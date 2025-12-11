import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuthenticated } from '../middleware/auth.js';
import { PermissionService } from '../services/permission-service.js';
import { syncTeamLeaderIds } from '../utils/team-leader-sync.js';
import validator from 'validator';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'src/assets/team-logos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    let teamId = req.params.teamId;
    if (!validator.isUUID(teamId)) {
      teamId = 'invalid';
    }
    const sanitizedTeamId = teamId.replace(/[^a-zA-Z0-9-]/g, '');
    const ext = path.extname(file.originalname) || '';
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `team-${sanitizedTeamId}-${Date.now()}${safeExt}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Helper: load team with offering_id
 */
async function getTeamWithOffering(teamId) {
  const { rows } = await pool.query(
    `SELECT t.*, t.offering_id, COALESCE(t.leader_ids, ARRAY[]::UUID[]) as leader_ids
     FROM team t
     WHERE t.id = $1`,
    [teamId]
  );
  return rows[0] || null;
}


/**
 * Get current user's team for an offering
 * GET /api/teams/my-team?offering_id=:id
 * Access: Any authenticated user
 */
router.get('/my-team', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const { offering_id } = req.query;

    // Check both team membership and leadership
    const result = await pool.query(
      `SELECT DISTINCT
        t.id,
        t.name,
        t.team_number,
        COALESCE(t.leader_ids, ARRAY[]::UUID[]) as leader_ids,
        t.status,
        t.mantra,
        t.links,
        t.logo_url,
        t.created_at,
        t.offering_id
      FROM team t
      LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $1 AND tm.left_at IS NULL
      WHERE ($1 = ANY(COALESCE(t.leader_ids, ARRAY[]::UUID[])) OR tm.user_id = $1)
        ${offering_id ? 'AND t.offering_id = $2' : ''}
      ORDER BY t.team_number
      LIMIT 1`,
      offering_id ? [userId, offering_id] : [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User is not assigned to a team' });
    }

    res.json({ team: result.rows[0] });
  } catch (err) {
    console.error('Error fetching user team:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all teams for an offering
 * GET /api/teams?offering_id=:id
 * Access:
 *   - Users with team.view_all or course.manage for this offering
 *     (Instructor, TA, Tutor, Admin)
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id } = req.query;
    if (!offering_id) {
      return res
        .status(400)
        .json({ error: 'offering_id query parameter is required' });
    }

    const userId = req.currentUser.id;

    const [canViewAll, canManageCourse] = await Promise.all([
      PermissionService.hasPermission(userId, 'team.view_all', offering_id, null),
      PermissionService.hasPermission(userId, 'course.manage', offering_id, null),
    ]);

    if (!canViewAll && !canManageCourse) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const result = await pool.query(
      `SELECT 
        t.id,
        COALESCE(t.leader_ids, ARRAY[]::UUID[]) as leader_ids,
        t.name,
        t.team_number,
        t.status,
        t.formed_at,
        t.created_at,
        u.name as leader_name,
        u.email as leader_email,
        COUNT(tm.user_id) as member_count
      FROM team t
      LEFT JOIN users u ON (t.leader_ids IS NOT NULL AND array_length(t.leader_ids, 1) > 0 AND u.id = t.leader_ids[1])
      LEFT JOIN team_members tm
        ON t.id = tm.team_id AND tm.left_at IS NULL
      WHERE t.offering_id = $1
      GROUP BY
        t.id,
        t.name,
        t.team_number,
        t.leader_ids,
        t.status,
        t.formed_at,
        t.created_at,
        u.name,
        u.email
      ORDER BY t.team_number, t.name`,
      [offering_id]
    );

    res.json({ teams: result.rows });
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get team by ID with members
 * GET /api/teams/:teamId
 * Access:
 *   - Staff / tutor with team.view_all or course.manage for this offering
 *   - Team leads/members via team-role permissions or membership
 */
router.get('/:teamId', ensureAuthenticated, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.currentUser.id;

    const team = await getTeamWithOffering(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const offeringId = team.offering_id;

    // Course-level permissions (instructor / TA / tutor / admin)
    const [canViewAllCourse, canManageCourse] = await Promise.all([
      PermissionService.hasPermission(userId, 'team.view_all', offeringId, null),
      PermissionService.hasPermission(userId, 'course.manage', offeringId, null),
    ]);

    // Team-level permissions (team lead via team_role_permissions)
    const canViewAsTeamRole = await PermissionService.hasPermission(
      userId,
      'team.view_all',
      null,
      teamId
    );

    // Membership (any team member can view their own team)
    const { rows: membershipRows } = await pool.query(
      `SELECT 1
       FROM team_members
       WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [teamId, userId]
    );
    const isMember = membershipRows.length > 0;

    if (!canViewAllCourse && !canManageCourse && !canViewAsTeamRole && !isMember) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // Get leader info + full team details
    const teamResult = await pool.query(
      `SELECT 
        t.*,
        COALESCE(t.leader_ids, ARRAY[]::UUID[]) as leader_ids,
        u.name as leader_name,
        u.email as leader_email
      FROM team t
      LEFT JOIN users u ON (t.leader_ids IS NOT NULL AND array_length(t.leader_ids, 1) > 0 AND u.id = t.leader_ids[1])
      WHERE t.id = $1`,
      [teamId]
    );

    // Get team members
    const membersResult = await pool.query(
      `SELECT 
        tm.id,
        tm.role,
        tm.joined_at,
        u.id as user_id,
        u.name,
        u.email,
        u.image_url
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND tm.left_at IS NULL
      ORDER BY tm.joined_at`,
      [teamId]
    );

    res.json({
      ...teamResult.rows[0],
      members: membersResult.rows,
    });
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create a new team
 * POST /api/teams
 * Body: { offering_id, name, team_number, leader_ids (array), status }
 * Access:
 *   - Users with team.manage for this offering
 *     (Instructor, TA, Admin)
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id, name, team_number, leader_ids, status = 'forming' } = req.body;
    
    if (!offering_id || !name) {
      return res
        .status(400)
        .json({ error: 'offering_id and name are required' });
    }

    const userId = req.currentUser.id;

    const canManageTeams = await PermissionService.hasPermission(
      userId,
      'team.manage',
      offering_id,
      null
    );

    if (!canManageTeams) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // Ensure leader_ids is an array with at least one leader
    const leaderIdsArray = Array.isArray(leader_ids) && leader_ids.length > 0 ? leader_ids : [];
    if (leaderIdsArray.length === 0) {
      return res.status(400).json({ error: 'At least one leader is required' });
    }

    const result = await pool.query(
      `INSERT INTO team (offering_id, name, team_number, leader_ids, status, formed_at, created_by)
       VALUES ($1, $2, $3, $4::UUID[], $5::team_status_enum, CURRENT_DATE, $6)
       RETURNING *`,
      [offering_id, name, team_number || null, leaderIdsArray, status, userId]
    );

    const team = result.rows[0];

    // Add all leaders as team members with leader role
    for (const leaderId of leaderIdsArray) {
      await pool.query(
        `INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
         VALUES ($1, $2, 'leader'::team_member_role_enum, CURRENT_DATE, $3)
         ON CONFLICT (team_id, user_id) DO UPDATE SET
           role = 'leader'::team_member_role_enum,
           left_at = NULL`,
        [team.id, leaderId, userId]
      );
    }
    
    // Sync leader_ids array after adding leaders
    await syncTeamLeaderIds(team.id);
    
    // Refresh team data to include updated leader_ids
    const { rows: updatedTeamRows } = await pool.query(
      'SELECT *, COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids FROM team WHERE id = $1',
      [team.id]
    );
    if (updatedTeamRows.length > 0) {
      Object.assign(team, updatedTeamRows[0]);
    }

    res.status(201).json(team);
  } catch (err) {
    console.error('Error creating team:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update team
 * PUT /api/teams/:teamId
 * Body: { name, team_number, leader_ids (array), status, mantra, links } + optional logo file
 * Access:
 *   - team.manage for the offering (Instructor/TA/Admin), OR
 *   - team.manage at team scope (team lead)
 */
router.put('/:teamId', ensureAuthenticated, upload.single('logo'), async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.currentUser.id;
    const { name, mantra, links } = req.body;

    // Check if user is the leader of this team (simplified permission check)
    const { rows: teamRows } = await pool.query(
      'SELECT *, COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids FROM team WHERE id = $1',
      [teamId]
    );

    if (teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamRows[0];

    const offeringId = team.offering_id;
    
    const [canManageCourseTeam, canManageTeamRole] = await Promise.all([
      PermissionService.hasPermission(userId, 'team.manage', offeringId, null),
      PermissionService.hasPermission(userId, 'team.manage', null, teamId),
    ]);
    
    // Support multiple leaders: check team.leader_ids array and team_members.role = 'leader'
    const isInLeaderIds = team.leader_ids && Array.isArray(team.leader_ids) && team.leader_ids.includes(userId);
    
    const { rows: membershipRows } = await pool.query(
      `SELECT 1 FROM team_members 
       WHERE team_id = $1 AND user_id = $2 AND role = 'leader'::team_member_role_enum AND left_at IS NULL
       LIMIT 1`,
      [teamId, userId]
    );
    const isTeamLead = isInLeaderIds || membershipRows.length > 0;
    
    if (!canManageCourseTeam && !canManageTeamRole && !isTeamLead) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (mantra !== undefined) {
      updates.push(`mantra = $${paramCount++}`);
      values.push(mantra);
    }
    if (links !== undefined) {
      updates.push(`links = $${paramCount++}::jsonb`);
      values.push(typeof links === 'string' ? links : JSON.stringify(links));
    }
    if (req.file) {
      const logoUrl = `/assets/team-logos/${req.file.filename}`;
      updates.push(`logo_url = $${paramCount++}`);
      values.push(logoUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(teamId);

    const result = await pool.query(
      `UPDATE team
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *, COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Return the updated team with parsed links
    const updatedTeam = result.rows[0];
    if (updatedTeam.links && typeof updatedTeam.links === 'string') {
      try {
        updatedTeam.links = JSON.parse(updatedTeam.links);
      } catch {
        // Keep as string if parsing fails
      }
    }

    res.json(updatedTeam);
  } catch (err) {
    console.error('Error updating team:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete team
 * DELETE /api/teams/:teamId
 * Access:
 *   - team.manage for the offering (Instructor/TA/Admin), OR
 *   - team.manage at team scope (team lead)
 */
router.delete('/:teamId', ensureAuthenticated, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.currentUser.id;

    const team = await getTeamWithOffering(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const offeringId = team.offering_id;

    const [canManageCourseTeam, canManageTeamRole] = await Promise.all([
      PermissionService.hasPermission(userId, 'team.manage', offeringId, null),
      PermissionService.hasPermission(userId, 'team.manage', null, teamId),
    ]);

    if (!canManageCourseTeam && !canManageTeamRole) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const result = await pool.query(
      'DELETE FROM team WHERE id = $1 RETURNING id',
      [teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ deleted: true, id: teamId });
  } catch (err) {
    console.error('Error deleting team:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get team members
 * GET /api/teams/:teamId/members
 * Access:
 *   - Staff / tutor: team.view_all or course.manage (course scope)
 *   - Team leads/members: membership or team.view_all at team scope
 */
router.get('/:teamId/members', ensureAuthenticated, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.currentUser.id;

    const team = await getTeamWithOffering(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const offeringId = team.offering_id;

    const [canViewAllCourse, canManageCourse] = await Promise.all([
      PermissionService.hasPermission(userId, 'team.view_all', offeringId, null),
      PermissionService.hasPermission(userId, 'course.manage', offeringId, null),
    ]);

    const canViewAsTeamRole = await PermissionService.hasPermission(
      userId,
      'team.view_all',
      null,
      teamId
    );

    const { rows: membershipRows } = await pool.query(
      `SELECT 1
       FROM team_members
       WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [teamId, userId]
    );
    const isMember = membershipRows.length > 0;

    if (!canViewAllCourse && !canManageCourse && !canViewAsTeamRole && !isMember) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const result = await pool.query(
      `SELECT 
        tm.id,
        tm.role,
        tm.joined_at,
        tm.left_at,
        u.id as user_id,
        u.name,
        u.email,
        u.image_url,
        u.primary_role
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at`,
      [teamId]
    );

    res.json({ members: result.rows });
  } catch (err) {
    console.error('Error fetching team members:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Add member to team
 * POST /api/teams/:teamId/members
 * Body: { user_id, role }
 * Access:
 *   - team.manage for the offering (Instructor/TA/Admin), OR
 *   - team.manage at team scope (team lead)
 */
router.post('/:teamId/members', ensureAuthenticated, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { user_id, role = 'member' } = req.body;
    const userId = req.currentUser.id;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const team = await getTeamWithOffering(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const offeringId = team.offering_id;

    const [canManageCourseTeam, canManageTeamRole] = await Promise.all([
      PermissionService.hasPermission(userId, 'team.manage', offeringId, null),
      PermissionService.hasPermission(userId, 'team.manage', null, teamId),
    ]);

    if (!canManageCourseTeam && !canManageTeamRole) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
       VALUES ($1, $2, $3::team_member_role_enum, CURRENT_DATE, $4)
       ON CONFLICT (team_id, user_id) 
       DO UPDATE SET 
         role = EXCLUDED.role,
         joined_at = CURRENT_DATE,
         left_at = NULL,
         added_by = EXCLUDED.added_by
       RETURNING *`,
      [teamId, user_id, role, userId]
    );

    // Sync leader_ids array after adding/updating member (especially if role is 'leader')
    await syncTeamLeaderIds(teamId);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding team member:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Remove member from team
 * DELETE /api/teams/:teamId/members/:userId
 * Access:
 *   - team.manage for the offering (Instructor/TA/Admin), OR
 *   - team.manage at team scope (team lead)
 */
router.delete('/:teamId/members/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const { teamId, userId: targetUserId } = req.params;
    const actorId = req.currentUser.id;

    const team = await getTeamWithOffering(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const offeringId = team.offering_id;

    const [canManageCourseTeam, canManageTeamRole] = await Promise.all([
      PermissionService.hasPermission(actorId, 'team.manage', offeringId, null),
      PermissionService.hasPermission(actorId, 'team.manage', null, teamId),
    ]);

    if (!canManageCourseTeam && !canManageTeamRole) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const result = await pool.query(
      `UPDATE team_members 
       SET left_at = CURRENT_DATE, removed_by = $1
       WHERE team_id = $2 AND user_id = $3 AND left_at IS NULL
       RETURNING *`,
      [actorId, teamId, targetUserId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'Team member not found or already removed' });
    }

    // Sync leader_ids array after removing member (in case it was a leader)
    await syncTeamLeaderIds(teamId);

    res.json({ removed: true, member: result.rows[0] });
  } catch (err) {
    console.error('Error removing team member:', err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
