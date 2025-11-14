import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';

/**
 * Test auth_logs table functionality
 * Replaces the old Sequelize-based auth-log.test.js
 */
describe('Auth Logs (Postgres)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1'); // connection sanity
  });

  beforeEach(async () => {
    // Clean up auth logs before each test
    await pool.query('TRUNCATE TABLE auth_logs RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    // Don't close pool - other tests may need it
  });

  describe('Auth Log Creation', () => {
    it('should create auth log with minimal fields', async () => {
      const result = await pool.query(`
        INSERT INTO auth_logs (event_type, message, user_email)
        VALUES ($1, $2, $3)
        RETURNING *
      `, ['LOGIN_SUCCESS', 'User logged in', 'test@example.com']);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].event_type).toBe('LOGIN_SUCCESS');
      expect(result.rows[0].message).toBe('User logged in');
      expect(result.rows[0].user_email).toBe('test@example.com');
      expect(result.rows[0].id).toBeDefined();
      expect(result.rows[0].created_at).toBeDefined();
    });

    it('should create auth log with all fields', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const metadata = { attempts: 2, reason: 'rate_limited' };
      
      const result = await pool.query(`
        INSERT INTO auth_logs (event_type, message, user_email, ip_address, user_id, path, metadata)
        VALUES ($1, $2, $3, $4, $5::uuid, $6, $7::jsonb)
        RETURNING *
      `, [
        'LOGIN_FAILURE',
        'Login failed due to rate limit',
        'user@example.com',
        '192.168.1.1',
        userId,
        '/auth/google/callback',
        JSON.stringify(metadata)
      ]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].event_type).toBe('LOGIN_FAILURE');
      expect(result.rows[0].user_email).toBe('user@example.com');
      expect(result.rows[0].ip_address).toBe('192.168.1.1');
      expect(result.rows[0].user_id).toBe(userId);
      expect(result.rows[0].path).toBe('/auth/google/callback');
      expect(result.rows[0].metadata).toEqual(metadata);
    });

    it('should create auth log with default empty metadata', async () => {
      const result = await pool.query(`
        INSERT INTO auth_logs (event_type, message, user_email)
        VALUES ($1, $2, $3)
        RETURNING *
      `, ['LOGIN_SUCCESS', 'User logged in', 'test@example.com']);

      expect(result.rows[0].metadata).toEqual({});
    });

    it('should store JSON metadata correctly', async () => {
      const metadata = {
        attempts: 3,
        reason: 'invalid_credentials',
        blocked: true,
        timestamp: new Date().toISOString()
      };

      const result = await pool.query(`
        INSERT INTO auth_logs (event_type, message, user_email, metadata)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING *
      `, ['LOGIN_FAILURE', 'Login failed', 'user@example.com', JSON.stringify(metadata)]);

      expect(result.rows[0].metadata).toEqual(metadata);
      expect(result.rows[0].metadata.attempts).toBe(3);
      expect(result.rows[0].metadata.reason).toBe('invalid_credentials');
    });
  });

  describe('Auth Log Queries', () => {
    beforeEach(async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO auth_logs (event_type, message, user_email, ip_address, metadata)
        VALUES 
          ('LOGIN_SUCCESS', 'User logged in', 'user1@example.com', '192.168.1.1', '{"source": "google"}'::jsonb),
          ('LOGIN_FAILURE', 'Login failed', 'user2@example.com', '192.168.1.2', '{"attempts": 2}'::jsonb),
          ('LOGIN_SUCCESS', 'User logged in', 'user1@example.com', '192.168.1.1', '{"source": "google"}'::jsonb),
          ('LOGOUT_SUCCESS', 'User logged out', 'user1@example.com', '192.168.1.1', '{}'::jsonb)
      `);
    });

    it('should query auth logs by event type', async () => {
      const result = await pool.query(`
        SELECT * FROM auth_logs 
        WHERE event_type = $1
        ORDER BY created_at DESC
      `, ['LOGIN_SUCCESS']);

      expect(result.rows.length).toBe(2);
      expect(result.rows.every(log => log.event_type === 'LOGIN_SUCCESS')).toBe(true);
    });

    it('should query auth logs by user email', async () => {
      const result = await pool.query(`
        SELECT * FROM auth_logs 
        WHERE user_email = $1
        ORDER BY created_at DESC
      `, ['user1@example.com']);

      expect(result.rows.length).toBe(3);
      expect(result.rows.every(log => log.user_email === 'user1@example.com')).toBe(true);
    });

    it('should query auth logs by IP address', async () => {
      const result = await pool.query(`
        SELECT * FROM auth_logs 
        WHERE ip_address = $1
        ORDER BY created_at DESC
      `, ['192.168.1.1']);

      expect(result.rows.length).toBe(3);
      expect(result.rows.every(log => log.ip_address === '192.168.1.1')).toBe(true);
    });

    it('should query auth logs with date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const result = await pool.query(`
        SELECT * FROM auth_logs 
        WHERE created_at >= $1
        ORDER BY created_at DESC
      `, [yesterday]);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every(log => new Date(log.created_at) >= yesterday)).toBe(true);
    });

    it('should query auth logs with metadata filter', async () => {
      const result = await pool.query(`
        SELECT * FROM auth_logs 
        WHERE metadata->>'source' = $1
        ORDER BY created_at DESC
      `, ['google']);

      expect(result.rows.length).toBe(2);
      expect(result.rows.every(log => log.metadata?.source === 'google')).toBe(true);
    });

    it('should count auth logs by event type', async () => {
      const result = await pool.query(`
        SELECT event_type, COUNT(*) as count
        FROM auth_logs
        GROUP BY event_type
        ORDER BY count DESC
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      const loginSuccess = result.rows.find(row => row.event_type === 'LOGIN_SUCCESS');
      expect(loginSuccess).toBeDefined();
      expect(parseInt(loginSuccess.count)).toBe(2);
    });
  });

  describe('Auth Log Event Types', () => {
    const eventTypes = [
      'LOGIN_SUCCESS',
      'LOGIN_FAILURE',
      'LOGIN_SUCCESS_WHITELIST',
      'LOGIN_SUCCESS_WHITELIST_BYPASS',
      'LOGIN_RATE_LIMITED',
      'LOGIN_REJECTED_DOMAIN',
      'LOGIN_ERROR',
      'LOGIN_CALLBACK_SUCCESS',
      'LOGIN_CALLBACK_ERROR',
      'LOGOUT_SUCCESS',
      'LOGOUT_ERROR',
      'PROFILE_ACCESSED',
      'ACCESS_REQUEST_SUBMITTED',
      'ACCESS_REQUEST_UPDATED',
      'ROUTE_UNAUTHORIZED_ACCESS',
      'PROFILE_UNAUTHORIZED'
    ];

    it('should create logs for all event types', async () => {
      for (const eventType of eventTypes) {
        const result = await pool.query(`
          INSERT INTO auth_logs (event_type, message, user_email)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [eventType, `Test ${eventType}`, 'test@example.com']);

        expect(result.rows[0].event_type).toBe(eventType);
      }

      // Verify all were created
      const count = await pool.query(`
        SELECT COUNT(*) as count FROM auth_logs
      `);
      expect(parseInt(count.rows[0].count)).toBe(eventTypes.length);
    });
  });

  describe('Auth Log Constraints', () => {
    it('should require event_type', async () => {
      await expect(
        pool.query(`
          INSERT INTO auth_logs (message, user_email)
          VALUES ($1, $2)
        `, ['Test message', 'test@example.com'])
      ).rejects.toThrow();
    });

    it('should allow null user_email for system events', async () => {
      const result = await pool.query(`
        INSERT INTO auth_logs (event_type, message)
        VALUES ($1, $2)
        RETURNING *
      `, ['SYSTEM_EVENT', 'System maintenance']);

      expect(result.rows[0].user_email).toBeNull();
    });

    it('should allow null user_id', async () => {
      const result = await pool.query(`
        INSERT INTO auth_logs (event_type, message, user_email)
        VALUES ($1, $2, $3)
        RETURNING *
      `, ['LOGIN_ATTEMPT', 'Login attempt', 'unknown@example.com']);

      expect(result.rows[0].user_id).toBeNull();
    });
  });

  describe('Auth Log Performance', () => {
    it('should handle bulk inserts efficiently', async () => {
      const startTime = Date.now();
      const logs = Array.from({ length: 100 }, (_, i) => ({
        event_type: 'LOGIN_SUCCESS',
        message: `Login ${i}`,
        user_email: `user${i}@example.com`,
        ip_address: `192.168.1.${i % 255}`
      }));

      // Insert in batch
      await pool.query(`
        INSERT INTO auth_logs (event_type, message, user_email, ip_address)
        SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[])
      `, [
        logs.map(l => l.event_type),
        logs.map(l => l.message),
        logs.map(l => l.user_email),
        logs.map(l => l.ip_address)
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);

      // Verify all were inserted
      const count = await pool.query('SELECT COUNT(*) as count FROM auth_logs');
      expect(parseInt(count.rows[0].count)).toBe(100);
    });
  });
});

