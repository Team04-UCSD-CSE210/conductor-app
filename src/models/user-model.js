import validator from 'validator';
import { pool } from '../db.js';

// Global roles for system/dashboard access
const ROLES = ['admin', 'instructor', 'student'];
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
   */
  static determineInstitutionType(email) {
    if (!email) return null;
    const emailLower = String(email).toLowerCase().trim();
    if (emailLower.endsWith('@ucsd.edu')) {
      return 'ucsd';
    }
    // Extension students typically use gmail or other non-ucsd.edu emails
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
    const institutionType = data.institution_type ?? this.determineInstitutionType(data.email);

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
        linkedin_url
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
        COALESCE($10, 'student'),
        COALESCE($11, 'active'),
        $12,
        $13,
        $14,
        $15,
        $16,
        $17
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
        primary_role    = COALESCE(EXCLUDED.primary_role,    users.primary_role),
        status          = COALESCE(EXCLUDED.status,          users.status),
        institution_type = COALESCE(EXCLUDED.institution_type, users.institution_type),
        profile_url     = COALESCE(EXCLUDED.profile_url,     users.profile_url),
        image_url       = COALESCE(EXCLUDED.image_url,       users.image_url),
        phone_number    = COALESCE(EXCLUDED.phone_number,    users.phone_number),
        github_username = COALESCE(EXCLUDED.github_username, users.github_username),
        linkedin_url    = COALESCE(EXCLUDED.linkedin_url,    users.linkedin_url),
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
      institutionType,
      data.profile_url ?? null,
      data.image_url ?? null,
      data.phone_number ?? null,
      data.github_username ?? null,
      data.linkedin_url ?? null,
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
        created_at,
        updated_at,
        updated_by,
        deleted_at
      FROM users
      WHERE email = $1::citext ${deletedClause}
      `,
      [String(email)]
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

    const query = `
      UPDATE users
      SET
        email           = LOWER($1)::citext,
        ucsd_pid        = $2,
        name            = $3,
        preferred_name  = $4,
        major           = $5,
        degree_program  = $6,
        academic_year   = $7,
        department      = $8,
        class_level     = $9,
        primary_role    = $10,
        status          = $11,
        institution_type = $12,
        profile_url     = $13,
        image_url       = $14,
        phone_number    = $15,
        github_username = $16,
        linkedin_url    = $17,
        updated_at      = NOW()
      WHERE id = $18::uuid
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
        created_at,
        updated_at,
        updated_by,
        deleted_at
      `;

    const { rows, rowCount } = await pool.query(query, [
      merged.email,
      merged.ucsd_pid ?? null,
      merged.name ?? null,
      merged.preferred_name ?? null,
      merged.major ?? null,
      merged.degree_program ?? null,
      merged.academic_year ?? null,
      merged.department ?? null,
      merged.class_level ?? null,
      merged.primary_role ?? 'student',
      merged.status ?? 'active',
      merged.institution_type ?? null,
      merged.profile_url ?? null,
      merged.image_url ?? null,
      merged.phone_number ?? null,
      merged.github_username ?? null,
      merged.linkedin_url ?? null,
      id,
    ]);

    if (rowCount === 0) throw new Error('User not found');
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
}
