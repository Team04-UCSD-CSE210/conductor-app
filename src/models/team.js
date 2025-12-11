import { pool } from '../db.js';

// Valid status values for teams
const STATUSES = ['forming', 'active', 'inactive'];

/**
 * Team Model - Handles team data operations
 * Manages teams within course offerings with leaders and status tracking
 */
export class TeamModel {
  /**
   * Validate team data before create/update
   * @param {Object} data - Data to validate
   * @param {boolean} isUpdate - If true, only validate fields that are present
   */
  static validate(data, isUpdate = false) {
    const errors = [];

    // Offering ID validation (required for create)
    if (!isUpdate && !data.offering_id) {
      errors.push('offering_id is required');
    }

    // Name validation (required for create)
    if (!isUpdate && !data.name) {
      errors.push('name is required');
    }

    // Team number validation (only if provided)
    if (data.team_number !== undefined && data.team_number !== null) {
      if (!Number.isInteger(data.team_number) || data.team_number < 0) {
        errors.push('Invalid team_number');
      }
    }

    // Status validation (only if provided)
    if (data.status !== undefined && data.status !== null) {
      if (!STATUSES.includes(data.status)) {
        errors.push(`Invalid status. Must be one of: ${STATUSES.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Create a new team
   */
  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    // Ensure leader_ids is an array with at least one leader
    if (!Array.isArray(data.leader_ids) || data.leader_ids.length === 0) {
      throw new Error('leader_ids must be a non-empty array');
    }
    
    const leaderIdsArray = data.leader_ids;

    const query = `
      INSERT INTO team (
        offering_id,
        name,
        team_number,
        leader_ids,
        status,
        formed_at,
        created_by,
        updated_by
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4::UUID[],
        CAST(COALESCE($5::text, 'forming') AS team_status_enum),
        $6,
        $7::uuid,
        $8::uuid
      )
      RETURNING
        id,
        offering_id,
        name,
        team_number,
        COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids,
        status,
        formed_at,
        created_at,
        updated_at,
        created_by,
        updated_by
    `;

    const { rows } = await pool.query(query, [
      data.offering_id,
      data.name,
      data.team_number ?? null,
      leaderIdsArray,
      data.status ?? 'forming',
      data.formed_at ?? null,
      data.created_by ?? null,
      data.updated_by ?? null,
    ]);

    return rows[0];
  }

  /**
   * Find team by ID
   */
  static async findById(id) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        name,
        team_number,
        COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids,
        status,
        formed_at,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM team
      WHERE id = $1::uuid
      `,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Find all teams with pagination
   */
  static async findAll(options = {}) {
    const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filter by offering
    if (options.offering_id) {
      const paramIndex = params.length + 1;
      whereClause += ` AND offering_id = $${paramIndex}::uuid`;
      params.push(options.offering_id);
    }

    // Filter by status
    if (options.status) {
      const paramIndex = params.length + 1;
      whereClause += ` AND status = $${paramIndex}::team_status_enum`;
      params.push(options.status);
    }

    // Filter by leader
    if (options.leader_id) {
      const paramIndex = params.length + 1;
      whereClause += ` AND $${paramIndex}::uuid = ANY(COALESCE(leader_ids, ARRAY[]::UUID[]))`;
      params.push(options.leader_id);
    }
    
    if (options.leader_ids) {
      const paramIndex = params.length + 1;
      whereClause += ` AND leader_ids && $${paramIndex}::UUID[]`;
      params.push(Array.isArray(options.leader_ids) ? options.leader_ids : [options.leader_ids]);
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        name,
        team_number,
        COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids,
        status,
        formed_at,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM team
      ${whereClause}
      ORDER BY team_number ASC, name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );
    return rows;
  }

  /**
   * Find teams by offering
   */
  static async findByOffering(offeringId, options = {}) {
    const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);

    let whereClause = 'WHERE offering_id = $1::uuid';
    const params = [offeringId];

    if (options.status) {
      const paramIndex = params.length + 1;
      whereClause += ` AND status = $${paramIndex}::team_status_enum`;
      params.push(options.status);
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        name,
        team_number,
        COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids,
        status,
        formed_at,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM team
      ${whereClause}
      ORDER BY team_number ASC, name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );
    return rows;
  }

  /**
   * Find team by leader
   */
  static async findByLeader(leaderId, options = {}) {
    const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        name,
        team_number,
        COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids,
        status,
        formed_at,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM team
      WHERE $1::uuid = ANY(COALESCE(leader_ids, ARRAY[]::UUID[]))
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [leaderId, limit, offset]
    );
    return rows;
  }

  /**
   * Update team
   */
  static async update(id, data) {
    // Get current team first
    const current = await this.findById(id);
    if (!current) throw new Error('Team not found');

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

    if (merged.offering_id !== undefined) {
      setClauses.push(`offering_id = $${paramIndex++}::uuid`);
      params.push(merged.offering_id);
    }

    if (merged.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(merged.name);
    }

    if (merged.team_number !== undefined) {
      setClauses.push(`team_number = $${paramIndex++}`);
      params.push(merged.team_number);
    }

    if (merged.leader_ids !== undefined) {
      if (!Array.isArray(merged.leader_ids) || merged.leader_ids.length === 0) {
        throw new Error('leader_ids must be a non-empty array');
      }
      setClauses.push(`leader_ids = $${paramIndex++}::UUID[]`);
      params.push(merged.leader_ids);
    }

    if (merged.status !== undefined && merged.status !== null) {
      setClauses.push(`status = $${paramIndex++}::text::team_status_enum`);
      params.push(merged.status);
    }

    if (merged.formed_at !== undefined) {
      setClauses.push(`formed_at = $${paramIndex++}`);
      params.push(merged.formed_at);
    }

    if (merged.updated_by !== undefined) {
      setClauses.push(`updated_by = $${paramIndex++}::uuid`);
      params.push(merged.updated_by);
    }

    setClauses.push(`updated_at = NOW()`);

    params.push(id); // For WHERE clause

    const query = `
      UPDATE team
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING
        id,
        offering_id,
        name,
        team_number,
        COALESCE(leader_ids, ARRAY[]::UUID[]) as leader_ids,
        status,
        formed_at,
        created_at,
        updated_at,
        created_by,
        updated_by
      `;

    const { rows, rowCount } = await pool.query(query, params);

    if (rowCount === 0) throw new Error('Team not found');
    return rows[0];
  }

  /**
   * Delete team (hard delete)
   */
  static async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM team WHERE id = $1::uuid',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Count teams
   */
  static async count(options = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (options.offering_id) {
      whereClause += ' AND offering_id = $1::uuid';
      params.push(options.offering_id);
    }

    if (options.status) {
      const paramIndex = params.length + 1;
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM team ${whereClause}`,
      params
    );
    return Number.parseInt(rows[0].count, 10);
  }
}

