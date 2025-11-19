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

import { describe, it, beforeAll, afterAll , expect} from 'vitest';
import assert from 'node:assert';
import { pool } from '../db.js';
import { SessionModel } from '../models/session-model.js';

describe('SessionModel', () => {
  let testOffering;
  let testUser;
  let createdSessionIds = [];
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
    // Create test offering
    const offeringResult = await pool.query(
      `INSERT INTO course_offerings (name, code, term, year, instructor_id, start_date, end_date, created_by, updated_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $5, FALSE)
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

  afterAll(async () => {
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

    expect(session.id).toBeTruthy();
    expect(session.title).toBe('Test Session 1', 'Should set title');
    expect(session.access_code).toBe('TEST01', 'Should set access code');
    expect(session.is_active).toBe(true, 'Should default to active');
    
    createdSessionIds.push(session.id);
  });

  it('should find session by ID', async () => {
    const sessionId = createdSessionIds[0];
    const session = await SessionModel.findById(sessionId);

    expect(session).toBeTruthy();
    expect(session.id).toBe(sessionId, 'Should match ID');
    expect(session.course_name).toBeTruthy();
  });

  it('should find session by access code', async () => {
    const session = await SessionModel.findByAccessCode('TEST01');

    expect(session).toBeTruthy();
    expect(session.access_code).toBe('TEST01', 'Should match access code');
    expect(session.course_name).toBeTruthy();
  });

  it('should return null for non-existent access code', async () => {
    const session = await SessionModel.findByAccessCode('NONEXISTENT');

    expect(session).toBe(null, 'Should return null for non-existent code');
  });

  it('should check access code uniqueness', async () => {
    const isUnique = await SessionModel.isAccessCodeUnique('TEST01');

    expect(isUnique).toBe(false, 'Should return false for existing code');

    const isUniqueNew = await SessionModel.isAccessCodeUnique('NEWCODE');

    expect(isUniqueNew).toBe(true, 'Should return true for new code');
  });

  it('should exclude session from uniqueness check', async () => {
    const sessionId = createdSessionIds[0];
    const isUnique = await SessionModel.isAccessCodeUnique('TEST01', sessionId);

    expect(isUnique).toBe(true, 'Should return true when excluding current session');
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

    expect(session2.id).toBeTruthy();
    expect(session3.id).toBeTruthy();
  });

  it('should find sessions by offering ID', async () => {
    const sessions = await SessionModel.findByOfferingId(testOffering.id);

    expect(Array.isArray(sessions)).toBeTruthy();
    expect(sessions.length >= 3).toBeTruthy();
  });

  it('should filter sessions by is_active', async () => {
    const activeSessions = await SessionModel.findByOfferingId(testOffering.id, {
      is_active: true,
    });

    expect(Array.isArray(activeSessions)).toBeTruthy();
    expect(activeSessions.every(s => s.is_active === true)).toBeTruthy();
  });

  it('should update session fields', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.update(sessionId, {
      title: 'Updated Session Title',
      description: 'Updated description',
    }, testUser.id);

    expect(updated.title).toBe('Updated Session Title', 'Should update title');
    expect(updated.description).toBe('Updated description', 'Should update description');
  });

  it('should update session access code', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.update(sessionId, {
      access_code: 'NEWCODE',
    }, testUser.id);

    expect(updated.access_code).toBe('NEWCODE', 'Should update access code');
  });

  it('should deactivate session', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.update(sessionId, {
      is_active: false,
    }, testUser.id);

    expect(updated.is_active).toBe(false, 'Should deactivate session');
  });

  it('should open attendance', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.openAttendance(sessionId, testUser.id);

    expect(updated.attendance_opened_at).toBeTruthy();
    expect(updated.attendance_closed_at).toBe(null, 'Should clear attendance_closed_at');
    expect(updated.is_active).toBe(true, 'Should activate session');
  });

  it('should close attendance', async () => {
    const sessionId = createdSessionIds[0];
    
    const updated = await SessionModel.closeAttendance(sessionId, testUser.id);

    expect(updated.attendance_closed_at).toBeTruthy();
  });

  it('should get session statistics', async () => {
    const sessionId = createdSessionIds[0];
    
    const stats = await SessionModel.getStatistics(sessionId);

    expect(stats).toBeTruthy();
    expect(stats.id).toBeTruthy();
    expect(stats.title).toBeTruthy();
    expect('present_count' in stats).toBeTruthy();
    expect('absent_count' in stats).toBeTruthy();
    expect('question_count' in stats).toBeTruthy();
    expect('response_count' in stats).toBeTruthy();
    expect('enrolled_students' in stats).toBeTruthy();
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

    expect(deleted).toBeTruthy();
    expect(deleted.id).toBe(tempSession.id, 'Should match session ID');

    const found = await SessionModel.findById(tempSession.id);
    expect(found).toBe(null, 'Session should no longer exist');
  });

  it('should return null when updating non-existent session', async () => {
    const updated = await SessionModel.update(
      '00000000-0000-0000-0000-000000000000',
      { title: 'Should fail' },
      testUser.id
    );

    expect(updated).toBe(null, 'Should return null for non-existent session');
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

    expect(sessions1.length).toBe(1, 'Should return 1 session with limit=1');
    
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

      expect(date1 >= date2).toBeTruthy();
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
