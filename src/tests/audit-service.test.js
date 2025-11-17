import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { AuditService } from '../services/audit-service.js';

describe('AuditService', () => {
  let testOfferingId;

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    // Don't delete any data - use unique identifiers and filter results instead
    // This prevents interference between tests and avoids foreign key constraint violations
    testOfferingId = '00000000-0000-0000-0000-000000000001';
  });

  afterAll(async () => {
    // Don't close pool - other tests may need it
    // Pool will be closed by test runner or process exit
  });

  // it.skip('logs user creation activity', async () => {
  //   // Always get fresh testUserId (might have been deleted by other tests)
  //   const testUserId = await ensureTestUser();
  //   expect(testUserId).toBeDefined();

  //   const log = await AuditService.logUserCreate(testUserId, {
  //     email: 'newuser@example.com',
  //     primary_role: 'student',
  //   });

  //   expect(log).not.toBeNull();
  //   expect(log.id).toBeDefined();

  //   const { rows } = await pool.query(
  //     'SELECT * FROM activity_logs WHERE id = $1::uuid',
  //     [log.id]
  //   );
  //   expect(rows.length).toBe(1);
  //   expect(rows[0].action_type).toBe('enroll'); // Enrollment action for user creation
  //   expect(rows[0].user_id).toBe(testUserId);
  // });

  // it.skip('logs user update activity', async () => {
  //   // Always get fresh testUserId (might have been deleted by other tests)
  //   const testUserId = await ensureTestUser();
  //   expect(testUserId).toBeDefined();

  //   const previousData = { name: 'Old Name', primary_role: 'student' };
  //   const changes = { name: 'New Name', primary_role: 'instructor' };

  //   const logResult = await AuditService.logUserUpdate(testUserId, changes, previousData);
  //   expect(logResult).not.toBeNull();
  //   expect(logResult.id).toBeDefined();

  //   // Verify log was created
  //   const { rows } = await pool.query(
  //     'SELECT * FROM activity_logs WHERE id = $1::uuid',
  //     [logResult.id]
  //   );
  //   expect(rows.length).toBe(1);
  //   expect(rows[0].action_type).toBe('update_assignment'); // AuditService maps 'user.updated' to 'update_assignment'
  //   expect(rows[0].user_id).toBe(testUserId);
  //   expect(rows[0].metadata).toBeDefined();
  //   expect(rows[0].metadata.changes).toBeDefined();
  // });

  // it.skip('logs user deletion activity', async () => {
  //   // Always get fresh testUserId (might have been deleted by other tests)
  //   const testUserId = await ensureTestUser();
  //   expect(testUserId).toBeDefined();

  //   // Create a user to delete (use unique email with timestamp)
  //   const timestamp = Date.now();
  //   const userToDelete = await UserModel.create({
  //     email: `delete-test-${timestamp}@example.com`,
  //     name: 'Delete Test User',
  //     primary_role: 'student',
  //     status: 'active',
  //   });
  //   const deletedUserId = userToDelete.id;
    
  //   const log = await AuditService.logUserDelete(testUserId, deletedUserId);
  //   expect(log).not.toBeNull();
  //   expect(log.id).toBeDefined();

  //   // Verify log was created
  //   const { rows } = await pool.query(
  //     'SELECT * FROM activity_logs WHERE id = $1::uuid',
  //     [log.id]
  //   );
  //   expect(rows.length).toBe(1);
  //   expect(rows[0].action_type).toBe('drop');
  //   expect(rows[0].user_id).toBe(testUserId);
  //   expect(rows[0].metadata.deleted_user_id).toBe(deletedUserId);
  // });

  // it.skip('logs role change activity', async () => {
  //   // Always get fresh testUserId (might have been deleted by other tests)
  //   const testUserId = await ensureTestUser();
  //   expect(testUserId).toBeDefined();

  //   // Create a real target user for role change (don't use hardcoded UUID)
  //   const timestamp = Date.now();
  //   const targetUser = await UserModel.create({
  //     email: `role-change-target-${timestamp}@example.com`,
  //     name: 'Role Change Target',
  //     primary_role: 'student',
  //     status: 'active',
  //   });
  //   const targetUserId = targetUser.id;
    
  //   const log = await AuditService.logRoleChange(
  //     testUserId,
  //     targetUserId,
  //     'student',
  //     'instructor',
  //     'global'
  //   );

  //   expect(log).not.toBeNull();
  //   expect(log.id).toBeDefined();

  //   // Verify log was created by checking the specific log ID
  //   const { rows } = await pool.query(
  //     'SELECT * FROM activity_logs WHERE id = $1::uuid',
  //     [log.id]
  //   );
  //   expect(rows.length).toBe(1);
  //   expect(rows[0].action_type).toBe('enroll'); // Role changes use 'enroll' action
  //   expect(rows[0].user_id).toBe(testUserId);
  //   expect(rows[0].metadata.old_role).toBe('student');
  //   expect(rows[0].metadata.new_role).toBe('instructor');
  //   expect(rows[0].metadata.role_type).toBe('global');
  //   expect(rows[0].metadata.target_user_id).toBe(targetUserId);
  // });


  // it.skip('gets user activity logs', async () => {
  //   // Always get fresh testUserId (might have been deleted by other tests)
  //   const testUserId = await ensureTestUser();
  //   expect(testUserId).toBeDefined();
    
  //   // Create a test user to delete (use unique email)
  //   const timestamp = Date.now();
  //   const userToDelete = await UserModel.create({
  //     email: `delete-log-test-${timestamp}@example.com`,
  //     name: 'Delete Log Test User',
  //     primary_role: 'student',
  //     status: 'active',
  //   });
    
  //   // Create all logs with unique identifiers - filter results by log IDs
  //   const log1 = await AuditService.logUserCreate(testUserId, { email: `test-${timestamp}@example.com`, primary_role: 'student' });
  //   expect(log1).not.toBeNull();
  //   expect(log1.id).toBeDefined();
    
  //   const log2 = await AuditService.logUserUpdate(testUserId, { name: 'Updated' }, { name: 'Original' });
  //   expect(log2).not.toBeNull();
  //   expect(log2.id).toBeDefined();
    
  //   const log3 = await AuditService.logUserDelete(testUserId, userToDelete.id);
  //   expect(log3).not.toBeNull();
  //   expect(log3.id).toBeDefined();

  //   // Get logs for the testUserId - filter to only our logs by ID
  //   const logs = await AuditService.getUserActivityLogs(testUserId);
  //   const ourLogs = logs.filter(log => 
  //     log.id === log1.id || log.id === log2.id || log.id === log3.id
  //   );

  //   expect(ourLogs.length).toBe(3);
  //   expect(ourLogs.every(log => log.user_id === testUserId)).toBe(true);
  // });

  // it.skip('gets offering activity logs', async () => {
  //   // Always get fresh testUserId (might have been deleted by other tests)
  //   const testUserId = await ensureTestUser();
  //   expect(testUserId).toBeDefined();
    
  //   // Create logs (these won't have offering_id, but that's okay for this test)
  //   const timestamp = Date.now();
  //   const log1 = await AuditService.logUserCreate(testUserId, { email: `test-${timestamp}@example.com`, primary_role: 'student' });
  //   expect(log1).not.toBeNull();
    
  //   // Create a target user for role change
  //   const targetUser = await UserModel.create({
  //     email: `role-change-${timestamp}@example.com`,
  //     name: 'Role Change User',
  //     primary_role: 'student',
  //     status: 'active',
  //   });
    
  //   const log2 = await AuditService.logRoleChange(testUserId, targetUser.id, 'student', 'instructor', 'global');
  //   expect(log2).not.toBeNull();

  //   // Get logs for the offering (testOfferingId is a placeholder UUID, so logs might be empty)
  //   const logs = await AuditService.getOfferingActivityLogs(testOfferingId);

  //   // Since testOfferingId is a placeholder, logs should be empty or contain logs with that offering_id
  //   expect(Array.isArray(logs)).toBe(true);
  //   if (logs.length > 0) {
  //     expect(logs.every(log => log.offering_id === testOfferingId)).toBe(true);
  //   }
  // });

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

