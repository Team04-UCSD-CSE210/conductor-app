/**
 * Session Ownership Tests
 * 
 * Tests for session ownership and authorization:
 * - Only instructors and team leaders can create sessions
 * - Only session creators can manage their sessions
 * - Team leader authorization checks
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { pool } from '../db.js';
import { SessionService } from '../services/session-service.js';

describe('Session Ownership and Authorization', () => {
  let testOffering;
  let instructor;
  let student;
  let teamLeader;
  let team;
  let sessionByInstructor;
  let sessionByTeamLeader;
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
      ['Session Ownership Test Course', 'SESH101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create instructor
    const instructorResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `session-instructor-${Date.now()}@test.edu`,
        'Session Test Instructor',
        'instructor',
        'active',
        adminId
      ]
    );
    instructor = instructorResult.rows[0];

    // Create student
    const studentResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `session-student-${Date.now()}@test.edu`,
        'Session Test Student',
        'student',
        'active',
        adminId
      ]
    );
    student = studentResult.rows[0];

    // Create team leader
    const teamLeaderResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `session-team-leader-${Date.now()}@test.edu`,
        'Session Test Team Leader',
        'student',
        'active',
        adminId
      ]
    );
    teamLeader = teamLeaderResult.rows[0];

    // Create team with team leader
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

    // Add team leader as team member with leader role
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [team.id, teamLeader.id, 'leader', adminId]
    );
  });

  after(async () => {
    // Clean up sessions
    if (sessionByInstructor) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [sessionByInstructor.id]);
    }
    if (sessionByTeamLeader) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [sessionByTeamLeader.id]);
    }

    // Clean up team members and team
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

  it('should allow instructor to create session', async () => {
    sessionByInstructor = await SessionService.createSession({
      offering_id: testOffering.id,
      title: 'Instructor Session',
      description: 'Session created by instructor',
      session_date: '2025-11-20',
      session_time: '14:00:00',
    }, instructor.id);

    assert.ok(sessionByInstructor.id, 'Should create session');
    assert.strictEqual(sessionByInstructor.created_by, instructor.id, 'Should set instructor as creator');
    assert.ok(sessionByInstructor.access_code, 'Should generate access code');
  });

  it('should allow team leader to create session', async () => {
    sessionByTeamLeader = await SessionService.createSession({
      offering_id: testOffering.id,
      title: 'Team Leader Session',
      description: 'Session created by team leader',
      session_date: '2025-11-21',
      session_time: '15:00:00',
    }, teamLeader.id);

    assert.ok(sessionByTeamLeader.id, 'Should create session');
    assert.strictEqual(sessionByTeamLeader.created_by, teamLeader.id, 'Should set team leader as creator');
  });

  it('should reject student creating session', async () => {
    await assert.rejects(
      async () => {
        await SessionService.createSession({
          offering_id: testOffering.id,
          title: 'Student Session',
          description: 'Session created by student (should fail)',
          session_date: '2025-11-22',
          session_time: '16:00:00',
        }, student.id);
      },
      /Not authorized to create sessions/,
      'Should reject student creating session'
    );
  });

  it('should allow creator to update their own session', async () => {
    const updated = await SessionService.updateSession(
      sessionByInstructor.id,
      { title: 'Updated Instructor Session' },
      instructor.id
    );

    assert.strictEqual(updated.title, 'Updated Instructor Session', 'Should update title');
  });

  it('should reject non-creator updating session', async () => {
    await assert.rejects(
      async () => {
        await SessionService.updateSession(
          sessionByInstructor.id,
          { title: 'Hijacked Session' },
          teamLeader.id
        );
      },
      /Not authorized to manage this session/,
      'Should reject non-creator updating session'
    );
  });

  it('should allow creator to delete their own session', async () => {
    // Create a temporary session to delete
    const tempSession = await SessionService.createSession({
      offering_id: testOffering.id,
      title: 'Temporary Session',
      description: 'Will be deleted',
      session_date: '2025-11-23',
      session_time: '10:00:00',
    }, instructor.id);

    const deleted = await SessionService.deleteSession(tempSession.id, instructor.id);

    assert.ok(deleted, 'Should delete session');
  });

  it('should reject non-creator deleting session', async () => {
    await assert.rejects(
      async () => {
        await SessionService.deleteSession(sessionByInstructor.id, student.id);
      },
      /Not authorized to manage this session/,
      'Should reject non-creator deleting session'
    );
  });

  it('should allow creator to open attendance', async () => {
    const updated = await SessionService.openAttendance(sessionByInstructor.id, instructor.id);

    assert.ok(updated.attendance_opened_at, 'Should set attendance_opened_at');
  });

  it('should reject non-creator opening attendance', async () => {
    await assert.rejects(
      async () => {
        await SessionService.openAttendance(sessionByTeamLeader.id, instructor.id);
      },
      /Not authorized to manage this session/,
      'Should reject non-creator opening attendance'
    );
  });

  it('should allow creator to close attendance', async () => {
    const updated = await SessionService.closeAttendance(sessionByInstructor.id, instructor.id);

    assert.ok(updated.attendance_closed_at, 'Should set attendance_closed_at');
  });

  it('should reject non-creator closing attendance', async () => {
    await assert.rejects(
      async () => {
        await SessionService.closeAttendance(sessionByInstructor.id, teamLeader.id);
      },
      /Not authorized to manage this session/,
      'Should reject non-creator closing attendance'
    );
  });

  it('should allow creator to add questions', async () => {
    const questions = await SessionService.addQuestions(
      sessionByInstructor.id,
      [
        {
          question_text: 'What is RBAC?',
          question_type: 'multiple_choice',
          correct_answer: 'Role-Based Access Control',
        }
      ],
      instructor.id
    );

    assert.ok(Array.isArray(questions), 'Should return questions array');
    assert.strictEqual(questions.length, 1, 'Should create 1 question');
  });

  it('should reject non-creator adding questions', async () => {
    await assert.rejects(
      async () => {
        await SessionService.addQuestions(
          sessionByInstructor.id,
          [
            {
              question_text: 'Unauthorized question',
              question_type: 'text',
            }
          ],
          student.id
        );
      },
      /Not authorized to manage this session/,
      'Should reject non-creator adding questions'
    );
  });

  it('should verify userCanCreateSession returns true for instructor', async () => {
    const canCreate = await SessionService.userCanCreateSession(instructor.id, testOffering.id);

    assert.strictEqual(canCreate, true, 'Instructor should be able to create sessions');
  });

  it('should verify userCanCreateSession returns true for team leader', async () => {
    const canCreate = await SessionService.userCanCreateSession(teamLeader.id, testOffering.id);

    assert.strictEqual(canCreate, true, 'Team leader should be able to create sessions');
  });

  it('should verify userCanCreateSession returns false for student', async () => {
    const canCreate = await SessionService.userCanCreateSession(student.id, testOffering.id);

    assert.strictEqual(canCreate, false, 'Regular student should not be able to create sessions');
  });

  it('should verify userCanCreateSession returns false for non-existent user', async () => {
    const canCreate = await SessionService.userCanCreateSession(
      '00000000-0000-0000-0000-000000000000',
      testOffering.id
    );

    assert.strictEqual(canCreate, false, 'Non-existent user should not be able to create sessions');
  });
});
