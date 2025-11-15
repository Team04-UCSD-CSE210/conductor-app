import { Router } from 'express';
import { pool } from '../db.js';
import { protect } from '../middleware/permission-middleware.js';

const router = Router();

/**
 * Submit interaction report
 * POST /api/interactions
 * Body: { offering_id, team_id?, user_id?, interaction_type, notes }
 * Requires: course.manage permission (course scope)
 */
router.post('/', ...protect('course.manage', 'course'), async (req, res) => {
  try {
    const { offering_id, team_id, user_id, interaction_type, notes } = req.body;

    if (!offering_id || !interaction_type || !notes) {
      return res.status(400).json({ 
        error: 'offering_id, interaction_type, and notes are required' 
      });
    }

    if (!team_id && !user_id) {
      return res.status(400).json({ 
        error: 'Either team_id or user_id must be provided' 
      });
    }

    // Create metadata object
    const metadata = {
      interaction_type, // 'positive' or 'negative'
      notes,
      team_id: team_id || null,
      user_id: user_id || null
    };

    // Use activity_logs table with action_type 'grade_submission' or create a new action type
    // For now, we'll use a generic action and store interaction details in metadata
    const result = await pool.query(
      `INSERT INTO activity_logs (user_id, offering_id, action_type, metadata)
       VALUES ($1, $2, 'grade_submission'::activity_action_type_enum, $3::jsonb)
       RETURNING *`,
      [req.currentUser.id, offering_id, JSON.stringify(metadata)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating interaction:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all interactions for an offering
 * GET /api/interactions?offering_id=:id
 * Requires: course.manage permission (course scope)
 */
router.get('/', ...protect('course.manage', 'course'), async (req, res) => {
  try {
    const { offering_id, team_id, user_id } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id query parameter is required' });
    }

    let query = `
      SELECT 
        al.id,
        al.created_at,
        al.metadata,
        u.name as created_by_name,
        u.email as created_by_email
      FROM activity_logs al
      INNER JOIN users u ON al.user_id = u.id
      WHERE al.offering_id = $1
        AND al.action_type = 'grade_submission'::activity_action_type_enum
        AND al.metadata->>'interaction_type' IS NOT NULL
    `;

    const params = [offering_id];
    let paramCount = 2;

    if (team_id) {
      query += ` AND al.metadata->>'team_id' = $${paramCount++}`;
      params.push(team_id);
    }

    if (user_id) {
      query += ` AND al.metadata->>'user_id' = $${paramCount++}`;
      params.push(user_id);
    }

    query += ` ORDER BY al.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ interactions: result.rows });
  } catch (err) {
    console.error('Error fetching interactions:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get interactions for a team
 * GET /api/interactions/team/:teamId
 * Requires: course.manage permission (course scope)
 */
router.get('/team/:teamId', ...protect('course.manage', 'course'), async (req, res) => {
  try {
    const { teamId } = req.params;

    const result = await pool.query(
      `SELECT 
        al.id,
        al.created_at,
        al.metadata,
        u.name as created_by_name,
        u.email as created_by_email
      FROM activity_logs al
      INNER JOIN users u ON al.user_id = u.id
      WHERE al.metadata->>'team_id' = $1
        AND al.action_type = 'grade_submission'::activity_action_type_enum
        AND al.metadata->>'interaction_type' IS NOT NULL
      ORDER BY al.created_at DESC`,
      [teamId]
    );

    res.json({ interactions: result.rows });
  } catch (err) {
    console.error('Error fetching team interactions:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get interactions for a student
 * GET /api/interactions/student/:userId
 * Requires: course.manage permission (course scope)
 */
router.get('/student/:userId', ...protect('course.manage', 'course'), async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT 
        al.id,
        al.created_at,
        al.metadata,
        u.name as created_by_name,
        u.email as created_by_email
      FROM activity_logs al
      INNER JOIN users u ON al.user_id = u.id
      WHERE al.metadata->>'user_id' = $1
        AND al.action_type = 'grade_submission'::activity_action_type_enum
        AND al.metadata->>'interaction_type' IS NOT NULL
      ORDER BY al.created_at DESC`,
      [userId]
    );

    res.json({ interactions: result.rows });
  } catch (err) {
    console.error('Error fetching student interactions:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

