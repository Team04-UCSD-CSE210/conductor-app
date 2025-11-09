import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { UserModel } from '../models/user-model.js';

describe('UserModel (Postgres)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1'); // connection sanity
  });

  beforeEach(async () => {
    // UUID PK, so RESTART IDENTITY is effectively harmless; CASCADE clears FKs if any.
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('validates inputs', async () => {
    // invalid email
    await expect(UserModel.create({ email: 'bad-email' }))
      .rejects.toThrow(/Invalid email/i);

    // invalid role
    await expect(UserModel.create({ email: 'ok@example.edu', role: 'nope' }))
      .rejects.toThrow(/Invalid role/i);

    // invalid status
    await expect(UserModel.create({ email: 'ok@example.edu', status: 'invalid' }))
      .rejects.toThrow(/Invalid status/i);

    // invalid auth_source
    await expect(UserModel.create({ email: 'ok@example.edu', auth_source: 'invalid' }))
      .rejects.toThrow(/Invalid auth_source/i);
  });

  it('creates and reads a user (email normalized)', async () => {
    const u = await UserModel.create({
      email: 'JANE@EXAMPLE.edu',
      name: 'Jane',
      role: 'admin',
    });

    expect(u.id).toBeDefined();                  // UUID
    expect(u.email).toBe('jane@example.edu');    // lowercased by model
    expect(u.role).toBe('admin');
    expect(u.status).toBe('active');              // default status
    expect(u.deleted_at).toBeNull();              // not deleted

    const fetched = await UserModel.findById(u.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Jane');
    expect(fetched?.role).toBe('admin');
  });

  it('creates user with auth_source and status', async () => {
    const u = await UserModel.create({
      email: 'student@ucsd.edu',
      name: 'Student',
      role: 'student',
      auth_source: 'ucsd',
      status: 'active',
    });

    expect(u.auth_source).toBe('ucsd');
    expect(u.status).toBe('active');

    const fetched = await UserModel.findById(u.id);
    expect(fetched?.auth_source).toBe('ucsd');
    expect(fetched?.status).toBe('active');
  });

  it('upserts on duplicate email (ON CONFLICT DO UPDATE)', async () => {
    await UserModel.create({
      email: 'instructor@example.edu',
      name: 'First Name',
      role: 'instructor',
    });

    const updated = await UserModel.create({
      email: 'instructor@example.edu',
      name: 'Updated Name',
      role: 'admin', // change role too
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.role).toBe('admin');

    const again = await UserModel.findByEmail('instructor@example.edu');
    expect(again?.name).toBe('Updated Name');
    expect(again?.role).toBe('admin');
  });

  it('updates fields and bumps updated_at', async () => {
    const u = await UserModel.create({
      email: 'person@example.edu',
      name: 'Original',
      role: 'student',
    });

    const before = new Date(u.updated_at).getTime();

    const after = await UserModel.update(u.id, {
      name: 'New Name',
      role: 'instructor',
    });

    expect(after.name).toBe('New Name');
    expect(after.role).toBe('instructor');
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(before);
  });

  it('lists with limit/offset and counts (excludes soft-deleted)', async () => {
    for (let i = 1; i <= 5; i++) {
      await UserModel.create({
        email: `user${i}@example.edu`,
        name: `User ${i}`,
        role: 'student',
      });
    }

    // Soft delete one user
    await UserModel.delete((await UserModel.findByEmail('user3@example.edu')).id);

    const page1 = await UserModel.findAll(3, 0);
    const page2 = await UserModel.findAll(3, 3);
    const total = await UserModel.count();

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(1); // Only 4 active users
    expect(total).toBe(4); // Excludes soft-deleted
  });

  it('soft deletes user (sets deleted_at)', async () => {
    const u = await UserModel.create({
      email: 'delete-me@example.edu',
      name: 'To Delete',
      role: 'student',
    });

    const ok = await UserModel.delete(u.id);
    expect(ok).toBe(true);

    // User should not be found in normal queries
    const missing = await UserModel.findById(u.id);
    expect(missing).toBeNull();

    // But should be found with includeDeleted flag
    const deleted = await UserModel.findById(u.id, true);
    expect(deleted).not.toBeNull();
    expect(deleted?.deleted_at).not.toBeNull();
  });

  it('restores soft-deleted user', async () => {
    const u = await UserModel.create({
      email: 'restore-me@example.edu',
      name: 'To Restore',
      role: 'student',
    });

    // Soft delete
    await UserModel.delete(u.id);
    const deleted = await UserModel.findById(u.id, true);
    expect(deleted?.deleted_at).not.toBeNull();

    // Restore
    const restored = await UserModel.restore(u.id);
    expect(restored).toBe(true);

    // Should be findable again
    const found = await UserModel.findById(u.id);
    expect(found).not.toBeNull();
    expect(found?.deleted_at).toBeNull();
  });

  it('finds users by role', async () => {
    await UserModel.create({ email: 'admin1@example.edu', name: 'Admin 1', role: 'admin' });
    await UserModel.create({ email: 'admin2@example.edu', name: 'Admin 2', role: 'admin' });
    await UserModel.create({ email: 'student1@example.edu', name: 'Student 1', role: 'student' });

    const admins = await UserModel.findByRole('admin');
    expect(admins.length).toBe(2);
    expect(admins.every(u => u.role === 'admin')).toBe(true);
  });

  it('finds users by auth_source', async () => {
    await UserModel.create({ 
      email: 'ucsd1@ucsd.edu', 
      name: 'UCSD Student', 
      role: 'student',
      auth_source: 'ucsd' 
    });
    await UserModel.create({ 
      email: 'ext1@example.com', 
      name: 'Extension Student', 
      role: 'student',
      auth_source: 'extension' 
    });

    const ucsdUsers = await UserModel.findByAuthSource('ucsd');
    expect(ucsdUsers.length).toBe(1);
    expect(ucsdUsers[0].auth_source).toBe('ucsd');
  });

  it('finds user by user_id', async () => {
    const u = await UserModel.create({
      email: 'userid@example.edu',
      name: 'User ID Test',
      role: 'student',
      user_id: 'TEST123',
    });

    const found = await UserModel.findByUserId('TEST123');
    expect(found).not.toBeNull();
    expect(found?.user_id).toBe('TEST123');
  });
});
