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

    const fetched = await UserModel.findById(u.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Jane');
    expect(fetched?.role).toBe('admin');
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

  it('lists with limit/offset and counts', async () => {
    for (let i = 1; i <= 5; i++) {
      await UserModel.create({
        email: `user${i}@example.edu`,
        name: `User ${i}`,
        role: 'student',
      });
    }

    const page1 = await UserModel.findAll(3, 0);
    const page2 = await UserModel.findAll(3, 3);
    const total = await UserModel.count();

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(2);
    expect(total).toBe(5);
  });

  it('deletes and returns boolean', async () => {
    const u = await UserModel.create({
      email: 'delete-me@example.edu',
      name: 'To Delete',
      role: 'student',
    });

    const ok = await UserModel.delete(u.id);
    expect(ok).toBe(true);

    const missing = await UserModel.findById(u.id);
    expect(missing).toBeNull();
  });
});
