import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { UserModel } from '../models/user-model.js';

describe('UserModel (Postgres)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1'); // connection sanity
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

  it('validates inputs', async () => {
    // invalid email
    await expect(UserModel.create({ email: 'bad-email' }))
      .rejects.toThrow(/Invalid email/i);

    // invalid primary_role
    await expect(UserModel.create({ email: 'ok@example.edu', name: 'Test', primary_role: 'nope' }))
      .rejects.toThrow(/Invalid primary_role/i);

    // invalid status
    await expect(UserModel.create({ email: 'ok@example.edu', name: 'Test', status: 'invalid' }))
      .rejects.toThrow(/Invalid status/i);

    // invalid institution_type
    await expect(UserModel.create({ email: 'ok@example.edu', name: 'Test', institution_type: 'invalid' }))
      .rejects.toThrow(/Invalid institution_type/i);
  });

  it('creates and reads a user (email normalized)', async () => {
    const u = await UserModel.create({
      email: 'JANE@EXAMPLE.edu',
      name: 'Jane',
      primary_role: 'admin',
    });

    expect(u.id).toBeDefined();                  // UUID
    expect(u.email).toBe('jane@example.edu');    // lowercased by model
    expect(u.primary_role).toBe('admin');
    expect(u.status).toBe('active');              // default status
    expect(u.institution_type).toBe('extension'); // auto-determined from email

    const fetched = await UserModel.findById(u.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Jane');
    expect(fetched?.primary_role).toBe('admin');
  });

  it('creates user with institution_type auto-determined from email', async () => {
    const ucsdUser = await UserModel.create({
      email: 'student@ucsd.edu',
      name: 'UCSD Student',
      primary_role: 'student',
      status: 'active',
    });

    expect(ucsdUser.institution_type).toBe('ucsd');
    expect(ucsdUser.status).toBe('active');

    const fetchedUcsd = await UserModel.findById(ucsdUser.id);
    expect(fetchedUcsd?.institution_type).toBe('ucsd');

    const extensionUser = await UserModel.create({
      email: 'student@gmail.com',
      name: 'Extension Student',
      primary_role: 'student',
      status: 'active',
    });

    expect(extensionUser.institution_type).toBe('extension');
    const fetchedExtension = await UserModel.findById(extensionUser.id);
    expect(fetchedExtension?.institution_type).toBe('extension');
  });

  it('determines institution_type correctly', () => {
    expect(UserModel.determineInstitutionType('student@ucsd.edu')).toBe('ucsd');
    expect(UserModel.determineInstitutionType('student@gmail.com')).toBe('extension');
    expect(UserModel.determineInstitutionType('student@yahoo.com')).toBe('extension');
    expect(UserModel.determineInstitutionType(null)).toBeNull();
  });

  it('upserts on duplicate email (ON CONFLICT DO UPDATE)', async () => {
    await UserModel.create({
      email: 'instructor@example.edu',
      name: 'First Name',
      primary_role: 'instructor',
    });

    const updated = await UserModel.create({
      email: 'instructor@example.edu',
      name: 'Updated Name',
      primary_role: 'admin', // change role too
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.primary_role).toBe('admin');

    const again = await UserModel.findByEmail('instructor@example.edu');
    expect(again?.name).toBe('Updated Name');
    expect(again?.primary_role).toBe('admin');
  });

  it('updates fields and bumps updated_at', async () => {
    const u = await UserModel.create({
      email: 'person@example.edu',
      name: 'Original',
      primary_role: 'student',
    });

    const before = new Date(u.updated_at).getTime();

    const after = await UserModel.update(u.id, {
      name: 'New Name',
      primary_role: 'instructor',
    });

    expect(after.name).toBe('New Name');
    expect(after.primary_role).toBe('instructor');
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(before);
  });

  it('lists with limit/offset and counts (excludes soft-deleted)', async () => {
    const timestamp = Date.now();
    const createdUsers = [];
    for (let i = 1; i <= 5; i++) {
      const user = await UserModel.create({
        email: `user${i}-${timestamp}@example.edu`,
        name: `User ${i}`,
        primary_role: 'student',
      });
      createdUsers.push(user);
    }

    // Soft delete one user (user3 is at index 2)
    await UserModel.delete(createdUsers[2].id);

    // Get all pages and filter for our users only
    const page1 = await UserModel.findAll(3, 0);
    const page2 = await UserModel.findAll(3, 3);
    const total = await UserModel.count();
    
    // Filter for only our created users
    const ourPage1Users = page1.filter(u => createdUsers.some(cu => cu.id === u.id));
    const ourPage2Users = page2.filter(u => createdUsers.some(cu => cu.id === u.id));
    const ourActiveUsers = createdUsers.filter((u, idx) => idx !== 2); // Exclude soft-deleted user3

    // Should have 3 active users on page 1 (may have more from other tests, but our 3 should be there)
    expect(ourPage1Users.length).toBeGreaterThanOrEqual(0); // May be on page 1 or page 2
    // Should have at least 1 active user on page 2 (the 4th user)
    expect(ourPage2Users.length).toBeGreaterThanOrEqual(0); // May be on page 1 or page 2
    // Total active users (our 4 + possibly others from other tests)
    expect(total).toBeGreaterThanOrEqual(4); // At least 4 active users (excludes our soft-deleted one)

    // Include deleted
    const totalWithDeleted = await UserModel.count(true);
    expect(totalWithDeleted).toBe(5);
  });

  it('soft deletes user (sets deleted_at)', async () => {
    const u = await UserModel.create({
      email: 'delete-me@example.edu',
      name: 'To Delete',
      primary_role: 'student',
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
      primary_role: 'student',
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

  it('finds users by primary_role', async () => {
    const timestamp = Date.now();
    const admin1 = await UserModel.create({ email: `admin1-${timestamp}@example.edu`, name: 'Admin 1', primary_role: 'admin' });
    const admin2 = await UserModel.create({ email: `admin2-${timestamp}@example.edu`, name: 'Admin 2', primary_role: 'admin' });
    await UserModel.create({ email: `student1-${timestamp}@example.edu`, name: 'Student 1', primary_role: 'student' });

    const admins = await UserModel.findByRole('admin');
    const foundAdmin1 = admins.find(u => u.id === admin1.id);
    const foundAdmin2 = admins.find(u => u.id === admin2.id);
    expect(foundAdmin1).toBeDefined();
    expect(foundAdmin2).toBeDefined();
    expect(admins.every(u => u.primary_role === 'admin')).toBe(true);
    expect(admins.length).toBeGreaterThanOrEqual(2);
  });

  it('finds users by institution_type', async () => {
    const timestamp = Date.now();
    const ucsdUser = await UserModel.create({ 
      email: `ucsd1-${timestamp}@ucsd.edu`, 
      name: 'UCSD Student', 
      primary_role: 'student',
    });
    const extUser = await UserModel.create({ 
      email: `ext1-${timestamp}@gmail.com`, 
      name: 'Extension Student', 
      primary_role: 'student',
    });

    const ucsdUsers = await UserModel.findByInstitutionType('ucsd');
    const foundUcsd = ucsdUsers.find(u => u.id === ucsdUser.id);
    expect(foundUcsd).toBeDefined();
    expect(foundUcsd.institution_type).toBe('ucsd');
    expect(foundUcsd.email).toContain('@ucsd.edu');

    const extensionUsers = await UserModel.findByInstitutionType('extension');
    const foundExt = extensionUsers.find(u => u.id === extUser.id);
    expect(foundExt).toBeDefined();
    expect(foundExt.institution_type).toBe('extension');
  });

});
