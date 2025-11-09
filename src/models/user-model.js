import validator from 'validator';
import { pool } from '../db.js';

// Global roles for system/dashboard access
const ROLES = ['admin', 'instructor', 'student'];
const STATUSES = ['active', 'suspended', 'inactive'];
const AUTH_SOURCES = ['ucsd', 'extension'];

/**
 * User Model - Handles user data operations with soft delete support
 * Supports new schema fields: auth_source, status, password_hash, deleted_at, etc.
 */
export class UserModel {
  /**
   * Validate user data before create/update
   */
  static validate(data) {
    const errors = [];
    
    // Email validation
    if (!data.email || !validator.isEmail(String(data.email))) {
      errors.push('Invalid email');
    }
    
    // Role validation
    if (data.role && !ROLES.includes(data.role)) {
      errors.push(`Invalid role. Must be one of: ${ROLES.join(', ')}`);
    }
    
    // Status validation
    if (data.status && !STATUSES.includes(data.status)) {
      errors.push(`Invalid status. Must be one of: ${STATUSES.join(', ')}`);
    }
    
    // Auth source validation
    if (data.auth_source && !AUTH_SOURCES.includes(data.auth_source)) {
      errors.push(`Invalid auth_source. Must be one of: ${AUTH_SOURCES.join(', ')}`);
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
    if (data.photo_url && !validator.isURL(String(data.photo_url))) {
      errors.push('Invalid photo_url');
    }
    if (data.image_url && !validator.isURL(String(data.image_url))) {
      errors.push('Invalid image_url');
    }
    if (data.profile_url && !validator.isURL(String(data.profile_url))) {
      errors.push('Invalid profile_url');
    }
    if (data.phone_url && !validator.isURL(String(data.phone_url))) {
      errors.push('Invalid phone_url');
    }
    if (data.openai_url && !validator.isURL(String(data.openai_url))) {
      errors.push('Invalid openai_url');
    }
    
    return errors;
  }

  /**
   * Create a new user (with soft delete support)
   */
  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      INSERT INTO users (
        email,
        password_hash,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url
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
        $10,
        COALESCE($11, 'student')::user_role_enum,
        COALESCE($12, 'active')::user_status_enum,
        $13::auth_source_enum,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19
      )
      ON CONFLICT (email) DO UPDATE
      SET
        name            = COALESCE(EXCLUDED.name,            users.name),
        preferred_name  = COALESCE(EXCLUDED.preferred_name,  users.preferred_name),
        major           = COALESCE(EXCLUDED.major,           users.major),
        bio             = COALESCE(EXCLUDED.bio,             users.bio),
        academic_year   = COALESCE(EXCLUDED.academic_year,   users.academic_year),
        department      = COALESCE(EXCLUDED.department,      users.department),
        class_level     = COALESCE(EXCLUDED.class_level,     users.class_level),
        role            = COALESCE(EXCLUDED.role,            users.role),
        status          = COALESCE(EXCLUDED.status,          users.status),
        auth_source     = COALESCE(EXCLUDED.auth_source,     users.auth_source),
        profile_url     = COALESCE(EXCLUDED.profile_url,     users.profile_url),
        image_url       = COALESCE(EXCLUDED.image_url,       users.image_url),
        phone_url       = COALESCE(EXCLUDED.phone_url,       users.phone_url),
        github_username = COALESCE(EXCLUDED.github_username, users.github_username),
        linkedin_url    = COALESCE(EXCLUDED.linkedin_url,    users.linkedin_url),
        openai_url      = COALESCE(EXCLUDED.openai_url,      users.openai_url),
        deleted_at      = NULL,
        updated_at      = NOW()
      RETURNING
        id,
        email,
        password_hash,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url,
        deleted_at,
        created_at,
        updated_at;
    `;
    
    const { rows } = await pool.query(query, [
      data.email,
      data.password_hash ?? null,
      data.user_id ?? null,
      data.name ?? null,
      data.preferred_name ?? null,
      data.major ?? null,
      data.bio ?? null,
      data.academic_year ?? null,
      data.department ?? null,
      data.class_level ?? null,
      data.role ?? null,
      data.status ?? null,
      data.auth_source ?? null,
      data.profile_url ?? null,
      data.image_url ?? null,
      data.phone_url ?? null,
      data.github_username ?? null,
      data.linkedin_url ?? null,
      data.openai_url ?? null,
    ]);
    
    return rows[0];
  }

  /**
   * Find user by ID (excludes soft-deleted users)
   */
  static async findById(id, includeDeleted = false) {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        password_hash,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url,
        deleted_at,
        created_at,
        updated_at
      FROM users
      WHERE id = $1::uuid ${deletedClause}
      `,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Find user by email (excludes soft-deleted users)
   */
  static async findByEmail(email, includeDeleted = false) {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        password_hash,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url,
        deleted_at,
        created_at,
        updated_at
      FROM users
      WHERE email = $1::citext ${deletedClause}
      `,
      [String(email)]
    );
    return rows[0] ?? null;
  }

  /**
   * Find user by user_id (excludes soft-deleted users)
   */
  static async findByUserId(userId, includeDeleted = false) {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        password_hash,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url,
        deleted_at,
        created_at,
        updated_at
      FROM users
      WHERE user_id = $1 ${deletedClause}
      `,
      [userId]
    );
    return rows[0] ?? null;
  }

