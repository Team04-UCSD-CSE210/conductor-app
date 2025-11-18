/**
 * Team Leader Permission Tests
 * 
 * Tests for team leader permissions including:
 * - Team leaders have session.create and session.manage permissions
 * - Team leaders can manage their team
 * - Permission resolution via team_role_permissions
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { pool } from '../db.js';
import { PermissionService } from '../services/permission-service.js';

describe('Team Leader Permissions', () => {
  let testOffering;
  let teamLeader;
  let teamMember;
  let team;
  let nonTeamStudent;
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
      ['Team Permission Test Course', 'TEAM101', 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create team leader (primary_role: student)
    const teamLeaderResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `team-leader-perm-${Date.now()}@test.edu`,
        'Team Leader Permission Test',
        'student',
        'active',
        adminId
      ]
    );
    teamLeader = teamLeaderResult.rows[0];

    // Create team member
    const teamMemberResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `team-member-perm-${Date.now()}@test.edu`,
        'Team Member Permission Test',
        'student',
        'active',
        adminId
      ]
    );
    teamMember = teamMemberResult.rows[0];

    // Create non-team student
    const nonTeamStudentResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `non-team-student-${Date.now()}@test.edu`,
        'Non-Team Student',
        'student',
        'active',
        adminId
      ]
    );
    nonTeamStudent = nonTeamStudentResult.rows[0];

    // Create team
    const teamResult = await pool.query(
      `INSERT INTO team (offering_id, name, leader_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [
        testOffering.id,
        'Permission Test Team',
        teamLeader.id,
        adminId
      ]
    );
    team = teamResult.rows[0];

    // Add team leader as member with 'leader' role
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [team.id, teamLeader.id, 'leader', adminId]
    );

    // Add regular team member with 'member' role
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [team.id, teamMember.id, 'member', adminId]
    );
  });

  after(async () => {
    // Clean up team members and team
    if (team) {
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [team.id]);
      await pool.query('DELETE FROM team WHERE id = $1', [team.id]);
    }

    // Clean up users
    const userIds = [teamLeader?.id, teamMember?.id, nonTeamStudent?.id].filter(Boolean);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }

    // Clean up offering
    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
  });

  it('should grant team leader session.create permission', async () => {
    const hasPermission = await PermissionService.hasPermission(
      teamLeader.id,
      'session.create',
      testOffering.id,
      team.id
    );

    assert.strictEqual(hasPermission, true, 'Team leader should have session.create permission');
  });

  it('should grant team leader session.manage permission', async () => {
    const hasPermission = await PermissionService.hasPermission(
      teamLeader.id,
      'session.manage',
      testOffering.id,
      team.id
    );

    assert.strictEqual(hasPermission, true, 'Team leader should have session.manage permission');
  });

  it('should grant team leader team.manage permission', async () => {
    const hasPermission = await PermissionService.hasPermission(
      teamLeader.id,
      'team.manage',
      testOffering.id,
      team.id
    );

    assert.strictEqual(hasPermission, true, 'Team leader should have team.manage permission');
  });

  it('should not grant team member session.create permission', async () => {
    const hasPermission = await PermissionService.hasPermission(
      teamMember.id,
      'session.create',
      testOffering.id,
      team.id
    );

    assert.strictEqual(hasPermission, false, 'Regular team member should not have session.create permission');
  });

  it('should not grant team member session.manage permission', async () => {
    const hasPermission = await PermissionService.hasPermission(
      teamMember.id,
      'session.manage',
      testOffering.id,
      team.id
    );

    assert.strictEqual(hasPermission, false, 'Regular team member should not have session.manage permission');
  });

  it('should not grant team member team.manage permission', async () => {
    const hasPermission = await PermissionService.hasPermission(
      teamMember.id,
      'team.manage',
      testOffering.id,
      team.id
    );

    assert.strictEqual(hasPermission, false, 'Regular team member should not have team.manage permission');
  });

  it('should not grant non-team student session.create permission', async () => {
    const hasPermission = await PermissionService.hasPermission(
      nonTeamStudent.id,
      'session.create',
      testOffering.id,
      null
    );

    assert.strictEqual(hasPermission, false, 'Non-team student should not have session.create permission');
  });

  it('should list all team leader permissions', async () => {
    const permissions = await PermissionService.listPermissionCodes(
      teamLeader.id,
      testOffering.id,
      team.id
    );

    assert.ok(Array.isArray(permissions), 'Should return permissions array');
    assert.ok(permissions.includes('session.create'), 'Should include session.create');
    assert.ok(permissions.includes('session.manage'), 'Should include session.manage');
    assert.ok(permissions.includes('team.manage'), 'Should include team.manage');
  });

  it('should verify team leader has more permissions than team member', async () => {
    const leaderPermissions = await PermissionService.listPermissionCodes(
      teamLeader.id,
      testOffering.id,
      team.id
    );

    const memberPermissions = await PermissionService.listPermissionCodes(
      teamMember.id,
      testOffering.id,
      team.id
    );

    assert.ok(
      leaderPermissions.length > memberPermissions.length,
      'Team leader should have more permissions than regular member'
    );
  });

  it('should verify team role permissions exist in database', async () => {
    const result = await pool.query(
      `SELECT p.code 
       FROM team_role_permissions trp
       JOIN permissions p ON p.id = trp.permission_id
       WHERE trp.team_role = 'leader'
       ORDER BY p.code`
    );

    const permissionCodes = result.rows.map(r => r.code);

    assert.ok(permissionCodes.includes('session.create'), 'Database should have session.create for team leaders');
    assert.ok(permissionCodes.includes('session.manage'), 'Database should have session.manage for team leaders');
    assert.ok(permissionCodes.includes('team.manage'), 'Database should have team.manage for team leaders');
  });

  it('should verify team member role has no permissions in database', async () => {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM team_role_permissions trp
       WHERE trp.team_role = 'member'`
    );

    const count = parseInt(result.rows[0].count, 10);

    assert.strictEqual(count, 0, 'Team member role should have no special permissions in database');
  });
});
