import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database initialization and migration runner
 * Handles schema creation, migrations, and seed data
 */
export class DatabaseInitializer {
  /**
   * Reads SQL migration files from the migrations directory
   * @param {string} filename - Name of the migration file
   * @returns {string} SQL content
   */
  static readMigrationFile(filename) {
    const migrationsPath = path.join(__dirname, '../../migrations', filename);
    if (!fs.existsSync(migrationsPath)) {
      throw new Error(`Migration file not found: ${filename}`);
    }
    return fs.readFileSync(migrationsPath, 'utf-8');
  }

  /**
   * Executes a SQL script
   * @param {string} sql - SQL script content
   * @param {string} description - Description for logging
   */
  static async executeSql(sql, description = 'SQL script') {
    try {
      await pool.query(sql);
      console.log(`✓ ${description} executed successfully`);
    } catch (error) {
      // Check if error is due to object already existing (idempotent operations)
      if (error.code === '42P07' || error.code === '42710') {
        // Table or object already exists - this is OK for idempotent migrations
        console.log(`⚠ ${description} skipped (already exists)`);
        return;
      }
      throw new Error(`Failed to execute ${description}: ${error.message}`);
    }
  }

  /**
   * Runs all migration files in order
   * @param {boolean} includeSeeds - Whether to run seed data migrations
   */
  static async runMigrations(includeSeeds = false) {
    console.log('[database] Running migrations...\n');

    // Run schema migrations
    const schemaMigrations = [
      { file: '01-create-tables.sql', description: 'Create tables and schema' },
    ];

    for (const migration of schemaMigrations) {
      const sql = this.readMigrationFile(migration.file);
      await this.executeSql(sql, migration.description);
    }

    // Run seed migrations if requested
    if (includeSeeds) {
      const seedMigrations = [
        { file: '02-seed-demo-users.sql', description: 'Seed demo users' },
      ];

      for (const migration of seedMigrations) {
        const sql = this.readMigrationFile(migration.file);
        await this.executeSql(sql, migration.description);
      }
    }

    console.log('\n[database] Migrations completed\n');
  }

  /**
   * Verifies database schema is properly initialized
   * @returns {Promise<boolean>} True if schema is valid
   */
  static async verifySchema() {
    try {
      // Check if users table exists
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);

      if (!result.rows[0].exists) {
        console.log('[database] Users table not found');
        return false;
      }

      // Check if required columns exist
      const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public';
      `);

      const requiredColumns = ['id', 'email', 'ucsd_pid', 'role', 'created_at', 'updated_at'];
      const existingColumns = columnsResult.rows.map((row) => row.column_name);

      const missingColumns = requiredColumns.filter((col) => !existingColumns.includes(col));
      if (missingColumns.length > 0) {
        console.log(`[database] Missing columns: ${missingColumns.join(', ')}`);
        return false;
      }

      console.log('[database] Schema verification passed');
      return true;
    } catch (error) {
      console.error('[database] Schema verification failed:', error.message);
      return false;
    }
  }

  /**
   * Initializes the database: runs migrations and optionally seeds data
   * @param {Object} options - Initialization options
   * @param {boolean} options.seed - Whether to seed demo data
   * @param {boolean} options.force - Force re-run migrations even if schema exists
   */
  static async initialize(options = {}) {
    const { seed = false, force = false } = options;

    console.log('[database] Initializing database...\n');

    try {
      // Verify connection
      await pool.query('SELECT 1');
      console.log('[database] Database connection verified\n');

      // Check if schema already exists
      const schemaExists = await this.verifySchema();

      if (schemaExists && !force) {
        console.log('[database] Schema already initialized. Use force=true to re-run migrations.\n');
        return;
      }

      // Run migrations
      await this.runMigrations(seed);

      // Final verification
      const isValid = await this.verifySchema();
      if (!isValid) {
        throw new Error('Schema verification failed after initialization');
      }

      console.log('[database] Database initialization completed successfully\n');
    } catch (error) {
      console.error('[database] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Drops all tables (use with caution!)
   * Useful for testing or complete reset
   */
  static async dropAllTables() {
    console.log('[database] Dropping all tables...\n');

    try {
      await pool.query(`
        DROP TABLE IF EXISTS users CASCADE;
        DROP TYPE IF EXISTS user_role CASCADE;
        DROP TYPE IF EXISTS user_status CASCADE;
        DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
      `);

      console.log('[database] All tables dropped\n');
    } catch (error) {
      console.error('[database] Failed to drop tables:', error.message);
      throw error;
    }
  }

  /**
   * Resets the database: drops all tables and re-initializes
   * @param {boolean} seed - Whether to seed demo data after reset
   */
  static async reset(seed = false) {
    console.log('[database] Resetting database...\n');
    await this.dropAllTables();
    await this.initialize({ seed, force: true });
  }
}

