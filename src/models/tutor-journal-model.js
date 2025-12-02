import { pool } from '../db.js';

/**
 * TutorJournalLog Model - CRUD operations for tutor_journal_logs table
 */
export class TutorJournalModel {
  static async upsert(journalData) {
    const {
      user_id,
      date,
      students_helped,
      students_needing_attention,
      preparation
    } = journalData;

    const result = await pool.query(
      `INSERT INTO tutor_journal_logs
       (user_id, date, students_helped, students_needing_attention, preparation)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         students_helped = EXCLUDED.students_helped,
         students_needing_attention = EXCLUDED.students_needing_attention,
         preparation = EXCLUDED.preparation,
         updated_at = NOW()
       RETURNING *`,
      [user_id, date, students_helped, students_needing_attention, preparation]
    );

    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT tuj.*, u.name AS user_name, u.email AS user_email
       FROM tutor_journal_logs tuj
       LEFT JOIN users u ON tuj.user_id = u.id
       WHERE tuj.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  static async findByUser(userId, options = {}) {
    const { startDate, endDate, limit = 50, offset = 0 } = options;

    let query = `
      SELECT tuj.*, u.name AS user_name, u.email AS user_email
      FROM tutor_journal_logs tuj
      LEFT JOIN users u ON tuj.user_id = u.id
      WHERE tuj.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND tuj.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND tuj.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += `
      ORDER BY tuj.date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id, journalData) {
    const { students_helped, students_needing_attention, preparation } = journalData;

    const result = await pool.query(
      `UPDATE tutor_journal_logs
       SET students_helped = $1,
           students_needing_attention = $2,
           preparation = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [students_helped, students_needing_attention, preparation, id]
    );

    return result.rows[0] || null;
  }

  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM tutor_journal_logs WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }
}
