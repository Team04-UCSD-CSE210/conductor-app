import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db.js';
import { AnnouncementModel } from '../models/announcement-model.js';
import { AnnouncementService } from '../services/announcement-service.js';

describe('Announcement Feature', () => {
  let testOffering;
  let testUser;
  let testTeam;
  let testStudent1;
  let testStudent2;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM team WHERE name LIKE 'Test Team%'`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-%@ucsd.edu'`);

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

    // Create test students
    const student1Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status)
       VALUES ('test-student1@ucsd.edu', 'Test Student 1', 'student', 'active')
       RETURNING *`
    );
    testStudent1 = student1Result.rows[0];

    const student2Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status)
       VALUES ('test-student2@ucsd.edu', 'Test Student 2', 'student', 'active')
       RETURNING *`
    );
    testStudent2 = student2Result.rows[0];

    // Create test team
    const teamResult = await pool.query(
      `INSERT INTO team (offering_id, name, team_number, leader_id, status)
       VALUES ($1, 'Test Team Alpha', 1, $2, 'active')
       RETURNING *`,
      [testOffering.id, testStudent1.id]
    );
    testTeam = teamResult.rows[0];

    // Add students to team
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, joined_at)
       VALUES ($1, $2, 'leader', CURRENT_DATE)`,
      [testTeam.id, testStudent1.id]
    );

    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', CURRENT_DATE)`,
      [testTeam.id, testStudent2.id]
    );
  });

  afterAll(async () => {
    // Clean up
    // Delete team first (before users who are leaders)
    if (testTeam) {
      await pool.query('DELETE FROM team WHERE id = $1', [testTeam.id]);
    }
    // Only delete offering if we created it for the test (code starts with TEST)
    if (testOffering && testOffering.code && testOffering.code.startsWith('TEST')) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
    if (testUser) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
    if (testStudent1) {
      await pool.query('DELETE FROM users WHERE id = $1', [testStudent1.id]);
    }
    if (testStudent2) {
      await pool.query('DELETE FROM users WHERE id = $1', [testStudent2.id]);
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

  describe('Team Announcements', () => {
    it('should create a team-specific announcement', async () => {
      const announcement = await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Team Meeting',
        message: 'Team meeting this Friday',
        team_id: testTeam.id
      }, testStudent1.id);

      expect(announcement).toBeDefined();
      expect(announcement.subject).toBe('Team Meeting');
      expect(announcement.team_id).toBe(testTeam.id);
    });

    it('should create a course-wide announcement (no team_id)', async () => {
      const announcement = await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Midterm Exam',
        message: 'Midterm is next week'
      }, testUser.id);

      expect(announcement).toBeDefined();
      expect(announcement.team_id).toBeNull();
    });

    it('should reject team_id that does not belong to offering', async () => {
      // Create a different offering and team
      const otherOfferingResult = await pool.query(
        `INSERT INTO course_offerings (code, name, instructor_id, start_date, end_date)
         VALUES ('OTHER-COURSE', 'Other Course', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days')
         RETURNING id`,
        [testUser.id]
      );
      const otherOffering = otherOfferingResult.rows[0];

      const otherTeamResult = await pool.query(
        `INSERT INTO team (offering_id, name, team_number, status)
         VALUES ($1, 'Other Team', 2, 'active')
         RETURNING id`,
        [otherOffering.id]
      );
      const otherTeam = otherTeamResult.rows[0];

      await expect(
        AnnouncementService.createAnnouncement({
          offering_id: testOffering.id,
          subject: 'Invalid Team',
          message: 'This should fail',
          team_id: otherTeam.id
        }, testUser.id)
      ).rejects.toThrow('Team not found or does not belong to this offering');

      // Cleanup
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [otherOffering.id]);
    });

    it('should get announcements visible to a team member', async () => {
      // Create course-wide announcement
      await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Course Announcement',
        message: 'Everyone should see this'
      }, testUser.id);

      // Create team-specific announcement
      await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Team Announcement',
        message: 'Only team members see this',
        team_id: testTeam.id
      }, testStudent1.id);

      // Student 1 (team member) should see both
      const student1Announcements = await AnnouncementService.getAnnouncementsForUser(
        testOffering.id,
        testStudent1.id
      );
      expect(student1Announcements.length).toBe(2);
      expect(student1Announcements.some(a => a.subject === 'Course Announcement')).toBe(true);
      expect(student1Announcements.some(a => a.subject === 'Team Announcement')).toBe(true);
    });

    it('should not show team announcements to non-team members', async () => {
      // Create another student not in the team
      const student3Result = await pool.query(
        `INSERT INTO users (email, name, primary_role, status)
         VALUES ('test-student3@ucsd.edu', 'Test Student 3', 'student', 'active')
         RETURNING *`
      );
      const testStudent3 = student3Result.rows[0];

      // Create course-wide announcement
      await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Public Announcement',
        message: 'Everyone sees this'
      }, testUser.id);

      // Create team-specific announcement
      await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Secret Team Message',
        message: 'Only team members see this',
        team_id: testTeam.id
      }, testStudent1.id);

      // Student 3 (not in team) should only see course-wide announcement
      const student3Announcements = await AnnouncementService.getAnnouncementsForUser(
        testOffering.id,
        testStudent3.id
      );
      
      expect(student3Announcements.length).toBe(1);
      expect(student3Announcements[0].subject).toBe('Public Announcement');
      expect(student3Announcements.some(a => a.subject === 'Secret Team Message')).toBe(false);

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [testStudent3.id]);
    });

    it('should include team name in announcement results', async () => {
      const announcement = await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Team Update',
        message: 'Important team update',
        team_id: testTeam.id
      }, testStudent1.id);

      const announcements = await AnnouncementService.getAnnouncementsForUser(
        testOffering.id,
        testStudent1.id
      );

      const teamAnnouncement = announcements.find(a => a.id === announcement.id);
      expect(teamAnnouncement).toBeDefined();
      expect(teamAnnouncement.team_name).toBe('Test Team Alpha');
    });

    it('should show team announcements to all team members', async () => {
      // Clean up any existing announcements
      await pool.query('DELETE FROM announcements WHERE offering_id = $1', [testOffering.id]);

      // Create team announcement by team leader
      await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Team Sprint Plan',
        message: 'Our sprint plan for this week',
        team_id: testTeam.id
      }, testStudent1.id);

      // Both team members should see it
      const student1Announcements = await AnnouncementService.getAnnouncementsForUser(
        testOffering.id,
        testStudent1.id
      );
      const student2Announcements = await AnnouncementService.getAnnouncementsForUser(
        testOffering.id,
        testStudent2.id
      );

      expect(student1Announcements.length).toBe(1);
      expect(student2Announcements.length).toBe(1);
      expect(student1Announcements[0].subject).toBe('Team Sprint Plan');
      expect(student2Announcements[0].subject).toBe('Team Sprint Plan');
    });

    it('should not show team announcements after member leaves team', async () => {
      // Create team announcement
      await AnnouncementService.createAnnouncement({
        offering_id: testOffering.id,
        subject: 'Active Team Message',
        message: 'Only active members see this',
        team_id: testTeam.id
      }, testStudent1.id);

      // Student 2 should see it initially
      let student2Announcements = await AnnouncementService.getAnnouncementsForUser(
        testOffering.id,
        testStudent2.id
      );
      expect(student2Announcements.some(a => a.subject === 'Active Team Message')).toBe(true);

      // Student 2 leaves the team
      await pool.query(
        `UPDATE team_members SET left_at = CURRENT_DATE WHERE team_id = $1 AND user_id = $2`,
        [testTeam.id, testStudent2.id]
      );

      // Student 2 should no longer see the team announcement
      student2Announcements = await AnnouncementService.getAnnouncementsForUser(
        testOffering.id,
        testStudent2.id
      );
      expect(student2Announcements.some(a => a.subject === 'Active Team Message')).toBe(false);

      // Restore student 2 to team for other tests
      await pool.query(
        `UPDATE team_members SET left_at = NULL WHERE team_id = $1 AND user_id = $2`,
        [testTeam.id, testStudent2.id]
      );
    });
  });
});
