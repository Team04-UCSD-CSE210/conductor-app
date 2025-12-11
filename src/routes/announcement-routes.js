import { Router } from 'express';
import { AnnouncementService } from '../services/announcement-service.js';
import { protect } from '../middleware/permission-middleware.js';
import { PermissionService } from '../services/permission-service.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

/**
 * Create a new announcement
 * POST /api/announcements
 * Body: { offering_id, subject, message, team_id? }
 * Requires: announcement.create permission (course scope for course-wide, team scope for team announcements)
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id, team_id } = req.body;
    const userId = req.currentUser.id;
    const { pool } = await import('../db.js');

    // Determine user's role in this offering
    const enrollmentCheck = await pool.query(
      `SELECT course_role FROM enrollments 
       WHERE offering_id = $1 AND user_id = $2 AND status = 'enrolled'::enrollment_status_enum
       LIMIT 1`,
      [offering_id, userId]
    );
    const enrollmentRole = enrollmentCheck.rows[0]?.course_role;
    const primaryRole = req.currentUser.primary_role;

    // Check if user is instructor or TA (can create course-wide announcements)
    const isInstructorOrTA = primaryRole === 'instructor' || 
                             enrollmentRole === 'ta' || 
                             enrollmentRole === 'tutor' ||
                             (primaryRole === 'student' && (enrollmentRole === 'ta' || enrollmentRole === 'tutor'));

    // Check if user is team lead (supports multiple leaders via leader_ids and team_members.role)
    // For team announcements, we'll check team leadership when team_id is provided
    let isTeamLead = enrollmentRole === 'team-lead';

    // Enforce announcement type based on user role
    if (isInstructorOrTA) {
      // Instructors/TAs can ONLY create course-wide announcements (visible to everyone)
      if (team_id) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Instructors and TAs can only create course-wide announcements visible to everyone'
        });
      }
      // Force team_id to null for course-wide announcements
      req.body.team_id = null;
      
      // Check course-level permission
      const hasPermission = await PermissionService.hasPermission(
        userId,
        'announcement.create',
        offering_id,
        null
      );
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have permission to create course-wide announcements'
        });
      }
    } else if (isTeamLead) {
      // Team leads can ONLY create team announcements (visible only to their team)
      if (!team_id) {
        return res.status(400).json({ 
          error: 'Bad Request',
          message: 'Team leads must create team-specific announcements'
        });
      }
      
      // Sync leader_ids
      const { syncTeamLeaderIds } = await import('../utils/team-leader-sync.js');
      await syncTeamLeaderIds(team_id);
      
      // Verify user is a team lead (supports multiple leaders via leader_ids array and team_members.role)
      const teamCheck = await pool.query(
        `SELECT 1 
         FROM team t
         LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $2 AND tm.left_at IS NULL
         WHERE t.id = $1 
           AND t.offering_id = $3
           AND ($2 = ANY(COALESCE(t.leader_ids, ARRAY[]::UUID[])) OR tm.role = 'leader'::team_member_role_enum)
         LIMIT 1`,
        [team_id, userId, offering_id]
      );
      
      if (teamCheck.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You must be a team lead of the specified team to create team announcements'
        });
      }
    } else {
      // Other users cannot create announcements
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to create announcements'
      });
    }

    const announcement = await AnnouncementService.createAnnouncement(
      req.body,
      userId
    );
    res.status(201).json(announcement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all announcements for a course offering
 * GET /api/announcements?offering_id=<uuid>&limit=<number>&offset=<number>
 * Requires: Authentication and enrollment in the offering (or team membership for team leads)
 * Returns: All announcements (for instructors/TAs) or user-visible announcements (for students/team leads)
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id, limit, offset } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id is required' });
    }

    const userId = req.currentUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is enrolled or is a team member/leader
    const { pool } = await import('../db.js');
    let isEnrolled = false;
    
    // Check regular enrollment
    const enrollmentCheck = await pool.query(
      `SELECT 1 FROM enrollments 
       WHERE offering_id = $1 AND user_id = $2 AND status = 'enrolled' 
       LIMIT 1`,
      [offering_id, userId]
    );
    isEnrolled = enrollmentCheck.rows.length > 0;
    
    // If not enrolled, check if user is a team member or team leader
    if (!isEnrolled) {
      const teamMemberCheck = await pool.query(
        `SELECT 1 FROM team_members tm
         INNER JOIN team t ON tm.team_id = t.id
         WHERE t.offering_id = $1 AND tm.user_id = $2 AND tm.left_at IS NULL
         LIMIT 1`,
        [offering_id, userId]
      );
      if (teamMemberCheck.rows.length > 0) {
        isEnrolled = true;
      } else {
        // Also check if user is a team leader (supports multiple leaders)
        const teamLeaderCheck = await pool.query(
          `SELECT 1 FROM team t
           LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $2 AND tm.left_at IS NULL
           WHERE t.offering_id = $1 AND ($2 = ANY(COALESCE(t.leader_ids, ARRAY[]::UUID[])) OR tm.role = 'leader'::team_member_role_enum)
           LIMIT 1`,
          [offering_id, userId]
        );
        isEnrolled = teamLeaderCheck.rows.length > 0;
      }
    }

    if (!isEnrolled) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be enrolled in this course to view announcements'
      });
    }

    const options = {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      order: 'created_at DESC'
    };

    // Students and team leads see course-wide + their team's announcements
    // Instructors/TAs/Tutors see only course-wide announcements (no team-specific)
    const userRole = req.currentUser.primary_role;
    let announcements;
    
    // Check if user is a team lead (check enrollment_role from database)
    let isTeamLead = false;
    const teamLeadCheck = await pool.query(
      `SELECT 1 FROM enrollments 
       WHERE offering_id = $1 AND user_id = $2 
         AND course_role = 'team-lead'::enrollment_role_enum
         AND status = 'enrolled'::enrollment_status_enum
       LIMIT 1`,
      [offering_id, userId]
    );
    isTeamLead = teamLeadCheck.rows.length > 0;
    
    if (userRole === 'student' || userRole === 'unregistered' || isTeamLead) {
      announcements = await AnnouncementService.getAnnouncementsForUser(
        offering_id,
        req.currentUser.id,
        options
      );
    } else {
      // Get all announcements and filter to course-wide only
      const allAnnouncements = await AnnouncementService.getAnnouncementsByOffering(
        offering_id,
        options
      );
      announcements = allAnnouncements.filter(a => a.team_id === null);
    }

    // Disable caching to ensure fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json(announcements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get recent announcements for a course offering
 * GET /api/announcements/recent?offering_id=<uuid>&limit=<number>
 * Requires: announcement.view permission (course scope) - All authenticated users
 * Returns: Course-wide announcements only for instructors/TAs/tutors, filtered for students
 */
