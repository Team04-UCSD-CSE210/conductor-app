import { Router } from 'express';
import { AnnouncementService } from '../services/announcement-service.js';
import { protect } from '../middleware/permission-middleware.js';

const router = Router();

/**
 * Create a new announcement
 * POST /api/announcements
 * Body: { offering_id, subject, message, team_id? }
 * Requires: announcement.create permission (course scope) - Professor/TA/Team Leader
 */
router.post('/', ...protect('announcement.create', 'course'), async (req, res) => {
  try {
    const announcement = await AnnouncementService.createAnnouncement(
      req.body,
      req.currentUser.id
    );
    res.status(201).json(announcement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all announcements for a course offering
 * GET /api/announcements?offering_id=<uuid>&limit=<number>&offset=<number>
 * Requires: announcement.view permission (course scope) - All authenticated users
 * Returns: All announcements (for instructors/TAs) or user-visible announcements (for students)
 */
router.get('/', ...protect('announcement.view', 'course'), async (req, res) => {
  try {
    const { offering_id, limit, offset } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id is required' });
    }

    const options = {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      order: 'created_at DESC'
    };

    // Students and tutors see only course-wide + their team's announcements
    // Instructors/TAs/Admins see all announcements
    const userRole = req.currentUser.role;
    let announcements;
    
    if (userRole === 'student' || userRole === 'unregistered') {
      announcements = await AnnouncementService.getAnnouncementsForUser(
        offering_id,
        req.currentUser.id,
        options
      );
    } else {
      announcements = await AnnouncementService.getAnnouncementsByOffering(
        offering_id,
        options
      );
    }

    // Disable caching to ensure fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json(announcements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get recent announcements for a course offering
 * GET /api/announcements/recent?offering_id=<uuid>&limit=<number>
 * Requires: announcement.view permission (course scope) - All authenticated users
 */
router.get('/recent', ...protect('announcement.view', 'course'), async (req, res) => {
  try {
    const { offering_id, limit } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id is required' });
    }

    const announcements = await AnnouncementService.getRecentAnnouncements(
      offering_id,
      limit ? Number(limit) : 5
    );

    res.json(announcements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get announcement by ID
 * GET /api/announcements/:id
 * Requires: announcement.view permission (course scope) - All authenticated users
 */
router.get('/:id', ...protect('announcement.view', 'course'), async (req, res) => {
  try {
    const announcement = await AnnouncementService.getAnnouncement(req.params.id);
    res.json(announcement);
  } catch (err) {
    if (err.message === 'Announcement not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update an announcement
 * PUT /api/announcements/:id
 * Body: { subject?, message? }
 * Requires: announcement.manage permission (course scope) - Professor/TA
 */
router.put('/:id', ...protect('announcement.manage', 'course'), async (req, res) => {
  try {
    const announcement = await AnnouncementService.updateAnnouncement(
      req.params.id,
      req.body
    );

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json(announcement);
  } catch (err) {
    if (err.message === 'Announcement not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete an announcement
 * DELETE /api/announcements/:id
 * Requires: announcement.manage permission (course scope) - Professor/TA
 */
router.delete('/:id', ...protect('announcement.manage', 'course'), async (req, res) => {
  try {
    const deleted = await AnnouncementService.deleteAnnouncement(
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    if (err.message === 'Announcement not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

export default router;
