import validator from 'validator';
import { pool, dbType } from '../db.js';

const ROLES = ['user', 'admin', 'moderator'];
const STATUSES = ['active', 'disabled', 'archived'];

export class UserModel {
  static validate(data) {
    const errors = [];
    if (!data.name || data.name.trim().length < 2) errors.push('Name too short');
    if (!data.email || !validator.isEmail(String(data.email))) errors.push('Invalid email');
    if (data.system_role && !ROLES.includes(data.system_role)) errors.push('Invalid system role');
    if (data.status && !STATUSES.includes(data.status)) errors.push('Invalid status');
    return errors;
  }

  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    if (dbType === 'postgresql') {
      const query = `
        INSERT INTO users (name, email, system_role, status)
        VALUES ($1, LOWER($2), COALESCE($3,'user')::user_role, COALESCE($4,'active')::user_status)
        ON CONFLICT (email) DO UPDATE
          SET name = EXCLUDED.name,
              system_role = EXCLUDED.system_role,
              status = EXCLUDED.status,
              updated_at = now()
        RETURNING id, name, email, system_role, status, created_at, updated_at;
      `;
      const { rows } = await pool.query(query, [
        data.name.trim(),
        String(data.email).toLowerCase(),
        data.system_role ?? 'user',
        data.status ?? 'active',
      ]);
      return rows[0];
    } else {
      // SQLite
      const query = `
        INSERT OR REPLACE INTO users (name, email, system_role, status)
        VALUES (?, ?, ?, ?)
      `;
      const { rows } = await pool.query(query, [
        data.name.trim(),
        String(data.email).toLowerCase(),
        data.system_role ?? 'user',
        data.status ?? 'active',
      ]);
      
      // Get the created user
      return await this.findByEmail(data.email);
    }
  }

  static async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, name, email, system_role, status, created_at, updated_at FROM users WHERE id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findAll(limit = 50, offset = 0) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    const { rows } = await pool.query(
      `SELECT id, name, email, system_role, status, created_at, updated_at
       FROM users
       ORDER BY created_at ASC, email ASC
       LIMIT ? OFFSET ?`,
      [lim, off]
    );
    return rows;
  }

  static async update(id, data) {
    const current = await this.findById(id);
    if (!current) throw new Error('User not found');

    const name = (data.name?.trim() ?? current.name);
    const email = (data.email ?? current.email);
    const system_role = (data.system_role ?? current.system_role);
    const status = (data.status ?? current.status);

    const { rowCount } = await pool.query(
      `UPDATE users
       SET name = ?, email = ?, system_role = ?, status = ?
       WHERE id = ?`,
      [name, email, system_role, status, id]
    );
    
    if (rowCount === 0) throw new Error('User not found');
    return await this.findById(id);
  }

  static async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return rowCount > 0;
  }

  static async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT id, name, email, system_role, status, created_at, updated_at
       FROM users
       WHERE email = ? COLLATE NOCASE`,
      [String(email)]
    );
    return rows[0] ?? null;
  }

  static async count() {
    const { rows } = await pool.query('SELECT COUNT(*) AS c FROM users');
    return rows[0].c;
  }
}

