import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { CourseStaffService } from '../services/course-staff-service.js';
import { CourseStaffModel } from '../models/course-staff-model.js';
import { UserModel } from '../models/user-model.js';

describe('CourseStaffService', () => {
  let instructorId;
  let taUserId;
  let tutorUserId;
  let offeringId;

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE activity_logs RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE course_staff RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE course_offerings RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE course_template RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

    // Create test users
    const instructor = await UserModel.create({
      email: 'instructor@example.com',
      name: 'Instructor',
      role: 'instructor',
    });
    instructorId = instructor.id;

    const ta = await UserModel.create({
      email: 'ta@example.com',
      name: 'TA User',
      role: 'student',
    });
    taUserId = ta.id;

    const tutor = await UserModel.create({
      email: 'tutor@example.com',
      name: 'Tutor User',
      role: 'student',
    });
    tutorUserId = tutor.id;

    // Create course template and offering
    const { rows: templateRows } = await pool.query(`
      INSERT INTO course_template (code, name, department)
      VALUES ('CSE210', 'Software Engineering', 'CSE')
      RETURNING id
    `);
    const templateId = templateRows[0].id;

    const { rows: offeringRows } = await pool.query(`
      INSERT INTO course_offerings (template_id, term, year, instructor_id, start_date, end_date)
      VALUES ($1::uuid, 'Fall', 2024, $2::uuid, '2024-09-01', '2024-12-15')
      RETURNING id
    `, [templateId, instructorId]);
    offeringId = offeringRows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('assigns staff to course offering', async () => {
    const staff = await CourseStaffService.assignStaff(
      offeringId,
      taUserId,
      'ta',
      instructorId
    );

    expect(staff.id).toBeDefined();
    expect(staff.offering_id).toBe(offeringId);
    expect(staff.user_id).toBe(taUserId);
    expect(staff.staff_role).toBe('ta');

    // Check audit log
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['course.staff.assigned']
    );
    expect(rows.length).toBe(1);
  });

  it('gets all staff for an offering', async () => {
    await CourseStaffService.assignStaff(offeringId, taUserId, 'ta', instructorId);
    await CourseStaffService.assignStaff(offeringId, tutorUserId, 'tutor', instructorId);

    const staff = await CourseStaffService.getOfferingStaff(offeringId);

    expect(staff.length).toBe(2);
    expect(staff.some(s => s.staff_role === 'ta')).toBe(true);
    expect(staff.some(s => s.staff_role === 'tutor')).toBe(true);
  });

  it('gets user staff assignments', async () => {
    await CourseStaffService.assignStaff(offeringId, taUserId, 'ta', instructorId);

    const assignments = await CourseStaffService.getUserStaffAssignments(taUserId);

    expect(assignments.length).toBe(1);
    expect(assignments[0].staff_role).toBe('ta');
  });

  it('updates staff role', async () => {
    const staff = await CourseStaffService.assignStaff(
      offeringId,
      taUserId,
      'ta',
      instructorId
    );

    const updated = await CourseStaffService.updateStaffRole(
      staff.id,
      'grader',
      instructorId
    );

    expect(updated.staff_role).toBe('grader');

    // Check audit log for role change
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['role.changed']
    );
    expect(rows.some(r => r.metadata.role_type === 'course')).toBe(true);
  });

  it('removes staff from course', async () => {
    await CourseStaffService.assignStaff(offeringId, taUserId, 'ta', instructorId);

    const deleted = await CourseStaffService.removeStaff(
      offeringId,
      taUserId,
      instructorId
    );

    expect(deleted).toBe(true);

    const staff = await CourseStaffService.getOfferingStaff(offeringId);
    expect(staff.length).toBe(0);
  });

  it('bulk assigns staff', async () => {
    const assignments = [
      { user_id: taUserId, staff_role: 'ta' },
      { user_id: tutorUserId, staff_role: 'tutor' },
    ];

    const result = await CourseStaffService.bulkAssignStaff(
      offeringId,
      assignments,
      instructorId
    );

    expect(result.assigned.length).toBe(2);
    expect(result.failed.length).toBe(0);
  });

  it('handles duplicate staff assignment (upsert)', async () => {
    await CourseStaffService.assignStaff(offeringId, taUserId, 'ta', instructorId);

    // Try to assign same user again with different role
    const staff = await CourseStaffService.assignStaff(
      offeringId,
      taUserId,
      'tutor',
      instructorId
    );

    expect(staff.staff_role).toBe('tutor'); // Should update to tutor

    const allStaff = await CourseStaffService.getOfferingStaff(offeringId);
    expect(allStaff.length).toBe(1); // Should still be only one record
  });
});

