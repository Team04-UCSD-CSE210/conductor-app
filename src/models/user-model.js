import validator from 'validator';
import { pool } from '../db.js';

// Global roles for system/dashboard access
// Valid primary_role values: admin, instructor, student, unregistered
const ROLES = ['admin', 'instructor', 'student', 'unregistered'];
const STATUSES = ['active', 'busy', 'inactive'];
const INSTITUTION_TYPES = ['ucsd', 'extension'];

/**
 * User Model - Handles user data operations
 * Matches new schema: primary_role, status, phone_number, institution_type, etc.
 */
export class UserModel {
  /**
   * Determine institution type from email
   * UCSD: email ends with @ucsd.edu
   * Extension: gmail or other non-ucsd.edu emails
   * 
   * NOTE: This method returns 'extension' for any non-UCSD email, but in practice,
   * 'extension' should only be set for whitelisted users. For OAuth login flow,
   * the whitelist is checked in server.js before setting institution_type.
   * For roster import (admin-only), admins can explicitly set institution_type
   * in the CSV/JSON data, or this method will auto-detect (which is acceptable
   * for admin bulk imports).
   */
  static determineInstitutionType(email) {
    if (!email) return null;
    const emailLower = String(email).toLowerCase().trim();
    if (emailLower.endsWith('@ucsd.edu')) {
      return 'ucsd';
    }
    // Extension students typically use gmail or other non-ucsd.edu emails
    // Note: In OAuth flow, whitelist check is done before setting this value
    return 'extension';
  }

  /**
   * Validate user data before create/update
   */
  static validate(data) {
    const errors = [];
    
    // Email validation
    if (!data.email || !validator.isEmail(String(data.email))) {
      errors.push('Invalid email');
    }
    
    // Name validation (required in new schema)
    if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
      errors.push('Name is required');
    }
    
    // Primary role validation
    if (data.primary_role && !ROLES.includes(data.primary_role)) {
      errors.push(`Invalid primary_role. Must be one of: ${ROLES.join(', ')}`);
    }
    
    // Status validation
    if (data.status && !STATUSES.includes(data.status)) {
      errors.push(`Invalid status. Must be one of: ${STATUSES.join(', ')}`);
    }
    
    // Institution type validation
    if (data.institution_type !== undefined && data.institution_type !== null) {
      if (!INSTITUTION_TYPES.includes(data.institution_type)) {
        errors.push(`Invalid institution_type. Must be one of: ${INSTITUTION_TYPES.join(', ')}`);
      }
    }
    
    // Academic year validation
    if (data.academic_year !== undefined && data.academic_year !== null) {
      if (!Number.isInteger(data.academic_year)) {
        errors.push('Invalid academic_year');
      }
    }
    
    // URL validations
    if (data.linkedin_url && !validator.isURL(String(data.linkedin_url))) {
      errors.push('Invalid linkedin_url');
    }
    if (data.image_url && !validator.isURL(String(data.image_url))) {
      errors.push('Invalid image_url');
    }
    if (data.profile_url && !validator.isURL(String(data.profile_url))) {
      errors.push('Invalid profile_url');
    }
    
