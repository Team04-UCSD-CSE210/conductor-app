/**
 * Course Selection Logic Tests
 * Tests the course selection functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../db.js';

describe('Course Selection Logic', () => {
  let testUserId;
  let testOffering1Id;
  let testOffering2Id;

  beforeAll(async () => {
    // Create test user directly
    const userResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW()) 
       RETURNING id`,
      ['test-course-selection@ucsd.edu', 'Test User', 'student']
    );
    testUserId = userResult.rows[0].id;

    // Create test course offerings directly
    const offering1Result = await pool.query(
      `INSERT INTO course_offerings (code, name, term, year, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
       RETURNING id`,
      ['CSE210', 'Software Engineering', 'Fall', 2024]
    );
    testOffering1Id = offering1Result.rows[0].id;

    const offering2Result = await pool.query(
      `INSERT INTO course_offerings (code, name, term, year, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
       RETURNING id`,
      ['CSE110', 'Software Engineering Fundamentals', 'Fall', 2024]
    );
    testOffering2Id = offering2Result.rows[0].id;

    // Create enrollments directly
    await pool.query(
      `INSERT INTO enrollments (user_id, offering_id, course_role, status, enrolled_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [testUserId, testOffering1Id, 'student', 'enrolled']
    );

    await pool.query(
      `INSERT INTO enrollments (user_id, offering_id, course_role, status, enrolled_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [testUserId, testOffering2Id, 'ta', 'enrolled']
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM enrollments WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM course_offerings WHERE id IN ($1, $2)', [testOffering1Id, testOffering2Id]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('User Enrollments Query', () => {
    it('should fetch user courses correctly', async () => {
      const result = await pool.query(
        `SELECT 
          e.id as enrollment_id,
          e.course_role,
          e.status,
          co.id as offering_id,
          co.code,
          co.name,
          co.term,
          co.year
        FROM enrollments e
        INNER JOIN course_offerings co ON e.offering_id = co.id
        WHERE e.user_id = $1::uuid
        ORDER BY e.enrolled_at DESC`,
        [testUserId]
      );

      expect(result.rows).toHaveLength(2);
      
      const coursesCodes = result.rows.map(row => row.code);
      expect(coursesCodes).toContain('CSE210');
      expect(coursesCodes).toContain('CSE110');
      
      // Check roles
      const cse210Row = result.rows.find(row => row.code === 'CSE210');
      const cse110Row = result.rows.find(row => row.code === 'CSE110');
      
      expect(cse210Row.course_role).toBe('student');
      expect(cse110Row.course_role).toBe('ta');
    });

    it('should verify enrollment for course selection', async () => {
      // Test valid enrollment
      const validEnrollment = await pool.query(
        `SELECT course_role FROM enrollments 
         WHERE user_id = $1::uuid AND offering_id = $2::uuid AND status = 'enrolled'::enrollment_status_enum`,
        [testUserId, testOffering1Id]
      );

      expect(validEnrollment.rows).toHaveLength(1);
      expect(validEnrollment.rows[0].course_role).toBe('student');

      // Test invalid enrollment (non-existent offering)
      const invalidEnrollment = await pool.query(
        `SELECT course_role FROM enrollments 
         WHERE user_id = $1::uuid AND offering_id = $2::uuid AND status = 'enrolled'::enrollment_status_enum`,
        [testUserId, '00000000-0000-0000-0000-000000000000']
      );

      expect(invalidEnrollment.rows).toHaveLength(0);
    });
  });

  describe('Multiple Enrollments Detection', () => {
    it('should detect when user has multiple enrollments', async () => {
      const enrollmentsResult = await pool.query(
        `SELECT e.offering_id, e.course_role, co.code, co.name 
         FROM enrollments e
         INNER JOIN course_offerings co ON e.offering_id = co.id
         WHERE e.user_id = $1::uuid AND e.status = 'enrolled'::enrollment_status_enum`,
        [testUserId]
      );

      const allEnrollments = enrollmentsResult.rows;
      
      // This should trigger course selection flow
      expect(allEnrollments.length).toBeGreaterThan(1);
      expect(allEnrollments).toHaveLength(2);
    });
  });

  describe('Course Selection Data Structure', () => {
    it('should format course data correctly for frontend', async () => {
      const result = await pool.query(
        `SELECT 
          e.id as enrollment_id,
          e.course_role,
          e.status,
          e.enrolled_at,
          co.id as offering_id,
          co.code,
          co.name,
          co.department,
          co.term,
          co.year,
          co.credits
        FROM enrollments e
        INNER JOIN course_offerings co ON e.offering_id = co.id
        WHERE e.user_id = $1::uuid
        ORDER BY e.enrolled_at DESC`,
        [testUserId]
      );

      const courses = result.rows.map(row => ({
        enrollment_id: row.enrollment_id,
        course_role: row.course_role,
        status: row.status,
        enrolled_at: row.enrolled_at,
        offering: {
          id: row.offering_id,
          code: row.code,
          name: row.name,
          department: row.department,
          term: row.term,
          year: row.year,
          credits: row.credits
        }
      }));

      expect(courses).toHaveLength(2);
      
      // Verify structure
      courses.forEach(course => {
        expect(course).toHaveProperty('enrollment_id');
        expect(course).toHaveProperty('course_role');
        expect(course).toHaveProperty('status');
        expect(course).toHaveProperty('offering');
        expect(course.offering).toHaveProperty('id');
        expect(course.offering).toHaveProperty('code');
        expect(course.offering).toHaveProperty('name');
      });
    });
  });
});
