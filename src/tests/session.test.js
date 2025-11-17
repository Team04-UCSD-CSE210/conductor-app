import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../db.js';
import { SessionModel } from '../models/session-model.js';
import { SessionQuestionModel } from '../models/session-question-model.js';
import { SessionResponseModel } from '../models/session-response-model.js';
import { SessionService } from '../services/session-service.js';

describe('Session Management Tests', () => {
  let testOffering, testUser, testStudent, testSession;

  before(async () => {
    // Create test data
    const userResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status)
       VALUES ('test-prof@test.com', 'Test Professor', 'instructor', 'active')
       RETURNING *`
    );
    testUser = userResult.rows[0];

    const studentResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status)
       VALUES ('test-student@test.com', 'Test Student', 'student', 'active')
       RETURNING *`
    );
    testStudent = studentResult.rows[0];

    const offeringResult = await pool.query(
      `INSERT INTO course_offerings 
       (code, name, instructor_id, start_date, end_date)
       VALUES ('TEST101', 'Test Course', $1, '2025-01-01', '2025-06-01')
       RETURNING *`,
      [testUser.id]
    );
    testOffering = offeringResult.rows[0];

    // Enroll student
    await pool.query(
      `INSERT INTO enrollments (offering_id, user_id, course_role, status)
       VALUES ($1, $2, 'student', 'enrolled')`,
      [testOffering.id, testStudent.id]
    );
  });

  after(async () => {
    // Cleanup
    await pool.query('DELETE FROM enrollments WHERE offering_id = $1', [testOffering.id]);
    await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUser.id, testStudent.id]);
  });

  describe('SessionModel', () => {
    beforeEach(async () => {
      // Clean up sessions before each test
      await pool.query('DELETE FROM sessions WHERE offering_id = $1', [testOffering.id]);
    });

    it('should create a session', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Test Session',
        description: 'Test description',
        session_date: '2025-02-01',
        session_time: '10:00:00',
        access_code: 'TEST123',
        code_expires_at: '2025-02-02',
        created_by: testUser.id
      });

      assert.ok(session.id);
      assert.equal(session.title, 'Test Session');
      assert.equal(session.access_code, 'TEST123');
    });

    it('should find session by ID', async () => {
      const created = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Find Test',
        session_date: '2025-02-01',
        access_code: 'FIND123',
        created_by: testUser.id
      });

      const found = await SessionModel.findById(created.id);
      assert.equal(found.id, created.id);
      assert.equal(found.title, 'Find Test');
    });

    it('should find session by access code', async () => {
      await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Code Test',
        session_date: '2025-02-01',
        access_code: 'CODE123',
        created_by: testUser.id
      });

      const found = await SessionModel.findByAccessCode('CODE123');
      assert.ok(found);
      assert.equal(found.access_code, 'CODE123');
    });

    it('should update session', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Original Title',
        session_date: '2025-02-01',
        access_code: 'UPDATE1',
        created_by: testUser.id
      });

      const updated = await SessionModel.update(
        session.id,
        { title: 'Updated Title' },
        testUser.id
      );

      assert.equal(updated.title, 'Updated Title');
    });

    it('should delete session', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Delete Test',
        session_date: '2025-02-01',
        access_code: 'DEL123',
        created_by: testUser.id
      });

      const deleted = await SessionModel.delete(session.id);
      assert.ok(deleted);

      const found = await SessionModel.findById(session.id);
      assert.equal(found, null);
    });
  });

  describe('SessionQuestionModel', () => {
    beforeEach(async () => {
      await pool.query('DELETE FROM sessions WHERE offering_id = $1', [testOffering.id]);
      
      testSession = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Question Test Session',
        session_date: '2025-02-01',
        access_code: 'QTEST1',
        created_by: testUser.id
      });
    });

    it('should create a question', async () => {
      const question = await SessionQuestionModel.create({
        session_id: testSession.id,
        question_text: 'What is 2+2?',
        question_type: 'text',
        question_order: 1,
        created_by: testUser.id
      });

      assert.ok(question.id);
      assert.equal(question.question_text, 'What is 2+2?');
    });

    it('should find questions by session', async () => {
      await SessionQuestionModel.create({
        session_id: testSession.id,
        question_text: 'Question 1',
        question_type: 'text',
        question_order: 1,
        created_by: testUser.id
      });

      await SessionQuestionModel.create({
        session_id: testSession.id,
        question_text: 'Question 2',
        question_type: 'multiple_choice',
        question_order: 2,
        options: JSON.stringify(['A', 'B', 'C']),
        created_by: testUser.id
      });

      const questions = await SessionQuestionModel.findBySessionId(testSession.id);
      assert.equal(questions.length, 2);
      assert.equal(questions[0].question_order, 1);
    });

    it('should delete question', async () => {
      const question = await SessionQuestionModel.create({
        session_id: testSession.id,
        question_text: 'Delete me',
        question_type: 'text',
        question_order: 1,
        created_by: testUser.id
      });

      await SessionQuestionModel.delete(question.id);
      const found = await SessionQuestionModel.findById(question.id);
      assert.equal(found, null);
    });
  });

  describe('SessionResponseModel', () => {
    let testQuestion;

    beforeEach(async () => {
      await pool.query('DELETE FROM sessions WHERE offering_id = $1', [testOffering.id]);
      
      testSession = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Response Test Session',
        session_date: '2025-02-01',
        access_code: 'RTEST1',
        created_by: testUser.id
      });

      testQuestion = await SessionQuestionModel.create({
        session_id: testSession.id,
        question_text: 'Test Question',
        question_type: 'text',
        question_order: 1,
        created_by: testUser.id
      });
    });

    it('should create a response', async () => {
      const response = await SessionResponseModel.create({
        question_id: testQuestion.id,
        user_id: testStudent.id,
        response_text: '4'
      });

      assert.ok(response.id);
      assert.equal(response.response_text, '4');
    });

    it('should upsert response (create if not exists)', async () => {
      const response1 = await SessionResponseModel.upsert({
        question_id: testQuestion.id,
        user_id: testStudent.id,
        response_text: 'First answer'
      });

      assert.equal(response1.response_text, 'First answer');

      const response2 = await SessionResponseModel.upsert({
        question_id: testQuestion.id,
        user_id: testStudent.id,
        response_text: 'Updated answer'
      });

      assert.equal(response2.response_text, 'Updated answer');
      assert.equal(response2.id, response1.id);
    });

    it('should find responses by question', async () => {
      await SessionResponseModel.create({
        question_id: testQuestion.id,
        user_id: testStudent.id,
        response_text: 'Answer 1'
      });

      const responses = await SessionResponseModel.findByQuestionId(testQuestion.id);
      assert.equal(responses.length, 1);
    });

    it('should find responses by session', async () => {
      await SessionResponseModel.create({
        question_id: testQuestion.id,
        user_id: testStudent.id,
        response_text: 'Test response'
      });

      const responses = await SessionResponseModel.findBySessionId(testSession.id);
      assert.equal(responses.length, 1);
    });
  });

  describe('SessionService', () => {
    beforeEach(async () => {
      await pool.query('DELETE FROM sessions WHERE offering_id = $1', [testOffering.id]);
    });

    it('should generate unique access code', async () => {
      const code1 = SessionService.generateAccessCode();
      const code2 = SessionService.generateAccessCode();

      assert.equal(code1.length, 6);
      assert.notEqual(code1, code2);
    });

    it('should create session with auto-generated code', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Auto Code Session',
        description: 'Test',
        session_date: '2025-02-01'
      }, testUser.id);

      assert.ok(session.access_code);
      assert.equal(session.access_code.length, 6);
    });

    it('should verify valid access code', async () => {
      // Use a future date to avoid expiration issues
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
      
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Verify Test',
        session_date: futureDate.toISOString().split('T')[0]
      }, testUser.id);

      // Open attendance first
      await SessionService.openAttendance(session.id, testUser.id);

      const verification = await SessionService.verifyAccessCode(session.access_code);
      assert.equal(verification.valid, true);
      assert.ok(verification.session);
    });

    it('should reject invalid access code', async () => {
      const verification = await SessionService.verifyAccessCode('INVALID');
      assert.equal(verification.valid, false);
    });

    it('should open and close attendance', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Attendance Test',
        session_date: '2025-02-01'
      }, testUser.id);

      const opened = await SessionService.openAttendance(session.id, testUser.id);
      assert.ok(opened.attendance_opened_at);

      const closed = await SessionService.closeAttendance(session.id, testUser.id);
      assert.ok(closed.attendance_closed_at);
    });
  });
});
