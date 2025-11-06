import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, dbType } from '../db.js';

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
      // Split SQL into individual statements for SQLite compatibility
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement.trim());
        }
      }
      console.log(`✓ ${description} executed successfully`);
    } catch (error) {
      // Check if error is due to object already existing (idempotent operations)
      if (error.code === '42P07' || error.code === '42710' || 
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate column name')) {
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
    console.log(`[database] Running ${dbType} migrations...\n`);

    // Run schema migrations based on database type
    const schemaMigrations = [];
    
    if (dbType === 'postgresql') {
      schemaMigrations.push(
        { file: '01-create-users.sql', description: 'Create users table and schema' },
        { file: '03-create-roles-permissions.sql', description: 'Create role-based access control system' }
      );
    } else {
      schemaMigrations.push(
        { file: '01-create-users-sqlite.sql', description: 'Create users table and schema (SQLite)' },
        { file: '03-create-roles-permissions-sqlite.sql', description: 'Create role-based access control system (SQLite)' },
        { file: '04-seed-role-permissions.sql', description: 'Seed role permissions' }
      );
    }

    for (const migration of schemaMigrations) {
      try {
        const sql = this.readMigrationFile(migration.file);
        await this.executeSql(sql, migration.description);
      } catch (error) {
        console.error(`Failed to run migration ${migration.file}:`, error.message);
        throw error;
      }
    }

    // Run seed migrations if requested
    if (includeSeeds) {
      const seedMigrations = [
        { file: '02-seed-demo-users.sql', description: 'Seed demo users' },
      ];

      for (const migration of seedMigrations) {
        try {
          const sql = this.readMigrationFile(migration.file);
          await this.executeSql(sql, migration.description);
        } catch (error) {
          console.log(`⚠ ${migration.description} failed: ${error.message}`);
        }
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
      if (dbType === 'postgresql') {
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

        const requiredColumns = ['id', 'name', 'email', 'created_at', 'updated_at'];
        const existingColumns = columnsResult.rows.map((row) => row.column_name);

        const missingColumns = requiredColumns.filter((col) => !existingColumns.includes(col));
        if (missingColumns.length > 0) {
          console.log(`[database] Missing columns: ${missingColumns.join(', ')}`);
          return false;
        }
      } else {
        // SQLite verification
        const result = await pool.query(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='users';
        `);

        if (result.rows.length === 0) {
          console.log('[database] Users table not found');
          return false;
        }
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

    console.log(`[database] Initializing ${dbType} database...\n`);

    try {
      // Verify connection
      await pool.query('SELECT 1');
      console.log('[database] Database connection verified\n');

      // Check if schema already exists
      const schemaExists = await this.verifySchema();

      if (schemaExists && !force) {
        console.log('[database] Schema already initialized. Use --force to re-run migrations.\n');
        
        // Still run role system migration if it doesn't exist
        try {
          await pool.query('SELECT 1 FROM courses LIMIT 1');
          console.log('[database] Role system already initialized\n');
        } catch (error) {
          console.log('[database] Role system not found, initializing...\n');
          await this.runRoleSystemMigration();
        }
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
   * Run just the role system migration
   */
  static async runRoleSystemMigration() {
    const migrationFile = dbType === 'postgresql' 
      ? '03-create-roles-permissions.sql'
      : '03-create-roles-permissions-sqlite.sql';
    
    try {
      const sql = this.readMigrationFile(migrationFile);
      await this.executeSql(sql, 'Create role-based access control system');
    } catch (error) {
      console.error('Failed to run role system migration:', error.message);
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
      if (dbType === 'postgresql') {
        await pool.query(`
          DROP TABLE IF EXISTS role_audit_log CASCADE;
          DROP TABLE IF EXISTS user_course_roles CASCADE;
          DROP TABLE IF EXISTS role_permissions CASCADE;
          DROP TABLE IF EXISTS courses CASCADE;
          DROP TABLE IF EXISTS users CASCADE;
          DROP TYPE IF EXISTS app_role CASCADE;
          DROP TYPE IF EXISTS permission_type CASCADE;
          DROP TYPE IF EXISTS user_role CASCADE;
          DROP TYPE IF EXISTS user_status CASCADE;
          DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
        `);
      } else {
        // SQLite
        await pool.query('DROP TABLE IF EXISTS role_audit_log');
        await pool.query('DROP TABLE IF EXISTS user_course_roles');
        await pool.query('DROP TABLE IF EXISTS role_permissions');
        await pool.query('DROP TABLE IF EXISTS courses');
        await pool.query('DROP TABLE IF EXISTS users');
      }

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

