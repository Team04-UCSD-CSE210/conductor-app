import { pool } from '../db.js';

// Course roles for enrollments
const COURSE_ROLES = ['student', 'ta', 'tutor', 'team-lead'];
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
        team_id,
        created_by,
        updated_by
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        CAST(COALESCE($3::text, 'student') AS enrollment_role_enum),
        CAST(COALESCE($4::text, 'enrolled') AS enrollment_status_enum),
        $5,
        $6,
        $7,
        $8,
        $9::uuid,
        $10::uuid,
        $11::uuid
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
        team_id,
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
      data.team_id ?? null,
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
    // Validate inputs
    if (!offeringId || !userId || offeringId === 'undefined' || userId === 'undefined') {
      return null;
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
        team_id,
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
      whereClause += ` AND course_role = $${paramIndex}::enrollment_role_enum`;
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
        team_id,
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
        team_id,
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
      WHERE offering_id = $1::uuid AND course_role = $2::enrollment_role_enum
      ORDER BY enrolled_at DESC
      LIMIT $3 OFFSET $4
      `,
      [offeringId, courseRole, limit, offset]
    );
    return rows;
  }

  /**
   * Retrieve roster details for an offering with joined user data and summary stats
   * Supports filtering by course_role, status, search term, and sorting.
   */
  static async findRosterDetails(offeringId, options = {}) {
    const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 50, 200));
    const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);

    const params = [offeringId];
    let paramIndex = 2;
    let whereClause = 'WHERE e.offering_id = $1::uuid';

    const validRoles = ['student', 'ta', 'tutor'];
    if (options.course_role && validRoles.includes(options.course_role)) {
      whereClause += ` AND e.course_role = $${paramIndex}::enrollment_role_enum`;
      params.push(options.course_role);
      paramIndex++;
    }

    const validStatuses = ['enrolled', 'waitlisted', 'dropped', 'completed'];
    if (options.status && validStatuses.includes(options.status)) {
      whereClause += ` AND e.status = $${paramIndex}::enrollment_status_enum`;
      params.push(options.status);
      paramIndex++;
    }

    if (options.search && typeof options.search === 'string' && options.search.trim().length > 0) {
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${options.search.trim()}%`);
      paramIndex++;
    }

    const sortMap = {
      name: 'LOWER(u.name) ASC',
      email: 'LOWER(u.email) ASC',
      recent: 'e.enrolled_at DESC',
      role: 'e.course_role ASC',
      status: 'e.status ASC',
    };
    const sortKey = typeof options.sort === 'string' ? options.sort.toLowerCase() : 'name';
    const sortClause = sortMap[sortKey] ?? sortMap.name;
    const orderClause = `ORDER BY ${sortClause}, LOWER(u.name) ASC`;

    const query = `
      SELECT
        e.id AS enrollment_id,
        e.offering_id,
        e.user_id,
        e.course_role,
        e.status AS enrollment_status,
        e.enrolled_at,
        e.dropped_at,
        e.updated_at AS enrollment_updated_at,
        u.name,
        u.preferred_name,
        u.email,
        u.primary_role,
        u.status AS user_status,
        u.institution_type,
        u.ucsd_pid,
        u.major,
        u.degree_program,
        u.academic_year,
        u.image_url,
        u.profile_url,
        u.github_username,
        u.linkedin_url,
        u.phone_number,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        t.id AS team_id,
        t.name AS team_name,
        t.team_number,
        t.leader_id AS team_leader_id,
        (
          SELECT STRING_AGG(SPLIT_PART(u_lead.name, ' ', 1), ', ' ORDER BY u_lead.name)
          FROM (
            SELECT DISTINCT u_lead.id, u_lead.name
            FROM users u_lead
            WHERE u_lead.id IN (
              SELECT leader_id FROM team WHERE id = t.id AND leader_id IS NOT NULL
              UNION
              SELECT tm_lead.user_id FROM team_members tm_lead
              WHERE tm_lead.team_id = t.id 
                AND tm_lead.role = 'leader'::team_member_role_enum 
                AND tm_lead.left_at IS NULL
            )
            AND u_lead.id NOT IN (
              SELECT e_lead.user_id FROM enrollments e_lead
              WHERE e_lead.offering_id = e.offering_id
                AND e_lead.course_role IN ('ta'::enrollment_role_enum, 'tutor'::enrollment_role_enum)
                AND e_lead.status = 'enrolled'::enrollment_status_enum
            )
          ) u_lead
        ) AS team_lead_name,
        CASE WHEN tm.role = 'leader' THEN TRUE ELSE FALSE END AS is_team_lead,
        co.instructor_id,
        u_instructor.name AS instructor_name,
        u_instructor.email AS instructor_email,
        COUNT(*) OVER()::INTEGER AS total_count,
        SUM(CASE WHEN e.course_role = 'student' THEN 1 ELSE 0 END) OVER()::INTEGER AS total_students,
        SUM(CASE WHEN e.course_role = 'ta' THEN 1 ELSE 0 END) OVER()::INTEGER AS total_tas,
        SUM(CASE WHEN e.course_role = 'tutor' THEN 1 ELSE 0 END) OVER()::INTEGER AS total_tutors,
        SUM(CASE WHEN e.status = 'enrolled' THEN 1 ELSE 0 END) OVER()::INTEGER AS total_enrolled,
        SUM(CASE WHEN e.status = 'waitlisted' THEN 1 ELSE 0 END) OVER()::INTEGER AS total_waitlisted,
        SUM(CASE WHEN e.status = 'dropped' THEN 1 ELSE 0 END) OVER()::INTEGER AS total_dropped,
        SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) OVER()::INTEGER AS total_completed
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN course_offerings co ON e.offering_id = co.id
      LEFT JOIN users u_instructor ON co.instructor_id = u_instructor.id
      LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.left_at IS NULL
      LEFT JOIN team t ON tm.team_id = t.id AND t.offering_id = e.offering_id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const { rows } = await pool.query(query, [...params, limit, offset]);

    const stats = rows.length > 0 ? {
      total: Number(rows[0].total_count ?? 0),
      roles: {
        student: Number(rows[0].total_students ?? 0),
        ta: Number(rows[0].total_tas ?? 0),
        tutor: Number(rows[0].total_tutors ?? 0),
      },
      statuses: {
        enrolled: Number(rows[0].total_enrolled ?? 0),
        waitlisted: Number(rows[0].total_waitlisted ?? 0),
        dropped: Number(rows[0].total_dropped ?? 0),
        completed: Number(rows[0].total_completed ?? 0),
      },
    } : {
      total: 0,
      roles: { student: 0, ta: 0, tutor: 0 },
      statuses: { enrolled: 0, waitlisted: 0, dropped: 0, completed: 0 },
    };

    const results = rows.map((row) => ({
      enrollment_id: row.enrollment_id,
      offering_id: row.offering_id,
      user_id: row.user_id,
      course_role: row.course_role,
      enrollment_status: row.enrollment_status,
      enrolled_at: row.enrolled_at,
      dropped_at: row.dropped_at,
      enrollment_updated_at: row.enrollment_updated_at,
      user: {
        id: row.user_id,
        name: row.name,
        preferred_name: row.preferred_name,
        email: row.email,
        primary_role: row.primary_role,
        status: row.user_status,
        institution_type: row.institution_type,
        ucsd_pid: row.ucsd_pid,
        major: row.major,
        degree_program: row.degree_program,
        academic_year: row.academic_year,
        image_url: row.image_url,
        profile_url: row.profile_url,
        github_username: row.github_username,
        linkedin_url: row.linkedin_url,
        phone_number: row.phone_number,
        created_at: row.user_created_at,
        updated_at: row.user_updated_at,
        team_id: row.team_id,
        team_name: row.team_name,
        team_number: row.team_number,
        team_lead_name: row.team_lead_name,
        is_team_lead: row.is_team_lead || false,
      },
    }));

    const totalPages = stats.total === 0 ? 1 : Math.max(1, Math.ceil(stats.total / limit));
    const page = stats.total === 0 ? 1 : Math.floor(offset / limit) + 1;

    // Get instructor info from first row (same for all rows in same offering)
    const instructorInfo = rows.length > 0 ? {
      id: rows[0].instructor_id,
      name: rows[0].instructor_name,
      email: rows[0].instructor_email,
    } : null;

    return {
      results,
      stats,
      instructor: instructorInfo,
      pagination: {
        limit,
        offset,
        page,
        totalPages,
        total: stats.total,
      },
    };
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
      setClauses.push(`course_role = $${paramIndex++}::text::enrollment_role_enum`);
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
    
    if (merged.team_id !== undefined) {
      setClauses.push(`team_id = $${paramIndex++}::uuid`);
      params.push(merged.team_id);
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
        team_id,
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

