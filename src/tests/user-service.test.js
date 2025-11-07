import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { UserService } from '../services/user-service.js';

describe('UserService (business rules)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
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

  it('getUserById returns user or throws not found', async () => {
    const created = await UserService.createUser({ name: 'Jane', email: 'jane@ex.com', role: 'admin' });
    const fetched = await UserService.getUserById(created.id);
    expect(fetched.email).toBe('jane@ex.com');

    await expect(UserService.getUserById('00000000-0000-0000-0000-000000000000'))
      .rejects.toThrow(/not found/i);
  });

  it('updateUser enforces unique email across users', async () => {
    const a = await UserService.createUser({ name: 'Al', email: 'a@ex.com', role: 'student' });
    const b = await UserService.createUser({ name: 'Bo', email: 'b@ex.com', role: 'student' });

    // try to change B's email to A's email -> should error
    await expect(UserService.updateUser(b.id, { email: 'a@ex.com' }))
      .rejects.toThrow(/already in use/i);

    // valid update keeps same email
    const ok = await UserService.updateUser(a.id, { name: 'A Prime', role: 'instructor' });
    expect(ok.name).toBe('A Prime');
    expect(ok.role).toBe('instructor');
  });

  it('deleteUser returns true or throws not found', async () => {
    const u = await UserService.createUser({ name: 'Del', email: 'del@ex.com', role: 'student' });
    await expect(UserService.deleteUser(u.id)).resolves.toBe(true);

    await expect(UserService.deleteUser(u.id)).rejects.toThrow(/not found/i);
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
});
