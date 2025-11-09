import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { AuditService } from '../services/audit-service.js';
import { UserModel } from '../models/user-model.js';

describe('AuditService', () => {
  let testUserId;
  let testOfferingId;

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE activity_logs RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    
    // Create a test user
    const user = await UserModel.create({
      email: 'audit-test@example.com',
      name: 'Audit Test User',
      role: 'admin',
    });
    testUserId = user.id;
    testOfferingId = '00000000-0000-0000-0000-000000000001';
  });

  afterAll(async () => {
    await pool.end();
  });

  it('logs user creation activity', async () => {
    const log = await AuditService.logUserCreate(testUserId, {
      email: 'newuser@example.com',
      role: 'student',
      auth_source: 'ucsd',
    });

    expect(log).not.toBeNull();
    expect(log.id).toBeDefined();

    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE id = $1',
      [log.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('user.created');
    expect(rows[0].user_id).toBe(testUserId);
  });

  it('logs user update activity', async () => {
    const previousData = { name: 'Old Name', role: 'student' };
    const changes = { name: 'New Name', role: 'instructor' };

    const log = await AuditService.logUserUpdate(testUserId, changes, previousData);

    expect(log).not.toBeNull();

    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['user.updated']
    );
    expect(rows.length).toBe(1);
    expect(rows[0].metadata.changes).toEqual(changes);
  });

  it('logs user deletion activity', async () => {
    const deletedUserId = '00000000-0000-0000-0000-000000000002';
    const log = await AuditService.logUserDelete(testUserId, deletedUserId);

    expect(log).not.toBeNull();

    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['user.deleted']
    );
    expect(rows.length).toBe(1);
    expect(rows[0].metadata.deleted_user_id).toBe(deletedUserId);
  });

  it('logs role change activity', async () => {
    const targetUserId = '00000000-0000-0000-0000-000000000003';
    const log = await AuditService.logRoleChange(
      testUserId,
      targetUserId,
      'student',
      'instructor',
      'global'
    );

    expect(log).not.toBeNull();

    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['role.changed']
    );
    expect(rows.length).toBe(1);
    expect(rows[0].metadata.old_role).toBe('student');
    expect(rows[0].metadata.new_role).toBe('instructor');
    expect(rows[0].metadata.role_type).toBe('global');
  });

  it('logs course staff assignment', async () => {
    const staffUserId = '00000000-0000-0000-0000-000000000004';
    const log = await AuditService.logCourseStaffAssign(
      testUserId,
      testOfferingId,
      staffUserId,
      'ta'
    );

    expect(log).not.toBeNull();

    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['course.staff.assigned']
    );
    expect(rows.length).toBe(1);
    expect(rows[0].offering_id).toBe(testOfferingId);
    expect(rows[0].metadata.staff_role).toBe('ta');
  });

  it('gets user activity logs', async () => {
    // Create multiple logs
    await AuditService.logUserCreate(testUserId, { email: 'test@example.com', role: 'student' });
    await AuditService.logUserUpdate(testUserId, { name: 'Updated' }, { name: 'Original' });
    await AuditService.logUserDelete(testUserId, '00000000-0000-0000-0000-000000000005');

    const logs = await AuditService.getUserActivityLogs(testUserId);

    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs.every(log => log.user_id === testUserId)).toBe(true);
  });

  it('gets offering activity logs', async () => {
    await AuditService.logCourseStaffAssign(testUserId, testOfferingId, 'user1', 'ta');
    await AuditService.logCourseStaffAssign(testUserId, testOfferingId, 'user2', 'tutor');

    const logs = await AuditService.getOfferingActivityLogs(testOfferingId);

    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every(log => log.offering_id === testOfferingId)).toBe(true);
  });

  it('handles logging errors gracefully', async () => {
    // Try to log with invalid user_id
    const log = await AuditService.logActivity({
      userId: 'invalid-uuid',
      action: 'test.action',
      metadata: { test: 'data' },
    });

    // Should not throw, but may return null
    // This tests that audit failures don't break main operations
    expect(log === null || log === undefined).toBe(true);
  });
});

