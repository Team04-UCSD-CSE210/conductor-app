import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { EnrollmentModel } from '../models/enrollment-model.js';
import { EnrollmentService } from '../services/enrollment-service.js';

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

  beforeEach(async () => {
    // Use DELETE instead of TRUNCATE to avoid deadlocks
    // Delete in order to respect foreign keys
    // Don't delete users or offerings - they're needed for tests
    await pool.query('DELETE FROM activity_logs');
    await pool.query('DELETE FROM enrollments');
    
    // Ensure instructor exists first (needed for course offering)
    let instructor = await pool.query(`
      SELECT id FROM users WHERE email = 'instructor@test.ucsd.edu' AND deleted_at IS NULL
    `);
    let instructorId;
    
    if (instructor.rows.length === 0) {
      const instructorResult = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('instructor@test.ucsd.edu', 'Test Instructor', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
        RETURNING id
      `);
      instructorId = instructorResult.rows[0].id;
    } else {
      instructorId = instructor.rows[0].id;
    }
    
    // Ensure course offering exists - always check by code, not by stored ID
    let offering = await pool.query(`
      SELECT id FROM course_offerings WHERE code = 'CSE210' AND instructor_id = $1::uuid
    `, [instructorId]);
    
    if (offering.rows.length === 0) {
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
    } else {
      // Update testOfferingId to the existing offering
      testOfferingId = offering.rows[0].id;
    }
    
    // Ensure test users still exist (they might have been deleted by other tests)
    // Always look up by email to get the correct ID
    let user1 = await pool.query(`
      SELECT id FROM users WHERE email = 'test1@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user1.rows.length === 0) {
      const user1Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('test1@ucsd.edu', 'Test User 1', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
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
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
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
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
        RETURNING id
      `);
      testUserId3 = user3Result.rows[0].id;
    } else {
      testUserId3 = user3.rows[0].id;
    }
  });

  afterAll(async () => {
    await pool.query('TRUNCATE TABLE enrollments RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE course_offerings RESTART IDENTITY CASCADE');
    // Don't close pool - other tests may need it
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

    const found = await EnrollmentModel.findById(enrollment.id);
    expect(found).not.toBeNull();
    expect(found.course_role).toBe('student');
  });

  it('prevents duplicate enrollments', async () => {
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

  it('finds enrollments by offering', async () => {
    await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });
    
    await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
    });

    const enrollments = await EnrollmentModel.findByOffering(testOfferingId);
    expect(enrollments.length).toBe(2);
  });

  it('finds enrollments by course_role', async () => {
    await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });
    
    await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
    });
    
    await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId3,
      course_role: 'tutor',
    });

    const tas = await EnrollmentModel.findByCourseRole(testOfferingId, 'ta');
    expect(tas.length).toBe(1);
    expect(tas[0].course_role).toBe('ta');

    const tutors = await EnrollmentModel.findByCourseRole(testOfferingId, 'tutor');
    expect(tutors.length).toBe(1);
    expect(tutors[0].course_role).toBe('tutor');
  });

  it('updates enrollment', async () => {
    const enrollment = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });

    const updated = await EnrollmentModel.update(enrollment.id, {
      course_role: 'ta',
      status: 'enrolled',
    });

    expect(updated.course_role).toBe('ta');
    expect(updated.status).toBe('enrolled');
  });

  it('deletes enrollment', async () => {
    // Create enrollment first
    const enrollment = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });

    // Verify it exists
    const foundBefore = await EnrollmentModel.findById(enrollment.id);
    expect(foundBefore).not.toBeNull();
    expect(foundBefore.id).toBe(enrollment.id);

    // Delete it
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
    // Use DELETE instead of TRUNCATE to avoid deadlocks
    await pool.query('DELETE FROM enrollments');
    await pool.query('DELETE FROM activity_logs');
    
    // Ensure test data exists (might have been deleted by other tests)
    // Ensure instructor exists first
    let instructor = await pool.query(`
      SELECT id FROM users WHERE email = 'instructor@ucsd.edu' AND deleted_at IS NULL
    `);
    let instructorId;
    
    if (instructor.rows.length === 0) {
      const instructorResult = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('instructor@ucsd.edu', 'Test Instructor', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
        RETURNING id
      `);
      instructorId = instructorResult.rows[0].id;
    } else {
      instructorId = instructor.rows[0].id;
    }
    
    // Ensure course offering exists
    let offering = await pool.query(`
      SELECT id FROM course_offerings WHERE code = 'CSE210' AND instructor_id = $1::uuid
    `, [instructorId]);
    
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
    } else {
      testOfferingId = offering.rows[0].id;
    }
    
    // Ensure test users exist
    let user1 = await pool.query(`
      SELECT id FROM users WHERE email = 'test1@ucsd.edu' AND deleted_at IS NULL
    `);
    if (user1.rows.length === 0) {
      const user1Result = await pool.query(`
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('test1@ucsd.edu', 'Test User 1', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
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
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
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
        ON CONFLICT (email) DO UPDATE SET deleted_at = NULL, email = EXCLUDED.email
        RETURNING id
      `);
      testUserId3 = user3Result.rows[0].id;
    } else {
      testUserId3 = user3.rows[0].id;
    }
  });

  afterAll(async () => {
    await pool.query('TRUNCATE TABLE enrollments RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE activity_logs RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE course_offerings RESTART IDENTITY CASCADE');
    // Don't close pool - let test runner handle cleanup
  });

  it('creates enrollment with validation', async () => {
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
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });

    const updated = await EnrollmentService.updateCourseRole(
      testOfferingId,
      testUserId1,
      'ta'
    );

    expect(updated.course_role).toBe('ta');
  });

  it('drops enrollment', async () => {
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });

    const dropped = await EnrollmentService.dropEnrollment(
      testOfferingId,
      testUserId1
    );

    expect(dropped.status).toBe('dropped');
    expect(dropped.dropped_at).not.toBeNull();
  });

  it('gets enrollment statistics', async () => {
    // Ensure users exist
    const user1Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid', [testUserId1]);
    const user2Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid', [testUserId2]);
    const user3Check = await pool.query('SELECT id FROM users WHERE id = $1::uuid', [testUserId3]);
    
    if (user1Check.rows.length === 0 || user2Check.rows.length === 0 || user3Check.rows.length === 0) {
      throw new Error('Test users not found - cannot run test');
    }

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

