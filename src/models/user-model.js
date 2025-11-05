import validator from 'validator';
import { pool } from '../db.js';

const ROLES = ['user', 'admin', 'moderator'];
const STATUSES = ['active', 'disabled', 'archived'];

export class UserModel {
  static validate(data) {
    const errors = [];
    if (!data.name || data.name.trim().length < 2) errors.push('Name too short');
    if (!data.email || !validator.isEmail(String(data.email))) errors.push('Invalid email');
    if (data.role && !ROLES.includes(data.role)) errors.push('Invalid role');
    if (data.status && !STATUSES.includes(data.status)) errors.push('Invalid status');
    return errors;
  }

  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      INSERT INTO users (name, email, role, status)
      VALUES ($1, LOWER($2), COALESCE($3,'user')::user_role, COALESCE($4,'active')::user_status)
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            role = EXCLUDED.role,
            status = EXCLUDED.status,
            updated_at = now()
      RETURNING id, name, email, role, status, created_at, updated_at;
    `;
    const { rows } = await pool.query(query, [
      data.name.trim(),
      String(data.email).toLowerCase(),
      data.role ?? 'user',
      data.status ?? 'active',
    ]);
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, created_at, updated_at FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findAll(limit = 50, offset = 0) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, created_at, updated_at
       FROM users
       ORDER BY created_at ASC, email ASC
       LIMIT $1 OFFSET $2`,
      [lim, off]
    );
    return rows;
  }

  static async update(id, data) {
  // Load current row first to avoid writing "undefined" or nulls accidentally
  const current = await this.findById(id);
  if (!current) throw new Error('User not found');

  const name   = (data.name?.trim() ?? current.name);
  const email  = (data.email ?? current.email);
  const role   = (data.role  ?? current.role);
  const status = (data.status ?? current.status);

  const { rows, rowCount } = await pool.query(
    `UPDATE users
       SET name = $1,
           email = $2::citext,
           role = $3::user_role,
           status = $4::user_status,
           updated_at = NOW()
     WHERE id = $5::uuid
     RETURNING id, name, email, role, status, created_at, updated_at`,
    [name, email, role, status, id]
  );
  if (rowCount === 0) throw new Error('User not found');
  return rows[0];
  }

  static async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return rowCount > 0;
  }

  static async findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, status, created_at, updated_at
     FROM users
     WHERE email = $1::citext`,
    [String(email)]
  );
  return rows[0] ?? null;
  }

  static async count() {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    return rows[0].c;
  }
}

