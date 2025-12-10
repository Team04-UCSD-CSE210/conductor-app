import validator from 'validator';
import { pool } from '../db.js';

// Valid status values for course offerings
const STATUSES = ['open', 'closed', 'completed'];

/**
 * CourseOffering Model - Handles course offering data operations
 * Manages course offerings with instructors, enrollment caps, and scheduling
 */
export class CourseOfferingModel {
  /**
   * Validate course offering data before create/update
   * @param {Object} data - Data to validate
   * @param {boolean} isUpdate - If true, only validate fields that are present
   */
  static validate(data, isUpdate = false) {
    const errors = [];

    // Code validation (required for create)
    if (!isUpdate && !data.code) {
      errors.push('code is required');
    }

    // Name validation (required for create)
    if (!isUpdate && !data.name) {
      errors.push('name is required');
    }

    // Instructor ID validation (required for create)
    if (!isUpdate && !data.instructor_id) {
      errors.push('instructor_id is required');
    }

    // Start date validation (required for create)
    if (!isUpdate && !data.start_date) {
      errors.push('start_date is required');
    }

    // End date validation (required for create)
    if (!isUpdate && !data.end_date) {
      errors.push('end_date is required');
    }

    // Date logic validation
    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      if (end <= start) {
        errors.push('end_date must be after start_date');
      }
    }

    // Status validation (only if provided)
    if (data.status !== undefined && data.status !== null) {
      if (!STATUSES.includes(data.status)) {
        errors.push(`Invalid status. Must be one of: ${STATUSES.join(', ')}`);
      }
    }

    // Year validation
    if (data.year !== undefined && data.year !== null) {
      if (!Number.isInteger(data.year) || data.year < 1900 || data.year > 2100) {
        errors.push('Invalid year');
      }
    }

    // Credits validation
    if (data.credits !== undefined && data.credits !== null) {
      if (!Number.isInteger(data.credits) || data.credits < 0) {
        errors.push('Invalid credits');
      }
    }

    // Enrollment cap validation
    if (data.enrollment_cap !== undefined && data.enrollment_cap !== null) {
      if (!Number.isInteger(data.enrollment_cap) || data.enrollment_cap < 0) {
        errors.push('Invalid enrollment_cap');
      }
    }

    // URL validation
    if (data.syllabus_url && !validator.isURL(String(data.syllabus_url))) {
      errors.push('Invalid syllabus_url');
    }

