import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/conductor.db');

/**
 * Database connection singleton
 */
class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   * @returns {Promise<sqlite3.Database>}
   */
  async connect() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(this.db);
        }
      });
    });
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }

  /**
   * Get database instance
   * @returns {sqlite3.Database}
   */
  getInstance() {
    return this.db;
  }
}

export default new Database();
