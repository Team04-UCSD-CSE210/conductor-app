import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { PermissionService } from '../services/permission-service.js';
import { UserModel } from '../models/user-model.js';

describe('PermissionService', () => {
  let adminUserId;
  let instructorUserId;
  let studentUserId;
  let testOfferingId;
  let testTeamId;

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE team_role_permissions RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE enrollment_role_permissions RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE user_role_permissions RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE permissions RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE course_staff RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE enrollments RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE team_members RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

    // Create test users
    const admin = await UserModel.create({
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    });
    adminUserId = admin.id;

    const instructor = await UserModel.create({
      email: 'instructor@example.com',
      name: 'Instructor User',
      role: 'instructor',
    });
    instructorUserId = instructor.id;

    const student = await UserModel.create({
      email: 'student@example.com',
      name: 'Student User',
      role: 'student',
    });
    studentUserId = student.id;

    testOfferingId = '00000000-0000-0000-0000-000000000001';
    testTeamId = '00000000-0000-0000-0000-000000000002';

    // Create sample permissions
    await pool.query(`
      INSERT INTO permissions (scope, resource, action, code, description) VALUES
      ('global', 'user', 'create', 'user:create', 'Create users'),
      ('global', 'user', 'update', 'user:update', 'Update users'),
      ('course', 'assignment', 'grade', 'course:assignment:grade', 'Grade assignments'),
      ('team', 'member', 'invite', 'team:member:invite', 'Invite team members')
    `);

    // Assign permissions to roles
    const { rows: perms } = await pool.query('SELECT id, code FROM permissions');
    const userCreatePerm = perms.find(p => p.code === 'user:create');
    const userUpdatePerm = perms.find(p => p.code === 'user:update');
    const gradePerm = perms.find(p => p.code === 'course:assignment:grade');
    const invitePerm = perms.find(p => p.code === 'team:member:invite');

    // Admin gets all global permissions
    await pool.query(
      'INSERT INTO user_role_permissions (user_role, permission_id) VALUES ($1, $2)',
      ['admin', userCreatePerm.id]
    );
    await pool.query(
      'INSERT INTO user_role_permissions (user_role, permission_id) VALUES ($1, $2)',
      ['admin', userUpdatePerm.id]
    );

    // Instructor gets update permission
    await pool.query(
      'INSERT INTO user_role_permissions (user_role, permission_id) VALUES ($1, $2)',
      ['instructor', userUpdatePerm.id]
    );

    // TA gets grading permission
    await pool.query(
      'INSERT INTO enrollment_role_permissions (enrollment_role, permission_id) VALUES ($1, $2)',
      ['ta', gradePerm.id]
    );

    // Team leader gets invite permission
    await pool.query(
      'INSERT INTO team_role_permissions (team_role, permission_id) VALUES ($1, $2)',
      ['leader', invitePerm.id]
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('gets global role permissions', async () => {
    const adminPerms = await PermissionService.getGlobalRolePermissions('admin');
    expect(adminPerms.length).toBeGreaterThan(0);
    expect(adminPerms.some(p => p.code === 'user:create')).toBe(true);
  });

  it('checks permission for admin user', async () => {
    const hasPermission = await PermissionService.hasPermission(
      adminUserId,
      'user:create'
    );
    expect(hasPermission).toBe(true);
  });

  it('checks permission for instructor user', async () => {
    const hasPermission = await PermissionService.hasPermission(
      instructorUserId,
      'user:update'
    );
    expect(hasPermission).toBe(true);
  });

  it('denies permission for student user', async () => {
    const hasPermission = await PermissionService.hasPermission(
      studentUserId,
      'user:create'
    );
    expect(hasPermission).toBe(false);
  });

  it('checks course-level permissions', async () => {
    // Create enrollment with TA role
    await pool.query(`
      INSERT INTO enrollments (offering_id, user_id, role)
      VALUES ($1::uuid, $2::uuid, 'ta'::enrollment_role_enum)
    `, [testOfferingId, studentUserId]);

    const hasPermission = await PermissionService.hasPermission(
      studentUserId,
      'course:assignment:grade',
      testOfferingId
    );
    expect(hasPermission).toBe(true);
  });

  it('checks team-level permissions', async () => {
    // Create team member with leader role
    await pool.query(`
      INSERT INTO team (id, offering_id, name, team_number)
      VALUES ($1::uuid, $2::uuid, 'Test Team', 1)
    `, [testTeamId, testOfferingId]);

    await pool.query(`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES ($1::uuid, $2::uuid, 'leader'::team_member_role_enum)
    `, [testTeamId, studentUserId]);

    const hasPermission = await PermissionService.hasPermission(
      studentUserId,
      'team:member:invite',
      null,
      testTeamId
    );
    expect(hasPermission).toBe(true);
  });

  it('admin has all permissions', async () => {
    const hasPermission = await PermissionService.hasPermission(
      adminUserId,
      'user:create'
    );
    expect(hasPermission).toBe(true);

    // Admin should have permission even if not explicitly assigned
    const allPerms = await PermissionService.getUserPermissions(adminUserId);
    expect(allPerms.length).toBeGreaterThan(0);
  });

  it('gets user permissions across all role levels', async () => {
    // Set up user with multiple roles
    await pool.query(`
      INSERT INTO enrollments (offering_id, user_id, role)
      VALUES ($1::uuid, $2::uuid, 'ta'::enrollment_role_enum)
    `, [testOfferingId, instructorUserId]);

    const permissions = await PermissionService.getUserPermissions(
      instructorUserId,
      testOfferingId
    );

    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions).toContain('user:update');
    expect(permissions).toContain('course:assignment:grade');
  });
});

