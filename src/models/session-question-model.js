import { pool } from '../db.js';

/**
 * Session Question Model - CRUD operations for session_questions table
 */
export class SessionQuestionModel {
  /**
   * Create a new question for a session
   */
  static async create(questionData) {
    const {
      session_id,
      question_text,
      question_type,
      question_order,
      options,
      is_required = false,
      created_by
    } = questionData;

    const result = await pool.query(
      `INSERT INTO session_questions 
       (session_id, question_text, question_type, question_order, 
        options, is_required, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING *`,
      [session_id, question_text, question_type, question_order, 
       options, is_required, created_by]
    );

    return result.rows[0];
  }

  /**
   * Create multiple questions at once
   */
  static async createMany(questions, createdBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdQuestions = [];
      for (const question of questions) {
        const result = await client.query(
          `INSERT INTO session_questions 
           (session_id, question_text, question_type, question_order, 
            options, is_required, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
           RETURNING *`,
          [
            question.session_id,
            question.question_text,
            question.question_type,
            question.question_order,
            question.options,
            question.is_required ?? false,
            createdBy
          ]
        );
        createdQuestions.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return createdQuestions;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get question by ID
   */
  static async findById(questionId) {
    const result = await pool.query(
      `SELECT sq.*,
              s.title as session_title,
              s.session_date,
              COUNT(sr.id) as response_count
       FROM session_questions sq
       LEFT JOIN sessions s ON sq.session_id = s.id
       LEFT JOIN session_responses sr ON sq.id = sr.question_id
       WHERE sq.id = $1
       GROUP BY sq.id, s.id`,
      [questionId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all questions for a session
   */
  static async findBySessionId(sessionId) {
    const result = await pool.query(
      `SELECT sq.*,
              COUNT(sr.id) as response_count
       FROM session_questions sq
       LEFT JOIN session_responses sr ON sq.id = sr.question_id
       WHERE sq.session_id = $1
       GROUP BY sq.id
       ORDER BY sq.question_order ASC, sq.created_at ASC`,
      [sessionId]
    );

    return result.rows;
  }

  /**
   * Update question
   */
  static async update(questionId, updates, updatedBy) {
    const allowedFields = [
      'question_text', 'question_type', 'question_order',
      'options', 'is_required'
    ];

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

    setFields.push(`updated_by = $${paramIndex}`);
    values.push(updatedBy);
    paramIndex++;

    values.push(questionId);

    const query = `
      UPDATE session_questions
      SET ${setFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete question
   */
  static async delete(questionId) {
    const result = await pool.query(
      `DELETE FROM session_questions WHERE id = $1 RETURNING *`,
      [questionId]
    );

    return result.rows[0] || null;
  }

  /**
   * Reorder questions for a session
   */
  static async reorder(sessionId, questionOrders, updatedBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const { question_id, order } of questionOrders) {
        await client.query(
          `UPDATE session_questions 
           SET question_order = $1, updated_by = $2
           WHERE id = $3 AND session_id = $4`,
          [order, updatedBy, question_id, sessionId]
        );
      }

      await client.query('COMMIT');

      // Return all questions in new order
      const result = await client.query(
        `SELECT * FROM session_questions 
         WHERE session_id = $1 
         ORDER BY question_order ASC`,
        [sessionId]
      );

      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get question statistics
   */
  static async getStatistics(questionId) {
    const result = await pool.query(
      `SELECT 
         sq.id,
         sq.question_text,
         sq.question_type,
         COUNT(DISTINCT sr.user_id) as total_responses,
         COUNT(DISTINCT sr.id) as response_count,
         CASE 
           WHEN sq.question_type = 'multiple_choice' THEN
             json_agg(
               json_build_object(
                 'option', sr.response_option,
                 'count', COUNT(sr.id)
               )
             ) FILTER (WHERE sr.response_option IS NOT NULL)
           ELSE NULL
         END as option_breakdown
       FROM session_questions sq
       LEFT JOIN session_responses sr ON sq.id = sr.question_id
       WHERE sq.id = $1
       GROUP BY sq.id`,
      [questionId]
    );

    return result.rows[0] || null;
  }
}
