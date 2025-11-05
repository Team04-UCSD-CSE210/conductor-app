import validator from 'validator';
import { getDb } from './db.js';

export class User {
  static validate(data) {
    const errors = [];
    if (!data.name || data.name.length < 2) errors.push('Name too short');
    if (!validator.isEmail(data.email)) errors.push('Invalid email');
    if (data.role && !['user', 'admin', 'moderator'].includes(data.role)) errors.push('Invalid role');
    return errors;
  }

  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const db = getDb();
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO users (name, email, role) VALUES (?, ?, ?)', 
        [data.name, data.email, data.role || 'user'], 
        function(err) {
          if (err) reject(new Error(err.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Email exists' : err.message));
          else resolve({ id: this.lastID, ...data });
        });
    });
  }

  static async findById(id) {
    const db = getDb();
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  static async findAll(limit = 50, offset = 0) {
    const db = getDb();
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?', 
        [limit, offset], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
    });
  }

  static async update(id, data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const db = getDb();
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
        [data.name, data.email, data.role, id],
        function(err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('User not found'));
          else resolve({ id, ...data });
        });
    });
  }

  static async delete(id) {
    const db = getDb();
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }
}
