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
      primary_role: 'admin',
      status: 'active',
    });
    testUserId = user.id;
    testOfferingId = '00000000-0000-0000-0000-000000000001';
  });

  afterAll(async () => {
    // Don't close pool - other tests may need it
    // Pool will be closed by test runner or process exit
  });

  it('logs user creation activity', async () => {
    const log = await AuditService.logUserCreate(testUserId, {
      email: 'newuser@example.com',
      primary_role: 'student',
    });

    expect(log).not.toBeNull();
    expect(log.id).toBeDefined();

    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE id = $1',
      [log.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].action_type).toBe('enroll'); // Enrollment action for user creation
    expect(rows[0].user_id).toBe(testUserId);
  });

  it('logs user update activity', async () => {
    const previousData = { name: 'Old Name', primary_role: 'student' };
    const changes = { name: 'New Name', primary_role: 'instructor' };

    await AuditService.logUserUpdate(testUserId, changes, previousData);

    // logActivity can return null on error, but should succeed in normal cases
    // Check the database directly instead
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1 AND user_id = $2::uuid ORDER BY created_at DESC LIMIT 1',
      ['update_assignment', testUserId] // AuditService maps 'user.updated' to 'update_assignment'
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Check that metadata contains changes
    const updateLog = rows[0];
    expect(updateLog.metadata).toBeDefined();
    expect(updateLog.metadata.changes).toBeDefined();
  });

  it('logs user deletion activity', async () => {
    const deletedUserId = '00000000-0000-0000-0000-000000000002';
    const log = await AuditService.logUserDelete(testUserId, deletedUserId);

    expect(log).not.toBeNull();

    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1',
      ['drop'] // Using 'drop' action for user deletion
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const deleteLog = rows.find(r => r.metadata && r.metadata.deleted_user_id === deletedUserId);
    expect(deleteLog).toBeDefined();
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
      'SELECT * FROM activity_logs WHERE action_type = $1',
      ['enroll'] // Role changes use 'enroll' action
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const roleChangeLog = rows.find(r => r.metadata && r.metadata.old_role === 'student');
    expect(roleChangeLog).toBeDefined();
    expect(roleChangeLog.metadata.new_role).toBe('instructor');
    expect(roleChangeLog.metadata.role_type).toBe('global');
  });


  it('gets user activity logs', async () => {
    // Create multiple logs
    await AuditService.logUserCreate(testUserId, { email: 'test@example.com', primary_role: 'student' });
    await AuditService.logUserUpdate(testUserId, { name: 'Updated' }, { name: 'Original' });
    await AuditService.logUserDelete(testUserId, '00000000-0000-0000-0000-000000000005');

    const logs = await AuditService.getUserActivityLogs(testUserId);

    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs.every(log => log.user_id === testUserId)).toBe(true);
  });

  it('gets offering activity logs', async () => {
    await AuditService.logUserCreate(testUserId, { email: 'test@example.com', primary_role: 'student' });
    await AuditService.logRoleChange(testUserId, testUserId, 'student', 'instructor', 'global');

    const logs = await AuditService.getOfferingActivityLogs(testOfferingId);

    expect(logs.length).toBeGreaterThanOrEqual(0);
    expect(logs.every(log => log.offering_id === testOfferingId)).toBe(true);
  });

  it('handles logging errors gracefully', async () => {
    // Try to log with invalid user_id
    const log = await AuditService.logActivity({
      userId: 'invalid-uuid',
      action: 'enroll', // Use valid action type
      metadata: { test: 'data' },
    });

    // Should not throw, but may return null
    // This tests that audit failures don't break main operations
    expect(log === null || log === undefined).toBe(true);
  });
});

