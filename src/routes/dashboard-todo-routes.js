import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

// Default todos for first-time student dashboard visits
const DEFAULT_STUDENT_TODOS = [
  'Review today\'s lecture notes',
  'Check upcoming assignment deadlines',
  'Sync with your team about project tasks',
  'Write a short journal entry about your progress'
];

// Helper: fetch or lazily create todos for current user
async function getOrCreateUserTodos(user) {
  const { id: userId, primary_role } = user;

  const existing = await pool.query(
    `SELECT id, title, is_completed, position
     FROM dashboard_todos
     WHERE user_id = $1
     ORDER BY position ASC, created_at ASC`,
    [userId]
  );

  // If user already has todos, just return them
  if (existing.rows.length > 0) {
    return existing.rows;
  }

  // For students only, seed default todos on first visit
  if (primary_role === 'student') {
    const valuesSqlParts = [];
    const params = [userId];

    DEFAULT_STUDENT_TODOS.forEach((title, index) => {
      // ($1 = userId, $2 = title, $3 = position) pattern, but offset params
      const baseIndex = params.length + 1;
      params.push(title, index);
      valuesSqlParts.push(`($1, $${baseIndex}, $${baseIndex + 1})`);
    });

    if (valuesSqlParts.length) {
      await pool.query(
        `INSERT INTO dashboard_todos (user_id, title, position)
         VALUES ${valuesSqlParts.join(', ')}`,
        params
      );
    }

    const created = await pool.query(
      `SELECT id, title, is_completed, position
       FROM dashboard_todos
       WHERE user_id = $1
       ORDER BY position ASC, created_at ASC`,
      [userId]
    );

    return created.rows;
  }

  // Non-students just start with empty list
  return [];
}

// Get current user's dashboard todos
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const todos = await getOrCreateUserTodos(user);
    res.json({ todos });
  } catch (error) {
    console.error('Error fetching dashboard todos:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard todos' });
  }
});

// Create a new todo for current user
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { title } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    // Determine next position
    const positionResult = await pool.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_position
       FROM dashboard_todos
       WHERE user_id = $1`,
      [user.id]
    );
    const nextPosition = positionResult.rows[0]?.next_position ?? 0;

    const insert = await pool.query(
      `INSERT INTO dashboard_todos (user_id, title, position)
       VALUES ($1, $2, $3)
       RETURNING id, title, is_completed, position`,
      [user.id, title.trim(), nextPosition]
    );

    res.status(201).json(insert.rows[0]);
  } catch (error) {
    console.error('Error creating dashboard todo:', error);
    res.status(500).json({ error: 'Failed to create dashboard todo' });
  }
});

// Update an existing todo (title, completion, or position)
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { id } = req.params;
    const { title, is_completed, position } = req.body || {};

    // Build dynamic update
    const fields = [];
    const params = [user.id, id];

    if (typeof title === 'string') {
      fields.push(`title = $${params.length + 1}`);
      params.push(title.trim());
    }
    if (typeof is_completed === 'boolean') {
      fields.push(`is_completed = $${params.length + 1}`);
      params.push(is_completed);
    }
    if (typeof position === 'number' && Number.isFinite(position)) {
      fields.push(`position = $${params.length + 1}`);
      params.push(position);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const update = await pool.query(
      `UPDATE dashboard_todos
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING id, title, is_completed, position`,
      params
    );

    if (update.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json(update.rows[0]);
  } catch (error) {
    console.error('Error updating dashboard todo:', error);
    res.status(500).json({ error: 'Failed to update dashboard todo' });
  }
});

// Delete a todo
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM dashboard_todos
       WHERE user_id = $1 AND id = $2`,
      [user.id, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting dashboard todo:', error);
    res.status(500).json({ error: 'Failed to delete dashboard todo' });
  }
});

export default router;


