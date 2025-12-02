import { pool } from '../db.js';

/**
 * TAJournalLog Model - CRUD operations for ta_journal_logs table
 */
export class TAJournalModel {
  static async upsert(journalData) {
    const {
      user_id,
      date,
      interactions,
      groups_with_concerns,
      students_to_reach
    } = journalData;

    const result = await pool.query(
      `INSERT INTO ta_journal_logs
       (user_id, date, interactions, groups_with_concerns, students_to_reach)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         interactions = EXCLUDED.interactions,
         groups_with_concerns = EXCLUDED.groups_with_concerns,
         students_to_reach = EXCLUDED.students_to_reach,
         updated_at = NOW()
       RETURNING *`,
      [user_id, date, interactions, groups_with_concerns, students_to_reach]
    );

    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT taj.*, u.name AS user_name, u.email AS user_email
       FROM ta_journal_logs taj
       LEFT JOIN users u ON taj.user_id = u.id
       WHERE taj.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  static async findByUser(userId, options = {}) {
    const { startDate, endDate, limit = 50, offset = 0 } = options;

    let query = `
      SELECT taj.*, u.name AS user_name, u.email AS user_email
      FROM ta_journal_logs taj
      LEFT JOIN users u ON taj.user_id = u.id
      WHERE taj.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND taj.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND taj.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += `
      ORDER BY taj.date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id, journalData) {
    const { interactions, groups_with_concerns, students_to_reach } = journalData;

    const result = await pool.query(
      `UPDATE ta_journal_logs
       SET interactions = $1,
           groups_with_concerns = $2,
           students_to_reach = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [interactions, groups_with_concerns, students_to_reach, id]
    );

    return result.rows[0] || null;
  }

  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM ta_journal_logs WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }
}
