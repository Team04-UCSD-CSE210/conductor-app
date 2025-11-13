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
    
    // Create test course offering
    const offeringResult = await pool.query(`
      INSERT INTO course_offerings (
        code, name, department, term, year, credits,
        instructor_id, start_date, end_date, status
      )
      VALUES ('CSE210', 'Software Engineering', 'CSE', 'Fall', 2024, 4,
              (SELECT id FROM users LIMIT 1),
              '2024-09-01', '2024-12-15', 'open')
      RETURNING id
    `);
    testOfferingId = offeringResult.rows[0].id;
    
    // Create test users
    const user1 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status)
      VALUES ('test1@ucsd.edu', 'Test User 1', 'student', 'active')
      RETURNING id
    `);
    testUserId1 = user1.rows[0].id;
    
    const user2 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status)
      VALUES ('test2@ucsd.edu', 'Test User 2', 'student', 'active')
      RETURNING id
    `);
    testUserId2 = user2.rows[0].id;
    
    const user3 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status)
      VALUES ('test3@ucsd.edu', 'Test User 3', 'student', 'active')
      RETURNING id
    `);
    testUserId3 = user3.rows[0].id;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE enrollments RESTART IDENTITY CASCADE');
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
    const enrollment = await EnrollmentModel.create({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
    });

    const deleted = await EnrollmentModel.delete(enrollment.id);
    expect(deleted).toBe(true);

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
      INSERT INTO users (email, name, primary_role, status)
      VALUES ('instructor@ucsd.edu', 'Test Instructor', 'instructor', 'active')
      RETURNING id
    `);
    
    const offeringResult = await pool.query(`
      INSERT INTO course_offerings (
        code, name, department, term, year, credits,
        instructor_id, start_date, end_date, status
      )
      VALUES ('CSE210', 'Software Engineering', 'CSE', 'Fall', 2024, 4,
              $1, '2024-09-01', '2024-12-15', 'open')
      RETURNING id
    `, [instructor.rows[0].id]);
    testOfferingId = offeringResult.rows[0].id;
    
    // Create test users
    const user1 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status)
      VALUES ('test1@ucsd.edu', 'Test User 1', 'student', 'active')
      RETURNING id
    `);
    testUserId1 = user1.rows[0].id;
    
    const user2 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status)
      VALUES ('test2@ucsd.edu', 'Test User 2', 'student', 'active')
      RETURNING id
    `);
    testUserId2 = user2.rows[0].id;
    
    const user3 = await pool.query(`
      INSERT INTO users (email, name, primary_role, status)
      VALUES ('test3@ucsd.edu', 'Test User 3', 'student', 'active')
      RETURNING id
    `);
    testUserId3 = user3.rows[0].id;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE enrollments RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE activity_logs RESTART IDENTITY CASCADE');
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
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'ta',
    });
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
    });

    const tas = await EnrollmentService.getTAs(testOfferingId);
    expect(tas.length).toBe(2);
    expect(tas.every(ta => ta.course_role === 'ta')).toBe(true);
  });

  it('updates course role', async () => {
    const enrollment = await EnrollmentService.createEnrollment({
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
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId1,
      course_role: 'student',
      status: 'enrolled',
    });
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId2,
      course_role: 'ta',
      status: 'enrolled',
    });
    
    await EnrollmentService.createEnrollment({
      offering_id: testOfferingId,
      user_id: testUserId3,
      course_role: 'tutor',
      status: 'enrolled',
    });

    const stats = await EnrollmentService.getEnrollmentStats(testOfferingId);
    expect(stats.total).toBe(3);
    expect(stats.by_role.students).toBe(1);
    expect(stats.by_role.tas).toBe(1);
    expect(stats.by_role.tutors).toBe(1);
    expect(stats.by_status.enrolled).toBe(3);
  });
});

