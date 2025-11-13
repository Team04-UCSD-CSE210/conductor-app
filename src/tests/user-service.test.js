import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { UserService } from '../services/user-service.js';
import { UserModel } from '../models/user-model.js';

describe('UserService (business rules)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE activity_logs RESTART IDENTITY CASCADE');
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
    
    // Check audit log was created
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1 AND user_id = $2::uuid',
      ['enroll', user.id]
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('getUserById returns user or throws not found', async () => {
    const timestamp = Date.now();
    const created = await UserService.createUser({ name: 'Jane', email: `jane-${timestamp}@ex.com`, primary_role: 'admin', status: 'active' });
    const fetched = await UserService.getUserById(created.id);
    expect(fetched.email).toBe(`jane-${timestamp}@ex.com`);

    await expect(UserService.getUserById('00000000-0000-0000-0000-000000000000'))
      .rejects.toThrow(/not found/i);
  });

  it('getUserById excludes soft-deleted users', async () => {
    const created = await UserService.createUser({ name: 'Jane', email: 'jane@ex.com', primary_role: 'admin', status: 'active' });
    await UserModel.delete(created.id);
    
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
    const user = await UserService.createUser({ 
      name: 'Test', 
      email: `test-${timestamp}@ex.com`, 
      primary_role: 'student',
      status: 'active'
    });
    
    await UserService.updateUser(user.id, { primary_role: 'instructor' }, user.id);
    
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
    const u = await UserService.createUser({ name: 'Del', email: `del-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });
    
    await expect(UserService.deleteUser(u.id, u.id)).resolves.toBe(true);

    // User should be soft-deleted
    await expect(UserService.getUserById(u.id)).rejects.toThrow(/not found/i);
    
    // Check audit log
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1 AND user_id = $2::uuid',
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
    for (let i = 1; i <= 7; i++) {
      await UserService.createUser({ name: `U${i}`, email: `u${i}-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });
    }
    const { users, total, page, totalPages } = await UserService.getUsers({ limit: 3, offset: 3 });
    expect(users.length).toBe(3);     // page 2
    expect(total).toBe(7);
    expect(page).toBe(2);
    expect(totalPages).toBe(3);
  });

  it('getUsers excludes soft-deleted by default', async () => {
    const timestamp = Date.now();
    const createdUsers = [];
    for (let i = 1; i <= 5; i++) {
      const user = await UserService.createUser({ name: `U${i}`, email: `u${i}-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });
      createdUsers.push(user);
    }
    
    // Soft delete one (use the created user object directly)
    await UserModel.delete(createdUsers[2].id); // user3 is at index 2 (u3)
    
    const { users, total } = await UserService.getUsers();
    expect(total).toBe(4); // Excludes soft-deleted
    expect(users.length).toBe(4);
  });

  it('getUsersByRole filters by role', async () => {
    const timestamp = Date.now();
    const admin1 = await UserService.createUser({ name: 'Admin 1', email: `admin1-${timestamp}@ex.com`, primary_role: 'admin', status: 'active' });
    const admin2 = await UserService.createUser({ name: 'Admin 2', email: `admin2-${timestamp}@ex.com`, primary_role: 'admin', status: 'active' });
    await UserService.createUser({ name: 'Student 1', email: `student1-${timestamp}@ex.com`, primary_role: 'student', status: 'active' });
    
    const admins = await UserService.getUsersByRole('admin');
    // Should find at least our 2 created admins
    const foundAdmin1 = admins.find(u => u.id === admin1.id);
    const foundAdmin2 = admins.find(u => u.id === admin2.id);
    expect(foundAdmin1).toBeDefined();
    expect(foundAdmin2).toBeDefined();
    expect(admins.every(u => u.primary_role === 'admin')).toBe(true);
    expect(admins.length).toBeGreaterThanOrEqual(2);
  });

  it('getUsersByInstitutionType filters by institution_type', async () => {
    const timestamp = Date.now();
    const ucsdUser = await UserService.createUser({ 
      name: 'UCSD', 
      email: `ucsd-${timestamp}@ucsd.edu`, 
      primary_role: 'student',
      status: 'active',
      institution_type: 'ucsd' 
    });
    await UserService.createUser({ 
      name: 'Extension', 
      email: `ext-${timestamp}@gmail.com`, 
      primary_role: 'student',
      status: 'active',
      institution_type: 'extension' 
    });
    
    const ucsdUsers = await UserService.getUsersByInstitutionType('ucsd');
    // Should find at least our created user (may find others from previous tests due to beforeEach truncate)
    const foundUser = ucsdUsers.find(u => u.id === ucsdUser.id);
    expect(foundUser).toBeDefined();
    expect(foundUser.institution_type).toBe('ucsd');
    expect(ucsdUsers.length).toBeGreaterThanOrEqual(1);
  });
});
