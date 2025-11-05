import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { UserModel } from '../models/user-model.js';

describe('UserModel (Postgres)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1'); // connection sanity
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('validates inputs', async () => {
    await expect(UserModel.create({ name: 'A', email: 'bad' }))
      .rejects.toThrow(/Name too short.*Invalid email/i);

    await expect(UserModel.create({ name: 'Ok Name', email: 'ok@ex.com', role: 'nope' }))
      .rejects.toThrow(/Invalid role/i);

    await expect(UserModel.create({ name: 'Ok Name', email: 'ok@ex.com', status: 'zzz' }))
      .rejects.toThrow(/Invalid status/i);
  });

  it('creates and reads a user (email normalized)', async () => {
    const u = await UserModel.create({ name: 'Jane', email: 'JANE@EX.com', role: 'admin' });
    expect(u.id).toBeDefined();
    expect(u.email).toBe('jane@ex.com');          // lowercased by model
    expect(u.role).toBe('admin');
    const fetched = await UserModel.findById(u.id);
    expect(fetched?.name).toBe('Jane');
  });

  it('upserts on duplicate email (ON CONFLICT DO UPDATE)', async () => {
    await UserModel.create({ name: 'John', email: 'john@ex.com', role: 'user' });
    const updated = await UserModel.create({ name: 'John Smith', email: 'john@ex.com', role: 'moderator' });
    expect(updated.name).toBe('John Smith');
    expect(updated.role).toBe('moderator');

    const again = await UserModel.findByEmail('john@ex.com');
    expect(again?.name).toBe('John Smith');
  });

  it('updates fields and bumps updated_at', async () => {
    const u = await UserModel.create({ name: 'Alice', email: 'alice@ex.com', role: 'user' });
    const before = u.updated_at;
    const after = await UserModel.update(u.id, { name: 'Alice Johnson', email: 'alice@ex.com', role: 'moderator' });
    expect(after.name).toBe('Alice Johnson');
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('lists with limit/offset and counts', async () => {
    for (let i = 1; i <= 5; i++) {
      await UserModel.create({ name: `U${i}`, email: `u${i}@ex.com`, role: 'user' });
    }
    const page1 = await UserModel.findAll(3, 0);
    const page2 = await UserModel.findAll(3, 3);
    const total = await UserModel.count();

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(2);
    expect(total).toBe(5);
  });

  it('deletes and returns boolean', async () => {
    const u = await UserModel.create({ name: 'Del', email: 'del@ex.com', role: 'user' });
    const ok = await UserModel.delete(u.id);
    expect(ok).toBe(true);
    const missing = await UserModel.findById(u.id);
    expect(missing).toBeNull();
  });
});
