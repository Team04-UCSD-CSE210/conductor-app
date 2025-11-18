/**
 * EnrollmentModel Tests
 * 
 * Tests for enrollment model CRUD operations including:
 * - Creating enrollments with enum validation
 * - Querying enrollments by various criteria
 * - Updating enrollment roles and status
 * - Constraint validation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { pool } from '../db.js';
import { EnrollmentModel } from '../models/enrollment-model.js';

describe('EnrollmentModel', () => {
  let testOffering;
  let testUser;
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

  after(async () => {
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

    assert.ok(errors.length > 0, 'Should have validation errors');
    assert.ok(errors.some(e => e.includes('offering_id')), 'Should require offering_id');
    assert.ok(errors.some(e => e.includes('user_id')), 'Should require user_id');
  });

  it('should validate course_role enum', async () => {
    const errors = EnrollmentModel.validate({
      offering_id: testOffering.id,
      user_id: testUser.id,
      course_role: 'invalid_role',
    });

    assert.ok(errors.length > 0, 'Should have validation errors');
    assert.ok(errors.some(e => e.includes('Invalid course_role')), 'Should reject invalid course_role');
  });

  it('should validate status enum', async () => {
    const errors = EnrollmentModel.validate({
      offering_id: testOffering.id,
      user_id: testUser.id,
      status: 'invalid_status',
    });

    assert.ok(errors.length > 0, 'Should have validation errors');
    assert.ok(errors.some(e => e.includes('Invalid status')), 'Should reject invalid status');
  });

  it('should accept valid course_role values', async () => {
    const validRoles = ['student', 'ta', 'tutor'];

    for (const role of validRoles) {
      const errors = EnrollmentModel.validate({
        offering_id: testOffering.id,
        user_id: testUser.id,
        course_role: role,
      });

      assert.strictEqual(errors.length, 0, `Should accept valid role: ${role}`);
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

    assert.ok(enrollment.id, 'Should return enrollment ID');
    assert.strictEqual(enrollment.course_role, 'student', 'Should set student role');
    assert.strictEqual(enrollment.status, 'enrolled', 'Should default to enrolled status');
    
    createdEnrollmentIds.push(enrollment.id);
  });

  it('should find enrollment by ID', async () => {
    const enrollmentId = createdEnrollmentIds[0];
    const enrollment = await EnrollmentModel.findById(enrollmentId);

    assert.ok(enrollment, 'Should find enrollment');
    assert.strictEqual(enrollment.id, enrollmentId, 'Should match ID');
  });

  it('should find enrollment by offering and user', async () => {
    const enrollment = await EnrollmentModel.findByOfferingAndUser(
      testOffering.id,
      testUser.id
    );

    assert.ok(enrollment, 'Should find enrollment');
    assert.strictEqual(enrollment.offering_id, testOffering.id, 'Should match offering ID');
    assert.strictEqual(enrollment.user_id, testUser.id, 'Should match user ID');
  });

  it('should return null for non-existent enrollment', async () => {
    const enrollment = await EnrollmentModel.findById('00000000-0000-0000-0000-000000000000');

    assert.strictEqual(enrollment, null, 'Should return null for non-existent ID');
  });

  it('should update enrollment course_role', async () => {
    const enrollmentId = createdEnrollmentIds[0];
    
    const updated = await EnrollmentModel.update(enrollmentId, {
      course_role: 'ta',
      updated_by: adminId,
    });

    assert.strictEqual(updated.course_role, 'ta', 'Should update to TA role');
    assert.strictEqual(updated.id, enrollmentId, 'Should maintain same ID');
  });

  it('should update enrollment status', async () => {
    const enrollmentId = createdEnrollmentIds[0];
    
    const updated = await EnrollmentModel.update(enrollmentId, {
      status: 'dropped',
      dropped_at: '2025-11-17',
      updated_by: adminId,
    });

    assert.strictEqual(updated.status, 'dropped', 'Should update to dropped status');
    assert.ok(updated.dropped_at, 'Should set dropped_at date');
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

    assert.ok(Array.isArray(enrollments), 'Should return array');
    assert.ok(enrollments.length >= 2, 'Should have at least 2 enrollments');

    // Clean up user2
    await pool.query('DELETE FROM users WHERE id = $1', [user2.id]);
  });

  it('should filter enrollments by course_role', async () => {
    const enrollments = await EnrollmentModel.findByOffering(testOffering.id, {
      course_role: 'ta',
    });

    assert.ok(Array.isArray(enrollments), 'Should return array');
    assert.ok(enrollments.every(e => e.course_role === 'ta'), 'All enrollments should be TAs');
  });

  it('should filter enrollments by status', async () => {
    const enrollments = await EnrollmentModel.findByOffering(testOffering.id, {
      status: 'dropped',
    });

    assert.ok(Array.isArray(enrollments), 'Should return array');
    assert.ok(enrollments.every(e => e.status === 'dropped'), 'All enrollments should be dropped');
  });

  it('should find enrollments by course role', async () => {
    const tas = await EnrollmentModel.findByCourseRole(testOffering.id, 'ta');

    assert.ok(Array.isArray(tas), 'Should return array');
    assert.ok(tas.every(e => e.course_role === 'ta'), 'All results should be TAs');
  });

  it('should count enrollments by offering', async () => {
    const count = await EnrollmentModel.countByOffering(testOffering.id);

    assert.ok(count >= 1, 'Should have at least 1 enrollment');
    assert.strictEqual(typeof count, 'number', 'Should return number');
  });

  it('should count enrollments by role', async () => {
    const taCount = await EnrollmentModel.countByOffering(testOffering.id, {
      course_role: 'ta',
    });

    assert.strictEqual(typeof taCount, 'number', 'Should return number');
  });

  it('should count enrollments by status', async () => {
    const droppedCount = await EnrollmentModel.countByOffering(testOffering.id, {
      status: 'dropped',
    });

    assert.strictEqual(typeof droppedCount, 'number', 'Should return number');
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

    assert.strictEqual(deleted, true, 'Should return true for successful deletion');

    const found = await EnrollmentModel.findById(tempEnrollment.id);
    assert.strictEqual(found, null, 'Enrollment should no longer exist');

    // Clean up temp user
    await pool.query('DELETE FROM users WHERE id = $1', [tempUser.id]);
  });

  it('should enforce enrollment_role_enum constraint', async () => {
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO enrollments (offering_id, user_id, course_role, created_by, updated_by)
           VALUES ($1, $2, $3::enrollment_role_enum, $4, $4)`,
          [testOffering.id, testUser.id, 'invalid_enum', adminId]
        );
      },
      /invalid input value for enum/,
      'Should reject invalid enum value at database level'
    );
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

    assert.strictEqual(enrollments1.length, 1, 'Should return 1 enrollment with limit=1');
    
    if (enrollments2.length > 0) {
      assert.notStrictEqual(
        enrollments1[0].id,
        enrollments2[0].id,
        'Different offsets should return different results'
      );
    }
  });
});
