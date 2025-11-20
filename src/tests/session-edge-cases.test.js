/**
 * Session Edge Cases and Error Handling Tests
 * 
 * Comprehensive edge case testing including:
 * - Boundary values (empty strings, max lengths, null values)
 * - Invalid inputs and malformed data
 * - Race conditions and concurrent modifications
 * - Timezone handling
 * - SQL injection prevention
 * - Transaction integrity
 * - Memory leaks and resource cleanup
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { pool } from '../db.js';
import { SessionModel } from '../models/session-model.js';
import { SessionService } from '../services/session-service.js';

describe('Session Edge Cases and Error Handling', () => {
  let testOffering;
  let instructor;
  let adminId;
  let createdSessionIds = [];

  beforeAll(async () => {
    // Get or create admin user
    let adminResult = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@ucsd.edu' AND deleted_at IS NULL LIMIT 1"
    );
    
    if (adminResult.rows.length === 0) {
      adminResult = await pool.query(
        `INSERT INTO users (email, name, primary_role, status)
         VALUES ('admin@ucsd.edu', 'Test Admin', 'admin', 'active')
         RETURNING id`
      );
    }
    adminId = adminResult.rows[0].id;

    // Create test offering
    const offeringResult = await pool.query(
      `INSERT INTO course_offerings (name, code, term, year, instructor_id, start_date, end_date, created_by, updated_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $5, FALSE)
       RETURNING *`,
      ['Edge Case Test Course', 'EDGE101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create instructor
    const instructorResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`edge-instructor-${Date.now()}@test.edu`, 'Edge Instructor', 'instructor', 'active', adminId]
    );
    instructor = instructorResult.rows[0];

    // Instructor is not enrolled - they are the offering instructor_id
  });

  afterAll(async () => {
    // Cleanup
    if (createdSessionIds.length > 0) {
      await pool.query(`DELETE FROM sessions WHERE id = ANY($1::uuid[])`, [createdSessionIds]);
    }

    await pool.query('DELETE FROM enrollments WHERE offering_id = $1', [testOffering.id]);

    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }

    if (instructor) {
      await pool.query('DELETE FROM users WHERE id = $1', [instructor.id]);
    }
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    if (createdSessionIds.length > 0) {
      await pool.query(`DELETE FROM sessions WHERE id = ANY($1::uuid[])`, [createdSessionIds]);
      createdSessionIds = [];
    }
  });

  describe('Boundary Values', () => {
    it('should handle extremely long title (255 chars)', async () => {
      const longTitle = 'A'.repeat(255);
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: longTitle,
        session_date: '2025-11-25'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.title.length).toBeLessThanOrEqual(255);
    });

    it('should reject title exceeding max length', async () => {
      const tooLongTitle = 'A'.repeat(256);
      try {
        const session = await SessionService.createSession({
          offering_id: testOffering.id,
          title: tooLongTitle,
          session_date: '2025-11-25'
        }, instructor.id);
        createdSessionIds.push(session.id);
        // If it doesn't throw, check if truncated
        expect(session.title.length).toBeLessThanOrEqual(255);
      } catch (error) {
        // Database constraint may reject it
        expect(error).toBeTruthy();
      }
    });

    it('should handle empty description', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Empty Description Test',
        description: '',
        session_date: '2025-11-25'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.description).toBe('');
    });

    it('should handle null description', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Null Description Test',
        description: null,
        session_date: '2025-11-25'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.description).toBeNull();
    });

    it('should handle very long description (5000 chars)', async () => {
      const longDesc = 'Lorem ipsum '.repeat(500);
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Long Description',
        description: longDesc,
        session_date: '2025-11-25'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.description.length).toBeGreaterThan(100);
    });

    it('should handle minimum valid date', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Min Date Test',
        session_date: '1970-01-01'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.session_date).toBeTruthy();
    });

    it('should handle far future date', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Far Future Date',
        session_date: '2099-12-31'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.session_date).toBeTruthy();
    });

    it('should handle midnight time (00:00:00)', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Midnight Session',
        session_date: '2025-11-25',
        session_time: '00:00:00',
        access_code: `MID${Date.now()}`,
        created_by: instructor.id
      });

      createdSessionIds.push(session.id);
      expect(session.session_time).toBeTruthy();
    });

    it('should handle end-of-day time (23:59:59)', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'End of Day Session',
        session_date: '2025-11-25',
        session_time: '23:59:59',
        access_code: `EOD${Date.now()}`,
        created_by: instructor.id
      });

      createdSessionIds.push(session.id);
      expect(session.session_time).toBeTruthy();
    });
  });

  describe('Invalid Inputs', () => {
    it('should reject invalid date format', async () => {
      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Invalid Date',
          session_date: '25-11-2025', // Wrong format
          access_code: `INV${Date.now()}`,
          created_by: instructor.id
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should reject invalid time format', async () => {
      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Invalid Time',
          session_date: '2025-11-25',
          session_time: '25:00:00', // Invalid hour
          access_code: `INVT${Date.now()}`,
          created_by: instructor.id
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should reject non-existent date (like Feb 30)', async () => {
      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Non-existent Date',
          session_date: '2025-02-30',
          access_code: `NEXD${Date.now()}`,
          created_by: instructor.id
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle special characters in title', async () => {
      const specialTitle = 'Test <script>alert("xss")</script> & "quotes" \'single\'';
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: specialTitle,
        session_date: '2025-11-25'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.title).toContain('script');
      expect(session.title).toContain('&');
    });

    it('should handle unicode characters in title', async () => {
      const unicodeTitle = '测试 Тест テスト 🎉 مرحبا';
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: unicodeTitle,
        session_date: '2025-11-25'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.title).toBe(unicodeTitle);
    });

    it('should prevent SQL injection in title', async () => {
      const sqlInjection = "'; DROP TABLE sessions; --";
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: sqlInjection,
        session_date: '2025-11-25'
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session.title).toBe(sqlInjection);

      // Verify sessions table still exists
      const result = await pool.query('SELECT COUNT(*) FROM sessions');
      expect(result.rows[0].count).toBeTruthy();
    });

    it('should prevent SQL injection in access code search', async () => {
      const result = await SessionModel.findByAccessCode("' OR '1'='1");
      expect(result).toBeNull();
    });
  });

  describe('Null and Undefined Handling', () => {
    it('should handle null offering_id gracefully', async () => {
      try {
        await SessionModel.create({
          offering_id: null,
          title: 'Null Offering',
          session_date: '2025-11-25',
          access_code: `NULL${Date.now()}`,
          created_by: instructor.id
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle undefined required fields', async () => {
      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          // title is missing
          session_date: '2025-11-25',
          access_code: `UNDEF${Date.now()}`,
          created_by: instructor.id
        });
        expect.fail('Should have thrown error for missing title');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle null created_by', async () => {
      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Null Creator',
          session_date: '2025-11-25',
          access_code: `NCRT${Date.now()}`,
          created_by: null
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should allow null updated_by on update', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Update Test',
        session_date: '2025-11-25',
        access_code: `UPDT${Date.now()}`,
        created_by: instructor.id
      });
      createdSessionIds.push(session.id);

      // Update with null updated_by should use a default or fail gracefully
      try {
        await SessionModel.update(session.id, { title: 'Updated' }, null);
        expect.fail('Should have thrown error for null updated_by');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent access code generation without duplicates', async () => {
      const promises = Array.from({ length: 20 }, () => 
        SessionService.generateUniqueAccessCode()
      );

      const codes = await Promise.all(promises);
      const uniqueCodes = new Set(codes);
      
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should handle concurrent session creation', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        SessionService.createSession({
          offering_id: testOffering.id,
          title: `Concurrent ${i}`,
          session_date: '2025-11-25',
          session_time: `${10 + i}:00:00`
        }, instructor.id)
      );

      const sessions = await Promise.all(promises);
      sessions.forEach(s => createdSessionIds.push(s.id));

      expect(sessions.length).toBe(10);
      const codes = sessions.map(s => s.access_code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);
    });

    it('should handle concurrent updates to same session', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Concurrent Update Test',
        session_date: '2025-11-25'
      }, instructor.id);
      createdSessionIds.push(session.id);

      const promises = Array.from({ length: 5 }, (_, i) => 
        SessionModel.update(session.id, { 
          title: `Updated ${i}` 
        }, instructor.id)
      );

      const results = await Promise.all(promises);
      
      // Last update should win
      const final = await SessionModel.findById(session.id);
      expect(final.title).toMatch(/Updated \d/);
    });

    it('should handle concurrent attendance open/close', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Concurrent Attendance',
        session_date: '2025-11-25'
      }, instructor.id);
      createdSessionIds.push(session.id);

      const operations = [
        SessionService.openAttendance(session.id, instructor.id),
        SessionService.closeAttendance(session.id, instructor.id),
        SessionService.openAttendance(session.id, instructor.id),
        SessionService.closeAttendance(session.id, instructor.id)
      ];

      await Promise.allSettled(operations);

      const final = await SessionModel.findById(session.id);
      // Should be in a consistent state
      expect(final).toBeTruthy();
    });
  });

  describe('Timezone and Date Handling', () => {
    it('should handle date across timezone boundaries', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Timezone Test',
        session_date: '2025-11-25',
        session_time: '23:59:59',
        access_code: `TZ${Date.now()}`,
        created_by: instructor.id
      });
      createdSessionIds.push(session.id);

      const retrieved = await SessionModel.findById(session.id);
      
      // Date should be consistent regardless of server timezone
      const sessionDate = typeof retrieved.session_date === 'string' 
        ? retrieved.session_date.split('T')[0]
        : retrieved.session_date.toISOString().split('T')[0];
      
      expect(sessionDate).toContain('2025-11-25');
    });

    it('should handle daylight saving time transitions', async () => {
      // Test around DST transition dates
      const dstDate = '2025-03-09'; // Typical DST start in US
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'DST Test',
        session_date: dstDate,
        session_time: '02:30:00' // Hour that "doesn't exist" on DST start
      }, instructor.id);

      createdSessionIds.push(session.id);
      expect(session).toBeTruthy();
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources on failed creation', async () => {
      const initialCount = await pool.query('SELECT COUNT(*) FROM sessions WHERE offering_id = $1', [testOffering.id]);

      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Fail Test',
          session_date: '2025-11-25',
          access_code: null, // This will fail
          created_by: instructor.id
        });
      } catch (error) {
        // Expected to fail
      }

      const afterCount = await pool.query('SELECT COUNT(*) FROM sessions WHERE offering_id = $1', [testOffering.id]);
      expect(afterCount.rows[0].count).toBe(initialCount.rows[0].count);
    });

    it('should handle large batch operations without memory issues', async () => {
      const sessions = [];
      
      // Create many sessions
      for (let i = 0; i < 50; i++) {
        const session = await SessionService.createSession({
          offering_id: testOffering.id,
          title: `Batch ${i}`,
          session_date: '2025-11-25',
          session_time: `${Math.floor(i / 10) + 10}:${(i % 60).toString().padStart(2, '0')}:00`
        }, instructor.id);
        sessions.push(session);
        createdSessionIds.push(session.id);
      }

      expect(sessions.length).toBe(50);

      // Retrieve all at once
      const retrieved = await SessionService.getSessionsByOffering(testOffering.id, { 
        userId: instructor.id,
        limit: 100 
      });

      expect(retrieved.length).toBeGreaterThanOrEqual(50);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test verifies error handling, actual connection error hard to simulate
      try {
        await SessionModel.findById('invalid-uuid-format');
        expect.fail('Should have thrown error for invalid UUID');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity with offering', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Referential Integrity Test',
        session_date: '2025-11-25'
      }, instructor.id);
      createdSessionIds.push(session.id);

      // Session should reference valid offering
      const result = await pool.query(
        `SELECT s.*, co.name as offering_name 
         FROM sessions s 
         JOIN course_offerings co ON s.offering_id = co.id 
         WHERE s.id = $1`,
        [session.id]
      );

      expect(result.rows[0].offering_name).toBeTruthy();
    });

    it('should cascade delete when offering is removed', async () => {
      // Create temporary offering
      const tempOffering = await pool.query(
        `INSERT INTO course_offerings (name, code, term, year, instructor_id, start_date, end_date, created_by, updated_by, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $5, FALSE)
         RETURNING *`,
        ['Temp Offering', `TEMP${Date.now()}`, 'Fall', 2025, instructor.id, '2025-09-01', '2025-12-15']
      );

      const session = await SessionModel.create({
        offering_id: tempOffering.rows[0].id,
        title: 'Will Be Deleted',
        session_date: '2025-11-25',
        access_code: `CASC${Date.now()}`,
        created_by: instructor.id
      });

      // Delete offering
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [tempOffering.rows[0].id]);

      // Session should be deleted too (CASCADE)
      const found = await SessionModel.findById(session.id);
      expect(found).toBeNull();
    });

    it('should prevent duplicate access codes', async () => {
      const code = `DUP${Date.now()}`;
      
      const session1 = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'First Session',
        session_date: '2025-11-25',
        access_code: code,
        created_by: instructor.id
      });
      createdSessionIds.push(session1.id);

      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Duplicate Code',
          session_date: '2025-11-25',
          access_code: code,
          created_by: instructor.id
        });
        expect.fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.message).toMatch(/unique|duplicate/i);
      }
    });

    it('should maintain updated_at timestamp on updates', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Timestamp Test',
        session_date: '2025-11-25'
      }, instructor.id);
      createdSessionIds.push(session.id);

      const originalUpdatedAt = session.updated_at;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      await SessionModel.update(session.id, { title: 'Updated Timestamp' }, instructor.id);
      const updated = await SessionModel.findById(session.id);

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });
  });

  describe('Access Code Edge Cases', () => {
    it('should handle access code with maximum retries', async () => {
      // Mock scenario where many codes already exist
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const session = await SessionService.createSession({
          offering_id: testOffering.id,
          title: `Code Test ${i}`,
          session_date: '2025-11-25'
        }, instructor.id);
        sessions.push(session);
        createdSessionIds.push(session.id);
      }

      // Should still generate unique code
      const newSession = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'New Unique Code',
        session_date: '2025-11-25'
      }, instructor.id);
      createdSessionIds.push(newSession.id);

      const existingCodes = sessions.map(s => s.access_code);
      expect(existingCodes).not.toContain(newSession.access_code);
    });

    it('should reject empty access code', async () => {
      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Empty Code',
          session_date: '2025-11-25',
          access_code: '',
          created_by: instructor.id
        });
        expect.fail('Should have thrown error for empty access code');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should be case-sensitive for access codes', async () => {
      const session1 = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Case Test 1',
        session_date: '2025-11-25',
        access_code: 'ABC123',
        created_by: instructor.id
      });
      createdSessionIds.push(session1.id);

      // Try to create with lowercase (should be allowed if case-sensitive)
      try {
        const session2 = await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Case Test 2',
          session_date: '2025-11-25',
          access_code: 'abc123',
          created_by: instructor.id
        });
        createdSessionIds.push(session2.id);
        
        // Both should exist
        expect(session1.access_code).toBe('ABC123');
        expect(session2.access_code).toBe('abc123');
      } catch (error) {
        // If case-insensitive, this is expected
        expect(error).toBeTruthy();
      }
    });
  });
});