    return errors;
  }

  /**
   * Create a new user
   */
  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    // Auto-determine institution_type from email if not provided
    // Since it will never be empty, ensure it's always a valid string (never null)
    const rawInstitutionType = data.institution_type ?? this.determineInstitutionType(data.email);
    // Convert null to empty string so PostgreSQL can infer parameter type, then handle empty in SQL
    const institutionType = rawInstitutionType ?? '';

    const query = `
      INSERT INTO users (
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider
      )
      VALUES (
        LOWER($1)::citext,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        CAST(COALESCE($10::text, 'student') AS user_role_enum),
        CAST(COALESCE($11::text, 'active') AS user_status_enum),
        CASE 
          WHEN $12::text IS NULL OR $12::text = '' THEN NULL::institution_type_enum
          ELSE CAST($12::text AS institution_type_enum)
        END,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        COALESCE($19, 'google')
      )
      ON CONFLICT (email) DO UPDATE
      SET
        name            = COALESCE(EXCLUDED.name,            users.name),
        preferred_name  = COALESCE(EXCLUDED.preferred_name,  users.preferred_name),
        major           = COALESCE(EXCLUDED.major,           users.major),
        degree_program  = COALESCE(EXCLUDED.degree_program,  users.degree_program),
        academic_year   = COALESCE(EXCLUDED.academic_year,   users.academic_year),
        department      = COALESCE(EXCLUDED.department,      users.department),
        class_level     = COALESCE(EXCLUDED.class_level,    users.class_level),
        primary_role    = COALESCE(EXCLUDED.primary_role::text,    users.primary_role::text)::user_role_enum,
        status          = COALESCE(EXCLUDED.status::text,          users.status::text)::user_status_enum,
        institution_type = COALESCE(EXCLUDED.institution_type::text, users.institution_type::text)::institution_type_enum,
        profile_url     = COALESCE(EXCLUDED.profile_url,     users.profile_url),
        image_url       = COALESCE(EXCLUDED.image_url,       users.image_url),
        phone_number    = COALESCE(EXCLUDED.phone_number,    users.phone_number),
        github_username = COALESCE(EXCLUDED.github_username, users.github_username),
        linkedin_url    = COALESCE(EXCLUDED.linkedin_url,    users.linkedin_url),
        google_id       = COALESCE(EXCLUDED.google_id,       users.google_id),
        oauth_provider  = COALESCE(EXCLUDED.oauth_provider,  users.oauth_provider),
        deleted_at      = NULL,
        updated_at      = NOW()
      RETURNING
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider,
        created_at,
        updated_at,
        updated_by,
        deleted_at;
    `;

    const { rows } = await pool.query(query, [
      data.email,
      data.ucsd_pid ?? null,
      data.name ?? null,
      data.preferred_name ?? null,
      data.major ?? null,
      data.degree_program ?? null,
      data.academic_year ?? null,
      data.department ?? null,
      data.class_level ?? null,
      data.primary_role ?? 'student',
      data.status ?? 'active',
      institutionType, // Will be empty string if null, handled in SQL CASE statement
      data.profile_url ?? null,
      data.image_url ?? null,
      data.phone_number ?? null,
      data.github_username ?? null,
      data.linkedin_url ?? null,
      data.google_id ?? null,
      data.oauth_provider ?? 'google',
    ]);
    
    return rows[0];
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @param {boolean} includeDeleted - Include soft-deleted users
   */
  static async findById(id, includeDeleted = false) {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider,
        created_at,
        updated_at,
        updated_by,
        deleted_at
      FROM users
      WHERE id = $1::uuid ${deletedClause}
      `,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @param {boolean} includeDeleted - Include soft-deleted users
   */
  static async findByEmail(email, includeDeleted = false) {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    // Normalize email to lowercase to match how emails are stored (LOWER() in INSERT)
    const normalizedEmail = email ? String(email).toLowerCase().trim() : '';
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider,
        created_at,
        updated_at,
        updated_by,
        deleted_at
      FROM users
      WHERE email = $1::citext ${deletedClause}
      `,
      [normalizedEmail]
    );
    return rows[0] ?? null;
  }

  /**
   * Find all users with pagination
   * @param {number} limit - Number of users to return
   * @param {number} offset - Number of users to skip
   * @param {boolean} includeDeleted - Include soft-deleted users
   */
  static async findAll(limit = 50, offset = 0, includeDeleted = false) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    const deletedClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider,
        created_at,
        updated_at,
        updated_by,
        deleted_at
      FROM users
      ${deletedClause}
      ORDER BY created_at ASC, email ASC
      LIMIT $1 OFFSET $2
      `,
      [lim, off]
    );
    return rows;
  }

  /**
   * Update user
   */
  static async update(id, data) {
    const current = await this.findById(id);
    if (!current) throw new Error('User not found');

    const merged = {
      ...current,
      ...data,
    };

    // Auto-update institution_type if email changed
    if (data.email && data.email !== current.email) {
      merged.institution_type = this.determineInstitutionType(data.email);
    } else if (data.institution_type === undefined && !current.institution_type && current.email) {
      // Auto-determine if not set
      merged.institution_type = this.determineInstitutionType(current.email);
    }

    const errors = this.validate(merged);
    if (errors.length) throw new Error(errors.join(', '));

    // Build SET clause dynamically to avoid NULL type inference issues
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    // Always update these fields
    setClauses.push(`email = LOWER($${paramIndex++})::citext`);
    params.push(merged.email);
    
    setClauses.push(`ucsd_pid = $${paramIndex++}`);
    params.push(merged.ucsd_pid ?? null);
    
    setClauses.push(`name = $${paramIndex++}`);
    params.push(merged.name ?? null);
    
    setClauses.push(`preferred_name = $${paramIndex++}`);
    params.push(merged.preferred_name ?? null);
    
    setClauses.push(`major = $${paramIndex++}`);
    params.push(merged.major ?? null);
    
    setClauses.push(`degree_program = $${paramIndex++}`);
    params.push(merged.degree_program ?? null);
    
    setClauses.push(`academic_year = $${paramIndex++}`);
    params.push(merged.academic_year ?? null);
    
    setClauses.push(`department = $${paramIndex++}`);
    params.push(merged.department ?? null);
    
    setClauses.push(`class_level = $${paramIndex++}`);
    params.push(merged.class_level ?? null);
    
    // Handle ENUM fields - only update if provided
    if (merged.primary_role !== undefined && merged.primary_role !== null) {
      setClauses.push(`primary_role = $${paramIndex++}::text::user_role_enum`);
      params.push(merged.primary_role);
    }
    
    if (merged.status !== undefined && merged.status !== null) {
      setClauses.push(`status = $${paramIndex++}::text::user_status_enum`);
      params.push(merged.status);
    }
    
    if (merged.institution_type !== undefined && merged.institution_type !== null) {
      setClauses.push(`institution_type = $${paramIndex++}::text::institution_type_enum`);
      params.push(merged.institution_type);
    }
    
    setClauses.push(`profile_url = $${paramIndex++}`);
    params.push(merged.profile_url ?? null);
    
    setClauses.push(`image_url = $${paramIndex++}`);
    params.push(merged.image_url ?? null);
    
    setClauses.push(`phone_number = $${paramIndex++}`);
    params.push(merged.phone_number ?? null);
    
    setClauses.push(`github_username = $${paramIndex++}`);
    params.push(merged.github_username ?? null);
    
    setClauses.push(`linkedin_url = $${paramIndex++}`);
    params.push(merged.linkedin_url ?? null);
    
    if (merged.google_id !== undefined && merged.google_id !== null) {
      setClauses.push(`google_id = $${paramIndex++}`);
      params.push(merged.google_id);
    }
    
    if (merged.oauth_provider !== undefined && merged.oauth_provider !== null) {
      setClauses.push(`oauth_provider = $${paramIndex++}`);
      params.push(merged.oauth_provider);
    }
    
    setClauses.push(`updated_at = NOW()`);
    
    params.push(id); // For WHERE clause
    
    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider,
        created_at,
        updated_at,
        updated_by,
        deleted_at
      `;

    const { rows, rowCount } = await pool.query(query, params);

    if (rowCount === 0) throw new Error('User not found');
    return rows[0];
  }

  /**
   * Update a subset of user card fields (self-edit)
   * Only allows profile/contact/availability fields, not roles or email.
   * @param {string} id - User ID
   * @param {Object} data - Partial user card fields
   */
  static async updateCardFields(id, data = {}) {
    // Validate inputs
    const errors = [];
    if (data.linkedin_url && !validator.isURL(String(data.linkedin_url))) {
      errors.push('Invalid linkedin_url');
    }
    if (data.image_url && !validator.isURL(String(data.image_url))) {
      errors.push('Invalid image_url');
    }
    if (data.profile_url && !validator.isURL(String(data.profile_url))) {
      errors.push('Invalid profile_url');
    }
    if (data.academic_year !== undefined && data.academic_year !== null) {
      const year = Number(data.academic_year);
      if (!Number.isInteger(year)) {
        errors.push('Invalid academic_year');
      }
    }
    if (errors.length) {
      const error = new Error(errors.join(', '));
      error.name = 'VALIDATION_ERROR';
      throw error;
    }

    // Build dynamic SET clause only with provided fields
    const allowedFields = [
      'preferred_name',
      'phone_number',
      'github_username',
      'linkedin_url',
      'class_chat',
      'slack_handle',
      'availability_general',
      'availability_specific',
      'pronunciation',
      'department',
      'major',
      'degree_program',
      'academic_year',
      'profile_url',
      'image_url'
    ];

    const setClauses = [];
    const params = [];
    let idx = 1;

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push(data[field]);
      }
    });

    if (!setClauses.length) {
      const error = new Error('No updatable fields provided');
      error.name = 'VALIDATION_ERROR';
      throw error;
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}::uuid AND deleted_at IS NULL
      RETURNING
        id,
        email,
        name,
        preferred_name,
        phone_number,
        github_username,
        linkedin_url,
        class_chat,
        slack_handle,
        availability_general,
        availability_specific,
        pronunciation,
        department,
        major,
        degree_program,
        academic_year,
        profile_url,
        image_url,
        primary_role,
        status,
        updated_at
    `;

    const { rows, rowCount } = await pool.query(query, params);
    if (rowCount === 0) {
      const error = new Error('User not found');
      error.name = 'NOT_FOUND';
      throw error;
    }
    return rows[0];
  }

  /**
   * Find users by primary_role
   */
  static async findByRole(role, limit = 50, offset = 0) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider,
        created_at,
        updated_at,
        updated_by,
        deleted_at
      FROM users
      WHERE primary_role = $1 AND deleted_at IS NULL
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
      `,
      [role, lim, off]
    );
    return rows;
  }

  /**
   * Find users by institution_type
   */
  static async findByInstitutionType(institutionType, limit = 50, offset = 0) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        major,
        degree_program,
        academic_year,
        department,
        class_level,
        primary_role,
        status,
        institution_type,
        profile_url,
        image_url,
        phone_number,
        github_username,
        linkedin_url,
        google_id,
        oauth_provider,
        created_at,
        updated_at,
        updated_by,
        deleted_at
      FROM users
      WHERE institution_type = $1 AND deleted_at IS NULL
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
      `,
      [institutionType, lim, off]
    );
    return rows;
  }

  /**
   * Soft delete user (sets deleted_at)
   */
  static async delete(id) {
    const { rowCount } = await pool.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1::uuid AND deleted_at IS NULL',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Restore soft-deleted user
   */
  static async restore(id) {
    const { rowCount } = await pool.query(
      'UPDATE users SET deleted_at = NULL WHERE id = $1::uuid AND deleted_at IS NOT NULL',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Count users (excluding soft-deleted by default)
   */
  static async count(includeDeleted = false) {
    const deletedClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM users ${deletedClause}`
    );
    return rows[0].c;
  }

  /**
   * Get users enrolled in a course offering with specific role
   * @param {string} offeringId - Course offering ID
   * @param {string} courseRole - Course role ('ta', 'tutor', 'student')
   * @param {Object} options - Query options (limit, offset, search)
   */
  static async getUsersByOfferingRole(offeringId, courseRole, options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 100));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);

    let whereClause = `
      WHERE e.offering_id = $1::uuid 
        AND e.course_role = $2
        AND e.status = 'enrolled'
        AND u.deleted_at IS NULL
    `;
    const params = [offeringId, courseRole];

    // Add search if provided
    if (options.search) {
      const searchParam = `%${options.search}%`;
      const paramIndex = params.length + 1;
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.preferred_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(searchParam);
    }

    params.push(limit, offset);

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
        u.major,
        u.class_level,
        u.primary_role,
        u.status,
        e.course_role,
        e.status as enrollment_status
      FROM users u
      JOIN enrollments e ON e.user_id = u.id
      ${whereClause}
      ORDER BY u.name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );
    return rows;
  }
}
