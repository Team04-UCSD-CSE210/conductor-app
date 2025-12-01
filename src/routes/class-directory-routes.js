import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

/**
 * Get class directory data for an offering
 * GET /api/class-directory?offering_id=:id
 * Returns professors, TAs, students, and groups with their details
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id } = req.query;
    
    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id query parameter is required' });
    }

    // Get professors (instructors)
    const professorsQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.pronouns,
        u.availability,
        u.social_links,
        u.last_activity,
        e.course_role,
        u.primary_role
      FROM users u
      INNER JOIN enrollments e ON u.id = e.user_id
      WHERE e.offering_id = $1::uuid 
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role = 'instructor'::enrollment_role_enum
      ORDER BY u.name
    `;

    // Get TAs
    const tasQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.pronouns,
        u.availability,
        u.social_links,
        u.last_activity,
        e.course_role,
        u.primary_role
      FROM users u
      INNER JOIN enrollments e ON u.id = e.user_id
      WHERE e.offering_id = $1::uuid 
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role = 'ta'::enrollment_role_enum
      ORDER BY u.name
    `;

    // Get students with team information
    const studentsQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.pronouns,
        u.availability,
        u.social_links,
        u.last_activity,
        e.course_role,
        u.primary_role,
        tm.team_id,
        t.name as team_name,
        tm.role as team_role
      FROM users u
      INNER JOIN enrollments e ON u.id = e.user_id
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN team t ON tm.team_id = t.id AND t.offering_id = $1::uuid
      WHERE e.offering_id = $1::uuid 
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role IN ('student'::enrollment_role_enum, 'tutor'::enrollment_role_enum)
      ORDER BY u.name
    `;

    // Get teams/groups with member information
    const groupsQuery = `
      SELECT 
        t.id,
        t.name,
        t.description as mantra,
        t.repository_url,
        t.slack_channel,
        t.status,
        COUNT(tm.user_id) as member_count,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'role', tm.role
          ) ORDER BY u.name
        ) FILTER (WHERE u.id IS NOT NULL) as members
      FROM team t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN users u ON tm.user_id = u.id
      WHERE t.offering_id = $1::uuid
      GROUP BY t.id, t.name, t.description, t.repository_url, t.slack_channel, t.status
      ORDER BY t.name
    `;

    // Execute all queries in parallel
    const [professorsResult, tasResult, studentsResult, groupsResult] = await Promise.all([
      pool.query(professorsQuery, [offering_id]),
      pool.query(tasQuery, [offering_id]),
      pool.query(studentsQuery, [offering_id]),
      pool.query(groupsQuery, [offering_id])
    ]);

    // Process groups to add links array
    const groups = groupsResult.rows.map(group => ({
      ...group,
      links: [
        group.repository_url && { name: 'Repository', url: group.repository_url },
        group.slack_channel && { name: 'Slack', url: group.slack_channel }
      ].filter(Boolean)
    }));

    const response = {
      professors: professorsResult.rows,
      tas: tasResult.rows,
      students: studentsResult.rows,
      groups: groups
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching class directory:', error);
    res.status(500).json({ error: 'Failed to fetch class directory data' });
  }
});

/**
 * Get user activity data for activity charts and attendance
 * GET /api/users/:userId/activity?days=30
 */
router.get('/users/:userId/activity', ensureAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily activity counts (interactions, attendance, etc.)
    const activityQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM (
        -- Interactions
        SELECT created_at FROM interactions WHERE user_id = $1::uuid AND created_at >= $2
        UNION ALL
        -- Attendance records
        SELECT created_at FROM attendance WHERE user_id = $1::uuid AND created_at >= $2
      ) combined_activity
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Get attendance summary
    const attendanceQuery = `
      SELECT 
        'Lectures' as type,
        COUNT(*) as count
      FROM attendance a
      INNER JOIN sessions s ON a.session_id = s.id
      WHERE a.user_id = $1::uuid 
        AND s.session_type = 'lecture'
        AND a.created_at >= $2
      UNION ALL
      SELECT 
        'Office Hours' as type,
        COUNT(*) as count
      FROM attendance a
      INNER JOIN sessions s ON a.session_id = s.id
      WHERE a.user_id = $1::uuid 
        AND s.session_type = 'office_hours'
        AND a.created_at >= $2
      UNION ALL
      SELECT 
        'Group Meetings' as type,
        COUNT(*) as count
      FROM attendance a
      INNER JOIN sessions s ON a.session_id = s.id
      WHERE a.user_id = $1::uuid 
        AND s.session_type = 'group_meeting'
        AND a.created_at >= $2
    `;

    const [activityResult, attendanceResult] = await Promise.all([
      pool.query(activityQuery, [userId, startDate]),
      pool.query(attendanceQuery, [userId, startDate])
    ]);

    // Convert attendance array to object
    const attendance = {};
    attendanceResult.rows.forEach(row => {
      attendance[row.type] = parseInt(row.count);
    });

    res.json({
      activity: activityResult.rows,
      attendance: attendance
    });

  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity data' });
  }
});

export default router;
