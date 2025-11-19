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
      // Log the actual error for debugging
      console.error(`[executeSql] Error executing ${description}:`, {
        code: error.code,
        message: error.message,
        detail: error.detail,
        hint: error.hint
      });
      
      // 42P01 = relation does not exist (this is an error, don't skip)
      if (error.code === '42P01') {
        throw new Error(`Failed to execute ${description}: ${error.message} (code: ${error.code})`);
      }
      
      // 42704 = undefined_object (type/object doesn't exist) - this is an error, don't skip
      if (error.code === '42704') {
        throw new Error(`Failed to execute ${description}: ${error.message} (code: ${error.code})`);
      }
      
      // Check if error is due to object already existing (idempotent operations)
      // 42P07 = duplicate_table, 42710 = duplicate_object
      // Only skip if it's truly a "already exists" error for CREATE statements
      if (error.code === '42P07' || error.code === '42710') {
        // Verify this is actually an "already exists" error by checking the message
        // AND that it's related to a CREATE statement (not a dependency issue)
        if (error.message && (
          error.message.includes('already exists') || 
          error.message.includes('duplicate')
        )) {
          // Only skip if this is clearly an idempotent CREATE operation
          // Don't skip if it's a dependency or constraint error
          if (!error.message.includes('depends on') && 
              !error.message.includes('constraint') &&
              !error.message.includes('foreign key')) {
            console.log(`⚠ ${description} skipped (already exists)`);
            return;
          }
        }
      }
      // For other errors, throw them - don't silently skip
      throw new Error(`Failed to execute ${description}: ${error.message} (code: ${error.code})`);
    }
  }

  /**
   * Discovers all numbered migration files in the migrations directory
   * @returns {Array<{file: string, number: number}>} Sorted array of migration files
   */
  static discoverMigrations() {
    const migrationsPath = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsPath);
    
    // Filter for numbered SQL files (e.g., 01-*.sql, 02-*.sql)
    const migrations = files
      .filter(file => /^\d{2,}-.+\.sql$/.test(file))
      .map(file => {
        const match = file.match(/^(\d+)-(.+)\.sql$/);
        return {
          file,
          number: parseInt(match[1], 10),
          description: match[2].replace(/-/g, ' '),
        };
      })
      .sort((a, b) => a.number - b.number); // Sort by number
    
    return migrations;
  }

  /**
   * Runs all migration files in order
   * Automatically discovers numbered migrations (01-*.sql, 02-*.sql, etc.)
   * @param {boolean} includeSeeds - Whether to run seed data migrations (files with "seed" in name)
   */
  static async runMigrations(includeSeeds = false) {
    const seedLabel = includeSeeds ? ' (including seeds)' : ' (schema only)';
    console.log(`[database] Running migrations${seedLabel}...\n`);

    const allMigrations = this.discoverMigrations();
    
    // Filter migrations: seeds are skipped unless includeSeeds is true
    const migrationsToRun = allMigrations.filter(migration => {
      const isSeed = migration.file.toLowerCase().includes('seed');
      return includeSeeds || !isSeed;
    });

    if (migrationsToRun.length === 0) {
      console.log('[database] No migrations found\n');
      return;
    }

    console.log(`[database] Found ${migrationsToRun.length} migration(s) to run:\n`);
    migrationsToRun.forEach(m => {
      const type = m.file.toLowerCase().includes('seed') ? '🌱 SEED' : '📋 SCHEMA';
      console.log(`  ${type}: ${m.file}`);
    });
    console.log('');

    for (const migration of migrationsToRun) {
      const sql = this.readMigrationFile(migration.file);
      await this.executeSql(sql, migration.description);
    }

    console.log(`\n[database] Migrations completed${seedLabel}\n`);
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

      const requiredColumns = ['id', 'email', 'name', 'primary_role', 'status', 'created_at', 'updated_at'];
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
        // If schema exists but seed is requested, run seed migrations
        // Seed files use ON CONFLICT, so they're safe to run multiple times
        if (seed) {
          console.log('[database] Running seed migrations (idempotent - safe to re-run)...\n');
          await this.runMigrations(true);
        }
        return;
      }

      // Run migrations (force will re-run everything)
      await this.runMigrations(seed);

      // Final verification
      const isValid = await this.verifySchema();
      if (!isValid) {
        console.error('[database] Schema verification failed. Database may be in an inconsistent state.');
        console.error('[database] Try running: npm run db:reset');
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
      // Drop all tables in correct order (respecting foreign keys)
      await pool.query(`
        DROP TABLE IF EXISTS activity_logs CASCADE;
        DROP TABLE IF EXISTS attendance CASCADE;
        DROP TABLE IF EXISTS submissions CASCADE;
        DROP TABLE IF EXISTS team_members CASCADE;
        DROP TABLE IF EXISTS team CASCADE;
        DROP TABLE IF EXISTS assignments CASCADE;
        DROP TABLE IF EXISTS enrollments CASCADE;
        DROP TABLE IF EXISTS course_offerings CASCADE;
        DROP TABLE IF EXISTS auth_logs CASCADE;
        DROP TABLE IF EXISTS access_requests CASCADE;
        DROP TABLE IF EXISTS whitelist CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        
        -- Drop permission tables (from migration 04)
        DROP TABLE IF EXISTS course_staff CASCADE;
        DROP TABLE IF EXISTS team_role_permissions CASCADE;
        DROP TABLE IF EXISTS enrollment_role_permissions CASCADE;
        DROP TABLE IF EXISTS user_role_permissions CASCADE;
        DROP TABLE IF EXISTS permissions CASCADE;
        
        -- Drop all ENUM types
        DROP TYPE IF EXISTS user_role_enum CASCADE;
        DROP TYPE IF EXISTS user_status_enum CASCADE;
        DROP TYPE IF EXISTS institution_type_enum CASCADE;
        DROP TYPE IF EXISTS course_role_enum CASCADE;
        DROP TYPE IF EXISTS enrollment_status_enum CASCADE;
        DROP TYPE IF EXISTS course_offering_status_enum CASCADE;
        DROP TYPE IF EXISTS assignment_type_enum CASCADE;
        DROP TYPE IF EXISTS assignment_assigned_to_enum CASCADE;
        DROP TYPE IF EXISTS team_status_enum CASCADE;
        DROP TYPE IF EXISTS team_member_role_enum CASCADE;
        DROP TYPE IF EXISTS submission_status_enum CASCADE;
        DROP TYPE IF EXISTS attendance_status_enum CASCADE;
        DROP TYPE IF EXISTS activity_action_type_enum CASCADE;
        
        -- Drop functions
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

