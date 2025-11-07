import validator from 'validator';
import { pool } from '../db.js';

const ROLES = ['admin', 'instructor', 'student'];

export class UserModel {
  static validate(data) {
    const errors = [];
    if (!data.email || !validator.isEmail(String(data.email))) {errors.push('Invalid email');}
    if (data.role && !ROLES.includes(data.role)) {errors.push('Invalid role');}
    if (data.academic_year !== undefined && data.academic_year !== null) {
      if (!Number.isInteger(data.academic_year)) {
        errors.push('Invalid academic_year');
      }
    }
    if (data.access_level !== undefined && data.access_level !== null) {
      if (!Number.isInteger(data.access_level)) {
        errors.push('Invalid access_level');
      }
    }
    if (data.linkedin_url && !validator.isURL(String(data.linkedin_url))) {errors.push('Invalid linkedin_url');}
    if (data.photo_url && !validator.isURL(String(data.photo_url))) {errors.push('Invalid photo_url');}
    if (data.image_url && !validator.isURL(String(data.image_url))) {errors.push('Invalid image_url');}
    return errors;
  }

  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      INSERT INTO users (
        email,
        ucsd_pid,
        name,
        preferred_name,
        pronouns,
        major,
        degree_program,
        academic_year,
        department,
        access_level,
        role,
        title,
        office,
        photo_url,
        image_url,
        github_username,
        linkedin_url,
        bio
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
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18
      )
      ON CONFLICT (email) DO UPDATE
      SET
        ucsd_pid        = COALESCE(EXCLUDED.ucsd_pid,        users.ucsd_pid),
        name            = COALESCE(EXCLUDED.name,            users.name),
        preferred_name  = COALESCE(EXCLUDED.preferred_name,  users.preferred_name),
        pronouns        = COALESCE(EXCLUDED.pronouns,        users.pronouns),
        major           = COALESCE(EXCLUDED.major,           users.major),
        degree_program  = COALESCE(EXCLUDED.degree_program,  users.degree_program),
        academic_year   = COALESCE(EXCLUDED.academic_year,   users.academic_year),
        department      = COALESCE(EXCLUDED.department,      users.department),
        access_level    = COALESCE(EXCLUDED.access_level,    users.access_level),
        role            = COALESCE(EXCLUDED.role,            users.role),
        title           = COALESCE(EXCLUDED.title,           users.title),
        office          = COALESCE(EXCLUDED.office,          users.office),
        photo_url       = COALESCE(EXCLUDED.photo_url,       users.photo_url),
        image_url       = COALESCE(EXCLUDED.image_url,       users.image_url),
        github_username = COALESCE(EXCLUDED.github_username, users.github_username),
        linkedin_url    = COALESCE(EXCLUDED.linkedin_url,    users.linkedin_url),
        bio             = COALESCE(EXCLUDED.bio,             users.bio),
        updated_at      = NOW()
      RETURNING
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        pronouns,
        major,
        degree_program,
        academic_year,
        department,
        access_level,
        role,
        title,
        office,
        photo_url,
        image_url,
        github_username,
        linkedin_url,
        bio,
        created_at,
        updated_at;
    `;
    const {
      email,
      ucsd_pid,
      name,
      preferred_name,
      pronouns,
      major,
      degree_program,
      academic_year,
      department,
      access_level,
      role,
      title,
      office,
      photo_url,
      image_url,
      github_username,
      linkedin_url,
      bio,
    } = data;

    const { rows } = await pool.query(query, [
      email,
      ucsd_pid ?? null,
      name ?? null,
      preferred_name ?? null,
      pronouns ?? null,
      major ?? null,
      degree_program ?? null,
      academic_year ?? null,
      department ?? null,
      access_level ?? null,
      role ?? null,
      title ?? null,
      office ?? null,
      photo_url ?? null,
      image_url ?? null,
      github_username ?? null,
      linkedin_url ?? null,
      bio ?? null,
    ]);
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        pronouns,
        major,
        degree_program,
        academic_year,
        department,
        access_level,
        role,
        title,
        office,
        photo_url,
        image_url,
        github_username,
        linkedin_url,
        bio,
        created_at,
        updated_at
      FROM users
      WHERE id = $1::uuid
      `,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByEmail(email) {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        pronouns,
        major,
        degree_program,
        academic_year,
        department,
        access_level,
        role,
        title,
        office,
        photo_url,
        image_url,
        github_username,
        linkedin_url,
        bio,
        created_at,
        updated_at
      FROM users
      WHERE email = $1::citext
      `,
      [String(email)]
    );
    return rows[0] ?? null;
  }

  static async findAll(limit = 50, offset = 0) {
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
        pronouns,
        major,
        degree_program,
        academic_year,
        department,
        access_level,
        role,
        title,
        office,
        photo_url,
        image_url,
        github_username,
        linkedin_url,
        bio,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at ASC, email ASC
      LIMIT $1 OFFSET $2
      `,
      [lim, off]
    );
    return rows;
  }

  static async update(id, data) {
    const current = await this.findById(id);
    if (!current) throw new Error('User not found');

    const merged = {
      ...current,
      ...data,
    };

    const errors = this.validate(merged);
    if (errors.length) throw new Error(errors.join(', '));

    const {
      email,
      ucsd_pid,
      name,
      preferred_name,
      pronouns,
      major,
      degree_program,
      academic_year,
      department,
      access_level,
      role,
      title,
      office,
      photo_url,
      image_url,
      github_username,
      linkedin_url,
      bio,
    } = merged;

    const { rows, rowCount } = await pool.query(
      `
      UPDATE users
      SET
        email           = LOWER($1)::citext,
        ucsd_pid        = $2,
        name            = $3,
        preferred_name  = $4,
        pronouns        = $5,
        major           = $6,
        degree_program  = $7,
        academic_year   = $8,
        department      = $9,
        access_level    = $10,
        role            = $11::user_role_enum,
        title           = $12,
        office          = $13,
        photo_url       = $14,
        image_url       = $15,
        github_username = $16,
        linkedin_url    = $17,
        bio             = $18,
        updated_at      = NOW()
      WHERE id = $19::uuid
      RETURNING
        id,
        email,
        ucsd_pid,
        name,
        preferred_name,
        pronouns,
        major,
        degree_program,
        academic_year,
        department,
        access_level,
        role,
        title,
        office,
        photo_url,
        image_url,
        github_username,
        linkedin_url,
        bio,
        created_at,
        updated_at
      `,
      [
        email,
        ucsd_pid,
        name,
        preferred_name,
        pronouns,
        major,
        degree_program,
        academic_year,
        department,
        access_level,
        role,
        title,
        office,
        photo_url,
        image_url,
        github_username,
        linkedin_url,
        bio,
        id,
      ]
    );

    if (rowCount === 0) throw new Error('User not found');
    return rows[0];
  }

  static async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM users WHERE id = $1::uuid',
      [id]
    );
    return rowCount > 0;
  }

  static async count() {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS c FROM users'
    );
    return rows[0].c;
  }
}
