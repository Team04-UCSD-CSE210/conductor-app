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

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { pool } from '../db.js';
import { EnrollmentService } from '../services/enrollment-service.js';

describe('EnrollmentService', () => {
  let testOffering;
  let testUsers = [];
  let createdEnrollmentIds = [];
  let adminId;

  before(async () => {
    // Get admin ID from seed data
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@ucsd.edu' AND deleted_at IS NULL LIMIT 1"
    );
    adminId = rows[0].id;
    // Create test offering
    const offeringResult = await pool.query(
      `INSERT INTO course_offerings (name, code, term, year, instructor_id, start_date, end_date, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $5)
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

  after(async () => {
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

    assert.ok(enrollment.id, 'Should return enrollment ID');
    assert.strictEqual(enrollment.course_role, 'student', 'Should default to student role');
    assert.strictEqual(enrollment.status, 'enrolled', 'Should default to enrolled status');
    
    createdEnrollmentIds.push(enrollment.id);
  });

  it('should create enrollment with specified role (TA)', async () => {
    const enrollment = await EnrollmentService.createEnrollment({
      offering_id: testOffering.id,
      user_id: testUsers[1].id,
      course_role: 'ta',
    }, adminId);

    assert.strictEqual(enrollment.course_role, 'ta', 'Should set TA role');
    createdEnrollmentIds.push(enrollment.id);
  });

  it('should create enrollment with tutor role', async () => {
    const enrollment = await EnrollmentService.createEnrollment({
      offering_id: testOffering.id,
      user_id: testUsers[2].id,
      course_role: 'tutor',
    }, adminId);

    assert.strictEqual(enrollment.course_role, 'tutor', 'Should set tutor role');
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

    assert.ok(enrollment, 'Should find enrollment');
    assert.strictEqual(enrollment.user_id, testUsers[0].id, 'Should match user ID');
    assert.strictEqual(enrollment.offering_id, testOffering.id, 'Should match offering ID');
  });

  it('should return null for non-existent enrollment', async () => {
    const enrollment = await EnrollmentService.getEnrollmentByOfferingAndUser(
      testOffering.id,
      '00000000-0000-0000-0000-000000000000'
    );

    assert.strictEqual(enrollment, null, 'Should return null for non-existent enrollment');
  });

  it('should get all enrollments for offering', async () => {
    const enrollments = await EnrollmentService.getEnrollmentsByOffering(testOffering.id);

    assert.ok(Array.isArray(enrollments), 'Should return array');
    assert.strictEqual(enrollments.length, 3, 'Should have 3 enrollments');
  });

  it('should get TAs for offering', async () => {
    const tas = await EnrollmentService.getTAs(testOffering.id);

    assert.ok(Array.isArray(tas), 'Should return array');
    assert.strictEqual(tas.length, 1, 'Should have 1 TA');
    assert.strictEqual(tas[0].course_role, 'ta', 'Should be TA role');
  });

  it('should get tutors for offering', async () => {
    const tutors = await EnrollmentService.getTutors(testOffering.id);

    assert.ok(Array.isArray(tutors), 'Should return array');
    assert.strictEqual(tutors.length, 1, 'Should have 1 tutor');
    assert.strictEqual(tutors[0].course_role, 'tutor', 'Should be tutor role');
  });

  it('should get students for offering', async () => {
    const students = await EnrollmentService.getStudents(testOffering.id);

    assert.ok(Array.isArray(students), 'Should return array');
    assert.strictEqual(students.length, 1, 'Should have 1 student');
    assert.strictEqual(students[0].course_role, 'student', 'Should be student role');
  });

  it('should get course staff (TAs and tutors)', async () => {
    const staff = await EnrollmentService.getCourseStaff(testOffering.id);

    assert.ok(Array.isArray(staff), 'Should return array');
    assert.strictEqual(staff.length, 2, 'Should have 2 staff members (TA + tutor)');
    
    const roles = staff.map(s => s.course_role).sort();
    assert.deepStrictEqual(roles, ['ta', 'tutor'], 'Should include TA and tutor');
  });

  it('should update course role', async () => {
    const enrollment = await EnrollmentService.updateCourseRole(
      testOffering.id,
      testUsers[0].id,
      'ta',
      adminId
    );

    assert.strictEqual(enrollment.course_role, 'ta', 'Should update to TA role');
  });

  it('should get enrollment statistics', async () => {
    const stats = await EnrollmentService.getEnrollmentStats(testOffering.id);

    assert.ok(stats, 'Should return stats');
    assert.strictEqual(stats.total, 3, 'Should have 3 total enrollments');
    assert.strictEqual(stats.by_role.tas, 2, 'Should have 2 TAs (after role update)');
    assert.strictEqual(stats.by_role.tutors, 1, 'Should have 1 tutor');
    assert.strictEqual(stats.by_status.enrolled, 3, 'Should have 3 enrolled');
  });

  it('should drop enrollment', async () => {
    const dropped = await EnrollmentService.dropEnrollment(
      testOffering.id,
      testUsers[0].id,
      adminId
    );

    assert.strictEqual(dropped.status, 'dropped', 'Should set status to dropped');
    assert.ok(dropped.dropped_at, 'Should set dropped_at date');
  });
});
