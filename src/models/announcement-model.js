import { pool } from '../db.js';

/**
 * AnnouncementModel - Database operations for announcements
 */
export class AnnouncementModel {
  /**
   * Create a new announcement
   * @param {Object} data - { offering_id, subject, message, created_by, team_id? }
   * @returns {Promise<Object>} Created announcement
   */
  static async create(data) {
    const { offering_id, subject, message, created_by, team_id } = data;

    const result = await pool.query(
      `INSERT INTO announcements (offering_id, subject, message, created_by, team_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [offering_id, subject, message, created_by, team_id || null]
    );

    return result.rows[0];
  }

  /**
   * Find announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise<Object|null>} Announcement or null
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT a.*, u.name as creator_name, u.email as creator_email
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all announcements for a course offering
   * @param {string} offeringId - Course offering ID
   * @param {Object} options - { limit, offset, order }
   * @returns {Promise<Array>} List of announcements
   */
  static async findByOffering(offeringId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      order = 'created_at DESC'
    } = options;

    const result = await pool.query(
      `SELECT a.*, u.name as creator_name, u.email as creator_email
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.offering_id = $1
       ORDER BY ${order}
       LIMIT $2 OFFSET $3`,
      [offeringId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Update an announcement
   * @param {string} id - Announcement ID
   * @param {Object} data - { subject?, message? }
   * @returns {Promise<Object|null>} Updated announcement or null
   */
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.subject !== undefined) {
      fields.push(`subject = $${paramIndex++}`);
      values.push(data.subject);
    }

    if (data.message !== undefined) {
      fields.push(`message = $${paramIndex++}`);
      values.push(data.message);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE announcements
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete an announcement
   * @param {string} id - Announcement ID
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM announcements WHERE id = $1 RETURNING id',
      [id]
    );

    return result.rowCount > 0;
  }

  /**
   * Count announcements for an offering
   * @param {string} offeringId - Course offering ID
   * @returns {Promise<number>} Count of announcements
   */
  static async count(offeringId) {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM announcements WHERE offering_id = $1',
      [offeringId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get recent announcements (last 7 days)
   * @param {string} offeringId - Course offering ID
   * @param {number} limit - Number of announcements to return
   * @returns {Promise<Array>} Recent announcements
   */
  static async getRecent(offeringId, limit = 5) {
    const result = await pool.query(
      `SELECT a.*, u.name as creator_name, u.email as creator_email
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.offering_id = $1
         AND a.created_at >= NOW() - INTERVAL '7 days'
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [offeringId, limit]
    );

    return result.rows;
  }

  /**
   * Get announcements visible to a user (course-wide + their team's)
   * @param {string} offeringId - Course offering ID
   * @param {string} userId - User ID
   * @param {Object} options - { limit, offset, order }
   * @returns {Promise<Array>} List of announcements
   */
  static async findVisibleToUser(offeringId, userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      order = 'created_at DESC'
    } = options;

    const result = await pool.query(
      `SELECT DISTINCT a.*, u.name as creator_name, u.email as creator_email,
              t.name as team_name
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       LEFT JOIN team t ON a.team_id = t.id
       WHERE a.offering_id = $1
         AND (
           a.team_id IS NULL  -- Course-wide announcements
           OR a.team_id IN (  -- Team-specific announcements for user's team
             SELECT team_id 
             FROM team_members 
             WHERE user_id = $2 AND left_at IS NULL
           )
         )
       ORDER BY ${order}
       LIMIT $3 OFFSET $4`,
      [offeringId, userId, limit, offset]
    );

    return result.rows;
  }
}
