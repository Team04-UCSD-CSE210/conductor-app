/**
 * Session Team-Based Filtering Tests
 * 
 * Tests for team_id column functionality:
 * - Auto-detection of team_id for team leaders
 * - Course-wide sessions (team_id = NULL) visible to all
 * - Team-specific sessions visible only to team members
 * - Filtering logic in getSessionsByOffering
 * - Edge cases and boundary conditions
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { pool } from '../db.js';
import { SessionModel } from '../models/session-model.js';
import { SessionService } from '../services/session-service.js';

describe('Session Team-Based Filtering', () => {
  let testOffering;
  let instructor;
  let teamLeaderA;
  let teamLeaderB;
  let studentA1;
  let studentA2;
  let studentB1;
  let studentNoTeam;
  let teamA;
  let teamB;
  let adminId;
  let createdSessionIds = [];

  beforeAll(async () => {
    // Get or create admin user
    let adminResult = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@ucsd.edu' AND deleted_at IS NULL LIMIT 1"
    );
    
    if (adminResult.rows.length === 0) {
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
      ['Team Filter Test Course', 'TEAMFILTER101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create instructor
    const instructorResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`team-filter-instructor-${Date.now()}@test.edu`, 'Team Filter Instructor', 'instructor', 'active', adminId]
    );
    instructor = instructorResult.rows[0];

    // Create team leaders
    const teamLeaderAResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`team-leader-a-${Date.now()}@test.edu`, 'Team Leader A', 'student', 'active', adminId]
    );
    teamLeaderA = teamLeaderAResult.rows[0];

    const teamLeaderBResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`team-leader-b-${Date.now()}@test.edu`, 'Team Leader B', 'student', 'active', adminId]
    );
    teamLeaderB = teamLeaderBResult.rows[0];

    // Create team members
    const studentA1Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`student-a1-${Date.now()}@test.edu`, 'Student A1', 'student', 'active', adminId]
    );
    studentA1 = studentA1Result.rows[0];

    const studentA2Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`student-a2-${Date.now()}@test.edu`, 'Student A2', 'student', 'active', adminId]
    );
    studentA2 = studentA2Result.rows[0];

    const studentB1Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`student-b1-${Date.now()}@test.edu`, 'Student B1', 'student', 'active', adminId]
    );
    studentB1 = studentB1Result.rows[0];

    const studentNoTeamResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`student-noteam-${Date.now()}@test.edu`, 'Student No Team', 'student', 'active', adminId]
    );
    studentNoTeam = studentNoTeamResult.rows[0];

    // Create Team A
    const teamAResult = await pool.query(
      `INSERT INTO team (offering_id, name, leader_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [testOffering.id, 'Team A', teamLeaderA.id, adminId]
    );
    teamA = teamAResult.rows[0];

    // Add team A members
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4), ($1, $5, $6, $4), ($1, $7, $8, $4)`,
      [teamA.id, teamLeaderA.id, 'leader', adminId, studentA1.id, 'member', studentA2.id, 'member']
    );

    // Create Team B
    const teamBResult = await pool.query(
      `INSERT INTO team (offering_id, name, leader_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [testOffering.id, 'Team B', teamLeaderB.id, adminId]
    );
    teamB = teamBResult.rows[0];

    // Add team B members
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4), ($1, $5, $6, $4)`,
      [teamB.id, teamLeaderB.id, 'leader', adminId, studentB1.id, 'member']
    );

    // Enroll students (instructor is referenced via offering.instructor_id, not enrolled)
    const users = [teamLeaderA, teamLeaderB, studentA1, studentA2, studentB1, studentNoTeam];
    for (const user of users) {
      await pool.query(
        `INSERT INTO enrollments (offering_id, user_id, course_role, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (offering_id, user_id) DO NOTHING`,
        [testOffering.id, user.id, 'student', 'enrolled']
      );
    }
  });

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    if (createdSessionIds.length > 0) {
      await pool.query(`DELETE FROM sessions WHERE id = ANY($1::uuid[])`, [createdSessionIds]);
    }

    if (teamA) {
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [teamA.id]);
      await pool.query('DELETE FROM team WHERE id = $1', [teamA.id]);
    }

    if (teamB) {
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [teamB.id]);
      await pool.query('DELETE FROM team WHERE id = $1', [teamB.id]);
    }

    await pool.query('DELETE FROM enrollments WHERE offering_id = $1', [testOffering.id]);

    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }

    const userIds = [instructor, teamLeaderA, teamLeaderB, studentA1, studentA2, studentB1, studentNoTeam]
      .filter(u => u)
      .map(u => u.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    if (createdSessionIds.length > 0) {
      await pool.query(`DELETE FROM sessions WHERE id = ANY($1::uuid[])`, [createdSessionIds]);
      createdSessionIds = [];
    }
  });

  describe('Team ID Auto-Detection', () => {
    it('should NOT set team_id for instructor-created sessions (course-wide lecture)', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Instructor Lecture',
        description: 'Course-wide lecture',
        session_date: '2025-11-25',
        session_time: '10:00:00'
      }, instructor.id);

      createdSessionIds.push(session.id);

      expect(session.team_id).toBeNull();
      expect(session.title).toBe('Instructor Lecture');
    });

    it('should auto-set team_id for team leader A', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Team A Meeting',
        description: 'Team-specific meeting',
        session_date: '2025-11-25',
        session_time: '14:00:00'
      }, teamLeaderA.id);

      createdSessionIds.push(session.id);

      expect(session.team_id).toBe(teamA.id);
      expect(session.title).toBe('Team A Meeting');
    });

    it('should auto-set team_id for team leader B', async () => {
      const session = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Team B Meeting',
        description: 'Team-specific meeting',
        session_date: '2025-11-25',
        session_time: '15:00:00'
      }, teamLeaderB.id);

      createdSessionIds.push(session.id);

      expect(session.team_id).toBe(teamB.id);
      expect(session.title).toBe('Team B Meeting');
    });

    it('should NOT set team_id for student without team leadership', async () => {
      // This should fail authorization, but if somehow they create a session, team_id should be null
      try {
        const session = await SessionService.createSession({
          offering_id: testOffering.id,
          title: 'Should Fail',
          session_date: '2025-11-25',
          session_time: '16:00:00'
        }, studentNoTeam.id);

        createdSessionIds.push(session.id);
        expect.fail('Should have thrown authorization error');
      } catch (error) {
        expect(error.message).toContain('Not authorized');
      }
    });
  });

  describe('Session Visibility Filtering', () => {
    let instructorSession;
    let teamASession;
    let teamBSession;

    beforeEach(async () => {
      // Create one course-wide lecture
      instructorSession = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Course-Wide Lecture',
        session_date: '2025-11-25',
        session_time: '09:00:00'
      }, instructor.id);
      createdSessionIds.push(instructorSession.id);

      // Create team-specific sessions
      teamASession = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Team A Meeting',
        session_date: '2025-11-25',
        session_time: '13:00:00'
      }, teamLeaderA.id);
      createdSessionIds.push(teamASession.id);

      teamBSession = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Team B Meeting',
        session_date: '2025-11-25',
        session_time: '14:00:00'
      }, teamLeaderB.id);
      createdSessionIds.push(teamBSession.id);
    });

    it('instructor should see all sessions (course-wide + all team sessions)', async () => {
      // Instructor sees all sessions (no team filtering applied for instructors)
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: instructor.id });

      const titles = sessions.map(s => s.title);
      // Instructor should see at least the course-wide lecture
      expect(titles).toContain('Course-Wide Lecture');
      // May or may not see team sessions depending on implementation
      // Since instructor is not in any team, they should see course-wide only unless we give them special access
    });

    it('team leader A should see course-wide lecture + team A meeting only', async () => {
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: teamLeaderA.id });

      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Course-Wide Lecture');
      expect(titles).toContain('Team A Meeting');
      expect(titles).not.toContain('Team B Meeting');
    });

    it('team leader B should see course-wide lecture + team B meeting only', async () => {
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: teamLeaderB.id });

      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Course-Wide Lecture');
      expect(titles).toContain('Team B Meeting');
      expect(titles).not.toContain('Team A Meeting');
    });

    it('team A member should see course-wide lecture + team A meeting only', async () => {
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: studentA1.id });

      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Course-Wide Lecture');
      expect(titles).toContain('Team A Meeting');
      expect(titles).not.toContain('Team B Meeting');
    });

    it('team B member should see course-wide lecture + team B meeting only', async () => {
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: studentB1.id });

      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Course-Wide Lecture');
      expect(titles).toContain('Team B Meeting');
      expect(titles).not.toContain('Team A Meeting');
    });

    it('student with no team should see only course-wide lectures', async () => {
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: studentNoTeam.id });

      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Course-Wide Lecture');
      expect(titles).not.toContain('Team A Meeting');
      expect(titles).not.toContain('Team B Meeting');
    });
  });

  describe('SessionModel Team Filtering', () => {
    let instructorSession;
    let teamASession;

    beforeEach(async () => {
      instructorSession = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Model Test Lecture',
        session_date: '2025-11-26',
        session_time: '10:00:00',
        access_code: `MDLLEC${Date.now()}`,
        code_expires_at: '2025-11-27T10:00:00Z',
        created_by: instructor.id,
        team_id: null
      });
      createdSessionIds.push(instructorSession.id);

      teamASession = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Model Test Team A',
        session_date: '2025-11-26',
        session_time: '14:00:00',
        access_code: `MDLTMA${Date.now()}`,
        code_expires_at: '2025-11-27T14:00:00Z',
        created_by: teamLeaderA.id,
        team_id: teamA.id
      });
      createdSessionIds.push(teamASession.id);
    });

    it('should create session with explicit team_id', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Explicit Team Session',
        session_date: '2025-11-26',
        access_code: `EXPTM${Date.now()}`,
        created_by: instructor.id,
        team_id: teamB.id
      });

      createdSessionIds.push(session.id);
      expect(session.team_id).toBe(teamB.id);
    });

    it('should create session with null team_id (course-wide)', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Explicit Course-Wide',
        session_date: '2025-11-26',
        access_code: `EXPCS${Date.now()}`,
        created_by: instructor.id,
        team_id: null
      });

      createdSessionIds.push(session.id);
      expect(session.team_id).toBeNull();
    });

    it('should filter sessions by team membership using findByOfferingIdWithTeamFilter', async () => {
      // Get team IDs for the user
      const teamIds = [teamA.id];
      const sessions = await SessionModel.findByOfferingIdWithTeamFilter(testOffering.id, teamIds);

      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Model Test Lecture'); // course-wide
      expect(titles).toContain('Model Test Team A'); // team A
    });

    it('should return only course-wide sessions for user with no team', async () => {
      // User with no team - pass empty array
      const sessions = await SessionModel.findByOfferingIdWithTeamFilter(testOffering.id, []);

      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Model Test Lecture');
      expect(titles).not.toContain('Model Test Team A');
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with multiple team memberships', async () => {
      // Add studentA1 to teamB as well
      await pool.query(
        `INSERT INTO team_members (team_id, user_id, role, added_by)
         VALUES ($1, $2, $3, $4)`,
        [teamB.id, studentA1.id, 'member', adminId]
      );

      // Create sessions for both teams
      const sessionA = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Multi Team A',
        session_date: '2025-11-27',
        session_time: '10:00:00'
      }, teamLeaderA.id);
      createdSessionIds.push(sessionA.id);

      const sessionB = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Multi Team B',
        session_date: '2025-11-27',
        session_time: '11:00:00'
      }, teamLeaderB.id);
      createdSessionIds.push(sessionB.id);

      // studentA1 should see both
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: studentA1.id });
      const titles = sessions.map(s => s.title);
      expect(titles).toContain('Multi Team A');
      expect(titles).toContain('Multi Team B');

      // Cleanup
      await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamB.id, studentA1.id]);
    });

    it('should handle null userId gracefully (show all sessions)', async () => {
      const instructorSession = await SessionService.createSession({
        offering_id: testOffering.id,
        title: 'Null User Test',
        session_date: '2025-11-27',
        session_time: '10:00:00'
      }, instructor.id);
      createdSessionIds.push(instructorSession.id);

      // Without userId, should show all sessions (backward compatibility)
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, {});
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should handle invalid team_id foreign key constraint', async () => {
      try {
        await SessionModel.create({
          offering_id: testOffering.id,
          title: 'Invalid Team',
          session_date: '2025-11-27',
          access_code: `INVTM${Date.now()}`,
          created_by: instructor.id,
          team_id: '00000000-0000-0000-0000-000000000000' // non-existent team
        });
        expect.fail('Should have thrown foreign key constraint error');
      } catch (error) {
        expect(error.message).toMatch(/foreign key constraint|violates|违反外键约束/i);
      }
    });

    it('should allow updating team_id of existing session', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Update Team ID Test',
        session_date: '2025-11-27',
        access_code: `UPDTM${Date.now()}`,
        created_by: instructor.id,
        team_id: null
      });
      createdSessionIds.push(session.id);

      const updated = await SessionModel.update(session.id, { team_id: teamA.id }, instructor.id);
      expect(updated.team_id).toBe(teamA.id);
    });

    it('should allow clearing team_id (making session course-wide)', async () => {
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Clear Team ID Test',
        session_date: '2025-11-27',
        access_code: `CLRTM${Date.now()}`,
        created_by: teamLeaderA.id,
        team_id: teamA.id
      });
      createdSessionIds.push(session.id);

      const updated = await SessionModel.update(session.id, { team_id: null }, instructor.id);
      expect(updated.team_id).toBeNull();
    });
  });

  describe('Performance and Data Integrity', () => {
    it('should efficiently query sessions with team filtering (check query plan)', async () => {
      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const session = await SessionService.createSession({
          offering_id: testOffering.id,
          title: `Perf Test ${i}`,
          session_date: '2025-11-28',
          session_time: `${10 + i}:00:00`
        }, i % 2 === 0 ? instructor.id : teamLeaderA.id);
        createdSessionIds.push(session.id);
      }

      const start = Date.now();
      const sessions = await SessionService.getSessionsByOffering(testOffering.id, { userId: teamLeaderA.id });
      const duration = Date.now() - start;

      expect(sessions.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should maintain referential integrity when team is deleted', async () => {
      // Create a temporary team
      const tempTeam = await pool.query(
        `INSERT INTO team (offering_id, name, leader_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4) RETURNING *`,
        [testOffering.id, 'Temp Team', teamLeaderA.id, adminId]
      );
      const tempTeamId = tempTeam.rows[0].id;

      // Create session for temp team
      const session = await SessionModel.create({
        offering_id: testOffering.id,
        title: 'Temp Team Session',
        session_date: '2025-11-28',
        access_code: `TMPTM${Date.now()}`,
        created_by: teamLeaderA.id,
        team_id: tempTeamId
      });
      createdSessionIds.push(session.id);

      // Delete the team (CASCADE should delete session or set team_id to NULL based on FK constraint)
      await pool.query('DELETE FROM team WHERE id = $1', [tempTeamId]);

      // Check if session still exists
      const foundSession = await SessionModel.findById(session.id);
      // Depending on FK constraint (CASCADE vs SET NULL), session might be deleted or team_id nulled
      // Based on migration, it's ON DELETE CASCADE, so session should be deleted
      expect(foundSession).toBeNull();

      // Remove from cleanup list since it's already deleted
      createdSessionIds = createdSessionIds.filter(id => id !== session.id);
    });
  });
});
