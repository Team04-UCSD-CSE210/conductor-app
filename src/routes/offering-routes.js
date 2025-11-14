import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

/**
 * Get offering details
 * GET /api/offerings/:offeringId
 * Requires: Authentication
 */
router.get('/:offeringId', ensureAuthenticated, async (req, res) => {
  try {
    const { offeringId } = req.params;

    const result = await pool.query(
      `SELECT 
        co.*,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role = 'student' AND e.status = 'enrolled') as student_count,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role = 'ta' AND e.status = 'enrolled') as ta_count,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role = 'tutor' AND e.status = 'enrolled') as tutor_count,
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
 * Requires: Authentication
 */
router.get('/:offeringId/stats', ensureAuthenticated, async (req, res) => {
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

