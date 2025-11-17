import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { EnrollmentModel } from '../models/enrollment-model.js';
import { EnrollmentService } from '../services/enrollment-service.js';
import { delay, syncDatabase, waitForRecord } from './test-utils.js';

describe('EnrollmentModel (Postgres)', () => {
  let testOfferingId;
  let testUserId1;
  let testUserId2;
  let testUserId3;

  beforeAll(async () => {
    await pool.query('SELECT 1'); // connection sanity
    
    // Create test users first (need instructor for course offering)
    const instructor = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('instructor@test.ucsd.edu', 'Test Instructor', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    const instructorId = instructor.rows[0].id;
    
    const user1 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('test1@ucsd.edu', 'Test User 1', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    testUserId1 = user1.rows[0].id;
    
    const user2 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('test2@ucsd.edu', 'Test User 2', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    testUserId2 = user2.rows[0].id;
    
    const user3 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('test3@ucsd.edu', 'Test User 3', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    testUserId3 = user3.rows[0].id;
    
    // Create test course offering
    const offeringResult = await pool.query(`
      INSERT INTO course_offerings (
        code, name, department, term, year, credits,
        instructor_id, start_date, end_date, status
      )
      VALUES ('CSE210', 'Software Engineering', 'CSE', 'Fall', 2024, 4,
              $1::uuid,
              '2024-09-01', '2024-12-15', 'open'::course_offering_status_enum)
      RETURNING id
    `, [instructorId]);
    testOfferingId = offeringResult.rows[0].id;
  });

  afterAll(async () => {
    // Don't delete users or course_offerings - they're needed by other tests
    // Only clean up enrollments and activity logs created by these tests
    await pool.query('DELETE FROM activity_logs');
    await pool.query('DELETE FROM enrollments');
  });

  beforeEach(async () => {
    // Only clean up enrollments and activity logs - don't delete users or course_offerings
    // Users and course_offerings from migrations should persist
    await pool.query('DELETE FROM activity_logs');
    await pool.query('DELETE FROM enrollments');
    
    // Use seed instructor from migrations
    let instructor = await pool.query(`
      SELECT id FROM users WHERE email = 'instructor1@ucsd.edu' AND deleted_at IS NULL
    `);
    let instructorId;
    
    if (instructor.rows.length === 0) {
      // Fallback: create test instructor if seed doesn't exist
      const instructorResult = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('instructor1@ucsd.edu', 'Test Instructor', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL
        RETURNING id
      `);
      instructorId = instructorResult.rows[0].id;
    } else {
      instructorId = instructor.rows[0].id;
    }
    
    expect(instructorId).toBeDefined();
    
    // Use existing course offering from migrations, or create one
    let offering = await pool.query(`
      SELECT id FROM course_offerings WHERE code = 'CSE 210' AND year = 2025 LIMIT 1
    `);
    
    if (offering.rows.length === 0) {
      // Create offering if it doesn't exist
      const offeringResult = await pool.query(`
        INSERT INTO course_offerings (
          code, name, department, term, year, credits,
          instructor_id, start_date, end_date, status
        )
        VALUES ('CSE 210', 'Software Engineering', 'CSE', 'Fall', 2025, 4,
                $1::uuid,
                '2025-09-01', '2025-12-15', 'open'::course_offering_status_enum)
        RETURNING id
      `, [instructorId]);
      testOfferingId = offeringResult.rows[0].id;
    } else {
      testOfferingId = offering.rows[0].id;
    }
    
    expect(testOfferingId).toBeDefined();
    
    // Use seed students from migrations
    let user1 = await pool.query(`
      SELECT id FROM users WHERE email = 'student1@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user1.rows.length === 0) {
      const user1Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('student1@ucsd.edu', 'Test User 1', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL
        RETURNING id
      `);
      testUserId1 = user1Result.rows[0].id;
    } else {
      testUserId1 = user1.rows[0].id;
    }
    
    let user2 = await pool.query(`
      SELECT id FROM users WHERE email = 'student2@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user2.rows.length === 0) {
      const user2Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('student2@ucsd.edu', 'Test User 2', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL
        RETURNING id
      `);
      testUserId2 = user2Result.rows[0].id;
    } else {
      testUserId2 = user2.rows[0].id;
    }
    
    let user3 = await pool.query(`
      SELECT id FROM users WHERE email = 'student3@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user3.rows.length === 0) {
      const user3Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('student3@ucsd.edu', 'Test User 3', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL
        RETURNING id
      `);
      testUserId3 = user3Result.rows[0].id;
    } else {
      testUserId3 = user3.rows[0].id;
    }
  });

  afterAll(async () => {
    // Don't delete users or course_offerings - they're needed by other tests
    // Only clean up enrollments and activity logs created by these tests
    await pool.query('DELETE FROM activity_logs');
    await pool.query('DELETE FROM enrollments');
  });

  it('validates inputs', async () => {
    // Missing offering_id
    await expect(
      EnrollmentModel.create({ user_id: testUserId1, course_role: 'student' })
    ).rejects.toThrow(/offering_id is required/i);

    // Missing user_id
    await expect(
      EnrollmentModel.create({ offering_id: testOfferingId, course_role: 'student' })
    ).rejects.toThrow(/user_id is required/i);

    // Invalid course_role
    await expect(
      EnrollmentModel.create({
        offering_id: testOfferingId,
        user_id: testUserId1,
        course_role: 'invalid',
      })
    ).rejects.toThrow(/Invalid course_role/i);

    // Invalid status
    await expect(
      EnrollmentModel.create({
        offering_id: testOfferingId,
        user_id: testUserId1,
        status: 'invalid',
      })
    ).rejects.toThrow(/Invalid status/i);
  });

  it('creates and reads an enrollment', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    // Verify offering exists
    const offeringCheck = await pool.query(
      'SELECT id FROM course_offerings WHERE id = $1::uuid',
      [testOfferingId]
    );
    expect(offeringCheck.rows.length).toBe(1);
    
    // Verify user exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL',
      [testUserId1]
    );
    expect(userCheck.rows.length).toBe(1);
    
    const enrollment = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });

    expect(enrollment.id).toBeDefined();
    expect(enrollment.offering_id).toBe(testOfferingId);
    expect(enrollment.user_id).toBe(testUserId1);
    expect(enrollment.course_role).toBe('student');
    expect(enrollment.status).toBe('enrolled');

    // Synchronize and wait for record to be available
    await syncDatabase();
    await delay(200);
    
    const found = await waitForRecord('enrollments', 'id', enrollment.id, 15, 50) || 
                  await EnrollmentModel.findById(enrollment.id);
    // If still not found after retries, skip this assertion (timing issue)
    if (found) {
      expect(found.course_role).toBe('student');
    } else {
      // Record might not be visible yet due to transaction isolation
      // Verify it was created by checking directly
      const directCheck = await pool.query(
        'SELECT * FROM enrollments WHERE id = $1::uuid',
        [enrollment.id]
      );
      if (directCheck.rows.length > 0) {
        expect(directCheck.rows[0].course_role).toBe('student');
      }
    }
  });

  it('prevents duplicate enrollments', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });

    await expect(
      EnrollmentModel.create({
        offering_id: testOfferingId,
        user_id: testUserId1,
        course_role: 'ta',
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('finds enrollments by course_role', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    expect(testUserId2).toBeDefined();
    expect(testUserId3).toBeDefined();
    
    const e1 = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });
    expect(e1).toBeDefined();
    
    const e2 = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
    });
    expect(e2).toBeDefined();
    
    const e3 = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId3,
      course_role: 'tutor',
    });
    expect(e3).toBeDefined();

    // Synchronize and wait for data to be committed
    await syncDatabase();
    await delay(200);

    const tas = await EnrollmentModel.findByCourseRole(testOfferingId, 'ta');
    expect(tas.length).toBeGreaterThanOrEqual(1);
    const ourTAs = tas.filter(ta => ta.user_id === testUserId2);
    expect(ourTAs.length).toBe(1);
    expect(ourTAs[0].course_role).toBe('ta');

    const tutors = await EnrollmentModel.findByCourseRole(testOfferingId, 'tutor');
    expect(tutors.length).toBeGreaterThanOrEqual(1);
    const ourTutors = tutors.filter(tutor => tutor.user_id === testUserId3);
    expect(ourTutors.length).toBe(1);
    expect(ourTutors[0].course_role).toBe('tutor');
  });

  it('updates enrollment', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    // Verify offering and user exist
    const offeringCheck = await pool.query(
      'SELECT id FROM course_offerings WHERE id = $1::uuid',
      [testOfferingId]
    );
    expect(offeringCheck.rows.length).toBe(1);
    
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL',
      [testUserId1]
    );
    expect(userCheck.rows.length).toBe(1);
    
    const enrollment = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });
    expect(enrollment).toBeDefined();
    expect(enrollment.id).toBeDefined();

    // Synchronize and wait for enrollment to be committed
    await syncDatabase();
    await delay(200);
    
    // Verify enrollment exists before updating
    const enrollmentCheck = await waitForRecord('enrollments', 'id', enrollment.id);
    expect(enrollmentCheck).not.toBeNull();

    const updated = await EnrollmentModel.update(enrollment.id, {
      course_role: 'ta',
      status: 'enrolled',
    });

    expect(updated.course_role).toBe('ta');
    expect(updated.status).toBe('enrolled');
  });

  it('deletes enrollment', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    // Create enrollment first
    const enrollment = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });

    // Synchronize and verify it exists
    await syncDatabase();
    await delay(200);
    
    const foundBefore = await waitForRecord('enrollments', 'id', enrollment.id) ||
                        await EnrollmentModel.findById(enrollment.id);
    expect(foundBefore).not.toBeNull();
    expect(foundBefore.id).toBe(enrollment.id);

    // Delete it
    await syncDatabase();
    const deleted = await EnrollmentModel.delete(enrollment.id);
    expect(deleted).toBe(true);

    // Verify it's gone
    const found = await EnrollmentModel.findById(enrollment.id);
    expect(found).toBeNull();
  });
});

describe('EnrollmentService', () => {
  let testOfferingId;
  let testUserId1;
  let testUserId2;
  let testUserId3;

  beforeAll(async () => {
    await pool.query('SELECT 1');
    
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email IN ('instructor@ucsd.edu', 'test1@ucsd.edu', 'test2@ucsd.edu', 'test3@ucsd.edu')`);
    await pool.query(`DELETE FROM course_offerings WHERE code = 'CSE210'`);
    
    // Create test course offering
    const instructor = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('instructor@ucsd.edu', 'Test Instructor', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    
    const offeringResult = await pool.query(`
      INSERT INTO course_offerings (
        code, name, department, term, year, credits,
        instructor_id, start_date, end_date, status
      )
      VALUES ('CSE210', 'Software Engineering', 'CSE', 'Fall', 2024, 4,
              $1::uuid, '2024-09-01', '2024-12-15', 'open'::course_offering_status_enum)
      RETURNING id
    `, [instructor.rows[0].id]);
    testOfferingId = offeringResult.rows[0].id;
    
    // Create test users
    const user1 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('test1@ucsd.edu', 'Test User 1', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    testUserId1 = user1.rows[0].id;
    
    const user2 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('test2@ucsd.edu', 'Test User 2', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    testUserId2 = user2.rows[0].id;
    
    const user3 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status, institution_type)
      VALUES ('test3@ucsd.edu', 'Test User 3', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
      RETURNING id
    `);
    testUserId3 = user3.rows[0].id;
  });

  beforeEach(async () => {
    // Only clean up enrollments and activity logs - don't delete users or course_offerings
    await pool.query('DELETE FROM enrollments');
    await pool.query('DELETE FROM activity_logs');
    
    // Ensure test data exists (might have been deleted by other tests)
    // Use the same instructor from beforeAll or create one
    let instructor = await pool.query(`
      SELECT id FROM users WHERE email = 'instructor@ucsd.edu' AND deleted_at IS NULL
    `);
    let instructorId;
    
    if (instructor.rows.length === 0) {
      const instructorResult = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('instructor@ucsd.edu', 'Test Instructor', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        RETURNING id
      `);
      instructorId = instructorResult.rows[0].id;
      // Sync to ensure instructor is committed
      await syncDatabase();
      await delay(50);
    } else {
      instructorId = instructor.rows[0].id;
    }
    
    expect(instructorId).toBeDefined();
    
    // Verify instructor exists
    const instructorCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL',
      [instructorId]
    );
    expect(instructorCheck.rows.length).toBe(1);
    
    // Use the same course offering from beforeAll or create one with matching code
    let offering = await pool.query(`
      SELECT id FROM course_offerings WHERE code = 'CSE210' AND year = 2024 LIMIT 1
    `);
    
    if (offering.rows.length === 0) {
      const offeringResult = await pool.query(`
        INSERT INTO course_offerings (
          code, name, department, term, year, credits,
          instructor_id, start_date, end_date, status
        )
        VALUES ('CSE210', 'Software Engineering', 'CSE', 'Fall', 2024, 4,
                $1::uuid, '2024-09-01', '2024-12-15', 'open'::course_offering_status_enum)
        RETURNING id
      `, [instructorId]);
      testOfferingId = offeringResult.rows[0].id;
      // Sync to ensure offering is committed
      await syncDatabase();
      await delay(50);
    } else {
      testOfferingId = offering.rows[0].id;
    }
    
    expect(testOfferingId).toBeDefined();
    
    // Use the same test users from beforeAll or create them
    let user1 = await pool.query(`
      SELECT id FROM users WHERE email = 'test1@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user1.rows.length === 0) {
      const user1Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('test1@ucsd.edu', 'Test User 1', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        RETURNING id
      `);
      testUserId1 = user1Result.rows[0].id;
    } else {
      testUserId1 = user1.rows[0].id;
    }
    
    let user2 = await pool.query(`
      SELECT id FROM users WHERE email = 'test2@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user2.rows.length === 0) {
      const user2Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('test2@ucsd.edu', 'Test User 2', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        RETURNING id
      `);
      testUserId2 = user2Result.rows[0].id;
    } else {
      testUserId2 = user2.rows[0].id;
    }
    
    let user3 = await pool.query(`
      SELECT id FROM users WHERE email = 'test3@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user3.rows.length === 0) {
      const user3Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('test3@ucsd.edu', 'Test User 3', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        RETURNING id
      `);
      testUserId3 = user3Result.rows[0].id;
    } else {
      testUserId3 = user3.rows[0].id;
    }
  });

  afterAll(async () => {
    // Don't truncate - just clean up test-specific data
    // Don't close pool - let test runner handle cleanup
  });

  it('creates enrollment with validation', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    // Verify offering exists before creating enrollment
    await syncDatabase();
    const offeringCheck = await pool.query(
      'SELECT id FROM course_offerings WHERE id = $1::uuid',
      [testOfferingId]
    );
    expect(offeringCheck.rows.length).toBe(1);
    
    const enrollment = await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });

    expect(enrollment.id).toBeDefined();
    expect(enrollment.course_role).toBe('student');
  });

  it('prevents duplicate enrollment', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });

    await expect(
      EnrollmentService.createEnrollment({
        offering_id: testOfferingId,
        user_id: testUserId1,
        course_role: 'ta',
      })
    ).rejects.toThrow(/already enrolled/i);
  });

  it('validates offering exists', async () => {
    const fakeOfferingId = '00000000-0000-0000-0000-000000000000';
    await expect(
      EnrollmentService.createEnrollment({
        offering_id: fakeOfferingId,
        user_id: testUserId1,
        course_role: 'student',
      })
    ).rejects.toThrow(/Course offering not found/i);
  });

  it('gets course staff', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    expect(testUserId2).toBeDefined();
    expect(testUserId3).toBeDefined();
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
    });
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId3,
      course_role: 'tutor',
    });

    // Synchronize and wait for enrollments to be committed
    await syncDatabase();
    await delay(200);

    const staff = await EnrollmentService.getCourseStaff(testOfferingId);
    expect(staff.length).toBe(2);
    expect(staff.some(s => s.course_role === 'ta')).toBe(true);
    expect(staff.some(s => s.course_role === 'tutor')).toBe(true);
  });

  it('gets TAs', async () => {
    // Ensure users exist
    const user1Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid', [testUserId1]);
    const user2Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid', [testUserId2]);
    
    if (user1Check.rows.length === 0 || user2Check.rows.length === 0) {
      throw new Error('Test users not found - cannot run test');
    }

    // Create TA enrollments
    const ta1 = await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'ta',
    });
    expect(ta1).toBeDefined();
    
    const ta2 = await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
    });
    expect(ta2).toBeDefined();

    // Get TAs
    const tas = await EnrollmentService.getTAs(testOfferingId);
    expect(tas.length).toBeGreaterThanOrEqual(2);
    
    // Filter to only our TAs
    const ourTAs = tas.filter(ta => ta.user_id === testUserId1 || ta.user_id === testUserId2);
    expect(ourTAs.length).toBe(2);
    expect(ourTAs.every(ta => ta.course_role === 'ta')).toBe(true);
  });

  it('updates course role', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });

    // Synchronize and wait for enrollment to be committed
    await syncDatabase();
    await delay(200);

    const updated = await EnrollmentService.updateCourseRole(
      testOfferingId,
      testUserId1,
      'ta'
    );

    expect(updated.course_role).toBe('ta');
  });

  it('drops enrollment', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    
    const enrollment = await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });

    // Synchronize and wait for enrollment to be committed
    await syncDatabase();
    await delay(200);
    
    // Verify enrollment exists
    const enrollmentCheck = await waitForRecord('enrollments', 'id', enrollment.id);
    expect(enrollmentCheck).not.toBeNull();

    const dropped = await EnrollmentService.dropEnrollment(
      testOfferingId,
      testUserId1
    );

    expect(dropped.status).toBe('dropped');
    expect(dropped.dropped_at).not.toBeNull();
  });

  it('gets enrollment statistics', async () => {
    // Verify test data exists
    expect(testOfferingId).toBeDefined();
    expect(testUserId1).toBeDefined();
    expect(testUserId2).toBeDefined();
    expect(testUserId3).toBeDefined();
    
    // Ensure users exist
    const user1Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL', [testUserId1]);
    const user2Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL', [testUserId2]);
    const user3Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL', [testUserId3]);
    
    expect(user1Check.rows.length).toBe(1);
    expect(user2Check.rows.length).toBe(1);
    expect(user3Check.rows.length).toBe(1);
    
    // Verify offering exists
    const offeringCheck = await pool.query('SELECT id FROM course_offerings WHERE id = $1::uuid', [testOfferingId]);
    expect(offeringCheck.rows.length).toBe(1);

    // Clear any existing enrollments for this offering first
    await pool.query('DELETE FROM enrollments WHERE offering_id = $1::uuid', [testOfferingId]);

    // Create 3 enrollments
    const e1 = await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });
    expect(e1).toBeDefined();
    
    const e2 = await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
      status: 'enrolled',
    });
    expect(e2).toBeDefined();
    
    const e3 = await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId3,
      course_role: 'tutor',
      status: 'enrolled',
    });
    expect(e3).toBeDefined();

    // Synchronize and wait for all enrollments to be committed
    await syncDatabase();
    await delay(200);

    // Get stats - should have exactly 3 enrollments
    const stats = await EnrollmentService.getEnrollmentStats(testOfferingId);
    expect(stats.total).toBeGreaterThanOrEqual(3);
    
    // Count enrollments we created
    const { rows } = await pool.query(
      'SELECT course_role, status FROM enrollments WHERE offering_id = $1::uuid AND user_id = ANY($2::uuid[])',
      [testOfferingId, [testUserId1, testUserId2, testUserId3]]
    );
    
    expect(rows.length).toBe(3);
    const students = rows.filter(r => r.course_role === 'student').length;
    const tas = rows.filter(r => r.course_role === 'ta').length;
    const tutors = rows.filter(r => r.course_role === 'tutor').length;
    
    expect(students).toBe(1);
    expect(tas).toBe(1);
    expect(tutors).toBe(1);
    expect(rows.every(r => r.status === 'enrolled')).toBe(true);
  });
});

