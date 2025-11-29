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

    // Get current user's role for filtering
    const email = req.user?.emails?.[0]?.value;
    const currentUser = email ? await pool.query('SELECT * FROM users WHERE email = $1', [email]).then(r => r.rows[0]) : null;
    const currentUserRole = currentUser ? await pool.query(
      'SELECT course_role FROM enrollments WHERE user_id = $1 AND offering_id = $2',
      [currentUser.id, offering_id]
    ).then(r => r.rows[0]?.course_role) : 'student';

    // Base query for detailed user information
    const baseUserQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.preferred_name,
        u.email,
        u.phone_number as phone,
        u.pronouns,
        u.availability,
        u.social_links,
        u.last_activity,
        u.image_url as profile_picture,
        e.course_role,
        u.primary_role
      FROM users u
      INNER JOIN enrollments e ON u.id = e.user_id
      WHERE e.offering_id = $1::uuid 
        AND e.status = 'enrolled'::enrollment_status_enum
    `;

    // Get professors (instructors) - simplified query
    const professorsQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.preferred_name,
        u.email,
        u.phone_number as phone,
        u.pronouns,
        u.availability,
        u.social_links,
        u.last_activity,
        u.image_url as profile_picture,
        'instructor' as course_role,
        u.primary_role
      FROM users u
      WHERE u.primary_role = 'instructor'
        AND (u.status = 'active' OR u.status IS NULL)
      ORDER BY u.name
    `;

    // Get TAs
    const tasQuery = baseUserQuery + `
        AND e.course_role = 'ta'::enrollment_role_enum
      ORDER BY u.name
    `;

    // Get tutors
    const tutorsQuery = baseUserQuery + `
        AND e.course_role = 'tutor'::enrollment_role_enum
      ORDER BY u.name
    `;

    // Get students - filtered based on current user role
    let studentsQuery;
    if (currentUserRole === 'student') {
      // Students can't see other students
      studentsQuery = `SELECT NULL as id WHERE FALSE`; 
    } else {
      studentsQuery = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.preferred_name,
          u.email,
          u.phone,
          u.pronouns,
          u.availability,
          u.social_links,
          u.last_activity,
          u.profile_picture,
          e.course_role,
          u.primary_role,
          tm.team_id,
          t.name as team_name,
          tm.role as team_role,
          CASE WHEN tm.role = 'leader' THEN true ELSE false END as is_team_lead
        FROM users u
        INNER JOIN enrollments e ON u.id = e.user_id
        LEFT JOIN team_members tm ON u.id = tm.user_id
        LEFT JOIN team t ON tm.team_id = t.id AND t.offering_id = $1::uuid
        WHERE e.offering_id = $1::uuid 
          AND e.status = 'enrolled'::enrollment_status_enum
          AND e.course_role = 'student'::enrollment_role_enum
        ORDER BY u.name
      `;
    }

    // Get teams/groups with member information
    const groupsQuery = `
      SELECT 
        t.id,
        t.name,
        t.team_number,
        t.status,
        COUNT(tm.user_id) as member_count,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', u.id,
            'name', u.name,
            'preferred_name', u.preferred_name,
            'email', u.email,
            'role', tm.role,
            'is_lead', CASE WHEN tm.role = 'leader' THEN true ELSE false END
          ) ORDER BY u.name
        ) FILTER (WHERE u.id IS NOT NULL) as members
      FROM team t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN users u ON tm.user_id = u.id
      WHERE t.offering_id = $1::uuid
      GROUP BY t.id, t.name, t.team_number, t.status
      ORDER BY t.name
    `;

    // Execute queries
    const [professorsResult, tasResult, tutorsResult, studentsResult, groupsResult] = await Promise.all([
      pool.query(professorsQuery),
      pool.query(tasQuery, [offering_id]),
      pool.query(tutorsQuery, [offering_id]),
      currentUserRole === 'student' ? Promise.resolve({rows: []}) : pool.query(studentsQuery, [offering_id]),
      pool.query(groupsQuery, [offering_id])
    ]);

    // Process groups - no links since table doesn't have URL fields
    const groups = groupsResult.rows.map(group => ({
      ...group,
      links: [] // No links available in current schema
    }));

    const response = {
      professors: professorsResult.rows,
      tas: tasResult.rows,
      tutors: tutorsResult.rows,
      students: studentsResult.rows,
      groups: groups,
      current_user_role: currentUserRole
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

/**
 * Update user profile
 * PUT /api/class-directory/profile
 */
router.put('/profile', ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;
    const { preferred_name, phone, pronouns, availability, social_links, profile_picture } = req.body;

    const updateQuery = `
      UPDATE users 
      SET preferred_name = $1, phone_number = $2, pronouns = $3, availability = $4, 
          social_links = $5, image_url = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      preferred_name, phone, pronouns, availability, 
      JSON.stringify(social_links), profile_picture, userId
    ]);

    res.json({ success: true, user: result.rows[0] });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Get current user profile
 * GET /api/class-directory/my-profile
 */
router.get('/my-profile', ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(`
      SELECT id, name, preferred_name, email, phone_number as phone, pronouns, 
             availability, social_links, image_url as profile_picture, primary_role
      FROM users WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
