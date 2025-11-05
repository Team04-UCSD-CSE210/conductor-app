import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../db.js';
import { RosterService } from '../services/roster-service.js';
import { UserModel } from '../models/user-model.js';

describe('RosterService', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('importRosterFromJson', () => {
    it('should import valid user array successfully', async () => {
      const users = [
        { name: 'Alice Johnson', email: 'alice@example.com', role: 'user', status: 'active' },
        { name: 'Bob Smith', email: 'bob@example.com', role: 'admin', status: 'active' },
      ];

      const result = await RosterService.importRosterFromJson(users);

      expect(result.imported).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.total).toBe(2);
      expect(result.imported[0]).toHaveProperty('id');
      expect(result.imported[0]).toHaveProperty('email', 'alice@example.com');
    });

    it('should handle partial failures gracefully', async () => {
      const users = [
        { name: 'Valid User', email: 'valid@example.com', role: 'user' },
        { name: 'A', email: 'invalid@example.com' }, // Name too short
        { name: 'Valid User 2', email: 'valid2@example.com', role: 'user' },
        { email: 'no-name@example.com' }, // Missing name
      ];

      const result = await RosterService.importRosterFromJson(users);

      expect(result.imported.length).toBeGreaterThan(0);
      expect(result.failed.length).toBeGreaterThan(0);
      expect(result.total).toBe(4);
      expect(result.imported.length + result.failed.length).toBe(4);
    });

    it('should reject non-array input', async () => {
      await expect(RosterService.importRosterFromJson({}))
        .rejects.toThrow('Expected an array of user objects');

      await expect(RosterService.importRosterFromJson('not an array'))
        .rejects.toThrow('Expected an array of user objects');

      await expect(RosterService.importRosterFromJson(null))
        .rejects.toThrow('Expected an array of user objects');
    });

    it('should reject empty array', async () => {
      await expect(RosterService.importRosterFromJson([]))
        .rejects.toThrow('User array cannot be empty');
    });

    it('should handle duplicate emails with upsert behavior', async () => {
      const users = [
        { name: 'Original Name', email: 'duplicate@example.com', role: 'user' },
        { name: 'Updated Name', email: 'duplicate@example.com', role: 'admin' },
      ];

      const result = await RosterService.importRosterFromJson(users);

      // Both should succeed due to upsert logic in UserModel.create
      expect(result.imported.length).toBe(2);
      expect(result.failed.length).toBe(0);

      // Verify the last import overwrote the first
      const user = await UserModel.findByEmail('duplicate@example.com');
      expect(user.name).toBe('Updated Name');
      expect(user.role).toBe('admin');
    });
  });

  describe('importRosterFromCsv', () => {
    it('should parse and import valid CSV data', async () => {
      const csv = `name,email,role,status
Alice Johnson,alice@example.com,user,active
Bob Smith,bob@example.com,admin,active`;

      const result = await RosterService.importRosterFromCsv(csv);

      expect(result.imported).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.total).toBe(2);
    });

    it('should handle case-insensitive column headers', async () => {
      const csv = `Name,Email,Role,Status
Charlie Brown,charlie@example.com,user,active
Diana Prince,diana@example.com,moderator,active`;

      const result = await RosterService.importRosterFromCsv(csv);

      expect(result.imported).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle CSV with default values for optional fields', async () => {
      const csv = `name,email
Eve Wilson,eve@example.com
Frank Miller,frank@example.com`;

      const result = await RosterService.importRosterFromCsv(csv);

      expect(result.imported).toHaveLength(2);
      const user = await UserModel.findByEmail('eve@example.com');
      expect(user.role).toBe('user'); // Default role
      expect(user.status).toBe('active'); // Default status
    });

    it('should handle CSV with extra whitespace', async () => {
      const csv = `name,email,role,status
  Grace Lee  ,  grace@example.com  ,  user  ,  active  `;

      const result = await RosterService.importRosterFromCsv(csv);

      expect(result.imported).toHaveLength(1);
      const user = await UserModel.findByEmail('grace@example.com');
      expect(user.name).toBe('Grace Lee');
      expect(user.email).toBe('grace@example.com');
    });

    it('should reject invalid CSV input', async () => {
      await expect(RosterService.importRosterFromCsv(''))
        .rejects.toThrow('CSV content cannot be empty');

      await expect(RosterService.importRosterFromCsv(null))
        .rejects.toThrow('CSV content must be a non-empty string');

      await expect(RosterService.importRosterFromCsv(123))
        .rejects.toThrow('CSV content must be a non-empty string');
    });

    it('should reject CSV with no data rows', async () => {
      const csv = 'name,email,role,status\n';

      await expect(RosterService.importRosterFromCsv(csv))
        .rejects.toThrow('CSV file contains no valid data rows');
    });

    it('should handle CSV with missing required fields', async () => {
      const csv = `name,email,role,status
Valid User,valid@example.com,user,active
,missing-email@example.com,user,active
Missing Name,invalid-email,user,active`;

      const result = await RosterService.importRosterFromCsv(csv);

      expect(result.imported.length).toBeGreaterThan(0);
      expect(result.failed.length).toBeGreaterThan(0);
    });

    it('should handle malformed CSV gracefully', async () => {
      const csv = `name,email,role,status
"Unclosed quote,email@example.com,user,active`;

      // Should either parse successfully or fail gracefully
      const result = await RosterService.importRosterFromCsv(csv);
      // Result may have failures, but should not crash
      expect(result).toHaveProperty('imported');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('total');
    });
  });

  describe('exportRosterToJson', () => {
    it('should export empty array when no users exist', async () => {
      const result = await RosterService.exportRosterToJson();
      expect(result).toEqual([]);
    });

    it('should export all users as JSON array', async () => {
      // Create test users
      await UserModel.create({ name: 'User One', email: 'user1@example.com', role: 'user' });
      await UserModel.create({ name: 'User Two', email: 'user2@example.com', role: 'admin' });

      const result = await RosterService.exportRosterToJson();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('role');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('created_at');
      expect(result[0]).toHaveProperty('updated_at');
    });

    it('should export users in correct format', async () => {
      await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
        role: 'moderator',
        status: 'active',
      });

      const result = await RosterService.exportRosterToJson();

      expect(result[0].name).toBe('Test User');
      expect(result[0].email).toBe('test@example.com');
      expect(result[0].role).toBe('moderator');
      expect(result[0].status).toBe('active');
    });
  });

  describe('exportRosterToCsv', () => {
    it('should export empty CSV with headers when no users exist', async () => {
      const result = await RosterService.exportRosterToCsv();

      expect(typeof result).toBe('string');
      expect(result).toContain('name,email,role,status,created_at,updated_at');
      expect(result.trim().split('\n').length).toBe(1); // Only header row
    });

    it('should export users as CSV with proper headers', async () => {
      await UserModel.create({ name: 'CSV User', email: 'csv@example.com', role: 'user' });

      const result = await RosterService.exportRosterToCsv();

      expect(result).toContain('name,email,role,status,created_at,updated_at');
      expect(result).toContain('CSV User');
      expect(result).toContain('csv@example.com');
      expect(result).toContain('user');
      expect(result).toContain('active');
    });

    it('should export multiple users correctly', async () => {
      await UserModel.create({ name: 'User A', email: 'a@example.com', role: 'user' });
      await UserModel.create({ name: 'User B', email: 'b@example.com', role: 'admin' });

      const result = await RosterService.exportRosterToCsv();

      const lines = result.trim().split('\n');
      expect(lines.length).toBe(3); // Header + 2 data rows
      expect(result).toContain('User A');
      expect(result).toContain('User B');
      expect(result).toContain('a@example.com');
      expect(result).toContain('b@example.com');
    });

    it('should handle special characters in CSV export', async () => {
      await UserModel.create({
        name: 'User, With Comma',
        email: 'comma@example.com',
        role: 'user',
      });

      const result = await RosterService.exportRosterToCsv();

      // CSV library should properly escape commas
      expect(result).toContain('comma@example.com');
    });
  });

  describe('normalizeCsvRecord', () => {
    it('should map CSV columns correctly', () => {
      const record = { Name: 'Test', Email: 'test@example.com', Role: 'admin', Status: 'active' };
      const normalized = RosterService.normalizeCsvRecord(record);

      expect(normalized.name).toBe('Test');
      expect(normalized.email).toBe('test@example.com');
      expect(normalized.role).toBe('admin');
      expect(normalized.status).toBe('active');
    });

    it('should handle lowercase column names', () => {
      const record = { name: 'Test', email: 'test@example.com', role: 'user', status: 'active' };
      const normalized = RosterService.normalizeCsvRecord(record);

      expect(normalized.name).toBe('Test');
      expect(normalized.email).toBe('test@example.com');
    });

    it('should apply defaults for missing fields', () => {
      const record = { name: 'Test', email: 'test@example.com' };
      const normalized = RosterService.normalizeCsvRecord(record);

      expect(normalized.role).toBe('user');
      expect(normalized.status).toBe('active');
    });

    it('should trim whitespace from values', () => {
      const record = { name: '  Test User  ', email: '  test@example.com  ' };
      const normalized = RosterService.normalizeCsvRecord(record);

      expect(normalized.name).toBe('Test User');
      expect(normalized.email).toBe('test@example.com');
    });
  });

  describe('validateUserData', () => {
    it('should accept valid user data', () => {
      const validData = { name: 'Valid Name', email: 'valid@example.com' };
      expect(() => RosterService.validateUserData(validData)).not.toThrow();
    });

    it('should reject name shorter than 2 characters', () => {
      const invalidData = { name: 'A', email: 'test@example.com' };
      expect(() => RosterService.validateUserData(invalidData))
        .toThrow('Name must be at least 2 characters long');
    });

    it('should reject missing name', () => {
      const invalidData = { email: 'test@example.com' };
      expect(() => RosterService.validateUserData(invalidData))
        .toThrow('Name must be at least 2 characters long');
    });

    it('should reject invalid email format', () => {
      const invalidData = { name: 'Valid Name', email: 'not-an-email' };
      expect(() => RosterService.validateUserData(invalidData))
        .toThrow('Valid email address is required');
    });

    it('should reject missing email', () => {
      const invalidData = { name: 'Valid Name' };
      expect(() => RosterService.validateUserData(invalidData))
        .toThrow('Valid email address is required');
    });
  });

  describe('Integration: Import then Export', () => {
    it('should maintain data integrity through import-export cycle', async () => {
      // Import via JSON
      const importData = [
        { name: 'Round Trip User', email: 'roundtrip@example.com', role: 'moderator', status: 'active' },
      ];
      await RosterService.importRosterFromJson(importData);

      // Export via CSV
      const csv = await RosterService.exportRosterToCsv();
      expect(csv).toContain('Round Trip User');
      expect(csv).toContain('roundtrip@example.com');
      expect(csv).toContain('moderator');

      // Export via JSON
      const json = await RosterService.exportRosterToJson();
      expect(json).toHaveLength(1);
      expect(json[0].name).toBe('Round Trip User');
      expect(json[0].email).toBe('roundtrip@example.com');
    });

    it('should handle large batch imports', async () => {
      const users = Array.from({ length: 50 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        role: 'user',
        status: 'active',
      }));

      const result = await RosterService.importRosterFromJson(users);
      expect(result.imported.length).toBe(50);
      expect(result.failed.length).toBe(0);

      const exported = await RosterService.exportRosterToJson();
      expect(exported.length).toBe(50);
    });
  });
});