    return errors;
  }

  /**
   * Create a new course offering
   */
  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      INSERT INTO course_offerings (
        code,
        name,
        department,
        term,
        year,
        credits,
        instructor_id,
        start_date,
        end_date,
        enrollment_cap,
        status,
        location,
        class_timings,
        syllabus_url,
        is_active,
        created_by,
        updated_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::uuid,
        $8,
        $9,
        $10,
        CAST(COALESCE($11::text, 'open') AS course_offering_status_enum),
        $12,
        $13,
        $14,
        COALESCE($15, true),
        $16::uuid,
        $17::uuid
      )
      RETURNING
        id,
        code,
        name,
        department,
        term,
        year,
        credits,
        instructor_id,
        start_date,
        end_date,
        enrollment_cap,
        status,
        location,
        class_timings,
        syllabus_url,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
    `;

    const { rows } = await pool.query(query, [
      data.code,
      data.name,
      data.department ?? null,
      data.term ?? null,
      data.year ?? null,
      data.credits ?? null,
      data.instructor_id,
      data.start_date,
      data.end_date,
      data.enrollment_cap ?? null,
      data.status ?? 'open',
      data.location ?? null,
      data.class_timings ?? null,
      data.syllabus_url ?? null,
      data.is_active ?? true,
      data.created_by ?? null,
      data.updated_by ?? null,
    ]);

    return rows[0];
  }

  /**
   * Find course offering by ID
   */
  static async findById(id) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        code,
        name,
        department,
        term,
        year,
        credits,
        instructor_id,
        start_date,
        end_date,
        enrollment_cap,
        status,
        location,
        class_timings,
        syllabus_url,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM course_offerings
      WHERE id = $1::uuid
      `,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Find all course offerings with pagination
   */
  static async findAll(options = {}) {
    const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filter by instructor
    if (options.instructor_id) {
      const paramIndex = params.length + 1;
      whereClause += ` AND instructor_id = $${paramIndex}::uuid`;
      params.push(options.instructor_id);
    }

    // Filter by status
    if (options.status) {
      const paramIndex = params.length + 1;
      whereClause += ` AND status = $${paramIndex}::course_offering_status_enum`;
      params.push(options.status);
    }

    // Filter by active
    if (options.is_active !== undefined) {
      const paramIndex = params.length + 1;
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(options.is_active);
    }

    // Filter by term and year
    if (options.term) {
      const paramIndex = params.length + 1;
      whereClause += ` AND term = $${paramIndex}`;
      params.push(options.term);
    }

    if (options.year) {
      const paramIndex = params.length + 1;
      whereClause += ` AND year = $${paramIndex}`;
      params.push(options.year);
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        code,
        name,
        department,
        term,
        year,
        credits,
        instructor_id,
        start_date,
        end_date,
        enrollment_cap,
        status,
        location,
        class_timings,
        syllabus_url,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM course_offerings
      ${whereClause}
      ORDER BY year DESC, term DESC, code ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );
    return rows;
  }

  /**
   * Find course offerings by instructor
   */
  static async findByInstructor(instructorId, options = {}) {
    const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        code,
        name,
        department,
        term,
        year,
        credits,
        instructor_id,
        start_date,
        end_date,
        enrollment_cap,
        status,
        location,
        class_timings,
        syllabus_url,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM course_offerings
      WHERE instructor_id = $1::uuid
      ORDER BY year DESC, term DESC, code ASC
      LIMIT $2 OFFSET $3
      `,
      [instructorId, limit, offset]
    );
    return rows;
  }

  /**
   * Update course offering
   */
  static async update(id, data) {
    // Get current offering first
    const current = await this.findById(id);
    if (!current) throw new Error('Course offering not found');

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

    if (merged.code !== undefined) {
      setClauses.push(`code = $${paramIndex++}`);
      params.push(merged.code);
    }

    if (merged.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(merged.name);
    }

    if (merged.department !== undefined) {
      setClauses.push(`department = $${paramIndex++}`);
      params.push(merged.department);
    }

    if (merged.term !== undefined) {
      setClauses.push(`term = $${paramIndex++}`);
      params.push(merged.term);
    }

    if (merged.year !== undefined) {
      setClauses.push(`year = $${paramIndex++}`);
      params.push(merged.year);
    }

    if (merged.credits !== undefined) {
      setClauses.push(`credits = $${paramIndex++}`);
      params.push(merged.credits);
    }

    if (merged.instructor_id !== undefined) {
      setClauses.push(`instructor_id = $${paramIndex++}::uuid`);
      params.push(merged.instructor_id);
    }

    if (merged.start_date !== undefined) {
      setClauses.push(`start_date = $${paramIndex++}`);
      params.push(merged.start_date);
    }

    if (merged.end_date !== undefined) {
      setClauses.push(`end_date = $${paramIndex++}`);
      params.push(merged.end_date);
    }

    if (merged.enrollment_cap !== undefined) {
      setClauses.push(`enrollment_cap = $${paramIndex++}`);
      params.push(merged.enrollment_cap);
    }

    if (merged.status !== undefined && merged.status !== null) {
      setClauses.push(`status = $${paramIndex++}::text::course_offering_status_enum`);
      params.push(merged.status);
    }

    if (merged.location !== undefined) {
      setClauses.push(`location = $${paramIndex++}`);
      params.push(merged.location);
    }

    if (merged.class_timings !== undefined) {
      setClauses.push(`class_timings = $${paramIndex++}`);
      params.push(merged.class_timings);
    }

    if (merged.syllabus_url !== undefined) {
      setClauses.push(`syllabus_url = $${paramIndex++}`);
      params.push(merged.syllabus_url);
    }

    if (merged.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(merged.is_active);
    }

    if (merged.updated_by !== undefined) {
      setClauses.push(`updated_by = $${paramIndex++}::uuid`);
      params.push(merged.updated_by);
    }

    setClauses.push(`updated_at = NOW()`);

    params.push(id); // For WHERE clause

    const query = `
      UPDATE course_offerings
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING
        id,
        code,
        name,
        department,
        term,
        year,
        credits,
        instructor_id,
        start_date,
        end_date,
        enrollment_cap,
        status,
        location,
        class_timings,
        syllabus_url,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      `;

    const { rows, rowCount } = await pool.query(query, params);

    if (rowCount === 0) throw new Error('Course offering not found');
    return rows[0];
  }

  /**
   * Delete course offering (hard delete)
   */
  static async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM course_offerings WHERE id = $1::uuid',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Count course offerings
   */
  static async count(options = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (options.instructor_id) {
      whereClause += ' AND instructor_id = $1::uuid';
      params.push(options.instructor_id);
    }

    if (options.status) {
      const paramIndex = params.length + 1;
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
    }

    if (options.is_active !== undefined) {
      const paramIndex = params.length + 1;
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(options.is_active);
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM course_offerings ${whereClause}`,
      params
    );
    return Number.parseInt(rows[0].count, 10);
  }

  /**
   * Get instructor details for a course offering
   * Returns user information for the instructor
   */
  static async getInstructorDetails(offeringId) {
    const { rows } = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        u.name,
        u.preferred_name,
        u.image_url,
        u.phone_number,
        u.github_username,
        u.linkedin_url,
        u.department,
        u.primary_role,
        u.status
      FROM course_offerings co
      JOIN users u ON u.id = co.instructor_id
      WHERE co.id = $1::uuid AND u.deleted_at IS NULL
      `,
      [offeringId]
    );
    return rows[0] ?? null;
  }
}

