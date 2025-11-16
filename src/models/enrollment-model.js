import { pool } from '../db.js';

// Course roles for enrollments
const COURSE_ROLES = ['student', 'ta', 'tutor'];
const ENROLLMENT_STATUSES = ['enrolled', 'waitlisted', 'dropped', 'completed'];

/**
 * Enrollment Model - Handles enrollment data operations
 * Manages course enrollments with roles (student, ta, tutor)
 */
export class EnrollmentModel {
  /**
   * Validate enrollment data before create/update
   * @param {Object} data - Data to validate
   * @param {boolean} isUpdate - If true, only validate fields that are present
   */
  static validate(data, isUpdate = false) {
    const errors = [];
    
    // Offering ID validation (required for create, optional for update)
    if (!isUpdate && !data.offering_id) {
      errors.push('offering_id is required');
    }
    
    // User ID validation (required for create, optional for update)
    if (!isUpdate && !data.user_id) {
      errors.push('user_id is required');
    }
    
    // Course role validation (only if provided)
    if (data.course_role !== undefined && data.course_role !== null) {
      if (!COURSE_ROLES.includes(data.course_role)) {
        errors.push(`Invalid course_role. Must be one of: ${COURSE_ROLES.join(', ')}`);
      }
    }
    
    // Status validation (only if provided)
    if (data.status !== undefined && data.status !== null) {
      if (!ENROLLMENT_STATUSES.includes(data.status)) {
        errors.push(`Invalid status. Must be one of: ${ENROLLMENT_STATUSES.join(', ')}`);
      }
    }
    
    return errors;
  }

  /**
   * Create a new enrollment
   */
  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      INSERT INTO enrollments (
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_by,
        updated_by
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        CAST(COALESCE($3::text, 'student') AS course_role_enum),
        CAST(COALESCE($4::text, 'enrolled') AS enrollment_status_enum),
        $5,
        $6,
        $7,
        $8,
        $9::uuid,
        $10::uuid
      )
      RETURNING
        id,
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_at,
        updated_at,
        created_by,
        updated_by
    `;
    
    const { rows } = await pool.query(query, [
      data.offering_id,
      data.user_id,
      data.course_role ?? 'student',
      data.status ?? 'enrolled',
      data.enrolled_at ?? new Date().toISOString().split('T')[0],
      data.dropped_at ?? null,
      data.final_grade ?? null,
      data.grade_marks ?? null,
      data.created_by ?? null,
      data.updated_by ?? null,
    ]);
    
    return rows[0];
  }

  /**
   * Find enrollment by ID
   */
  static async findById(id) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM enrollments
      WHERE id = $1::uuid
      `,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Find enrollment by offering_id and user_id
   */
  static async findByOfferingAndUser(offeringId, userId) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM enrollments
      WHERE offering_id = $1::uuid AND user_id = $2::uuid
      `,
      [offeringId, userId]
    );
    return rows[0] ?? null;
  }

  /**
   * Find all enrollments for a course offering
   */
  static async findByOffering(offeringId, options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);
    
    let whereClause = 'WHERE offering_id = $1::uuid';
    const params = [offeringId];
    
    if (options.course_role) {
      const paramIndex = params.length + 1;
      whereClause += ` AND course_role = $${paramIndex}::course_role_enum`;
      params.push(options.course_role);
    }
    
    if (options.status) {
      const paramIndex = params.length + 1;
      whereClause += ` AND status = $${paramIndex}::enrollment_status_enum`;
      params.push(options.status);
    }
    
    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM enrollments
      ${whereClause}
      ORDER BY course_role, enrolled_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );
    return rows;
  }

  /**
   * Find all enrollments for a user
   */
  static async findByUser(userId, options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);
    
    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM enrollments
      WHERE user_id = $1::uuid
      ORDER BY enrolled_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );
    return rows;
  }

  /**
   * Find enrollments by course_role (e.g., all TAs, all tutors)
   */
  static async findByCourseRole(offeringId, courseRole, options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);
    
    const { rows } = await pool.query(
      `
      SELECT
        id,
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM enrollments
      WHERE offering_id = $1::uuid AND course_role = $2::course_role_enum
      ORDER BY enrolled_at DESC
      LIMIT $3 OFFSET $4
      `,
      [offeringId, courseRole, limit, offset]
    );
    return rows;
  }

  /**
   * Update enrollment
   */
  static async update(id, data) {
    // Get current enrollment first
    const current = await this.findById(id);
    if (!current) throw new Error('Enrollment not found');

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
    
    if (merged.user_id !== undefined) {
      setClauses.push(`user_id = $${paramIndex++}::uuid`);
      params.push(merged.user_id);
    }
    
    if (merged.course_role !== undefined && merged.course_role !== null) {
      setClauses.push(`course_role = $${paramIndex++}::text::course_role_enum`);
      params.push(merged.course_role);
    }
    
    if (merged.status !== undefined && merged.status !== null) {
      setClauses.push(`status = $${paramIndex++}::text::enrollment_status_enum`);
      params.push(merged.status);
    }
    
    if (merged.enrolled_at !== undefined) {
      setClauses.push(`enrolled_at = $${paramIndex++}`);
      params.push(merged.enrolled_at);
    }
    
    if (merged.dropped_at !== undefined) {
      setClauses.push(`dropped_at = $${paramIndex++}`);
      params.push(merged.dropped_at);
    }
    
    if (merged.final_grade !== undefined) {
      setClauses.push(`final_grade = $${paramIndex++}`);
      params.push(merged.final_grade);
    }
    
    if (merged.grade_marks !== undefined) {
      setClauses.push(`grade_marks = $${paramIndex++}`);
      params.push(merged.grade_marks);
    }
    
    if (merged.updated_by !== undefined) {
      setClauses.push(`updated_by = $${paramIndex++}::uuid`);
      params.push(merged.updated_by);
    }
    
    setClauses.push(`updated_at = NOW()`);
    
    params.push(id); // For WHERE clause
    
    const query = `
      UPDATE enrollments
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING
        id,
        offering_id,
        user_id,
        course_role,
        status,
        enrolled_at,
        dropped_at,
        final_grade,
        grade_marks,
        created_at,
        updated_at,
        created_by,
        updated_by
      `;

    const { rows, rowCount } = await pool.query(query, params);

    if (rowCount === 0) throw new Error('Enrollment not found');
    return rows[0];
  }

  /**
   * Delete enrollment (hard delete)
   */
  static async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM enrollments WHERE id = $1::uuid',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Count enrollments for an offering
   */
  static async countByOffering(offeringId, options = {}) {
    let whereClause = 'WHERE offering_id = $1::uuid';
    const params = [offeringId];
    
    if (options.course_role) {
      whereClause += ' AND course_role = $2';
      params.push(options.course_role);
    }
    
    if (options.status) {
      const paramIndex = params.length + 1;
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
    }
    
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM enrollments ${whereClause}`,
      params
    );
    return parseInt(rows[0].count, 10);
  }
}

