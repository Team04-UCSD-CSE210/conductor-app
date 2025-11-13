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
    const data = { name: 'John', email: 'john@ex.com', primary_role: 'student', status: 'active' };
    const u1 = await UserService.createUser(data);
    expect(u1.id).toBeDefined();

    await expect(UserService.createUser(data))
      .rejects.toThrow(/already exists/i);
  });

  it('creates user with institution_type and logs activity', async () => {
    const data = { 
      name: 'Test User', 
      email: 'test@ucsd.edu', 
      primary_role: 'student',
      status: 'active',
      institution_type: 'ucsd' 
    };
    const user = await UserService.createUser(data, null);
    
    expect(user.institution_type).toBe('ucsd');
    
    // Check audit log was created
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1',
      ['enroll']
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('getUserById returns user or throws not found', async () => {
    const created = await UserService.createUser({ name: 'Jane', email: 'jane@ex.com', primary_role: 'admin', status: 'active' });
    const fetched = await UserService.getUserById(created.id);
    expect(fetched.email).toBe('jane@ex.com');

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
    const a = await UserService.createUser({ name: 'Al', email: 'a@ex.com', primary_role: 'student', status: 'active' });
    const b = await UserService.createUser({ name: 'Bo', email: 'b@ex.com', primary_role: 'student', status: 'active' });

    // try to change B's email to A's email -> should error
    await expect(UserService.updateUser(b.id, { email: 'a@ex.com' }, a.id))
      .rejects.toThrow(/already in use/i);

    // valid update keeps same email
    const ok = await UserService.updateUser(a.id, { name: 'A Prime', primary_role: 'instructor' }, a.id);
    expect(ok.name).toBe('A Prime');
    expect(ok.primary_role).toBe('instructor');
  });

  it('updateUser logs role changes', async () => {
    const user = await UserService.createUser({ 
      name: 'Test', 
      email: 'test@ex.com', 
      primary_role: 'student',
      status: 'active'
    });
    
    await UserService.updateUser(user.id, { primary_role: 'instructor' }, user.id);
    
    // Check audit log for role change - look for log entry with role change metadata
    const { rows } = await pool.query(
      `SELECT * FROM activity_logs 
       WHERE action_type = $1 
       AND metadata->>'old_role' = $2 
       AND metadata->>'new_role' = $3`,
      ['enroll', 'student', 'instructor']
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].metadata.old_role).toBe('student');
    expect(rows[0].metadata.new_role).toBe('instructor');
  });

  it('deleteUser soft deletes and logs activity', async () => {
    const u = await UserService.createUser({ name: 'Del', email: 'del@ex.com', primary_role: 'student', status: 'active' });
    
    await expect(UserService.deleteUser(u.id, u.id)).resolves.toBe(true);

    // User should be soft-deleted
    await expect(UserService.getUserById(u.id)).rejects.toThrow(/not found/i);
    
    // Check audit log
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action_type = $1',
      ['drop']
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('restoreUser restores soft-deleted user', async () => {
    const u = await UserService.createUser({ name: 'Restore', email: 'restore@ex.com', primary_role: 'student', status: 'active' });
    await UserService.deleteUser(u.id, u.id);
    
    await expect(UserService.restoreUser(u.id, u.id)).resolves.toBe(true);
    
    // User should be findable again
    const restored = await UserService.getUserById(u.id);
    expect(restored).not.toBeNull();
  });

  it('getUsers returns users + pagination meta', async () => {
    for (let i = 1; i <= 7; i++) {
      await UserService.createUser({ name: `U${i}`, email: `u${i}@ex.com`, primary_role: 'student', status: 'active' });
    }
    const { users, total, page, totalPages } = await UserService.getUsers({ limit: 3, offset: 3 });
    expect(users.length).toBe(3);     // page 2
    expect(total).toBe(7);
    expect(page).toBe(2);
    expect(totalPages).toBe(3);
  });

  it('getUsers excludes soft-deleted by default', async () => {
    for (let i = 1; i <= 5; i++) {
      await UserService.createUser({ name: `U${i}`, email: `u${i}@ex.com`, primary_role: 'student', status: 'active' });
    }
    
    // Soft delete one
    const user3 = await UserModel.findByEmail('u3@ex.com');
    await UserModel.delete(user3.id);
    
    const { users, total } = await UserService.getUsers();
    expect(total).toBe(4); // Excludes soft-deleted
    expect(users.length).toBe(4);
  });

  it('getUsersByRole filters by role', async () => {
    await UserService.createUser({ name: 'Admin 1', email: 'admin1@ex.com', primary_role: 'admin', status: 'active' });
    await UserService.createUser({ name: 'Admin 2', email: 'admin2@ex.com', primary_role: 'admin', status: 'active' });
    await UserService.createUser({ name: 'Student 1', email: 'student1@ex.com', primary_role: 'student', status: 'active' });
    
    const admins = await UserService.getUsersByRole('admin');
    expect(admins.length).toBe(2);
    expect(admins.every(u => u.primary_role === 'admin')).toBe(true);
  });

  it('getUsersByInstitutionType filters by institution_type', async () => {
    await UserService.createUser({ 
      name: 'UCSD', 
      email: 'ucsd@ucsd.edu', 
      primary_role: 'student',
      status: 'active',
      institution_type: 'ucsd' 
    });
    await UserService.createUser({ 
      name: 'Extension', 
      email: 'ext@gmail.com', 
      primary_role: 'student',
      status: 'active',
      institution_type: 'extension' 
    });
    
    const ucsdUsers = await UserService.getUsersByInstitutionType('ucsd');
    expect(ucsdUsers.length).toBe(1);
    expect(ucsdUsers[0].institution_type).toBe('ucsd');
  });
});
