import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db.js';
import { AnnouncementModel } from '../models/announcement-model.js';
import { AnnouncementService } from '../services/announcement-service.js';

describe('Announcement Feature', () => {
  let testOffering;
  let testUser;

  beforeAll(async () => {
    // Get existing CSE210 offering or use any offering
    const existingOffering = await pool.query(
      `SELECT id, code FROM course_offerings LIMIT 1`
    );
    
    if (existingOffering.rows.length > 0) {
      testOffering = existingOffering.rows[0];
    } else {
      // If no offerings exist, create one with minimal required fields
      const instructorResult = await pool.query(
        `SELECT id FROM users WHERE primary_role = 'instructor' LIMIT 1`
      );
      
      if (instructorResult.rows.length === 0) {
        throw new Error('No instructor found. Database not properly seeded.');
      }
      
      const offeringResult = await pool.query(
        `INSERT INTO course_offerings (code, name, instructor_id, start_date, end_date)
         VALUES ('TEST-COURSE', 'Test Course', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days')
         RETURNING id, code`,
        [instructorResult.rows[0].id]
      );
      testOffering = offeringResult.rows[0];
    }

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status)
       VALUES ('test-instructor@ucsd.edu', 'Test Instructor', 'instructor', 'active')
       RETURNING *`
    );
    testUser = userResult.rows[0];
  });

  afterAll(async () => {
    // Clean up
    // Only delete offering if we created it for the test (code starts with TEST)
    if (testOffering && testOffering.code && testOffering.code.startsWith('TEST')) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
    if (testUser) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up announcements before each test
    await pool.query('DELETE FROM announcements WHERE offering_id = $1', [testOffering.id]);
  });

  describe('AnnouncementModel', () => {
    it('should create an announcement', async () => {
      const announcement = await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'Test Announcement',
        message: 'This is a test announcement',
        created_by: testUser.id
      });

      expect(announcement).toBeDefined();
      expect(announcement.subject).toBe('Test Announcement');
      expect(announcement.message).toBe('This is a test announcement');
      expect(announcement.offering_id).toBe(testOffering.id);
      expect(announcement.created_by).toBe(testUser.id);
    });

    it('should find announcement by id', async () => {
      const created = await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'Find Test',
        message: 'Testing find',
        created_by: testUser.id
      });

      const found = await AnnouncementModel.findById(created.id);
      expect(found).toBeDefined();
      expect(found.subject).toBe('Find Test');
      expect(found.creator_name).toBe('Test Instructor');
    });

    it('should find announcements by offering', async () => {
      await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'Announcement 1',
        message: 'Message 1',
        created_by: testUser.id
      });

      await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'Announcement 2',
        message: 'Message 2',
        created_by: testUser.id
      });

      const announcements = await AnnouncementModel.findByOffering(testOffering.id);
      expect(announcements.length).toBe(2);
    });

    it('should update an announcement', async () => {
      const created = await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'Original Subject',
        message: 'Original Message',
        created_by: testUser.id
      });

      const updated = await AnnouncementModel.update(created.id, {
        subject: 'Updated Subject',
        message: 'Updated Message'
      });

      expect(updated.subject).toBe('Updated Subject');
      expect(updated.message).toBe('Updated Message');
    });

    it('should delete an announcement', async () => {
      const created = await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'To Delete',
        message: 'Will be deleted',
        created_by: testUser.id
      });

      const deleted = await AnnouncementModel.delete(created.id);
      expect(deleted).toBe(true);

      const found = await AnnouncementModel.findById(created.id);
      expect(found).toBeNull();
    });

    it('should count announcements', async () => {
      await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'Count Test 1',
        message: 'Message',
        created_by: testUser.id
      });

      await AnnouncementModel.create({
        offering_id: testOffering.id,
        subject: 'Count Test 2',
        message: 'Message',
        created_by: testUser.id
      });

      const count = await AnnouncementModel.count(testOffering.id);
      expect(count).toBe(2);
    });
  });

  describe('AnnouncementService', () => {
    it('should create announcement with validation', async () => {
      const announcement = await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Service Test',
        message: 'Testing service'
      }, testUser.id);

      expect(announcement).toBeDefined();
      expect(announcement.subject).toBe('Service Test');
    });

    it('should reject empty subject', async () => {
      await expect(
        AnnouncementService.createAnnouncement({
          offering_id: testOffering.id,
          subject: '  ',
          message: 'Testing'
        }, testUser.id)
      ).rejects.toThrow('subject is required');
    });

    it('should reject empty message', async () => {
      await expect(
        AnnouncementService.createAnnouncement({
          offering_id: testOffering.id,
          subject: 'Test',
          message: '  '
        }, testUser.id)
      ).rejects.toThrow('message is required');
    });

    it('should reject missing offering_id', async () => {
      await expect(
        AnnouncementService.createAnnouncement({
          subject: 'Test',
          message: 'Test'
        }, testUser.id)
      ).rejects.toThrow('offering_id is required');
    });

    it('should update announcement', async () => {
      const created = await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Original',
        message: 'Original'
      }, testUser.id);

      const updated = await AnnouncementService.updateAnnouncement(
        created.id,
        { subject: 'Updated' }
      );

      expect(updated.subject).toBe('Updated');
      expect(updated.message).toBe('Original'); // Message unchanged
    });

    it('should delete announcement', async () => {
      const created = await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'To Delete',
        message: 'Delete me'
      }, testUser.id);

      const deleted = await AnnouncementService.deleteAnnouncement(created.id);
      expect(deleted).toBe(true);

      await expect(
        AnnouncementService.getAnnouncement(created.id)
      ).rejects.toThrow('Announcement not found');
    });

    it('should get recent announcements', async () => {
      await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Recent 1',
        message: 'Message'
      }, testUser.id);

      const recent = await AnnouncementService.getRecentAnnouncements(testOffering.id, 5);
      expect(recent.length).toBeGreaterThan(0);
    });
  });
});
