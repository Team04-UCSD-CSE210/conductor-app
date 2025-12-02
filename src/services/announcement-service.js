import { AnnouncementModel } from '../models/announcement-model.js';
import { pool } from '../db.js';

/**
 * AnnouncementService - Business logic for announcements
 */
export class AnnouncementService {
  /**
   * Create a new announcement
   * @param {Object} data - { offering_id, subject, message }
   * @param {string} userId - ID of the user creating the announcement
   * @returns {Promise<Object>} Created announcement
   */
  static async createAnnouncement(data, userId) {
    const { offering_id, subject, message } = data;

    // Validate required fields
    if (!offering_id) {
      throw new Error('offering_id is required');
    }
    if (!subject || subject.trim().length === 0) {
      throw new Error('subject is required');
    }
    if (!message || message.trim().length === 0) {
      throw new Error('message is required');
    }

    // Validate offering exists
    const offeringCheck = await pool.query(
      'SELECT id FROM course_offerings WHERE id = $1',
      [offering_id]
    );

    if (offeringCheck.rows.length === 0) {
      throw new Error('Course offering not found');
    }

    // Create announcement
    const announcement = await AnnouncementModel.create({
      offering_id,
      subject: subject.trim(),
      message: message.trim(),
      created_by: userId
    });

    return announcement;
  }

  /**
   * Get announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise<Object>} Announcement
   */
  static async getAnnouncement(id) {
    const announcement = await AnnouncementModel.findById(id);

    if (!announcement) {
      throw new Error('Announcement not found');
    }

    return announcement;
  }

  /**
   * Get all announcements for a course offering
   * @param {string} offeringId - Course offering ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of announcements
   */
  static async getAnnouncementsByOffering(offeringId, options = {}) {
    return await AnnouncementModel.findByOffering(offeringId, options);
  }

  /**
   * Update an announcement
   * @param {string} id - Announcement ID
   * @param {Object} data - { subject?, message? }
   * @returns {Promise<Object>} Updated announcement
   */
  static async updateAnnouncement(id, data) {
    const announcement = await AnnouncementModel.findById(id);

    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Validate updates
    if (data.subject !== undefined && data.subject.trim().length === 0) {
      throw new Error('subject cannot be empty');
    }
    if (data.message !== undefined && data.message.trim().length === 0) {
      throw new Error('message cannot be empty');
    }

    // Prepare update data
    const updateData = {};
    if (data.subject !== undefined) {
      updateData.subject = data.subject.trim();
    }
    if (data.message !== undefined) {
      updateData.message = data.message.trim();
    }

    const updated = await AnnouncementModel.update(id, updateData);
    return updated;
  }

  /**
   * Delete an announcement
   * @param {string} id - Announcement ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async deleteAnnouncement(id) {
    const announcement = await AnnouncementModel.findById(id);

    if (!announcement) {
      throw new Error('Announcement not found');
    }

    const deleted = await AnnouncementModel.delete(id);
    return deleted;
  }

  /**
   * Get recent announcements for an offering
   * @param {string} offeringId - Course offering ID
   * @param {number} limit - Number of announcements to return
   * @returns {Promise<Array>} Recent announcements
   */
  static async getRecentAnnouncements(offeringId, limit = 5) {
    return await AnnouncementModel.getRecent(offeringId, limit);
  }

  /**
   * Get announcement count for an offering
   * @param {string} offeringId - Course offering ID
   * @returns {Promise<number>} Count of announcements
   */
  static async getAnnouncementCount(offeringId) {
    return await AnnouncementModel.count(offeringId);
  }
}
