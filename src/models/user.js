import validator from 'validator';
import database from '../database/database.js';

/**
 * User model with validation and CRUD operations
 */
export class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.email = data.email || '';
    this.role = data.role || 'user';
    this.status = data.status || 'active';
    this.createdAt = data.created_at || null;
    this.updatedAt = data.updated_at || null;
  }

  /**
   * Validate user data
   * @returns {Object} validation result
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (!validator.isEmail(this.email)) {
      errors.push('Invalid email format');
    }

    if (!['user', 'admin', 'moderator'].includes(this.role)) {
      errors.push('Role must be user, admin, or moderator');
    }

    if (!['active', 'inactive', 'suspended'].includes(this.status)) {
      errors.push('Status must be active, inactive, or suspended');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize user input
   * @returns {User} sanitized user instance
   */
  sanitize() {
    this.name = validator.escape(this.name.trim());
    this.email = validator.normalizeEmail(this.email);
    this.role = this.role.toLowerCase();
    this.status = this.status.toLowerCase();
    return this;
  }

  /**
   * Create new user
   * @returns {Promise<User>}
   */
  async save() {
    this.sanitize();
    const validation = this.validate();
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const db = database.getInstance();
    const self = this;
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO users (name, email, role, status)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run([self.name, self.email, self.role, self.status], function(err) {
        if (err) {
          reject(new Error(`Failed to create user: ${err.message}`));
        } else {
          self.id = this.lastID;
          resolve(self);
        }
      });
      
      stmt.finalize();
    });
  }

  /**
   * Update existing user
   * @returns {Promise<User>}
   */
  async update() {
    if (!this.id) {
      throw new Error('Cannot update user without ID');
    }

    this.sanitize();
    const validation = this.validate();
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const db = database.getInstance();
    const self = this;
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, role = ?, status = ?
        WHERE id = ?
      `);
      
      stmt.run([self.name, self.email, self.role, self.status, self.id], function(err) {
        if (err) {
          reject(new Error(`Failed to update user: ${err.message}`));
        } else if (this.changes === 0) {
          reject(new Error('User not found'));
        } else {
          resolve(self);
        }
      });
      
      stmt.finalize();
    });
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<User|null>}
   */
  static async findById(id) {
    const db = database.getInstance();
    
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(new Error(`Failed to find user: ${err.message}`));
        } else {
          resolve(row ? new User(row) : null);
        }
      });
    });
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<User|null>}
   */
  static async findByEmail(email) {
    const db = database.getInstance();
    
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          reject(new Error(`Failed to find user: ${err.message}`));
        } else {
          resolve(row ? new User(row) : null);
        }
      });
    });
  }

  /**
   * Get all users with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Array<User>>}
   */
  static async findAll(options = {}) {
    const { limit = 50, offset = 0, role, status } = options;
    const db = database.getInstance();
    
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    
    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(new Error(`Failed to fetch users: ${err.message}`));
        } else {
          resolve(rows.map(row => new User(row)));
        }
      });
    });
  }

  /**
   * Delete user by ID
   * @param {number} id - User ID
   * @returns {Promise<boolean>}
   */
  static async deleteById(id) {
    const db = database.getInstance();
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      
      stmt.run([id], function(err) {
        if (err) {
          reject(new Error(`Failed to delete user: ${err.message}`));
        } else {
          resolve(this.changes > 0);
        }
      });
      
      stmt.finalize();
    });
  }

  /**
   * Get user count for performance testing
   * @returns {Promise<number>}
   */
  static async count() {
    const db = database.getInstance();
    
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
          reject(new Error(`Failed to count users: ${err.message}`));
        } else {
          resolve(row.count);
        }
      });
    });
  }
}
