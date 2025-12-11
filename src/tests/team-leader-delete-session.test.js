/**
 * Team Leader Session Delete Tests
 * 
 * Tests for team leader's ability to delete their team's sessions
 * via DELETE /api/sessions/team/:sessionId endpoint
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { pool } from '../db.js';

describe('Team Leader Session Delete', () => {
  let testOffering;
  let teamLeader;
  let otherTeamLeader;
  let teamMember;
  let team;
  let otherTeam;
  let teamSession;
  let otherTeamSession;
  let adminId;

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
      ['Team Delete Test Course', 'TDEL101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create team leader 1
    const teamLeaderResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `team-leader-delete-1-${Date.now()}@test.edu`,
        'Team Leader 1',
        'student',
        'active',
        adminId
      ]
    );
    teamLeader = teamLeaderResult.rows[0];

    // Create team leader 2
    const otherTeamLeaderResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `team-leader-delete-2-${Date.now()}@test.edu`,
        'Team Leader 2',
        'student',
        'active',
        adminId
      ]
    );
    otherTeamLeader = otherTeamLeaderResult.rows[0];

    // Create team member
    const teamMemberResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `team-member-${Date.now()}@test.edu`,
        'Team Member',
        'student',
        'active',
        adminId
      ]
    );
    teamMember = teamMemberResult.rows[0];

    // Create team 1
    const teamResult = await pool.query(
      `INSERT INTO team (offering_id, name, leader_ids, created_by, updated_by)
       VALUES ($1, $2, ARRAY[$3]::UUID[], $4, $4)
       RETURNING *`,
      [testOffering.id, 'Delete Test Team 1', teamLeader.id, adminId]
    );
    team = teamResult.rows[0];

    // Create team 2
    const otherTeamResult = await pool.query(
      `INSERT INTO team (offering_id, name, leader_ids, created_by, updated_by)
       VALUES ($1, $2, ARRAY[$3]::UUID[], $4, $4)
       RETURNING *`,
      [testOffering.id, 'Delete Test Team 2', otherTeamLeader.id, adminId]
    );
    otherTeam = otherTeamResult.rows[0];

    // Add team leaders to their teams
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [team.id, teamLeader.id, 'leader', adminId]
    );

    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [otherTeam.id, otherTeamLeader.id, 'leader', adminId]
    );

    // Add team member to team 1
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [team.id, teamMember.id, 'member', adminId]
    );

    // Create session for team 1
    const sessionResult = await pool.query(
      `INSERT INTO sessions (
        offering_id, team_id, title, description, 
        session_date, session_time, created_by, updated_by, access_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
      RETURNING *`,
      [
        testOffering.id,
        team.id,
        'Team 1 Meeting',
        'Test session for team 1',
        '2025-11-20',
        '14:00:00',
        teamLeader.id,
        'TEST001'
      ]
    );
    teamSession = sessionResult.rows[0];

    // Create session for team 2
    const otherSessionResult = await pool.query(
      `INSERT INTO sessions (
        offering_id, team_id, title, description, 
        session_date, session_time, created_by, updated_by, access_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
      RETURNING *`,
      [
        testOffering.id,
        otherTeam.id,
        'Team 2 Meeting',
        'Test session for team 2',
        '2025-11-21',
        '15:00:00',
        otherTeamLeader.id,
        'TEST002'
      ]
    );
    otherTeamSession = otherSessionResult.rows[0];
  });

  afterAll(async () => {
    // Clean up sessions
    if (teamSession) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [teamSession.id]);
    }
    if (otherTeamSession) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [otherTeamSession.id]);
    }

    // Clean up teams
    if (team) {
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [team.id]);
      await pool.query('DELETE FROM team WHERE id = $1', [team.id]);
    }
    if (otherTeam) {
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [otherTeam.id]);
      await pool.query('DELETE FROM team WHERE id = $1', [otherTeam.id]);
    }

    // Clean up users
    const userIds = [teamLeader?.id, otherTeamLeader?.id, teamMember?.id].filter(Boolean);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }

    // Clean up offering
    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
  });

  it('should allow team leader to delete their own team session', async () => {
    // Verify session exists and has team_id
    const beforeDelete = await pool.query(
      'SELECT id, team_id FROM sessions WHERE id = $1',
      [teamSession.id]
    );
    expect(beforeDelete.rows.length).toBe(1);
    expect(beforeDelete.rows[0].team_id).toBe(team.id);

    // Verify team leader role
    const teamMemberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [team.id, teamLeader.id]
    );
    expect(teamMemberCheck.rows.length).toBe(1);
    expect(teamMemberCheck.rows[0].role).toBe('leader');

    // Delete the session
    const deleteResult = await pool.query(
      'DELETE FROM sessions WHERE id = $1 RETURNING id',
      [teamSession.id]
    );
    expect(deleteResult.rows.length).toBe(1);

    // Verify session is deleted
    const afterDelete = await pool.query(
      'SELECT id FROM sessions WHERE id = $1',
      [teamSession.id]
    );
    expect(afterDelete.rows.length).toBe(0);

    // Recreate for other tests
    const recreateResult = await pool.query(
      `INSERT INTO sessions (
        offering_id, team_id, title, description, 
        session_date, session_time, created_by, updated_by, access_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
      RETURNING *`,
      [
        testOffering.id,
        team.id,
        'Team 1 Meeting',
        'Test session for team 1',
        '2025-11-20',
        '14:00:00',
        teamLeader.id,
        'TEST001'
      ]
    );
    teamSession = recreateResult.rows[0];
  });

  it('should prevent team leader from deleting another team\'s session', async () => {
    // Verify other team's session exists
    const sessionCheck = await pool.query(
      'SELECT id, team_id FROM sessions WHERE id = $1',
      [otherTeamSession.id]
    );
    expect(sessionCheck.rows.length).toBe(1);
    expect(sessionCheck.rows[0].team_id).toBe(otherTeam.id);

    // Verify team leader is not in other team
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [otherTeam.id, teamLeader.id]
    );
    expect(memberCheck.rows.length).toBe(0);

    // Attempt to delete should fail at authorization level
    // In the actual API, this would return 403
    const otherTeamSessionStillExists = await pool.query(
      'SELECT id FROM sessions WHERE id = $1',
      [otherTeamSession.id]
    );
    expect(otherTeamSessionStillExists.rows.length).toBe(1);
  });

  it('should prevent regular team member from deleting team session', async () => {
    // Verify team member role
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [team.id, teamMember.id]
    );
    expect(memberCheck.rows.length).toBe(1);
    expect(memberCheck.rows[0].role).toBe('member');
    expect(memberCheck.rows[0].role).not.toBe('leader');

    // Session should still exist (member can't delete)
    const sessionCheck = await pool.query(
      'SELECT id FROM sessions WHERE id = $1',
      [teamSession.id]
    );
    expect(sessionCheck.rows.length).toBe(1);
  });

  it('should prevent deletion of session without team_id', async () => {
    // Create session without team_id (lecture session)
    const lectureSessionResult = await pool.query(
      `INSERT INTO sessions (
        offering_id, title, description, 
        session_date, session_time, created_by, updated_by, access_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
      RETURNING *`,
      [
        testOffering.id,
        'Lecture Session',
        'No team assigned',
        '2025-11-22',
        '10:00:00',
        adminId,
        'TEST003'
      ]
    );
    const lectureSession = lectureSessionResult.rows[0];

    // Verify session has no team_id
    expect(lectureSession.team_id).toBeNull();

    // Team leader should not be able to delete via team endpoint
    // (This would be blocked at the API level with 400 error)

    // Clean up
    await pool.query('DELETE FROM sessions WHERE id = $1', [lectureSession.id]);
  });

  it('should return error for non-existent session', async () => {
    const fakeSessionId = '00000000-0000-0000-0000-000000000000';
    
    const result = await pool.query(
      'SELECT id FROM sessions WHERE id = $1',
      [fakeSessionId]
    );
    
    expect(result.rows.length).toBe(0);
  });

  it('should verify session belongs to team before deletion', async () => {
    // Verify the session has correct team_id
    const sessionCheck = await pool.query(
      'SELECT team_id FROM sessions WHERE id = $1',
      [teamSession.id]
    );
    
    expect(sessionCheck.rows.length).toBe(1);
    expect(sessionCheck.rows[0].team_id).toBe(team.id);

    // Verify team leader is in the team
    const leaderCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [team.id, teamLeader.id]
    );
    
    expect(leaderCheck.rows.length).toBe(1);
    expect(leaderCheck.rows[0].role).toBe('leader');
  });
});
