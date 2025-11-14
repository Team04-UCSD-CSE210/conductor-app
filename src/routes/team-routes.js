import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuthenticated, requireAdminOrInstructor } from '../middleware/auth.js';

const router = Router();

/**
 * Get all teams for an offering
 * GET /api/teams?offering_id=:id
 * Requires: Authentication
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id } = req.query;
    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id query parameter is required' });
    }

    const result = await pool.query(
      `SELECT 
        t.id,
        t.name,
        t.team_number,
        t.leader_id,
        t.status,
        t.formed_at,
        t.created_at,
        u.name as leader_name,
        u.email as leader_email,
        COUNT(tm.user_id) as member_count
      FROM team t
      LEFT JOIN users u ON t.leader_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.left_at IS NULL
      WHERE t.offering_id = $1
      GROUP BY t.id, t.name, t.team_number, t.leader_id, t.status, t.formed_at, t.created_at, u.name, u.email
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
 * Requires: Authentication
 */
router.get('/:teamId', ensureAuthenticated, async (req, res) => {
  try {
    const { teamId } = req.params;

    // Get team details
    const teamResult = await pool.query(
      `SELECT 
        t.*,
        u.name as leader_name,
        u.email as leader_email
      FROM team t
      LEFT JOIN users u ON t.leader_id = u.id
      WHERE t.id = $1`,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

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
      members: membersResult.rows
    });
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create a new team
 * POST /api/teams
 * Body: { offering_id, name, team_number, leader_id, status }
 * Requires: Admin or Instructor
 */
router.post('/', ensureAuthenticated, requireAdminOrInstructor, async (req, res) => {
  try {
    const { offering_id, name, team_number, leader_id, status = 'forming' } = req.body;
    
    if (!offering_id || !name) {
      return res.status(400).json({ error: 'offering_id and name are required' });
    }

    const result = await pool.query(
      `INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
       VALUES ($1, $2, $3, $4, $5::team_status_enum, CURRENT_DATE, $6)
       RETURNING *`,
      [offering_id, name, team_number || null, leader_id || null, status, req.currentUser.id]
    );

    // If leader_id is provided, add them as a member
    if (leader_id) {
      await pool.query(
        `INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
         VALUES ($1, $2, 'leader'::team_member_role_enum, CURRENT_DATE, $3)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [result.rows[0].id, leader_id, req.currentUser.id]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating team:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update team
 * PUT /api/teams/:teamId
 * Body: { name, team_number, leader_id, status }
 * Requires: Admin or Instructor
 */
router.put('/:teamId', ensureAuthenticated, requireAdminOrInstructor, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, team_number, leader_id, status } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (team_number !== undefined) {
      updates.push(`team_number = $${paramCount++}`);
      values.push(team_number);
    }
    if (leader_id !== undefined) {
      updates.push(`leader_id = $${paramCount++}`);
      values.push(leader_id);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}::team_status_enum`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_by = $${paramCount++}`);
    values.push(req.currentUser.id);
    values.push(teamId);

    const result = await pool.query(
      `UPDATE team SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating team:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete team
 * DELETE /api/teams/:teamId
 * Requires: Admin or Instructor
 */
router.delete('/:teamId', ensureAuthenticated, requireAdminOrInstructor, async (req, res) => {
  try {
    const { teamId } = req.params;

    const result = await pool.query('DELETE FROM team WHERE id = $1 RETURNING id', [teamId]);

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
 * Requires: Authentication
 */
router.get('/:teamId/members', ensureAuthenticated, async (req, res) => {
  try {
    const { teamId } = req.params;

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
 * Requires: Admin or Instructor
 */
router.post('/:teamId/members', ensureAuthenticated, requireAdminOrInstructor, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { user_id, role = 'member' } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
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
      [teamId, user_id, role, req.currentUser.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding team member:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Remove member from team
 * DELETE /api/teams/:teamId/members/:userId
 * Requires: Admin or Instructor
 */
router.delete('/:teamId/members/:userId', ensureAuthenticated, requireAdminOrInstructor, async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    const result = await pool.query(
      `UPDATE team_members 
       SET left_at = CURRENT_DATE, removed_by = $1
       WHERE team_id = $2 AND user_id = $3 AND left_at IS NULL
       RETURNING *`,
      [req.currentUser.id, teamId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found or already removed' });
    }

    res.json({ removed: true, member: result.rows[0] });
  } catch (err) {
    console.error('Error removing team member:', err);
    res.status(400).json({ error: err.message });
  }
});

export default router;

