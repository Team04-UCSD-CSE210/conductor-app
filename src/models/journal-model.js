import { pool } from '../db.js';

/**
 * WorkJournalLog Model - CRUD operations for work_journal_logs table
 */
export class JournalModel {
  /**
   * Create journal entry
   */
  static async create(journalData) {
    const {
      user_id,
      date,
      done_since_yesterday,
      working_on_today,
      blockers,
      feelings
    } = journalData;

    const result = await pool.query(
      `INSERT INTO work_journal_logs
       (user_id, date, done_since_yesterday, working_on_today, blockers, feelings)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user_id,
        date,
        done_since_yesterday,
        working_on_today,
        blockers,
        feelings
      ]
    );

    return result.rows[0];
  }

  /**
   * Create or update journal entry (upsert using user_id + date)
   */
  static async upsert(journalData) {
    const {
      user_id,
      date,
      done_since_yesterday,
      working_on_today,
      blockers,
      feelings
    } = journalData;

    const result = await pool.query(
      `INSERT INTO work_journal_logs
       (user_id, date, done_since_yesterday, working_on_today, blockers, feelings)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         done_since_yesterday = EXCLUDED.done_since_yesterday,
         working_on_today = EXCLUDED.working_on_today,
         blockers = EXCLUDED.blockers,
         feelings = EXCLUDED.feelings,
         updated_at = NOW()
       RETURNING *`,
      [
        user_id,
        date,
        done_since_yesterday,
        working_on_today,
        blockers,
        feelings
      ]
    );

    return result.rows[0];
  }

  /**
   * Get journal entry by ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT wjl.*,
              u.name AS user_name,
              u.email AS user_email
       FROM work_journal_logs wjl
       LEFT JOIN users u ON wjl.user_id = u.id
       WHERE wjl.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get journal entry for specific user and date
   */
  static async findByUserAndDate(userId, date) {
    const result = await pool.query(
      `SELECT * FROM work_journal_logs
       WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all journal entries for a user
   */
  static async findByUser(userId, options = {}) {
    const { startDate, endDate, limit = 50, offset = 0 } = options;

    let query = `
      SELECT wjl.*, u.name AS user_name, u.email AS user_email
      FROM work_journal_logs wjl
      LEFT JOIN users u ON wjl.user_id = u.id
      WHERE wjl.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND wjl.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND wjl.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += `
      ORDER BY wjl.date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update journal entry
   */
  static async update(id, updates) {
    const allowedFields = [
      'done_since_yesterday',
      'working_on_today',
      'blockers',
      'feelings',
      'date'
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

    values.push(id);

    const query = `
      UPDATE work_journal_logs
      SET ${setFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete journal entry
   */
  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM work_journal_logs
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }
}
