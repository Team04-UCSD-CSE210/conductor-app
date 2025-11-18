/**
 * SessionModel Tests
 * 
 * Tests for session model CRUD operations including:
 * - Creating sessions with access codes
 * - Querying sessions by various criteria
 * - Updating session state (attendance open/close)
 * - Access code uniqueness validation
 * - Session statistics
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { pool } from '../db.js';
import { SessionModel } from '../models/session-model.js';

describe('SessionModel', () => {
  let testOffering;
  let testUser;
  let createdSessionIds = [];
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
      ['SessionModel Test Course', 'SESMOD101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create test user (instructor)
    const userResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `session-model-test-${Date.now()}@test.edu`,
        'SessionModel Test Instructor',
        'instructor',
        'active',
        adminId
      ]
    );
    testUser = userResult.rows[0];
  });

  after(async () => {
    // Clean up sessions
    if (createdSessionIds.length > 0) {
      await pool.query(
        `DELETE FROM sessions WHERE id = ANY($1::uuid[])`,
        [createdSessionIds]
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

  it('should create session with required fields', async () => {
    const session = await SessionModel.create({
      offering_id: testOffering.id,
      title: 'Test Session 1',
      description: 'First test session',
      session_date: '2025-11-20',
      session_time: '14:00:00',
      access_code: 'TEST01',
      code_expires_at: '2025-11-21T14:00:00Z',
      created_by: testUser.id,
    });

    assert.ok(session.id, 'Should return session ID');
    assert.strictEqual(session.title, 'Test Session 1', 'Should set title');
    assert.strictEqual(session.access_code, 'TEST01', 'Should set access code');
    assert.strictEqual(session.is_active, true, 'Should default to active');
    
    createdSessionIds.push(session.id);
  });

  it('should find session by ID', async () => {
    const sessionId = createdSessionIds[0];
    const session = await SessionModel.findById(sessionId);

    assert.ok(session, 'Should find session');
    assert.strictEqual(session.id, sessionId, 'Should match ID');
    assert.ok(session.course_name, 'Should include course name from join');
  });

  it('should find session by access code', async () => {
    const session = await SessionModel.findByAccessCode('TEST01');

    assert.ok(session, 'Should find session by access code');
    assert.strictEqual(session.access_code, 'TEST01', 'Should match access code');
    assert.ok(session.course_name, 'Should include course name from join');
  });

  it('should return null for non-existent access code', async () => {
    const session = await SessionModel.findByAccessCode('NONEXISTENT');

    assert.strictEqual(session, null, 'Should return null for non-existent code');
  });

  it('should check access code uniqueness', async () => {
    const isUnique = await SessionModel.isAccessCodeUnique('TEST01');

    assert.strictEqual(isUnique, false, 'Should return false for existing code');

    const isUniqueNew = await SessionModel.isAccessCodeUnique('NEWCODE');

    assert.strictEqual(isUniqueNew, true, 'Should return true for new code');
  });

  it('should exclude session from uniqueness check', async () => {
    const sessionId = createdSessionIds[0];
    const isUnique = await SessionModel.isAccessCodeUnique('TEST01', sessionId);

    assert.strictEqual(isUnique, true, 'Should return true when excluding current session');
  });

  it('should create multiple sessions with different access codes', async () => {
    const session2 = await SessionModel.create({
      offering_id: testOffering.id,
      title: 'Test Session 2',
      description: 'Second test session',
      session_date: '2025-11-21',
      session_time: '15:00:00',
      access_code: 'TEST02',
      code_expires_at: '2025-11-22T15:00:00Z',
      created_by: testUser.id,
    });

    createdSessionIds.push(session2.id);

    const session3 = await SessionModel.create({
      offering_id: testOffering.id,
      title: 'Test Session 3',
      description: 'Third test session',
      session_date: '2025-11-22',
      session_time: '16:00:00',
      access_code: 'TEST03',
      code_expires_at: '2025-11-23T16:00:00Z',
      created_by: testUser.id,
    });

    createdSessionIds.push(session3.id);

    assert.ok(session2.id, 'Should create second session');
    assert.ok(session3.id, 'Should create third session');
  });

  it('should find sessions by offering ID', async () => {
    const sessions = await SessionModel.findByOfferingId(testOffering.id);

    assert.ok(Array.isArray(sessions), 'Should return array');
    assert.ok(sessions.length >= 3, 'Should have at least 3 sessions');
  });

  it('should filter sessions by is_active', async () => {
    const activeSessions = await SessionModel.findByOfferingId(testOffering.id, {
      is_active: true,
    });

    assert.ok(Array.isArray(activeSessions), 'Should return array');
    assert.ok(activeSessions.every(s => s.is_active === true), 'All sessions should be active');
  });

  it('should update session fields', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.update(sessionId, {
      title: 'Updated Session Title',
      description: 'Updated description',
    }, testUser.id);

    assert.strictEqual(updated.title, 'Updated Session Title', 'Should update title');
    assert.strictEqual(updated.description, 'Updated description', 'Should update description');
  });

  it('should update session access code', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.update(sessionId, {
      access_code: 'NEWCODE',
    }, testUser.id);

    assert.strictEqual(updated.access_code, 'NEWCODE', 'Should update access code');
  });

  it('should deactivate session', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.update(sessionId, {
      is_active: false,
    }, testUser.id);

    assert.strictEqual(updated.is_active, false, 'Should deactivate session');
  });

  it('should open attendance', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.openAttendance(sessionId, testUser.id);

    assert.ok(updated.attendance_opened_at, 'Should set attendance_opened_at');
    assert.strictEqual(updated.attendance_closed_at, null, 'Should clear attendance_closed_at');
    assert.strictEqual(updated.is_active, true, 'Should activate session');
  });

  it('should close attendance', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.closeAttendance(sessionId, testUser.id);

    assert.ok(updated.attendance_closed_at, 'Should set attendance_closed_at');
  });

  it('should get session statistics', async () => {
    const sessionId = createdSessionIds[0];
    
    const stats = await SessionModel.getStatistics(sessionId);

    assert.ok(stats, 'Should return statistics');
    assert.ok(stats.id, 'Should include session ID');
    assert.ok(stats.title, 'Should include session title');
    assert.ok('present_count' in stats, 'Should include present_count');
    assert.ok('absent_count' in stats, 'Should include absent_count');
    assert.ok('question_count' in stats, 'Should include question_count');
    assert.ok('response_count' in stats, 'Should include response_count');
    assert.ok('enrolled_students' in stats, 'Should include enrolled_students');
  });

  it('should delete session', async () => {
    // Create temporary session to delete
    const tempSession = await SessionModel.create({
      offering_id: testOffering.id,
      title: 'Temporary Session',
      description: 'Will be deleted',
      session_date: '2025-11-23',
      session_time: '10:00:00',
      access_code: 'TEMPCODE',
      code_expires_at: '2025-11-24T10:00:00Z',
      created_by: testUser.id,
    });

    const deleted = await SessionModel.delete(tempSession.id);

    assert.ok(deleted, 'Should return deleted session');
    assert.strictEqual(deleted.id, tempSession.id, 'Should match session ID');

    const found = await SessionModel.findById(tempSession.id);
    assert.strictEqual(found, null, 'Session should no longer exist');
  });

  it('should return null when updating non-existent session', async () => {
    const updated = await SessionModel.update(
      '00000000-0000-0000-0000-000000000000',
      { title: 'Should fail' },
      testUser.id
    );

    assert.strictEqual(updated, null, 'Should return null for non-existent session');
  });

  it('should reject update with no valid fields', async () => {
    const sessionId = createdSessionIds[0];

    await assert.rejects(
      async () => {
        await SessionModel.update(sessionId, {
          invalid_field: 'value',
        }, testUser.id);
      },
      /No valid fields to update/,
      'Should reject update with no valid fields'
    );
  });

  it('should respect limit and offset options', async () => {
    const sessions1 = await SessionModel.findByOfferingId(testOffering.id, {
      limit: 1,
      offset: 0,
    });

    const sessions2 = await SessionModel.findByOfferingId(testOffering.id, {
      limit: 1,
      offset: 1,
    });

    assert.strictEqual(sessions1.length, 1, 'Should return 1 session with limit=1');
    
    if (sessions2.length > 0) {
      assert.notStrictEqual(
        sessions1[0].id,
        sessions2[0].id,
        'Different offsets should return different results'
      );
    }
  });

  it('should order sessions by date descending', async () => {
    const sessions = await SessionModel.findByOfferingId(testOffering.id);

    if (sessions.length >= 2) {
      const date1 = new Date(sessions[0].session_date);
      const date2 = new Date(sessions[1].session_date);

      assert.ok(date1 >= date2, 'Sessions should be ordered by date descending');
    }
  });

  // TODO: Fix - FK violation gets masked by unique constraint on access_code
  // it('should enforce foreign key constraint on offering_id', async () => {
  //   await assert.rejects(
  //     async () => {
  //       await SessionModel.create({
  //         offering_id: '00000000-0000-0000-0000-000000000000',
  //         title: 'Invalid Session',
  //         description: 'Should fail',
  //         session_date: '2025-11-20',
  //         session_time: '14:00:00',
  //         access_code: `INVALID-${Date.now()}`,
  //         code_expires_at: '2025-11-21T14:00:00Z',
  //         created_by: testUser.id,
  //       });
  //     },
  //     /violates foreign key constraint/,
  //     'Should reject invalid offering_id'
  //   );
  // });
});
