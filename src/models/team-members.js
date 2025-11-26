import { pool } from '../db.js';

// Valid role values for team members
const ROLES = ['leader', 'member'];

/**
 * TeamMember Model - Handles team member data operations
 * Manages team memberships with roles, join/leave dates and tracking
 */
export class TeamMemberModel {
  /**
   * Validate team member data before create/update
   * @param {Object} data - Data to validate
   * @param {boolean} isUpdate - If true, only validate fields that are present
   */
  static validate(data, isUpdate = false) {
    const errors = [];

    // Team ID validation (required for create)
    if (!isUpdate && !data.team_id) {
      errors.push('team_id is required');
    }

    // User ID validation (required for create)
    if (!isUpdate && !data.user_id) {
      errors.push('user_id is required');
    }

    // Role validation (only if provided)
    if (data.role !== undefined && data.role !== null) {
      if (!ROLES.includes(data.role)) {
        errors.push(`Invalid role. Must be one of: ${ROLES.join(', ')}`);
      }
    }

    // Date validation
    if (data.joined_at && data.left_at) {
      const joined = new Date(data.joined_at);
      const left = new Date(data.left_at);
      if (left <= joined) {
        errors.push('left_at must be after joined_at');
      }
    }

    return errors;
  }

  /**
   * Create a new team member
   */
  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      INSERT INTO team_members (
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        CAST($3::text AS team_member_role_enum),
        $4,
        $5,
        $6::uuid,
        $7::uuid
      )
      RETURNING
        id,
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
    `;

    const { rows } = await pool.query(query, [
      data.team_id,
      data.user_id,
      data.role ?? null,
      data.joined_at ?? null,
      data.left_at ?? null,
      data.added_by ?? null,
      data.removed_by ?? null,
    ]);

    return rows[0];
  }

  /**
   * Find team member by ID
   */
  static async findById(id) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
      FROM team_members
      WHERE id = $1::uuid
      `,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Find team member by team and user
   */
  static async findByTeamAndUser(teamId, userId) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
      FROM team_members
      WHERE team_id = $1::uuid AND user_id = $2::uuid
      `,
      [teamId, userId]
    );
    return rows[0] ?? null;
  }

  /**
   * Find all team members with pagination
   */
  static async findAll(options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filter by team
    if (options.team_id) {
      const paramIndex = params.length + 1;
      whereClause += ` AND team_id = $${paramIndex}::uuid`;
      params.push(options.team_id);
    }

    // Filter by user
    if (options.user_id) {
      const paramIndex = params.length + 1;
      whereClause += ` AND user_id = $${paramIndex}::uuid`;
      params.push(options.user_id);
    }

    // Filter by role
    if (options.role) {
      const paramIndex = params.length + 1;
      whereClause += ` AND role = $${paramIndex}::team_member_role_enum`;
      params.push(options.role);
    }

    // Filter active members (those who haven't left)
    if (options.active === true) {
      whereClause += ' AND left_at IS NULL';
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
      FROM team_members
      ${whereClause}
      ORDER BY joined_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );
    return rows;
  }

  /**
   * Find team members by team
   */
  static async findByTeam(teamId, options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);

    let whereClause = 'WHERE team_id = $1::uuid';
    const params = [teamId];

    if (options.role) {
      const paramIndex = params.length + 1;
      whereClause += ` AND role = $${paramIndex}::team_member_role_enum`;
      params.push(options.role);
    }

    // Filter active members
    if (options.active === true) {
      whereClause += ' AND left_at IS NULL';
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
      FROM team_members
      ${whereClause}
      ORDER BY joined_at ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );
    return rows;
  }

  /**
   * Find teams by user
   */
  static async findByUser(userId, options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);

    let whereClause = 'WHERE user_id = $1::uuid';
    const params = [userId];

    if (options.role) {
      const paramIndex = params.length + 1;
      whereClause += ` AND role = $${paramIndex}::team_member_role_enum`;
      params.push(options.role);
    }

    // Filter active memberships
    if (options.active === true) {
      whereClause += ' AND left_at IS NULL';
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
      FROM team_members
      ${whereClause}
      ORDER BY joined_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );
    return rows;
  }

  /**
   * Update team member
   */
  static async update(id, data) {
    // Get current team member first
    const current = await this.findById(id);
    if (!current) throw new Error('Team member not found');

    // Validate only fields that are being updated
    const errors = this.validate(data, true);
    if (errors.length) throw new Error(errors.join(', '));

    // Merge with current data
    const merged = {
      ...current,
      ...data,
    };

    // Build SET clause dynamically
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (merged.team_id !== undefined) {
      setClauses.push(`team_id = $${paramIndex++}::uuid`);
      params.push(merged.team_id);
    }

    if (merged.user_id !== undefined) {
      setClauses.push(`user_id = $${paramIndex++}::uuid`);
      params.push(merged.user_id);
    }

    if (merged.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}::text::team_member_role_enum`);
      params.push(merged.role);
    }

    if (merged.joined_at !== undefined) {
      setClauses.push(`joined_at = $${paramIndex++}`);
      params.push(merged.joined_at);
    }

    if (merged.left_at !== undefined) {
      setClauses.push(`left_at = $${paramIndex++}`);
      params.push(merged.left_at);
    }

    if (merged.added_by !== undefined) {
      setClauses.push(`added_by = $${paramIndex++}::uuid`);
      params.push(merged.added_by);
    }

    if (merged.removed_by !== undefined) {
      setClauses.push(`removed_by = $${paramIndex++}::uuid`);
      params.push(merged.removed_by);
    }

    params.push(id); // For WHERE clause

    const query = `
      UPDATE team_members
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING
        id,
        team_id,
        user_id,
        role,
        joined_at,
        left_at,
        added_by,
        removed_by
      `;

    const { rows, rowCount } = await pool.query(query, params);

    if (rowCount === 0) throw new Error('Team member not found');
    return rows[0];
  }

  /**
   * Delete team member (hard delete)
   */
  static async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM team_members WHERE id = $1::uuid',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Remove member from team (by team and user)
   */
  static async removeFromTeam(teamId, userId, removedBy = null) {
    const { rowCount } = await pool.query(
      `UPDATE team_members 
       SET left_at = NOW(), removed_by = $3::uuid
       WHERE team_id = $1::uuid AND user_id = $2::uuid AND left_at IS NULL`,
      [teamId, userId, removedBy]
    );
    return rowCount > 0;
  }

  /**
   * Count team members
   */
  static async count(options = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (options.team_id) {
      whereClause += ' AND team_id = $1::uuid';
      params.push(options.team_id);
    }

    if (options.user_id) {
      const paramIndex = params.length + 1;
      whereClause += ` AND user_id = $${paramIndex}::uuid`;
      params.push(options.user_id);
    }

    if (options.role) {
      const paramIndex = params.length + 1;
      whereClause += ` AND role = $${paramIndex}`;
      params.push(options.role);
    }

    if (options.active === true) {
      whereClause += ' AND left_at IS NULL';
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM team_members ${whereClause}`,
      params
    );
    return parseInt(rows[0].count, 10);
  }

  /**
   * Get team member counts grouped by team_id
   * Useful for getting member counts for multiple teams at once
   */
  static async countByTeams(teamIds) {
    if (!teamIds || teamIds.length === 0) return [];

    const placeholders = teamIds.map((_, i) => `$${i + 1}::uuid`).join(', ');
    const { rows } = await pool.query(
      `
      SELECT
        team_id,
        COUNT(*) as member_count,
        COUNT(CASE WHEN role = 'leader' THEN 1 END) as leader_count
      FROM team_members
      WHERE team_id IN (${placeholders})
        AND left_at IS NULL
      GROUP BY team_id
      `,
      teamIds
    );
    return rows;
  }

  /**
   * Get team leaders for multiple teams
   */
  static async getLeadersByTeams(teamIds) {
    if (!teamIds || teamIds.length === 0) return [];

    const placeholders = teamIds.map((_, i) => `$${i + 1}::uuid`).join(', ');
    const { rows } = await pool.query(
      `
      SELECT
        team_id,
        user_id
      FROM team_members
      WHERE team_id IN (${placeholders})
        AND role = 'leader'
        AND left_at IS NULL
      `,
      teamIds
    );
    return rows;
  }
}


