import { Router } from 'express';
import { AnnouncementService } from '../services/announcement-service.js';
import { protect } from '../middleware/permission-middleware.js';
import { PermissionService } from '../services/permission-service.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

/**
 * Create a new announcement
 * POST /api/announcements
 * Body: { offering_id, subject, message, team_id? }
 * Requires: announcement.create permission (course scope for course-wide, team scope for team announcements)
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id, team_id } = req.body;
    const userId = req.currentUser.id;

    // Check permissions based on whether this is a team or course announcement
    let hasPermission = false;
    
    if (team_id) {
      // Team announcement - check team permissions
      hasPermission = await PermissionService.hasPermission(
        userId,
        'announcement.create',
        offering_id,
        team_id
      );
    } else {
      // Course-wide announcement - check course permissions
      hasPermission = await PermissionService.hasPermission(
        userId,
        'announcement.create',
        offering_id,
        null
      );
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to create announcements'
      });
    }

    const announcement = await AnnouncementService.createAnnouncement(
      req.body,
      userId
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

    // Students see only course-wide + their team's announcements
    // Instructors/TAs/Tutors see only course-wide announcements (no team-specific)
    const userRole = req.currentUser.primary_role;
    let announcements;
    
    if (userRole === 'student' || userRole === 'unregistered') {
      announcements = await AnnouncementService.getAnnouncementsForUser(
        offering_id,
        req.currentUser.id,
        options
      );
    } else {
      // Get all announcements and filter to course-wide only
      const allAnnouncements = await AnnouncementService.getAnnouncementsByOffering(
        offering_id,
        options
      );
      announcements = allAnnouncements.filter(a => a.team_id === null);
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
 * Returns: Course-wide announcements only for instructors/TAs/tutors, filtered for students
 */
router.get('/recent', ...protect('announcement.view', 'course'), async (req, res) => {
  try {
    const { offering_id, limit } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id is required' });
    }

    const userRole = req.currentUser.primary_role;
    let announcements;

    if (userRole === 'student' || userRole === 'unregistered') {
      // Students see all recent (will be filtered by visibility in frontend/service if needed)
      announcements = await AnnouncementService.getRecentAnnouncements(
        offering_id,
        limit ? Number(limit) : 5
      );
    } else {
      // Instructors/TAs/Tutors see only course-wide recent announcements
      announcements = await AnnouncementService.getRecentCourseWideAnnouncements(
        offering_id,
        limit ? Number(limit) : 5
      );
    }

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
 * Requires: announcement.manage permission (course scope for course-wide, team scope for team announcements)
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const announcementId = req.params.id;

    // Get the announcement to check its team_id and offering_id
    const announcement = await AnnouncementService.getAnnouncement(announcementId);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Check permissions based on whether this is a team or course announcement
    let hasPermission = false;
    
    if (announcement.team_id) {
      // Team announcement - check team permissions
      hasPermission = await PermissionService.hasPermission(
        userId,
        'announcement.manage',
        announcement.offering_id,
        announcement.team_id
      );
    } else {
      // Course-wide announcement - check course permissions
      hasPermission = await PermissionService.hasPermission(
        userId,
        'announcement.manage',
        announcement.offering_id,
        null
      );
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to update this announcement'
      });
    }

    const updated = await AnnouncementService.updateAnnouncement(
      announcementId,
      req.body
    );

    res.json(updated);
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
 * Requires: announcement.manage permission (course scope for course-wide, team scope for team announcements)
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const announcementId = req.params.id;

    // Get the announcement to check its team_id and offering_id
    const announcement = await AnnouncementService.getAnnouncement(announcementId);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Check permissions based on whether this is a team or course announcement
    let hasPermission = false;
    
    if (announcement.team_id) {
      // Team announcement - check team permissions
      hasPermission = await PermissionService.hasPermission(
        userId,
        'announcement.manage',
        announcement.offering_id,
        announcement.team_id
      );
    } else {
      // Course-wide announcement - check course permissions
      hasPermission = await PermissionService.hasPermission(
        userId,
        'announcement.manage',
        announcement.offering_id,
        null
      );
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to delete this announcement'
      });
    }

    await AnnouncementService.deleteAnnouncement(announcementId);

    res.json({ deleted: true });
  } catch (err) {
    if (err.message === 'Announcement not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

export default router;
