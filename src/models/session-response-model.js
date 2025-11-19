import { pool } from '../db.js';

/**
 * Session Response Model - CRUD operations for session_responses table
 */
export class SessionResponseModel {
  /**
   * Create or update a response (upsert)
   */
  static async upsert(responseData) {
    const {
      question_id,
      user_id,
      response_text,
      response_option
    } = responseData;

    if (!question_id || !user_id) {
      throw new Error('question_id and user_id are required');
    }

    const result = await pool.query(
      `INSERT INTO session_responses 
       (question_id, user_id, response_text, response_option)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (question_id, user_id)
       DO UPDATE SET
         response_text = EXCLUDED.response_text,
         response_option = EXCLUDED.response_option,
         updated_at = NOW()
       RETURNING *`,
      [question_id, user_id, response_text, response_option]
    );

    return result.rows[0];
  }

  /**
   * Create a new response
   */
  static async create(responseData) {
    const {
      question_id,
      user_id,
      response_text,
      response_option
    } = responseData;

    if (!question_id || !user_id) {
      throw new Error('question_id and user_id are required');
    }

    const result = await pool.query(
      `INSERT INTO session_responses 
       (question_id, user_id, response_text, response_option)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [question_id, user_id, response_text, response_option]
    );

    return result.rows[0];
  }

  /**
   * Submit multiple responses at once
   */
  static async createMany(responses) {
    if (!responses || responses.length === 0) {
      return [];
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdResponses = [];
      for (const response of responses) {
        if (!response.question_id || !response.user_id) {
          throw new Error('question_id and user_id are required for all responses');
        }

        const result = await client.query(
          `INSERT INTO session_responses 
           (question_id, user_id, response_text, response_option)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (question_id, user_id)
           DO UPDATE SET
             response_text = EXCLUDED.response_text,
             response_option = EXCLUDED.response_option,
             updated_at = NOW()
           RETURNING *`,
          [
            response.question_id,
            response.user_id,
            response.response_text,
            response.response_option
          ]
        );
        createdResponses.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return createdResponses;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get response by ID
   */
  static async findById(responseId) {
    const result = await pool.query(
      `SELECT sr.*,
              sq.question_text,
              sq.question_type,
              sq.session_id,
              u.name as user_name,
              u.email as user_email
       FROM session_responses sr
       LEFT JOIN session_questions sq ON sr.question_id = sq.id
       LEFT JOIN users u ON sr.user_id = u.id
       WHERE sr.id = $1`,
      [responseId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get user's response to a specific question
   */
  static async findByQuestionAndUser(questionId, userId) {
    const result = await pool.query(
      `SELECT sr.*,
              sq.question_text,
              sq.question_type,
              sq.session_id
       FROM session_responses sr
       LEFT JOIN session_questions sq ON sr.question_id = sq.id
       WHERE sr.question_id = $1 AND sr.user_id = $2`,
      [questionId, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all responses for a question
   * Includes team information for better student identification
   */
  static async findByQuestionId(questionId) {
    const result = await pool.query(
      `SELECT sr.*,
              u.name as user_name,
              u.email as user_email,
              u.ucsd_pid,
              COALESCE(
                (SELECT t.name 
                 FROM team_members tm
                 INNER JOIN team t ON tm.team_id = t.id
                 WHERE tm.user_id = sr.user_id 
                   AND tm.left_at IS NULL
                 LIMIT 1),
                'No team'
              ) as team_name
       FROM session_responses sr
       LEFT JOIN users u ON sr.user_id = u.id
       WHERE sr.question_id = $1
       ORDER BY sr.submitted_at ASC`,
      [questionId]
    );

    return result.rows;
  }

  /**
   * Get all responses for a session (join through session_questions)
   * Includes team information for better student identification
   */
  static async findBySessionId(sessionId) {
    const result = await pool.query(
      `SELECT sr.*,
              sq.question_text,
              sq.question_type,
              sq.question_order,
              u.name as user_name,
              u.email as user_email,
              u.ucsd_pid,
              COALESCE(
                (SELECT t.name 
                 FROM team_members tm
                 INNER JOIN team t ON tm.team_id = t.id
                 WHERE tm.user_id = sr.user_id 
                   AND tm.left_at IS NULL
                 LIMIT 1),
                'No team'
              ) as team_name
       FROM session_responses sr
       INNER JOIN session_questions sq ON sr.question_id = sq.id
       LEFT JOIN users u ON sr.user_id = u.id
       WHERE sq.session_id = $1
       ORDER BY sq.question_order ASC, u.name ASC`,
      [sessionId]
    );

    return result.rows;
  }

  /**
   * Get user's responses for a session
   */
  static async findBySessionAndUser(sessionId, userId) {
    const result = await pool.query(
      `SELECT sr.*,
              sq.question_text,
              sq.question_type,
              sq.question_order
       FROM session_responses sr
       INNER JOIN session_questions sq ON sr.question_id = sq.id
       WHERE sq.session_id = $1 AND sr.user_id = $2
       ORDER BY sq.question_order ASC`,
      [sessionId, userId]
    );

    return result.rows;
  }

  /**
   * Get all responses by a user across all sessions
   */
  static async findByUserId(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await pool.query(
      `SELECT sr.*,
              sq.question_text,
              sq.question_type,
              sq.session_id,
              s.title as session_title,
              s.session_date
       FROM session_responses sr
       INNER JOIN session_questions sq ON sr.question_id = sq.id
       INNER JOIN sessions s ON sq.session_id = s.id
       WHERE sr.user_id = $1
       ORDER BY s.session_date DESC, sr.submitted_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Update response
   */
  static async update(responseId, updates) {
    const allowedFields = ['response_text', 'response_option'];

    const setFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(responseId);

    const query = `
      UPDATE session_responses
      SET ${setFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete response
   */
  static async delete(responseId) {
    const result = await pool.query(
      `DELETE FROM session_responses WHERE id = $1 RETURNING *`,
      [responseId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get response statistics for a session
   */
  static async getSessionStatistics(sessionId) {
    const result = await pool.query(
      `SELECT 
         sq.id as question_id,
         sq.question_text,
         sq.question_type,
         sq.question_order,
         COUNT(DISTINCT sr.user_id) as response_count,
         CASE 
           WHEN sq.question_type = 'multiple_choice' THEN
             json_object_agg(sr.response_option, option_counts.count)
           ELSE NULL
         END as option_breakdown
       FROM session_questions sq
       LEFT JOIN session_responses sr ON sq.id = sr.question_id
       LEFT JOIN LATERAL (
         SELECT response_option, COUNT(*) as count
         FROM session_responses
         WHERE question_id = sq.id
         GROUP BY response_option
       ) option_counts ON true
       WHERE sq.session_id = $1
       GROUP BY sq.id
       ORDER BY sq.question_order ASC`,
      [sessionId]
    );

    return result.rows;
  }

  /**
   * Check if user has responded to all required questions in a session
   */
  static async hasCompletedRequired(sessionId, userId) {
    const result = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE sq.is_required = true) as required_count,
         COUNT(*) FILTER (WHERE sq.is_required = true AND sr.id IS NOT NULL) as completed_count
       FROM session_questions sq
       LEFT JOIN session_responses sr ON sq.id = sr.question_id AND sr.user_id = $2
       WHERE sq.session_id = $1`,
      [sessionId, userId]
    );

    const stats = result.rows[0];
    return stats.required_count === stats.completed_count;
  }
}
