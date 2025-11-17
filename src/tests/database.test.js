import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../db.js';
import { DatabaseInitializer } from '../database/init.js';

describe('Database Connection and Initialization', () => {
  beforeAll(async () => {
    // Verify connection before tests
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // Don't close pool - other tests may need it
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      const result = await pool.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should execute queries without errors', async () => {
      const result = await pool.query('SELECT NOW() as current_time');
      expect(result.rows[0].current_time).toBeDefined();
      expect(result.rows[0].current_time).toBeInstanceOf(Date);
    });

    it('should handle connection errors gracefully', async () => {
      // Test with invalid query (should throw)
      await expect(
        pool.query('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });
  });

  describe('Database Schema', () => {
    it('should have users table', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have auth_logs table', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'auth_logs'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have whitelist table', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'whitelist'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have access_requests table', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'access_requests'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have enrollments table', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'enrollments'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have course_offerings table', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'course_offerings'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have required columns in users table', async () => {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
        AND column_name IN ('id', 'email', 'name', 'primary_role', 'status', 'google_id', 'oauth_provider', 'created_at', 'updated_at');
      `);
      
      const columns = result.rows.map(row => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('email');
      expect(columns).toContain('name');
      expect(columns).toContain('primary_role');
      expect(columns).toContain('status');
      expect(columns).toContain('google_id');
      expect(columns).toContain('oauth_provider');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have required columns in auth_logs table', async () => {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'auth_logs' 
        AND table_schema = 'public'
        AND column_name IN ('id', 'event_type', 'message', 'user_email', 'ip_address', 'user_id', 'path', 'metadata', 'created_at');
      `);
      
      const columns = result.rows.map(row => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('event_type');
      expect(columns).toContain('message');
      expect(columns).toContain('user_email');
      expect(columns).toContain('created_at');
    });

    it('should have user_role_enum with correct values', async () => {
      const result = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role_enum')
        ORDER BY enumsortorder;
      `);
      
      const values = result.rows.map(row => row.enumlabel);
      expect(values).toContain('admin');
      expect(values).toContain('instructor');
      expect(values).toContain('student');
      expect(values).toContain('unregistered');
    });
  });

  describe('DatabaseInitializer', () => {
    it('should verify schema successfully', async () => {
      const isValid = await DatabaseInitializer.verifySchema();
      expect(isValid).toBe(true);
    });

    it('should discover migration files', () => {
      const migrations = DatabaseInitializer.discoverMigrations();
      expect(Array.isArray(migrations)).toBe(true);
      expect(migrations.length).toBeGreaterThan(0);
      
      // Check that migrations are sorted by number
      for (let i = 1; i < migrations.length; i++) {
        expect(migrations[i].number).toBeGreaterThanOrEqual(migrations[i - 1].number);
      }
    });

    it('should read migration file', () => {
      const migrations = DatabaseInitializer.discoverMigrations();
      if (migrations.length > 0) {
        const sql = DatabaseInitializer.readMigrationFile(migrations[0].file);
        expect(typeof sql).toBe('string');
        expect(sql.length).toBeGreaterThan(0);
      }
    });

    it('should throw error for non-existent migration file', () => {
      expect(() => {
        DatabaseInitializer.readMigrationFile('999-nonexistent.sql');
      }).toThrow('Migration file not found');
    });
  });

  describe('Database Transactions', () => {
    it('should support transactions', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Insert test data
        await client.query(`
          INSERT INTO users (email, name, primary_role, status, institution_type)
          VALUES ('transaction-test@example.com', 'Test User', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        `);
        
        // Verify it exists in transaction
        const result = await client.query(`
          SELECT * FROM users WHERE email = 'transaction-test@example.com'
        `);
        expect(result.rows.length).toBe(1);
        
        // Rollback
        await client.query('ROLLBACK');
        
        // Verify it doesn't exist after rollback
        const afterRollback = await pool.query(`
          SELECT * FROM users WHERE email = 'transaction-test@example.com'
        `);
        expect(afterRollback.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });

  describe('Database Indexes', () => {
    it('should have index on users.email', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_email';
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should have index on users.google_id', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_google_id';
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should have index on auth_logs.user_email', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'auth_logs' 
        AND indexname LIKE '%user_email%';
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
