/**
 * EnrollmentService Tests
 * 
 * Tests for enrollment business logic including:
 * - Creating enrollments with validation
 * - Duplicate enrollment prevention
 * - Role assignment and validation
 * - Enrollment queries and statistics
 * - Audit logging
 */

import { describe, it, beforeAll, afterAll , expect} from 'vitest';
import assert from 'node:assert';
import { pool } from '../db.js';
import { EnrollmentService } from '../services/enrollment-service.js';

describe('EnrollmentService', () => {
  let testOffering;
  let testUsers = [];
  let createdEnrollmentIds = [];
  let adminId;

  beforeAll(async () => {
    // Get or create admin user
    let adminResult = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@ucsd.edu' AND deleted_at IS NULL LIMIT 1"
    );
    
    if (adminResult.rows.length === 0) {
      // Create admin if doesn't exist
      adminResult = await pool.query(
        `INSERT INTO users (email, name, primary_role, status)
         VALUES ('admin@ucsd.edu', 'Test Admin', 'admin', 'active')
         RETURNING id`
      );
    }
    adminId = adminResult.rows[0].id;
    
    // Clean up any existing test data first - be more thorough
    // First delete enrollments, then users, then offering
    await pool.query(`DELETE FROM enrollments WHERE offering_id IN (SELECT id FROM course_offerings WHERE code = 'TEST101')`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'enrollment-test-%@test.edu' OR email LIKE 'enrollment-invalid%@test.edu'`);
    await pool.query(`DELETE FROM course_offerings WHERE code = 'TEST101'`);
    
    // Create test offering (set is_active=FALSE to prevent auto-enrollment trigger)
    const offeringResult = await pool.query(
      `INSERT INTO course_offerings (name, code, term, year, instructor_id, start_date, end_date, created_by, updated_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $5, FALSE)
       RETURNING *`,
      ['Test Course', 'TEST101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create test users
    for (let i = 0; i < 3; i++) {
      const userResult = await pool.query(
        `INSERT INTO users (email, name, primary_role, status, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          `enrollment-test-${i}-${Date.now()}@test.edu`,
          `Enrollment Test User ${i}`,
          'student',
          'active',
          adminId
        ]
      );
      testUsers.push(userResult.rows[0]);
    }
  });

  afterAll(async () => {
    // Clean up enrollments
    if (createdEnrollmentIds.length > 0) {
      await pool.query(
        `DELETE FROM enrollments WHERE id = ANY($1::uuid[])`,
        [createdEnrollmentIds]
      );
    }

    // Clean up users
    const userIds = testUsers.map(u => u.id);
    if (userIds.length > 0) {
      await pool.query(
        `DELETE FROM users WHERE id = ANY($1::uuid[])`,
        [userIds]
      );
    }

    // Clean up offering
    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
  });

  it('should create enrollment with default role (student)', async () => {
    const enrollment = await EnrollmentService.createEnrollment({
      offering_id: testOffering.id,
      user_id: testUsers[0].id,
    }, adminId);

    expect(enrollment.id).toBeTruthy();
    expect(enrollment.course_role).toBe('student', 'Should default to student role');
    expect(enrollment.status).toBe('enrolled', 'Should default to enrolled status');
    
    createdEnrollmentIds.push(enrollment.id);
  });

  it('should create enrollment with specified role (TA)', async () => {
    const enrollment = await EnrollmentService.createEnrollment({
      offering_id: testOffering.id,
      user_id: testUsers[1].id,
      course_role: 'ta',
    }, adminId);

    expect(enrollment.course_role).toBe('ta', 'Should set TA role');
    createdEnrollmentIds.push(enrollment.id);
  });

  it('should create enrollment with tutor role', async () => {
    const enrollment = await EnrollmentService.createEnrollment({
      offering_id: testOffering.id,
      user_id: testUsers[2].id,
      course_role: 'tutor',
    }, adminId);

    expect(enrollment.course_role).toBe('tutor', 'Should set tutor role');
    createdEnrollmentIds.push(enrollment.id);
  });

  it('should prevent duplicate enrollments', async () => {
    await assert.rejects(
      async () => {
        await EnrollmentService.createEnrollment({
          offering_id: testOffering.id,
          user_id: testUsers[0].id,
        }, adminId);
      },
      /already enrolled/,
      'Should reject duplicate enrollment'
    );
  });

  it('should reject invalid course role', async () => {
    const tempUserResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `enrollment-invalid-role-${Date.now()}@test.edu`,
        'Invalid Role User',
        'student',
        'active',
        adminId
      ]
    );
    const tempUser = tempUserResult.rows[0];
    testUsers.push(tempUser);

    await assert.rejects(
      async () => {
        await EnrollmentService.createEnrollment({
          offering_id: testOffering.id,
          user_id: tempUser.id,
          course_role: 'invalid_role',
        }, adminId);
      },
      /Invalid course_role/,
      'Should reject invalid role'
    );
  });

  it('should reject enrollment for non-existent offering', async () => {
    const tempUserResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `enrollment-no-offering-${Date.now()}@test.edu`,
        'No Offering User',
        'student',
        'active',
        adminId
      ]
    );
    const tempUser = tempUserResult.rows[0];
    testUsers.push(tempUser);

    await assert.rejects(
      async () => {
        await EnrollmentService.createEnrollment({
          offering_id: '00000000-0000-0000-0000-000000000000',
          user_id: tempUser.id,
        }, adminId);
      },
      /Course offering not found/,
      'Should reject non-existent offering'
    );
  });

  it('should reject enrollment for non-existent user', async () => {
    await assert.rejects(
      async () => {
        await EnrollmentService.createEnrollment({
          offering_id: testOffering.id,
          user_id: '00000000-0000-0000-0000-000000000000',
        }, adminId);
      },
      /User not found/,
      'Should reject non-existent user'
    );
  });

  it('should get enrollment by offering and user', async () => {
    const enrollment = await EnrollmentService.getEnrollmentByOfferingAndUser(
      testOffering.id,
      testUsers[0].id
    );

    expect(enrollment).toBeTruthy();
    expect(enrollment.user_id).toBe(testUsers[0].id, 'Should match user ID');
    expect(enrollment.offering_id).toBe(testOffering.id, 'Should match offering ID');
  });

  it('should return null for non-existent enrollment', async () => {
    const enrollment = await EnrollmentService.getEnrollmentByOfferingAndUser(
      testOffering.id,
      '00000000-0000-0000-0000-000000000000'
    );

    expect(enrollment).toBe(null, 'Should return null for non-existent enrollment');
  });

  it('should get all enrollments for offering', async () => {
    const enrollments = await EnrollmentService.getEnrollmentsByOffering(testOffering.id);

    expect(Array.isArray(enrollments)).toBeTruthy();
    expect(enrollments.length).toBe(3, 'Should have 3 enrollments');
  });

  it('should get TAs for offering', async () => {
    const tas = await EnrollmentService.getTAs(testOffering.id);

    expect(Array.isArray(tas)).toBeTruthy();
    expect(tas.length).toBe(1, 'Should have 1 TA');
    expect(tas[0].course_role).toBe('ta', 'Should be TA role');
  });

  it('should get tutors for offering', async () => {
    const tutors = await EnrollmentService.getTutors(testOffering.id);

    expect(Array.isArray(tutors)).toBeTruthy();
    expect(tutors.length).toBe(1, 'Should have 1 tutor');
    expect(tutors[0].course_role).toBe('tutor', 'Should be tutor role');
  });

  it('should get students for offering', async () => {
    const students = await EnrollmentService.getStudents(testOffering.id);

    expect(Array.isArray(students)).toBeTruthy();
    expect(students.length).toBe(1, 'Should have 1 student');
    expect(students[0].course_role).toBe('student', 'Should be student role');
  });

  it('should get course staff (TAs and tutors)', async () => {
    const staff = await EnrollmentService.getCourseStaff(testOffering.id);

    expect(Array.isArray(staff)).toBeTruthy();
    expect(staff.length).toBe(2, 'Should have 2 staff members (TA + tutor)');
    
    const roles = staff.map(s => s.course_role).sort();
    expect(roles).toEqual(['ta', 'tutor'], 'Should include TA and tutor');
  });

  it('should update course role', async () => {
    const enrollment = await EnrollmentService.updateCourseRole(
      testOffering.id,
      testUsers[0].id,
      'ta',
      adminId
    );

    expect(enrollment.course_role).toBe('ta', 'Should update to TA role');
  });

  it('should get enrollment statistics', async () => {
    const stats = await EnrollmentService.getEnrollmentStats(testOffering.id);

    expect(stats).toBeTruthy();
    expect(stats.total).toBe(3, 'Should have 3 total enrollments');
    expect(stats.by_role.tas).toBe(2, 'Should have 2 TAs (after role update)');
    expect(stats.by_role.tutors).toBe(1, 'Should have 1 tutor');
    expect(stats.by_status.enrolled).toBe(3, 'Should have 3 enrolled');
  });

  it('should drop enrollment', async () => {
    const dropped = await EnrollmentService.dropEnrollment(
      testOffering.id,
      testUsers[0].id,
      adminId
    );

    expect(dropped.status).toBe('dropped', 'Should set status to dropped');
    expect(dropped.dropped_at).toBeTruthy();
  });
});
