/**
 * EnrollmentModel Tests
 * 
 * Tests for enrollment model CRUD operations including:
 * - Creating enrollments with enum validation
 * - Querying enrollments by various criteria
 * - Updating enrollment roles and status
 * - Constraint validation
 */

import { describe, it, beforeAll, afterAll , expect} from 'vitest';
import { pool } from '../db.js';
import { EnrollmentModel } from '../models/enrollment-model.js';

describe('EnrollmentModel', () => {
  let testOffering;
  let testUser;
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
    
    // Clean up any existing test data first
    await pool.query(`DELETE FROM enrollments WHERE offering_id IN (SELECT id FROM course_offerings WHERE code = 'ENRMOD101')`);
    await pool.query(`DELETE FROM course_offerings WHERE code = 'ENRMOD101'`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'enrollment-model-test-%@test.edu' OR email LIKE 'enrollment-temp-%@test.edu'`);
    
    // Create test offering
    const offeringResult = await pool.query(
      `INSERT INTO course_offerings (name, code, term, year, instructor_id, start_date, end_date, created_by, updated_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $5, FALSE)
       RETURNING *`,
      ['EnrollmentModel Test Course', 'ENRMOD101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `enrollment-model-test-${Date.now()}@test.edu`,
        'EnrollmentModel Test User',
        'student',
        'active',
        adminId
      ]
    );
    testUser = userResult.rows[0];
  });

  afterAll(async () => {
    // Clean up enrollments
    if (createdEnrollmentIds.length > 0) {
      await pool.query(
        `DELETE FROM enrollments WHERE id = ANY($1::uuid[])`,
        [createdEnrollmentIds]
      );
    }

    // Clean up user
    if (testUser) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }

    // Clean up offering
    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
  });

  it('should validate required fields on create', async () => {
    const errors = EnrollmentModel.validate({});

    expect(errors.length > 0).toBeTruthy();
    expect(errors.some(e => e.includes('offering_id'))).toBeTruthy();
    expect(errors.some(e => e.includes('user_id'))).toBeTruthy();
  });

  it('should validate course_role enum', async () => {
    const errors = EnrollmentModel.validate({
      offering_id: testOffering.id,
      user_id: testUser.id,
      course_role: 'invalid_role',
    });

    expect(errors.length > 0).toBeTruthy();
    expect(errors.some(e => e.includes('Invalid course_role'))).toBeTruthy();
  });

  it('should validate status enum', async () => {
    const errors = EnrollmentModel.validate({
      offering_id: testOffering.id,
      user_id: testUser.id,
      status: 'invalid_status',
    });

    expect(errors.length > 0).toBeTruthy();
    expect(errors.some(e => e.includes('Invalid status'))).toBeTruthy();
  });

  it('should accept valid course_role values', async () => {
    const validRoles = ['student', 'ta', 'tutor'];

    for (const role of validRoles) {
      const errors = EnrollmentModel.validate({
        offering_id: testOffering.id,
        user_id: testUser.id,
        course_role: role,
      });

      expect(errors.length).toBe(0);
    }
  });

  it('should create enrollment with student role', async () => {
    const enrollment = await EnrollmentModel.create({
      offering_id: testOffering.id,
      user_id: testUser.id,
      course_role: 'student',
      created_by: adminId,
      updated_by: adminId,
    });

    expect(enrollment.id).toBeTruthy();
    expect(enrollment.course_role).toBe('student');
    expect(enrollment.status).toBe('enrolled');
    
    createdEnrollmentIds.push(enrollment.id);
  });

  it('should find enrollment by ID', async () => {
    const enrollmentId = createdEnrollmentIds[0];
    const enrollment = await EnrollmentModel.findById(enrollmentId);

    expect(enrollment).toBeTruthy();
    expect(enrollment.id).toBe(enrollmentId);
  });

  it('should find enrollment by offering and user', async () => {
    const enrollment = await EnrollmentModel.findByOfferingAndUser(
      testOffering.id,
      testUser.id
    );

    expect(enrollment).toBeTruthy();
    expect(enrollment.offering_id).toBe(testOffering.id);
    expect(enrollment.user_id).toBe(testUser.id);
  });

  it('should return null for non-existent enrollment', async () => {
    const enrollment = await EnrollmentModel.findById('00000000-0000-0000-0000-000000000000');

    expect(enrollment).toBe(null);
  });

  it('should update enrollment course_role', async () => {
    const enrollmentId = createdEnrollmentIds[0];
    
    const updated = await EnrollmentModel.update(enrollmentId, {
      course_role: 'ta',
      updated_by: adminId,
    });

    expect(updated.course_role).toBe('ta');
    expect(updated.id).toBe(enrollmentId);
  });

  it('should update enrollment status', async () => {
    const enrollmentId = createdEnrollmentIds[0];
    
    const updated = await EnrollmentModel.update(enrollmentId, {
      status: 'dropped',
      dropped_at: '2025-11-17',
      updated_by: adminId,
    });

    expect(updated.status).toBe('dropped', 'Should update to dropped status');
    expect(updated.dropped_at).toBeTruthy();
  });

  it('should find enrollments by offering', async () => {
    // Create additional enrollments
    const user2Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `enrollment-model-test2-${Date.now()}@test.edu`,
        'EnrollmentModel Test User 2',
        'student',
        'active',
        adminId
      ]
    );
    const user2 = user2Result.rows[0];

    const enrollment2 = await EnrollmentModel.create({
      offering_id: testOffering.id,
      user_id: user2.id,
      course_role: 'tutor',
      created_by: adminId,
      updated_by: adminId,
    });
    createdEnrollmentIds.push(enrollment2.id);

    const enrollments = await EnrollmentModel.findByOffering(testOffering.id);

    expect(Array.isArray(enrollments)).toBeTruthy();
    expect(enrollments.length >= 2).toBeTruthy();

    // Clean up user2
    await pool.query('DELETE FROM users WHERE id = $1', [user2.id]);
  });

  it('should filter enrollments by course_role', async () => {
    const enrollments = await EnrollmentModel.findByOffering(testOffering.id, {
      course_role: 'ta',
    });

    expect(Array.isArray(enrollments)).toBeTruthy();
    expect(enrollments.every(e => e.course_role === 'ta')).toBeTruthy();
  });

  it('should filter enrollments by status', async () => {
    const enrollments = await EnrollmentModel.findByOffering(testOffering.id, {
      status: 'dropped',
    });

    expect(Array.isArray(enrollments)).toBeTruthy();
    expect(enrollments.every(e => e.status === 'dropped')).toBeTruthy();
  });

  it('should find enrollments by course role', async () => {
    const tas = await EnrollmentModel.findByCourseRole(testOffering.id, 'ta');

    expect(Array.isArray(tas)).toBeTruthy();
    expect(tas.every(e => e.course_role === 'ta')).toBeTruthy();
  });

  it('should count enrollments by offering', async () => {
    const count = await EnrollmentModel.countByOffering(testOffering.id);

    expect(count >= 1).toBeTruthy();
    expect(typeof count).toBe('number');
  });

  it('should count enrollments by role', async () => {
    const taCount = await EnrollmentModel.countByOffering(testOffering.id, {
      course_role: 'ta',
    });

    expect(typeof taCount).toBe('number');
  });

  it('should count enrollments by status', async () => {
    const droppedCount = await EnrollmentModel.countByOffering(testOffering.id, {
      status: 'dropped',
    });

    expect(typeof droppedCount).toBe('number');
  });

  it('should delete enrollment', async () => {
    // Create temporary enrollment to delete
    const tempUserResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `enrollment-temp-${Date.now()}@test.edu`,
        'Temp User',
        'student',
        'active',
        adminId
      ]
    );
    const tempUser = tempUserResult.rows[0];

    const tempEnrollment = await EnrollmentModel.create({
      offering_id: testOffering.id,
      user_id: tempUser.id,
      created_by: adminId,
      updated_by: adminId,
    });

    const deleted = await EnrollmentModel.delete(tempEnrollment.id);

    expect(deleted).toBe(true);

    const found = await EnrollmentModel.findById(tempEnrollment.id);
    expect(found).toBe(null);

    // Clean up temp user
    await pool.query('DELETE FROM users WHERE id = $1', [tempUser.id]);
  });

  it('should enforce enrollment_role_enum constraint', async () => {
    await expect(async () => {
      await pool.query(
        `INSERT INTO enrollments (offering_id, user_id, course_role, created_by, updated_by)
         VALUES ($1, $2, $3::enrollment_role_enum, $4, $4)`,
        [testOffering.id, testUser.id, 'invalid_enum', adminId]
      );
    }).rejects.toThrow(/invalid input value for enum/);
  });

  it('should respect limit and offset options', async () => {
    const enrollments1 = await EnrollmentModel.findByOffering(testOffering.id, {
      limit: 1,
      offset: 0,
    });

    const enrollments2 = await EnrollmentModel.findByOffering(testOffering.id, {
      limit: 1,
      offset: 1,
    });

    expect(enrollments1.length).toBe(1);
    
    if (enrollments2.length > 0) {
      expect(enrollments1[0].id).not.toBe(enrollments2[0].id);
    }
  });
});
