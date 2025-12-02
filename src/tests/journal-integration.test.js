import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { pool } from '../db.js';
import { JournalModel } from '../models/journal-model.js';
import { UserModel } from '../models/user-model.js';
import { delay, syncDatabase } from './test-utils.js';

describe('Work Journal Integration Tests', () => {
  let testUser;
  let testUser2;

  beforeAll(async () => {
    await pool.query('SELECT 1'); // connection sanity check
  });

  beforeEach(async () => {
    // Clean up journal entries and create test users
    await pool.query('DELETE FROM work_journal_logs');
    await pool.query("DELETE FROM users WHERE email LIKE '%journal-test%'");
    
    // Create test users
    testUser = await UserModel.create({
      email: 'user1-journal-test@ucsd.edu',
      name: 'Test User 1',
      primary_role: 'student'
    });

    testUser2 = await UserModel.create({
      email: 'user2-journal-test@ucsd.edu',
      name: 'Test User 2',
      primary_role: 'student'
    });

    await syncDatabase();
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM work_journal_logs');
    await pool.query("DELETE FROM users WHERE email LIKE '%journal-test%'");
  });

  describe('Journal Entry Creation', () => {
    it('should create a new journal entry', async () => {
      const entry = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Completed feature X',
        working_on_today: 'Starting feature Y',
        blockers: 'None',
        feelings: 'Productive'
      });

      expect(entry.id).toBeDefined();
      expect(entry.user_id).toBe(testUser.id);
      expect(entry.date.toISOString().split('T')[0]).toBe('2025-11-25');
      expect(entry.done_since_yesterday).toBe('Completed feature X');
      expect(entry.working_on_today).toBe('Starting feature Y');
      expect(entry.blockers).toBe('None');
      expect(entry.feelings).toBe('Productive');
      expect(entry.created_at).toBeDefined();
      expect(entry.updated_at).toBeDefined();
    });

    it('should enforce unique constraint on user_id and date', async () => {
      // Create first entry
      await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'First entry',
        working_on_today: 'Working on it',
        blockers: 'None',
        feelings: 'Good'
      });

      // Attempt to create duplicate entry for same user and date
      await expect(
        JournalModel.create({
          user_id: testUser.id,
          date: '2025-11-25',
          done_since_yesterday: 'Duplicate entry',
          working_on_today: 'Same date',
          blockers: 'None',
          feelings: 'Confused'
        })
      ).rejects.toThrow();
    });

    it('should allow same date for different users', async () => {
      const entry1 = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'User 1 work',
        working_on_today: 'User 1 plans',
        blockers: 'None',
        feelings: 'Good'
      });

      const entry2 = await JournalModel.create({
        user_id: testUser2.id,
        date: '2025-11-25',
        done_since_yesterday: 'User 2 work',
        working_on_today: 'User 2 plans',
        blockers: 'None',
        feelings: 'Great'
      });

      expect(entry1.user_id).toBe(testUser.id);
      expect(entry2.user_id).toBe(testUser2.id);
      expect(entry1.date.toISOString()).toBe(entry2.date.toISOString());
    });
  });

  describe('Journal Entry Upsert', () => {
    it('should insert new entry when none exists', async () => {
      const entry = await JournalModel.upsert({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Initial entry',
        working_on_today: 'Plans',
        blockers: 'None',
        feelings: 'Good'
      });

      expect(entry.done_since_yesterday).toBe('Initial entry');
    });

    it('should update existing entry when conflict occurs', async () => {
      // Create initial entry
      const initial = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Original work',
        working_on_today: 'Original plans',
        blockers: 'Original blockers',
        feelings: 'Original feelings'
      });

      await delay(100); // Ensure updated_at will be different

      // Upsert with same user_id and date
      const updated = await JournalModel.upsert({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Updated work',
        working_on_today: 'Updated plans',
        blockers: 'Updated blockers',
        feelings: 'Updated feelings'
      });

      expect(updated.id).toBe(initial.id); // Same record
      expect(updated.done_since_yesterday).toBe('Updated work');
      expect(updated.working_on_today).toBe('Updated plans');
      expect(updated.blockers).toBe('Updated blockers');
      expect(updated.feelings).toBe('Updated feelings');
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(initial.updated_at).getTime()
      );
    });
  });

  describe('Journal Entry Retrieval', () => {
    beforeEach(async () => {
      // Create multiple entries for testing
      await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-20',
        done_since_yesterday: 'Work from 11/20',
        working_on_today: 'Plans for 11/20',
        blockers: 'None',
        feelings: 'Good'
      });

      await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-22',
        done_since_yesterday: 'Work from 11/22',
        working_on_today: 'Plans for 11/22',
        blockers: 'Some issues',
        feelings: 'Stressed'
      });

      await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Work from 11/25',
        working_on_today: 'Plans for 11/25',
        blockers: 'None',
        feelings: 'Great'
      });

      await JournalModel.create({
        user_id: testUser2.id,
        date: '2025-11-25',
        done_since_yesterday: 'User 2 work',
        working_on_today: 'User 2 plans',
        blockers: 'None',
        feelings: 'Good'
      });

      await syncDatabase();
    });

    it('should find entry by ID', async () => {
      const entries = await JournalModel.findByUser(testUser.id);
      const entryId = entries[0].id;

      const found = await JournalModel.findById(entryId);

      expect(found).toBeDefined();
      expect(found.id).toBe(entryId);
      expect(found.user_id).toBe(testUser.id);
      expect(found.user_name).toBe(testUser.name);
      expect(found.user_email).toBe(testUser.email);
    });

    it('should return null for non-existent ID', async () => {
      const found = await JournalModel.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('should find entry by user and date', async () => {
      const found = await JournalModel.findByUserAndDate(testUser.id, '2025-11-22');

      expect(found).toBeDefined();
      expect(found.user_id).toBe(testUser.id);
      expect(found.date.toISOString().split('T')[0]).toBe('2025-11-22');
      expect(found.done_since_yesterday).toBe('Work from 11/22');
    });

    it('should find all entries for a user', async () => {
      const entries = await JournalModel.findByUser(testUser.id);

      expect(entries).toHaveLength(3);
      // Should be sorted by date DESC
      expect(entries[0].date.toISOString().split('T')[0]).toBe('2025-11-25');
      expect(entries[1].date.toISOString().split('T')[0]).toBe('2025-11-22');
      expect(entries[2].date.toISOString().split('T')[0]).toBe('2025-11-20');
    });

    it('should only return entries for specified user', async () => {
      const user1Entries = await JournalModel.findByUser(testUser.id);
      const user2Entries = await JournalModel.findByUser(testUser2.id);

      expect(user1Entries).toHaveLength(3);
      expect(user2Entries).toHaveLength(1);
      expect(user2Entries[0].user_id).toBe(testUser2.id);
    });

    it('should filter entries by date range', async () => {
      const entries = await JournalModel.findByUser(testUser.id, {
        startDate: '2025-11-21',
        endDate: '2025-11-24'
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].date.toISOString().split('T')[0]).toBe('2025-11-22');
    });

    it('should respect limit and offset pagination', async () => {
      const firstPage = await JournalModel.findByUser(testUser.id, {
        limit: 2,
        offset: 0
      });

      const secondPage = await JournalModel.findByUser(testUser.id, {
        limit: 2,
        offset: 2
      });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
      expect(firstPage[0].date.toISOString().split('T')[0]).toBe('2025-11-25');
      expect(firstPage[1].date.toISOString().split('T')[0]).toBe('2025-11-22');
      expect(secondPage[0].date.toISOString().split('T')[0]).toBe('2025-11-20');
    });
  });

  describe('Journal Entry Update', () => {
    let entryToUpdate;

    beforeEach(async () => {
      entryToUpdate = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Original work',
        working_on_today: 'Original plans',
        blockers: 'Original blockers',
        feelings: 'Original feelings'
      });
      await delay(100);
    });

    it('should update allowed fields', async () => {
      const updated = await JournalModel.update(entryToUpdate.id, {
        done_since_yesterday: 'Updated work',
        working_on_today: 'Updated plans',
        blockers: 'Updated blockers',
        feelings: 'Updated feelings'
      });

      expect(updated.done_since_yesterday).toBe('Updated work');
      expect(updated.working_on_today).toBe('Updated plans');
      expect(updated.blockers).toBe('Updated blockers');
      expect(updated.feelings).toBe('Updated feelings');
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(entryToUpdate.updated_at).getTime()
      );
    });

    it('should update only specified fields', async () => {
      const updated = await JournalModel.update(entryToUpdate.id, {
        blockers: 'New blocker found'
      });

      expect(updated.blockers).toBe('New blocker found');
      expect(updated.done_since_yesterday).toBe('Original work');
      expect(updated.working_on_today).toBe('Original plans');
      expect(updated.feelings).toBe('Original feelings');
    });

    it('should allow updating the date', async () => {
      const updated = await JournalModel.update(entryToUpdate.id, {
        date: '2025-11-26'
      });

      expect(updated.date.toISOString().split('T')[0]).toBe('2025-11-26');
    });

    it('should throw error when no valid fields to update', async () => {
      await expect(
        JournalModel.update(entryToUpdate.id, {
          invalid_field: 'should not work'
        })
      ).rejects.toThrow(/No valid fields to update/);
    });

    it('should return null for non-existent entry', async () => {
      const updated = await JournalModel.update(
        '00000000-0000-0000-0000-000000000000',
        { blockers: 'Test' }
      );

      expect(updated).toBeNull();
    });
  });

  describe('Journal Entry Deletion', () => {
    let entryToDelete;

    beforeEach(async () => {
      entryToDelete = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Work to delete',
        working_on_today: 'Plans to delete',
        blockers: 'None',
        feelings: 'Good'
      });
      await syncDatabase();
    });

    it('should delete an entry', async () => {
      const deleted = await JournalModel.delete(entryToDelete.id);

      expect(deleted).toBeDefined();
      expect(deleted.id).toBe(entryToDelete.id);

      // Verify it's deleted
      const found = await JournalModel.findById(entryToDelete.id);
      expect(found).toBeNull();
    });

    it('should return null when deleting non-existent entry', async () => {
      const deleted = await JournalModel.delete('00000000-0000-0000-0000-000000000000');
      expect(deleted).toBeNull();
    });
  });

  describe('User Deletion Cascade', () => {
    it('should delete journal entries when user is deleted', async () => {
      // Ensure the foreign key constraint has ON DELETE CASCADE
      // Check if constraint exists and has CASCADE
      const constraintCheck = await pool.query(`
        SELECT 
          c.conname as constraint_name,
          c.confdeltype as delete_action
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class r ON c.confrelid = r.oid
        WHERE t.relname = 'work_journal_logs'
          AND r.relname = 'users'
          AND c.contype = 'f'
          AND c.conkey::smallint[] = ARRAY(
              SELECT attnum::smallint
              FROM pg_attribute 
              WHERE attrelid = t.oid 
                AND attname = 'user_id'
          )
        LIMIT 1
      `);

      if (constraintCheck.rows.length > 0) {
        const constraint = constraintCheck.rows[0];
        // confdeltype: 'c' = CASCADE, 'r' = RESTRICT, 'n' = NO ACTION, 'a' = SET NULL, 'd' = SET DEFAULT
        if (constraint.delete_action !== 'c') {
          // Drop and recreate with CASCADE
          await pool.query(`ALTER TABLE work_journal_logs DROP CONSTRAINT ${constraint.constraint_name}`);
          await pool.query(`
            ALTER TABLE work_journal_logs
            ADD CONSTRAINT work_journal_logs_user_id_fkey 
            FOREIGN KEY (user_id) 
            REFERENCES users(id) 
            ON DELETE CASCADE
          `);
        }
      } else {
        // No constraint found, create one with CASCADE
        await pool.query(`
          ALTER TABLE work_journal_logs
          ADD CONSTRAINT work_journal_logs_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES users(id) 
          ON DELETE CASCADE
        `);
      }

      // Create journal entry
      const entry = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: 'Work',
        working_on_today: 'Plans',
        blockers: 'None',
        feelings: 'Good'
      });

      await syncDatabase();

      // Verify entry exists
      const found = await JournalModel.findById(entry.id);
      expect(found).toBeDefined();

      // Hard delete user to test cascade
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
      await syncDatabase();

      // Verify journal entry is deleted via CASCADE
      const foundAfterDelete = await JournalModel.findById(entry.id);
      expect(foundAfterDelete).toBeNull();
    });
  });

  describe('Data Validation', () => {
    it('should handle empty/null fields gracefully', async () => {
      const entry = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: null,
        working_on_today: '',
        blockers: null,
        feelings: ''
      });

      expect(entry.id).toBeDefined();
      expect(entry.done_since_yesterday).toBeNull();
      expect(entry.working_on_today).toBe('');
      expect(entry.blockers).toBeNull();
      expect(entry.feelings).toBe('');
    });

    it('should handle large text content', async () => {
      const longText = 'A'.repeat(5000);
      
      const entry = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: longText,
        working_on_today: longText,
        blockers: longText,
        feelings: longText
      });

      expect(entry.done_since_yesterday).toBe(longText);
      expect(entry.working_on_today).toBe(longText);
      expect(entry.blockers).toBe(longText);
      expect(entry.feelings).toBe(longText);
    });

    it('should handle special characters and newlines', async () => {
      const specialText = `Line 1\nLine 2\n\nSpecial: <>&"'`;
      
      const entry = await JournalModel.create({
        user_id: testUser.id,
        date: '2025-11-25',
        done_since_yesterday: specialText,
        working_on_today: specialText,
        blockers: specialText,
        feelings: specialText
      });

      expect(entry.done_since_yesterday).toBe(specialText);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent upserts correctly', async () => {
      // Simulate concurrent upserts to same user/date
      const promises = Array.from({ length: 5 }, (_, i) =>
        JournalModel.upsert({
          user_id: testUser.id,
          date: '2025-11-25',
          done_since_yesterday: `Work attempt ${i}`,
          working_on_today: `Plans attempt ${i}`,
          blockers: 'None',
          feelings: 'Good'
        })
      );

      await Promise.all(promises);

      // All should succeed, but only one entry should exist
      const entries = await JournalModel.findByUser(testUser.id);
      expect(entries).toHaveLength(1);
      
      // The last upsert should win
      expect(entries[0].done_since_yesterday).toMatch(/Work attempt \d/);
    });
  });
});
