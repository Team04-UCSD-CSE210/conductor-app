import { pool } from '../db.js';

/**
 * InstructorJournalLog Model - CRUD operations for instructor_journal_logs table
 */
export class InstructorJournalModel {
  /**
   * Create instructor journal entry
   */
  static async create(journalData) {
    const {
      user_id,
      date,
      interactions,
      team_concerns,
      class_wide_issues,
      overall_course
    } = journalData;

    const result = await pool.query(
      `INSERT INTO instructor_journal_logs
       (user_id, date, interactions, team_concerns, class_wide_issues, overall_course)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user_id,
        date,
        interactions,
        team_concerns,
        class_wide_issues,
        overall_course
      ]
    );

    return result.rows[0];
  }

  /**
   * Create or update instructor journal entry (upsert using user_id + date)
   */
  static async upsert(journalData) {
    const {
      user_id,
      date,
      interactions,
      team_concerns,
      class_wide_issues,
      overall_course
    } = journalData;

    const result = await pool.query(
      `INSERT INTO instructor_journal_logs
       (user_id, date, interactions, team_concerns, class_wide_issues, overall_course)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         interactions = EXCLUDED.interactions,
         team_concerns = EXCLUDED.team_concerns,
         class_wide_issues = EXCLUDED.class_wide_issues,
         overall_course = EXCLUDED.overall_course,
         updated_at = NOW()
       RETURNING *`,
      [
        user_id,
        date,
        interactions,
        team_concerns,
        class_wide_issues,
        overall_course
      ]
    );

    return result.rows[0];
  }

  /**
   * Get instructor journal entry by ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT ijl.*,
              u.name AS user_name,
              u.email AS user_email
       FROM instructor_journal_logs ijl
       LEFT JOIN users u ON ijl.user_id = u.id
       WHERE ijl.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get instructor journal entry by user and date
   */
  static async findByUserAndDate(userId, date) {
    const result = await pool.query(
      `SELECT * FROM instructor_journal_logs
       WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all instructor journal entries for a user
   */
  static async findByUser(userId, options = {}) {
    const { startDate, endDate, limit = 50, offset = 0 } = options;

    let query = `
      SELECT ijl.*, u.name AS user_name, u.email AS user_email
      FROM instructor_journal_logs ijl
      LEFT JOIN users u ON ijl.user_id = u.id
      WHERE ijl.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND ijl.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND ijl.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += `
      ORDER BY ijl.date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update instructor journal entry
   */
  static async update(id, journalData) {
    const {
      interactions,
      team_concerns,
      class_wide_issues,
      overall_course
    } = journalData;

    const result = await pool.query(
      `UPDATE instructor_journal_logs
       SET interactions = $1,
           team_concerns = $2,
           class_wide_issues = $3,
           overall_course = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [interactions, team_concerns, class_wide_issues, overall_course, id]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete instructor journal entry
   */
  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM instructor_journal_logs WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all instructor journal entries (admin only)
   */
  static async findAll(options = {}) {
    const { startDate, endDate, limit = 100, offset = 0 } = options;

    let query = `
      SELECT ijl.*, u.name AS user_name, u.email AS user_email
      FROM instructor_journal_logs ijl
      LEFT JOIN users u ON ijl.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND ijl.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND ijl.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += `
      ORDER BY ijl.date DESC, u.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }
}
