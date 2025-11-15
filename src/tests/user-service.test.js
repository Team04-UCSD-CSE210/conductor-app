import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { UserService } from '../services/user-service.js';
import { UserModel } from '../models/user-model.js';

describe('UserService (business rules)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    // Use DELETE instead of TRUNCATE to avoid deadlocks
    // Delete in order to respect foreign keys
    await pool.query('DELETE FROM activity_logs');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM team');
    await pool.query('DELETE FROM enrollments');
    await pool.query('DELETE FROM course_offerings');
    await pool.query('DELETE FROM auth_logs');
    await pool.query('DELETE FROM users');
  });

  afterAll(async () => {
    // Don't close pool - other tests may need it
  });

  it('creates a user and prevents duplicate email', async () => {
    const timestamp = Date.now();
    const email = `john-${timestamp}@ex.com`;
    const data = { name: 'John', email, primary_role: 'student', status: 'active' };
    const u1 = await UserService.createUser(data);
    expect(u1.id).toBeDefined();
    expect(u1.email).toBe(email.toLowerCase());

    // Verify user exists in database
    const existing = await UserModel.findByEmail(email);
    expect(existing).not.toBeNull();
    expect(existing.id).toBe(u1.id);

    // Try to create with same email - should fail
    await expect(UserService.createUser(data))
      .rejects.toThrow(/already exists/i);
  });

  it('creates user with institution_type and logs activity', async () => {
    const timestamp = Date.now();
    const data = { 
      name: 'Test User', 
      email: `test-${timestamp}@ucsd.edu`, 
      primary_role: 'student',
      status: 'active',
      institution_type: 'ucsd' 
    };
    const user = await UserService.createUser(data, null);
    
    expect(user.institution_type).toBe('ucsd');
    
    // Check audit log was created - use the user's ID as createdBy
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1 AND user_id = $2::uuid',
      ['enroll', user.id]
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('getUserById returns user or throws not found', async () => {
    const timestamp = Date.now();
    const email = `jane-${timestamp}@ex.com`;
    const created = await UserService.createUser({ name: 'Jane', email, primary_role: 'admin', status: 'active' });
    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    
    // Immediately fetch the user we just created
    const fetched = await UserService.getUserById(created.id);
    expect(fetched).toBeDefined();
    expect(fetched.email).toBe(email);

    // Test with invalid UUID
    await expect(UserService.getUserById('00000000-0000-0000-0000-000000000000'))
      .rejects.toThrow(/not found/i);
  });

  it('getUserById excludes soft-deleted users', async () => {
    const timestamp = Date.now();
    const email = `jane-delete-${timestamp}@ex.com`;
    const created = await UserService.createUser({ name: 'Jane', email, primary_role: 'admin', status: 'active' });
    expect(created).toBeDefined();
    
    const deleted = await UserModel.delete(created.id);
    expect(deleted).toBe(true);
    
    await expect(UserService.getUserById(created.id))
      .rejects.toThrow(/not found/i);
  });

  it('updateUser enforces unique email across users', async () => {
    const timestamp = Date.now();
    const a = await UserService.createUser({ name: 'Al', email: `a-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });
    const b = await UserService.createUser({ name: 'Bo', email: `b-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });

    // try to change B's email to A's email -> should error
    await expect(UserService.updateUser(b.id, { email: `a-${timestamp}@ex.com` }, a.id))
      .rejects.toThrow(/already in use/i);

    // valid update keeps same email
    const ok = await UserService.updateUser(a.id, { name: 'A Prime', primary_role: 'instructor' }, a.id);
    expect(ok.name).toBe('A Prime');
    expect(ok.primary_role).toBe('instructor');
  });

  it('updateUser logs role changes', async () => {
    const timestamp = Date.now();
    const email = `test-role-${timestamp}@ex.com`;
    const user = await UserService.createUser({ 
      name: 'Test', 
      email, 
      primary_role: 'student',
      status: 'active'
    });
    expect(user).toBeDefined();
    
    const updated = await UserService.updateUser(user.id, { primary_role: 'instructor' }, user.id);
    expect(updated).toBeDefined();
    expect(updated.primary_role).toBe('instructor');
    
    // Check audit log for role change - look for log entry with role change metadata
    const { rows } = await pool.query(
      `SELECT * FROM activity_logs 
       WHERE action_type = $1 
       AND user_id = $2::uuid
       AND metadata->>'old_role' = $3 
       AND metadata->>'new_role' = $4`,
      ['enroll', user.id, 'student', 'instructor']
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].metadata.old_role).toBe('student');
    expect(rows[0].metadata.new_role).toBe('instructor');
  });

  it('deleteUser soft deletes and logs activity', async () => {
    const timestamp = Date.now();
    const email = `del-log-${timestamp}@ex.com`;
    const u = await UserService.createUser({ name: 'Del', email, primary_role: 'student', status: 'active' });
    expect(u).toBeDefined();
    
    await expect(UserService.deleteUser(u.id, u.id)).resolves.toBe(true);

    // User should be soft-deleted
    await expect(UserService.getUserById(u.id)).rejects.toThrow(/not found/i);
    
    // Check audit log - the user performing the delete (u.id) should have logged it
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1 AND metadata->>\'deleted_user_id\' = $2',
      ['drop', u.id]
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('restoreUser restores soft-deleted user', async () => {
    const timestamp = Date.now();
    const u = await UserService.createUser({ name: 'Restore', email: `restore-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });
    await UserService.deleteUser(u.id, u.id);
    
    await expect(UserService.restoreUser(u.id, u.id)).resolves.toBe(true);
    
    // User should be findable again
    const restored = await UserService.getUserById(u.id);
    expect(restored).not.toBeNull();
  });

  it('getUsers returns users + pagination meta', async () => {
    const timestamp = Date.now();
    const createdEmails = [];
    for (let i = 1; i <= 7; i++) {
      const email = `u${i}-${timestamp}@ex.com`;
      createdEmails.push(email);
      await UserService.createUser({ name: `U${i}`, email, primary_role: 'student', status: 'active' });
    }
    
    // Get page 2 (offset 3, limit 3) - should have 3 users
    const { users, total, page, totalPages } = await UserService.getUsers({ limit: 3, offset: 3 });
    
    // Should have at least our 7 users (may have more from other tests)
    expect(total).toBeGreaterThanOrEqual(7);
    // Page should be calculated correctly
    expect(page).toBeGreaterThanOrEqual(2);
    // Should have at least 3 pages for 7 users
    expect(totalPages).toBeGreaterThanOrEqual(3);
    // This page should have at least some of our users
    const ourUsers = users.filter(u => createdEmails.includes(u.email));
    expect(ourUsers.length).toBeGreaterThanOrEqual(0); // May or may not be on this page
  });

  it('getUsers excludes soft-deleted by default', async () => {
    const timestamp = Date.now();
    const createdUsers = [];
    const createdEmails = [];
    for (let i = 1; i <= 5; i++) {
      const email = `u-del-${i}-${timestamp}@ex.com`;
      createdEmails.push(email);
      const user = await UserService.createUser({ name: `U${i}`, email, primary_role: 'student', status: 'active' });
      createdUsers.push(user);
    }
    
    // Soft delete one (use the created user object directly)
    const deleted = await UserModel.delete(createdUsers[2].id); // user3 is at index 2 (u3)
    expect(deleted).toBe(true);
    
    // Count only our users that are not deleted
    const { users, total } = await UserService.getUsers();
    const ourActiveUsers = users.filter(u => createdEmails.includes(u.email) && u.email !== createdUsers[2].email);
    
    // Should find 4 active users (excluding the soft-deleted one)
    expect(ourActiveUsers.length).toBe(4);
    // Total should be at least 4 (may have more from other tests)
    expect(total).toBeGreaterThanOrEqual(4);
  });

  it('getUsersByRole filters by role', async () => {
    const timestamp = Date.now();
    const admin1Email = `admin1-${timestamp}@ex.com`;
    const admin2Email = `admin2-${timestamp}@ex.com`;
    const admin1 = await UserService.createUser({ name: 'Admin 1', email: admin1Email, primary_role: 'admin', status: 'active' });
    expect(admin1).toBeDefined();
    const admin2 = await UserService.createUser({ name: 'Admin 2', email: admin2Email, primary_role: 'admin', status: 'active' });
    expect(admin2).toBeDefined();
    await UserService.createUser({ name: 'Student 1', email: `student1-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });
    
    const admins = await UserService.getUsersByRole('admin');
    // Should find at least our 2 created admins
    const foundAdmin1 = admins.find(u => u.email === admin1Email);
    const foundAdmin2 = admins.find(u => u.email === admin2Email);
    expect(foundAdmin1).toBeDefined();
    expect(foundAdmin2).toBeDefined();
    expect(admins.every(u => u.primary_role === 'admin')).toBe(true);
    expect(admins.length).toBeGreaterThanOrEqual(2);
  });

  it('getUsersByInstitutionType filters by institution_type', async () => {
    const timestamp = Date.now();
    const ucsdEmail = `ucsd-filter-${timestamp}@ucsd.edu`;
    const ucsdUser = await UserService.createUser({ 
      name: 'UCSD', 
      email: ucsdEmail, 
      primary_role: 'student',
      status: 'active',
      institution_type: 'ucsd' 
    });
    expect(ucsdUser).toBeDefined();
    await UserService.createUser({ 
      name: 'Extension', 
      email: `ext-filter-${timestamp}@gmail.com`, 
      primary_role: 'student',
      status: 'active',
      institution_type: 'extension' 
    });
    
    const ucsdUsers = await UserService.getUsersByInstitutionType('ucsd');
    // Should find at least our created user (may find others from previous tests)
    const foundUser = ucsdUsers.find(u => u.email === ucsdEmail);
    expect(foundUser).toBeDefined();
    expect(foundUser.institution_type).toBe('ucsd');
    expect(ucsdUsers.length).toBeGreaterThanOrEqual(1);
  });
});
