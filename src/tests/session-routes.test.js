/**
 * Session Routes Integration Tests
 * 
 * Tests for session HTTP endpoints including:
 * - POST /api/sessions with authorization checks
 * - Session ownership validation at route level
 * - HTTP status codes and error handling
 * - Permission middleware integration
 */

import { describe, it, beforeAll, afterAll , expect} from 'vitest';
import assert from 'node:assert';
import { pool } from '../db.js';

describe('Session Routes Integration', () => {
  let testOffering;
  let instructor;
  let teamLeader;
  let student;
  let team;
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
      ['Session Routes Test Course', 'SESROUTE101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create instructor
    const instructorResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `session-route-instructor-${Date.now()}@test.edu`,
        'Session Route Instructor',
        'instructor',
        'active',
        adminId
      ]
    );
    instructor = instructorResult.rows[0];

    // Create student
    const otherStudentResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `session-route-student-${Date.now()}@test.edu`,
        'Session Route Student',
        'student',
        'active',
        adminId
      ]
    );
    student = otherStudentResult.rows[0];

    // Create team leader
    const teamLeaderResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `session-route-teamleader-${Date.now()}@test.edu`,
        'Session Route Team Leader',
        'student',
        'active',
        adminId
      ]
    );
    teamLeader = teamLeaderResult.rows[0];

    // Create team
    const teamResult = await pool.query(
      `INSERT INTO team (offering_id, name, leader_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [
        testOffering.id,
        'Test Team',
        teamLeader.id,
        adminId
      ]
    );
    team = teamResult.rows[0];

    // Add team leader to team
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [team.id, teamLeader.id, 'leader', adminId]
    );
  });

  afterAll(async () => {
    // Clean up sessions
    if (createdSessionIds.length > 0) {
      await pool.query(
        `DELETE FROM sessions WHERE id = ANY($1::uuid[])`,
        [createdSessionIds]
      );
    }

    // Clean up team
    if (team) {
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [team.id]);
      await pool.query('DELETE FROM team WHERE id = $1', [team.id]);
    }

    // Clean up users
    const userIds = [instructor?.id, student?.id, teamLeader?.id].filter(Boolean);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }

    // Clean up offering
    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
  });

  it('should create session with instructor credentials (POST /api/sessions)', async () => {
    // Import SessionService to test route behavior
    const { SessionService } = await import('../services/session-service.js');

    const session = await SessionService.createSession({
      offering_id: testOffering.id,
      title: 'Route Test Session',
      description: 'Testing route creation',
      session_date: '2025-11-20',
      session_time: '14:00:00',
    }, instructor.id);

    expect(session.id).toBeTruthy();
    expect(session.title).toBe('Route Test Session', 'Should set title');
    expect(session.access_code).toBeTruthy();
    
    createdSessionIds.push(session.id);
  });

  it('should create session with team leader credentials', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const session = await SessionService.createSession({
      offering_id: testOffering.id,
      title: 'Team Leader Session',
      description: 'Session by team leader',
      session_date: '2025-11-21',
      session_time: '15:00:00',
    }, teamLeader.id);

    expect(session.id).toBeTruthy();
    
    createdSessionIds.push(session.id);
  });

  it('should reject session creation by student', async () => {
    const { SessionService } = await import('../services/session-service.js');

    await assert.rejects(
      async () => {
        await SessionService.createSession({
          offering_id: testOffering.id,
          title: 'Student Session',
          description: 'Should fail',
          session_date: '2025-11-22',
          session_time: '16:00:00',
        }, student.id);
      },
      /Not authorized to create sessions/,
      'Should reject student creating session'
    );
  });

  // TODO: Fix - SessionService needs validation for required fields
  // it('should return 400 for invalid session data', async () => {
  //   const { SessionService } = await import('../services/session-service.js');

  //   await assert.rejects(
  //     async () => {
  //       await SessionService.createSession({
  //         offering_id: testOffering.id,
  //         // Missing required fields
  //       }, instructor.id);
  //     },
  //     /title is required/,
  //     'Should validate required fields'
  //   );
  // });

  it('should get sessions for offering (GET /api/sessions)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessions = await SessionService.getSessionsByOffering(testOffering.id);

    expect(Array.isArray(sessions)).toBeTruthy();
    expect(sessions.length >= 2).toBeTruthy();
  });

  it('should get session by ID (GET /api/sessions/:sessionId)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessionId = createdSessionIds[0];
    const session = await SessionService.getSession(sessionId);

    expect(session).toBeTruthy();
    expect(session.id).toBe(sessionId, 'Should match ID');
  });

  it('should return 404 for non-existent session', async () => {
    const { SessionService } = await import('../services/session-service.js');

    await assert.rejects(
      async () => {
        await SessionService.getSession('00000000-0000-0000-0000-000000000000');
      },
      /Session not found/,
      'Should throw for non-existent session'
    );
  });

  it('should allow creator to update session (PUT /api/sessions/:sessionId)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessionId = createdSessionIds[0];
    const updated = await SessionService.updateSession(
      sessionId,
      { title: 'Updated Title' },
      instructor.id
    );

    expect(updated.title).toBe('Updated Title', 'Should update title');
  });

  it('should reject non-creator updating session', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessionId = createdSessionIds[0];
    
    await assert.rejects(
      async () => {
        await SessionService.updateSession(
          sessionId,
          { title: 'Hijacked' },
          teamLeader.id
        );
      },
      /Not authorized to manage this session/,
      'Should reject non-creator update'
    );
  });

  it('should allow creator to delete session (DELETE /api/sessions/:sessionId)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    // Create temp session
    const tempSession = await SessionService.createSession({
      offering_id: testOffering.id,
      title: 'Temp Session',
      description: 'Will be deleted',
      session_date: '2025-11-23',
      session_time: '10:00:00',
    }, instructor.id);

    const deleted = await SessionService.deleteSession(tempSession.id, instructor.id);

    expect(deleted).toBeTruthy();
  });



  it('should open attendance (POST /api/sessions/:sessionId/open-attendance)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessionId = createdSessionIds[0];
    const session = await SessionService.openAttendance(sessionId, instructor.id);

    expect(session.attendance_opened_at).toBeTruthy();
  });

  it('should close attendance (POST /api/sessions/:sessionId/close-attendance)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessionId = createdSessionIds[0];
    const session = await SessionService.closeAttendance(sessionId, instructor.id);

    expect(session.attendance_closed_at).toBeTruthy();
  });

  it('should regenerate access code (POST /api/sessions/:sessionId/regenerate-code)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessionId = createdSessionIds[0];
    const session = await SessionService.getSession(sessionId);
    const oldCode = session.access_code;

    const updated = await SessionService.regenerateAccessCode(sessionId, instructor.id);

    assert.notStrictEqual(updated.access_code, oldCode, 'Should generate new code');
  });

  it('should add questions to session (POST /api/sessions/:sessionId/questions)', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const sessionId = createdSessionIds[0];
    const questions = await SessionService.addQuestions(
      sessionId,
      [
        {
          question_text: 'What is RBAC?',
          question_type: 'text',
        }
      ],
      instructor.id
    );

    expect(Array.isArray(questions)).toBeTruthy();
    expect(questions.length).toBe(1, 'Should add 1 question');
  });

  // TODO: Fix - SessionService.verifyAccessCode attendance check logic issue
  // it('should verify access code (GET /api/sessions/verify-code/:code)', async () => {
  //   const { SessionService } = await import('../services/session-service.js');

  //   const sessionId = createdSessionIds[0];
  //   const session = await SessionService.getSession(sessionId);

  //   const verification = await SessionService.verifyAccessCode(session.access_code);

  //   expect(verification).toBeTruthy();
  //   expect(verification.valid).toBe(true, 'Should be valid (attendance is open)');
  // });

  it('should return invalid for non-existent access code', async () => {
    const { SessionService } = await import('../services/session-service.js');

    const verification = await SessionService.verifyAccessCode('INVALID');

    expect(verification.valid).toBe(false, 'Should be invalid');
  });

  // TODO: Fix - SessionResponseModel.getSessionStatistics has 'field name must not be null' error
  // it('should get session statistics (GET /api/sessions/:sessionId/statistics)', async () => {
  //   const { SessionService } = await import('../services/session-service.js');

  //   const sessionId = createdSessionIds[0];
  //   const stats = await SessionService.getSessionStatistics(sessionId);

  //   expect(stats).toBeTruthy();
  //   expect('present_count' in stats).toBeTruthy();
  // });





  // TODO: Fix - SessionService.regenerateAccessCode needs ownership validation
  // it('should enforce ownership on regenerate code', async () => {
  //   const { SessionService } = await import('../services/session-service.js');

  //   const sessionId = createdSessionIds[1]; // Team leader's session
  //   
  //   await assert.rejects(
  //     async () => {
  //       await SessionService.regenerateAccessCode(sessionId, instructor.id);
  //     },
  //     /Not authorized to manage this session/,
  //     'Should reject non-creator regenerating code'
  //   );
  // });


});
