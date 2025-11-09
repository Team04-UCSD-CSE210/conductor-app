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
    await pool.end();
  });

  it('creates a user and prevents duplicate email', async () => {
    const data = { name: 'John', email: 'john@ex.com', role: 'student' };
    const u1 = await UserService.createUser(data);
    expect(u1.id).toBeDefined();

    await expect(UserService.createUser(data))
      .rejects.toThrow(/already exists/i);
  });

  it('creates user with auth_source and logs activity', async () => {
    const data = { 
      name: 'Test User', 
      email: 'test@ucsd.edu', 
      role: 'student',
      auth_source: 'ucsd' 
    };
    const user = await UserService.createUser(data, null);
    
    expect(user.auth_source).toBe('ucsd');
    
    // Check audit log was created
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['user.created']
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('getUserById returns user or throws not found', async () => {
    const created = await UserService.createUser({ name: 'Jane', email: 'jane@ex.com', role: 'admin' });
    const fetched = await UserService.getUserById(created.id);
    expect(fetched.email).toBe('jane@ex.com');

    await expect(UserService.getUserById('00000000-0000-0000-0000-000000000000'))
      .rejects.toThrow(/not found/i);
  });

  it('getUserById excludes soft-deleted users', async () => {
    const created = await UserService.createUser({ name: 'Jane', email: 'jane@ex.com', role: 'admin' });
    await UserModel.delete(created.id);
    
    await expect(UserService.getUserById(created.id))
      .rejects.toThrow(/not found/i);
  });

  it('updateUser enforces unique email across users', async () => {
    const a = await UserService.createUser({ name: 'Al', email: 'a@ex.com', role: 'student' });
    const b = await UserService.createUser({ name: 'Bo', email: 'b@ex.com', role: 'student' });

    // try to change B's email to A's email -> should error
    await expect(UserService.updateUser(b.id, { email: 'a@ex.com' }, a.id))
      .rejects.toThrow(/already in use/i);

    // valid update keeps same email
    const ok = await UserService.updateUser(a.id, { name: 'A Prime', role: 'instructor' }, a.id);
    expect(ok.name).toBe('A Prime');
    expect(ok.role).toBe('instructor');
  });

  it('updateUser logs role changes', async () => {
    const user = await UserService.createUser({ 
      name: 'Test', 
      email: 'test@ex.com', 
      role: 'student' 
    });
    
    await UserService.updateUser(user.id, { role: 'instructor' }, user.id);
    
    // Check audit log for role change
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['role.changed']
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].metadata.old_role).toBe('student');
    expect(rows[0].metadata.new_role).toBe('instructor');
  });

  it('deleteUser soft deletes and logs activity', async () => {
    const u = await UserService.createUser({ name: 'Del', email: 'del@ex.com', role: 'student' });
    
    await expect(UserService.deleteUser(u.id, u.id)).resolves.toBe(true);

    // User should be soft-deleted
    await expect(UserService.getUserById(u.id)).rejects.toThrow(/not found/i);
    
    // Check audit log
    const { rows } = await pool.query(
      'SELECT * FROM activity_logs WHERE action = $1',
      ['user.deleted']
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('restoreUser restores soft-deleted user', async () => {
    const u = await UserService.createUser({ name: 'Restore', email: 'restore@ex.com', role: 'student' });
    await UserService.deleteUser(u.id, u.id);
    
    await expect(UserService.restoreUser(u.id, u.id)).resolves.toBe(true);
    
    // User should be findable again
    const restored = await UserService.getUserById(u.id);
    expect(restored).not.toBeNull();
  });

  it('getUsers returns users + pagination meta', async () => {
    for (let i = 1; i <= 7; i++) {
      await UserService.createUser({ name: `U${i}`, email: `u${i}@ex.com`, role: 'student' });
    }
    const { users, total, page, totalPages } = await UserService.getUsers({ limit: 3, offset: 3 });
    expect(users.length).toBe(3);     // page 2
    expect(total).toBe(7);
    expect(page).toBe(2);
    expect(totalPages).toBe(3);
  });

  it('getUsers excludes soft-deleted by default', async () => {
    for (let i = 1; i <= 5; i++) {
      await UserService.createUser({ name: `U${i}`, email: `u${i}@ex.com`, role: 'student' });
    }
    
    // Soft delete one
    const user3 = await UserModel.findByEmail('u3@ex.com');
    await UserModel.delete(user3.id);
    
    const { users, total } = await UserService.getUsers();
    expect(total).toBe(4); // Excludes soft-deleted
    expect(users.length).toBe(4);
  });

  it('getUsersByRole filters by role', async () => {
    await UserService.createUser({ name: 'Admin 1', email: 'admin1@ex.com', role: 'admin' });
    await UserService.createUser({ name: 'Admin 2', email: 'admin2@ex.com', role: 'admin' });
    await UserService.createUser({ name: 'Student 1', email: 'student1@ex.com', role: 'student' });
    
    const admins = await UserService.getUsersByRole('admin');
    expect(admins.length).toBe(2);
    expect(admins.every(u => u.role === 'admin')).toBe(true);
  });

  it('getUsersByAuthSource filters by auth_source', async () => {
    await UserService.createUser({ 
      name: 'UCSD', 
      email: 'ucsd@ucsd.edu', 
      role: 'student',
      auth_source: 'ucsd' 
    });
    await UserService.createUser({ 
      name: 'Extension', 
      email: 'ext@example.com', 
      role: 'student',
      auth_source: 'extension' 
    });
    
    const ucsdUsers = await UserService.getUsersByAuthSource('ucsd');
    expect(ucsdUsers.length).toBe(1);
    expect(ucsdUsers[0].auth_source).toBe('ucsd');
  });
});
