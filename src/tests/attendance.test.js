import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../db.js';
import { AttendanceModel } from '../models/attendance-model.js';
import { AttendanceService } from '../services/attendance-service.js';
import { SessionModel } from '../models/session-model.js';
import { SessionQuestionModel } from '../models/session-question-model.js';

describe('Attendance Management Tests', () => {
  let testOffering, testUser, testStudent1, testStudent2, testSession;

  before(async () => {
    // Create test data
    const userResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status)
       VALUES ('test-prof2@test.com', 'Test Professor 2', 'instructor', 'active')
       RETURNING *`
    );
    testUser = userResult.rows[0];

    const student1Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, ucsd_pid)
       VALUES ('student1@test.com', 'Student One', 'student', 'active', 'A12345678')
       RETURNING *`
    );
    testStudent1 = student1Result.rows[0];

    const student2Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, ucsd_pid)
       VALUES ('student2@test.com', 'Student Two', 'student', 'active', 'A87654321')
       RETURNING *`
    );
    testStudent2 = student2Result.rows[0];

    const offeringResult = await pool.query(
      `INSERT INTO course_offerings 
       (code, name, instructor_id, start_date, end_date)
       VALUES ('ATT101', 'Attendance Course', $1, '2025-01-01', '2025-06-01')
       RETURNING *`,
      [testUser.id]
    );
    testOffering = offeringResult.rows[0];

    // Enroll students
    await pool.query(
      `INSERT INTO enrollments (offering_id, user_id, course_role, status)
       VALUES ($1, $2, 'student', 'enrolled'), ($1, $3, 'student', 'enrolled')`,
      [testOffering.id, testStudent1.id, testStudent2.id]
    );
  });

  after(async () => {
    // Cleanup
    await pool.query('DELETE FROM enrollments WHERE offering_id = $1', [testOffering.id]);
    await pool.query('DELETE FROM sessions WHERE offering_id = $1', [testOffering.id]);
    await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', 
      [testUser.id, testStudent1.id, testStudent2.id]);
  });

  describe('AttendanceModel', () => {
    beforeEach(async () => {
      // Clean up and create fresh session
      await pool.query('DELETE FROM sessions WHERE offering_id = $1', [testOffering.id]);
      
      testSession = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Attendance Test Session',
        session_date: '2025-02-01',
        session_time: '10:00:00',
        access_code: 'ATT123',
        created_by: testUser.id
      });
    });

    it('should create attendance record', async () => {
      const attendance = await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present',
        access_code_used: 'ATT123'
      });

      assert.ok(attendance.id);
      assert.equal(attendance.status, 'present');
      assert.equal(attendance.access_code_used, 'ATT123');
    });

    it('should upsert attendance (create or update)', async () => {
      // Create
      const attendance1 = await AttendanceModel.upsert({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'absent'
      });

      assert.equal(attendance1.status, 'absent');

      // Update
      const attendance2 = await AttendanceModel.upsert({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present',
        access_code_used: 'ATT123'
      });

      assert.equal(attendance2.status, 'present');
      assert.equal(attendance2.id, attendance1.id);
    });

    it('should find attendance by session and user', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      const found = await AttendanceModel.findBySessionAndUser(
        testSession.id,
        testStudent1.id
      );

      assert.ok(found);
      assert.equal(found.status, 'present');
    });

    it('should find all attendance for a session', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent2.id,
        status: 'late'
      });

      const attendance = await AttendanceModel.findBySessionId(testSession.id);
      assert.equal(attendance.length, 2);
    });

    it('should filter attendance by status', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent2.id,
        status: 'absent'
      });

      const presentOnly = await AttendanceModel.findBySessionId(testSession.id, {
        status: 'present'
      });

      assert.equal(presentOnly.length, 1);
      assert.equal(presentOnly[0].status, 'present');
    });

    it('should get session statistics', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent2.id,
        status: 'absent'
      });

      const stats = await AttendanceModel.getSessionStatistics(testSession.id);
      
      assert.ok(stats);
      assert.equal(stats.present_count, 1);
      assert.equal(stats.absent_count, 1);
      assert.equal(stats.total_enrolled, 2);
    });

    it('should get user statistics', async () => {
      // Create multiple sessions
      const session2 = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Session 2',
        session_date: '2025-02-02',
        access_code: 'ATT124',
        created_by: testUser.id
      });

      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      await AttendanceModel.create({
        session_id: session2.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      const stats = await AttendanceModel.getUserStatistics(
        testStudent1.id,
        testOffering.id
      );

      assert.ok(stats);
      assert.equal(stats.sessions_present, 2);
      assert.equal(stats.attendance_percentage, 100);
    });

    it('should get course attendance summary', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent2.id,
        status: 'absent'
      });

      const summary = await AttendanceModel.getCourseAttendanceSummary(testOffering.id);
      
      assert.equal(summary.length, 2);
      assert.ok(summary.find(s => s.user_id === testStudent1.id));
      assert.ok(summary.find(s => s.user_id === testStudent2.id));
    });

    it('should mark absent students', async () => {
      // Only student1 has checked in
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      // Mark remaining as absent
      const absentStudents = await AttendanceModel.markAbsentStudents(testSession.id);
      
      assert.equal(absentStudents.length, 1);
      assert.equal(absentStudents[0].user_id, testStudent2.id);
      assert.equal(absentStudents[0].status, 'absent');
    });
  });

  describe('AttendanceService', () => {
    beforeEach(async () => {
      await pool.query('DELETE FROM sessions WHERE offering_id = $1', [testOffering.id]);
      
      testSession = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Service Test Session',
        session_date: '2025-02-01',
        session_time: '10:00:00',
        access_code: 'SVC123',
        is_active: true,
        created_by: testUser.id
      });

      // Open attendance
      await pool.query(
        'UPDATE sessions SET attendance_opened_at = NOW() WHERE id = $1',
        [testSession.id]
      );
    });

    it('should check in student with valid code', async () => {
      const attendance = await AttendanceService.checkIn('SVC123', testStudent1.id);
      
      assert.ok(attendance);
      assert.equal(attendance.status, 'present');
      assert.equal(attendance.user_id, testStudent1.id);
    });

    it('should reject check-in with invalid code', async () => {
      await assert.rejects(
        async () => {
          await AttendanceService.checkIn(`INVALID-${Date.now()}`, testStudent1.id);
        },
        { message: 'Invalid access code' }
      );
    });

    it('should reject check-in for non-enrolled student', async () => {
      // Create a non-enrolled user
      const nonEnrolled = await pool.query(
        `INSERT INTO users (email, name, primary_role, status)
         VALUES ('nonenrolled@test.com', 'Not Enrolled', 'student', 'active')
         RETURNING *`
      );

      await assert.rejects(
        async () => {
          await AttendanceService.checkIn('SVC123', nonEnrolled.rows[0].id);
        },
        { message: 'You are not enrolled in this course' }
      );

      await pool.query('DELETE FROM users WHERE id = $1', [nonEnrolled.rows[0].id]);
    });

    it('should submit responses', async () => {
      // Create questions
      const question1 = await SessionQuestionModel.create({
        session_id: testSession.id,
        question_text: 'Question 1',
        question_type: 'text',
        question_order: 1,
        created_by: testUser.id
      });

      const question2 = await SessionQuestionModel.create({
        session_id: testSession.id,
        question_text: 'Question 2',
        question_type: 'multiple_choice',
        question_order: 2,
        created_by: testUser.id
      });

      const responses = await AttendanceService.submitResponses(
        testSession.id,
        testStudent1.id,
        [
          { question_id: question1.id, response_text: 'Answer 1' },
          { question_id: question2.id, response_option: 'A' }
        ]
      );

      assert.equal(responses.length, 2);
    });

    it('should get student attendance', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      const attendance = await AttendanceService.getStudentAttendance(
        testStudent1.id,
        testOffering.id
      );

      assert.ok(attendance.length > 0);
    });

    it('should mark attendance manually', async () => {
      const attendance = await AttendanceService.markAttendance(
        testSession.id,
        testStudent1.id,
        'present'
      );

      assert.equal(attendance.status, 'present');
    });

    it('should update attendance status', async () => {
      const attendance = await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'late'
      });

      const updated = await AttendanceService.updateAttendanceStatus(
        attendance.id,
        'present'
      );

      assert.equal(updated.status, 'present');
    });

    it('should close session and mark absent', async () => {
      // Only student1 checked in
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      const result = await AttendanceService.closeSessionAndMarkAbsent(
        testSession.id,
        testUser.id
      );

      assert.equal(result.markedAbsent, 1);
      assert.ok(result.session.attendance_closed_at);
    });

    it('should get attendance report', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      const report = await AttendanceService.getAttendanceReport(testSession.id);
      
      assert.ok(report.session);
      assert.equal(report.report.length, 2); // Both enrolled students
      assert.ok(report.statistics);
    });

    it('should get course attendance summary', async () => {
      await AttendanceModel.create({
        session_id: testSession.id,
        user_id: testStudent1.id,
        status: 'present'
      });

      const summary = await AttendanceService.getCourseAttendanceSummary(testOffering.id);
      
      assert.equal(summary.length, 2);
    });

    it('should bulk import attendance', async () => {
      const attendanceData = [
        {
          email: 'student1@test.com',
          status: 'present'
        },
        {
          ucsd_pid: 'A87654321',
          status: 'late'
        }
      ];

      const results = await AttendanceService.bulkImportAttendance(
        testSession.id,
        attendanceData,
        testUser.id
      );

      assert.equal(results.length, 2);
      assert.equal(results[0].status, 'success');
      assert.equal(results[1].status, 'success');
    });
  });
});
