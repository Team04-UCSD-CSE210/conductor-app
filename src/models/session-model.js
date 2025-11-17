import { pool } from '../db.js';

/**
 * Session Model - CRUD operations for sessions table
 */
export class SessionModel {
  /**
   * Create a new session
   */
  static async create(sessionData) {
    const {
      offering_id,
      title,
      description,
      session_date,
      session_time,
      access_code,
      code_expires_at,
      is_active = true,
      created_by
    } = sessionData;

    const result = await pool.query(
      `INSERT INTO sessions 
       (offering_id, title, description, session_date, session_time, 
        access_code, code_expires_at, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING *`,
      [offering_id, title, description, session_date, session_time, 
       access_code, code_expires_at, is_active, created_by]
    );

    return result.rows[0];
  }

  /**
   * Get session by ID
   */
  static async findById(sessionId) {
    const result = await pool.query(
      `SELECT s.*, 
              co.name as course_name,
              co.code as course_code,
              u.name as creator_name
       FROM sessions s
       LEFT JOIN course_offerings co ON s.offering_id = co.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [sessionId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get session by access code
   */
  static async findByAccessCode(accessCode) {
    const result = await pool.query(
      `SELECT s.*,
              co.name as course_name,
              co.code as course_code
       FROM sessions s
       LEFT JOIN course_offerings co ON s.offering_id = co.id
       WHERE s.access_code = $1`,
      [accessCode]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all sessions for a course offering
   */
  static async findByOfferingId(offeringId, options = {}) {
    const { limit = 50, offset = 0, is_active } = options;

    let query = `
      SELECT s.*,
             COUNT(DISTINCT a.user_id) as attendance_count,
             COUNT(DISTINCT sr.user_id) as response_count
      FROM sessions s
      LEFT JOIN attendance a ON s.id = a.session_id AND a.status = 'present'
      LEFT JOIN session_responses sr ON s.id IN (
        SELECT sq.session_id FROM session_questions sq WHERE sq.id = sr.question_id
      )
      WHERE s.offering_id = $1
    `;

    const params = [offeringId];
    let paramIndex = 2;

    if (is_active !== undefined) {
      query += ` AND s.is_active = $${paramIndex}`;
      params.push(is_active);
      paramIndex++;
    }

    query += `
      GROUP BY s.id
      ORDER BY s.session_date DESC, s.session_time DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update session
   */
  static async update(sessionId, updates, updatedBy) {
    const allowedFields = [
      'title', 'description', 'session_date', 'session_time',
      'access_code', 'code_expires_at', 'is_active',
      'attendance_opened_at', 'attendance_closed_at'
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

    values.push(sessionId);

    const query = `
      UPDATE sessions
      SET ${setFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Open attendance for a session
   */
  static async openAttendance(sessionId, updatedBy) {
    const result = await pool.query(
      `UPDATE sessions
       SET attendance_opened_at = NOW(),
           attendance_closed_at = NULL,
           is_active = true,
           updated_by = $2
       WHERE id = $1
       RETURNING *`,
      [sessionId, updatedBy]
    );

    return result.rows[0] || null;
  }

  /**
   * Close attendance for a session
   */
  static async closeAttendance(sessionId, updatedBy) {
    const result = await pool.query(
      `UPDATE sessions
       SET attendance_closed_at = NOW(),
           updated_by = $2
       WHERE id = $1
       RETURNING *`,
      [sessionId, updatedBy]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete session
   */
  static async delete(sessionId) {
    const result = await pool.query(
      `DELETE FROM sessions WHERE id = $1 RETURNING *`,
      [sessionId]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if access code is unique
   */
  static async isAccessCodeUnique(accessCode, excludeSessionId = null) {
    let query = 'SELECT id FROM sessions WHERE access_code = $1';
    const params = [accessCode];

    if (excludeSessionId) {
      query += ' AND id != $2';
      params.push(excludeSessionId);
    }

    const result = await pool.query(query, params);
    return result.rows.length === 0;
  }

  /**
   * Get session statistics
   */
  static async getStatistics(sessionId) {
    const result = await pool.query(
      `SELECT 
         s.id,
         s.title,
         s.session_date,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'present') as present_count,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'absent') as absent_count,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'late') as late_count,
         COUNT(DISTINCT a.user_id) as total_attendance_records,
         COUNT(DISTINCT sq.id) as question_count,
         COUNT(DISTINCT sr.id) as response_count,
         (SELECT COUNT(*) FROM enrollments 
          WHERE offering_id = s.offering_id 
          AND status = 'enrolled' 
          AND course_role = 'student') as enrolled_students
       FROM sessions s
       LEFT JOIN attendance a ON s.id = a.session_id
       LEFT JOIN session_questions sq ON s.id = sq.session_id
       LEFT JOIN session_responses sr ON sq.id = sr.question_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [sessionId]
    );

    return result.rows[0] || null;
  }
}
