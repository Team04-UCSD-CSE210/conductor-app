import { Router } from 'express';
import { pool } from '../db.js';
import { protectAny } from '../middleware/permission-middleware.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

/**
 * Get active course offering
 * GET /api/offerings/active
 * Requires: Authentication
 */
router.get('/active', ensureAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM course_offerings 
       WHERE is_active = TRUE 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active course offering found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching active offering:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all offerings (for query with is_active)
 * GET /api/offerings?is_active=true
 * Requires: Authentication
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { is_active, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM course_offerings WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching offerings:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get offering details
 * GET /api/offerings/:offeringId
 * Requires: roster.view or course.manage permission (course scope)
 */
router.get('/:offeringId', ...protectAny(['roster.view', 'course.manage'], 'course'), async (req, res) => {
  try {
    const { offeringId } = req.params;

    const result = await pool.query(
      `SELECT 
        co.*,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role::text = 'student' AND e.status = 'enrolled') as student_count,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role::text = 'ta' AND e.status = 'enrolled') as ta_count,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role::text = 'tutor' AND e.status = 'enrolled') as tutor_count,
        COUNT(DISTINCT t.id) as team_count
      FROM course_offerings co
      LEFT JOIN enrollments e ON co.id = e.offering_id
      LEFT JOIN team t ON co.id = t.offering_id
      WHERE co.id = $1
      GROUP BY co.id`,
      [offeringId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offering not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching offering:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get offering statistics
 * GET /api/offerings/:offeringId/stats
 * Requires: roster.view or course.manage permission (course scope)
 */
router.get('/:offeringId/stats', ...protectAny(['roster.view', 'course.manage'], 'course'), async (req, res) => {
  try {
    const { offeringId } = req.params;

    // Get enrollment stats by role
    const enrollmentStats = await pool.query(
      `SELECT 
        course_role,
        status,
        COUNT(*) as count
      FROM enrollments
      WHERE offering_id = $1
      GROUP BY course_role, status`,
      [offeringId]
    );

    // Get team stats
    const teamStats = await pool.query(
      `SELECT 
        status,
        COUNT(*) as count
      FROM team
      WHERE offering_id = $1
      GROUP BY status`,
      [offeringId]
    );

    // Get total team members
    const teamMemberCount = await pool.query(
      `SELECT COUNT(DISTINCT tm.user_id) as count
       FROM team_members tm
       INNER JOIN team t ON tm.team_id = t.id
       WHERE t.offering_id = $1 AND tm.left_at IS NULL`,
      [offeringId]
    );

    res.json({
      enrollments: enrollmentStats.rows,
      teams: teamStats.rows,
      total_team_members: parseInt(teamMemberCount.rows[0]?.count || 0)
    });
  } catch (err) {
    console.error('Error fetching offering stats:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