  /**
   * Find all users with pagination (excludes soft-deleted by default)
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
        password_hash,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url,
        deleted_at,
        created_at,
        updated_at
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
   * Update user (preserves deleted_at if user is soft-deleted)
   */
  static async update(id, data) {
    const current = await this.findById(id, true); // Include deleted to check existence
    if (!current) throw new Error('User not found');

    const merged = {
      ...current,
      ...data,
    };

    const errors = this.validate(merged);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      UPDATE users
      SET
        email           = LOWER($1)::citext,
        password_hash   = COALESCE($2, users.password_hash),
        user_id         = COALESCE($3, users.user_id),
        name            = $4,
        preferred_name  = $5,
        major           = $6,
        bio             = $7,
        academic_year   = $8,
        department      = $9,
        class_level     = $10,
        role            = $11::user_role_enum,
        status          = $12::user_status_enum,
        auth_source     = $13::auth_source_enum,
        profile_url     = $14,
        image_url       = $15,
        phone_url       = $16,
        github_username = $17,
        linkedin_url    = $18,
        openai_url      = $19,
        updated_at      = NOW()
      WHERE id = $20::uuid
      RETURNING
        id,
        email,
        password_hash,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url,
        deleted_at,
        created_at,
        updated_at
      `;

    const { rows, rowCount } = await pool.query(query, [
      merged.email,
      merged.password_hash ?? null,
      merged.user_id ?? null,
      merged.name ?? null,
      merged.preferred_name ?? null,
      merged.major ?? null,
      merged.bio ?? null,
      merged.academic_year ?? null,
      merged.department ?? null,
      merged.class_level ?? null,
      merged.role,
      merged.status ?? 'active',
      merged.auth_source ?? null,
      merged.profile_url ?? null,
      merged.image_url ?? null,
      merged.phone_url ?? null,
      merged.github_username ?? null,
      merged.linkedin_url ?? null,
      merged.openai_url ?? null,
      id,
    ]);

    if (rowCount === 0) throw new Error('User not found');
    return rows[0];
  }

  /**
   * Soft delete user (sets deleted_at timestamp)
   */
  static async delete(id) {
    const { rowCount } = await pool.query(
      `UPDATE users 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND deleted_at IS NULL
       RETURNING id, deleted_at`,
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Restore soft-deleted user (clears deleted_at)
   */
  static async restore(id) {
    const { rowCount } = await pool.query(
      `UPDATE users 
       SET deleted_at = NULL, updated_at = NOW()
       WHERE id = $1::uuid AND deleted_at IS NOT NULL
       RETURNING id, deleted_at`,
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Hard delete user (permanent removal - use with caution)
   */
  static async hardDelete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM users WHERE id = $1::uuid',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Count users (excludes soft-deleted by default)
   */
  static async count(includeDeleted = false) {
    const deletedClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM users ${deletedClause}`
    );
    return rows[0].c;
  }

  /**
   * Find users by role
   */
  static async findByRole(role, limit = 50, offset = 0) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        user_id,
        name,
        preferred_name,
        major,
        bio,
        academic_year,
        department,
        class_level,
        role,
        status,
        auth_source,
        profile_url,
        image_url,
        phone_url,
        github_username,
        linkedin_url,
        openai_url,
        created_at,
        updated_at
      FROM users
      WHERE role = $1::user_role_enum AND deleted_at IS NULL
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
      `,
      [role, lim, off]
    );
    return rows;
  }

  /**
   * Find users by auth_source
   */
  static async findByAuthSource(authSource, limit = 50, offset = 0) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        user_id,
        name,
        preferred_name,
        major,
        role,
        status,
        auth_source,
        created_at,
        updated_at
      FROM users
      WHERE auth_source = $1::auth_source_enum AND deleted_at IS NULL
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
      `,
      [authSource, lim, off]
    );
    return rows;
  }
}