router.get('/recent', ...protect('announcement.view', 'course'), async (req, res) => {
  try {
    const { offering_id, limit } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id is required' });
    }

    const userRole = req.currentUser.primary_role;
    let announcements;

    if (userRole === 'student' || userRole === 'unregistered') {
      // Students see all recent (will be filtered by visibility in frontend/service if needed)
      announcements = await AnnouncementService.getRecentAnnouncements(
        offering_id,
        limit ? Number(limit) : 5
      );
    } else {
      // Instructors/TAs/Tutors see only course-wide recent announcements
      announcements = await AnnouncementService.getRecentCourseWideAnnouncements(
        offering_id,
        limit ? Number(limit) : 5
      );
    }

    res.json(announcements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get announcement by ID
 * GET /api/announcements/:id
 * Requires: announcement.view permission (course scope) - All authenticated users
 */
router.get('/:id', ...protect('announcement.view', 'course'), async (req, res) => {
  try {
    const announcement = await AnnouncementService.getAnnouncement(req.params.id);
    res.json(announcement);
  } catch (err) {
    if (err.message === 'Announcement not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update an announcement
 * PUT /api/announcements/:id
 * Body: { subject?, message? }
 * Requires: announcement.manage permission (course scope for course-wide, team scope for team announcements)
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const announcementId = req.params.id;

    // Get the announcement to check its team_id and offering_id
    const announcement = await AnnouncementService.getAnnouncement(announcementId);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Each person can only edit/delete their own announcements
    // Check if the user created this announcement
    if (announcement.created_by !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only edit your own announcements'
      });
    }

    // Additional validation: For team announcements, ensure user is still a team member/lead
    if (announcement.team_id) {
      const { pool } = await import('../db.js');
      // Sync leader_ids
      const { syncTeamLeaderIds } = await import('../utils/team-leader-sync.js');
      await syncTeamLeaderIds(announcement.team_id);
      
      // Check if user is team lead (supports multiple leaders)
      const teamCheck = await pool.query(
        `SELECT 1 
         FROM team t
         LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $2 AND tm.left_at IS NULL
         WHERE t.id = $1 
           AND t.offering_id = $3
           AND ($2 = ANY(COALESCE(t.leader_ids, ARRAY[]::UUID[])) OR tm.role = 'leader'::team_member_role_enum)
         LIMIT 1`,
        [announcement.team_id, userId, announcement.offering_id]
      );
      if (teamCheck.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You must be a team lead to edit team announcements'
        });
      }
    }

    const updated = await AnnouncementService.updateAnnouncement(
      announcementId,
      req.body
    );

    res.json(updated);
  } catch (err) {
    if (err.message === 'Announcement not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete an announcement
 * DELETE /api/announcements/:id
 * Requires: announcement.manage permission (course scope for course-wide, team scope for team announcements)
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const announcementId = req.params.id;

    // Get the announcement to check its team_id and offering_id
    const announcement = await AnnouncementService.getAnnouncement(announcementId);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Each person can only edit/delete their own announcements
    // Check if the user created this announcement
    if (announcement.created_by !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only delete your own announcements'
      });
    }

    // Additional validation: For team announcements, ensure user is still a team member/lead
    if (announcement.team_id) {
      const { pool } = await import('../db.js');
      // Sync leader_ids
      const { syncTeamLeaderIds } = await import('../utils/team-leader-sync.js');
      await syncTeamLeaderIds(announcement.team_id);
      
      // Check if user is team lead (supports multiple leaders)
      const teamCheck = await pool.query(
        `SELECT 1 
         FROM team t
         LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $2 AND tm.left_at IS NULL
         WHERE t.id = $1 
           AND t.offering_id = $3
           AND ($2 = ANY(COALESCE(t.leader_ids, ARRAY[]::UUID[])) OR tm.role = 'leader'::team_member_role_enum)
         LIMIT 1`,
        [announcement.team_id, userId, announcement.offering_id]
      );
      if (teamCheck.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You must be a team lead to delete team announcements'
        });
      }
    }

    await AnnouncementService.deleteAnnouncement(announcementId);

    res.json({ deleted: true });
  } catch (err) {
    if (err.message === 'Announcement not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

export default router;
