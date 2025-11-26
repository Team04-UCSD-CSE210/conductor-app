import { Router } from 'express';
import { EnrollmentService } from '../services/enrollment-service.js';
import { ensureAuthenticated } from '../middleware/auth.js';
import { protect } from '../middleware/permission-middleware.js';
import { PermissionService } from '../services/permission-service.js';

const router = Router();

/**
 * Create a new enrollment
 * POST /enrollments
 * Body: { offering_id, user_id, course_role, status, ... }
 * Requires: enrollment.manage permission (course scope)
 */
router.post('/', ...protect('enrollment.manage', 'course'), async (req, res) => {
  try {
    const createdBy = req.currentUser.id;
    const enrollment = await EnrollmentService.createEnrollment(req.body, createdBy);
    res.status(201).json(enrollment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get enrollment by offering and user
 * GET /enrollments/offering/:offeringId/user/:userId
 * Requires:
 *   - viewing own enrollment (always allowed), OR
 *   - roster.view or course.manage (course scope)
 */
router.get(
  '/offering/:offeringId/user/:userId',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { offeringId, userId } = req.params;

      // Load the enrollment first
      const enrollment = await EnrollmentService.getEnrollmentByOfferingAndUser(
        offeringId,
        userId
      );

      if (!enrollment) {
        return res.status(404).json({ error: 'Enrollment not found' });
      }

      // Self can always view own enrollment
      const isSelf = req.currentUser.id === userId;

      let allowed = isSelf;

      if (!allowed) {
        // Check roster.view or course.manage for this offering
        const [canRosterView, canCourseManage] = await Promise.all([
          PermissionService.hasPermission(
            req.currentUser.id,
            'roster.view',
            offeringId,
            null
          ),
          PermissionService.hasPermission(
            req.currentUser.id,
            'course.manage',
            offeringId,
            null
          ),
        ]);

        allowed = canRosterView || canCourseManage;
      }

      if (!allowed) {
        return res.status(403).json({ error: 'forbidden' });
      }

      res.json(enrollment);
    } catch (err) {
      console.error('Error fetching enrollment:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * Get TAs for an offering
 * GET /enrollments/offering/:offeringId/tas?limit=50&offset=0
 * Requires: Authentication (all authenticated users can view)
 */
router.get('/offering/:offeringId/tas', ensureAuthenticated, async (req, res) => {
  try {
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
    };
    const tas = await EnrollmentService.getTAs(req.params.offeringId, options);
    res.json(tas);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get tutors for an offering
 * GET /enrollments/offering/:offeringId/tutors?limit=50&offset=0
 * Requires: Authentication (all authenticated users can view)
 */
router.get('/offering/:offeringId/tutors', ensureAuthenticated, async (req, res) => {
  try {
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
    };
    const tutors = await EnrollmentService.getTutors(req.params.offeringId, options);
    res.json(tutors);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get students for an offering
 * GET /enrollments/offering/:offeringId/students?limit=50&offset=0
 * Requires: Authentication (all authenticated users can view)
 */
router.get('/offering/:offeringId/students', ensureAuthenticated, async (req, res) => {
  try {
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
    };
    const students = await EnrollmentService.getStudents(req.params.offeringId, options);
    res.json(students);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get detailed roster (with user information and summary stats) for an offering
 * GET /enrollments/offering/:offeringId/roster
 * Requires: Authentication (all authenticated users can view roster)
 * Note: Editing (import/export) is restricted via separate permissions
 */
router.get('/offering/:offeringId/roster', ensureAuthenticated, async (req, res) => {
  try {
    const parseNumber = (value, fallback) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const options = {
      limit: parseNumber(req.query.limit, 50),
      offset: parseNumber(req.query.offset, 0),
      course_role: req.query.course_role || undefined,
      status: req.query.status || undefined,
      search: req.query.search || undefined,
      sort: req.query.sort || undefined,
    };

    const roster = await EnrollmentService.getRosterDetails(req.params.offeringId, options);
    res.json(roster);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all enrollments for a course offering
 * GET /enrollments/offering/:offeringId?limit=50&offset=0&course_role=ta&status=enrolled
 * Requires: Authentication (all authenticated users can view enrollments)
 */
router.get('/offering/:offeringId', ensureAuthenticated, async (req, res) => {
  try {
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
      course_role: req.query.course_role || undefined,
      status: req.query.status || undefined,
    };
    const enrollments = await EnrollmentService.getEnrollmentsByOffering(
      req.params.offeringId,
      options
    );
    res.json(enrollments);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get enrollment statistics for an offering
 * GET /enrollments/offering/:offeringId/stats
 * Requires: Authentication
 */
router.get('/offering/:offeringId/stats', ensureAuthenticated, async (req, res) => {
  try {
    const stats = await EnrollmentService.getEnrollmentStats(req.params.offeringId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all enrollments for a user
 * GET /enrollments/user/:userId?limit=50&offset=0
 * Requires: Authentication (users can view their own enrollments, admins can view any)
 */
router.get('/user/:userId', ensureAuthenticated, async (req, res) => {
  try {
    // Users can view their own enrollments, admins/instructors can view any
    // Note: IDs are UUIDs (strings), not integers, so compare directly
    if (req.currentUser.id !== req.params.userId && 
        req.currentUser.primary_role !== 'admin') {
      return res.status(403).json({ error: "forbidden" });
    }
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
    };
    const enrollments = await EnrollmentService.getEnrollmentsByUser(
      req.params.userId,
      options
    );
    res.json(enrollments);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get enrollment by ID
 * GET /enrollments/:id
 * Requires: roster.view or course.manage permission (course scope)
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const enrollment = await EnrollmentService.getEnrollmentById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // allow self-view automatically
    const isSelf = req.currentUser.id === enrollment.user_id;

    let allowed = isSelf;
    if (!allowed) {
      const [canViewRoster, canManageCourse] = await Promise.all([
        PermissionService.hasPermission(
          req.currentUser.id,
          'roster.view',
          enrollment.offering_id,
          null
        ),
        PermissionService.hasPermission(
          req.currentUser.id,
          'course.manage',
          enrollment.offering_id,
          null
        ),
      ]);

      allowed = canViewRoster || canManageCourse;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'forbidden' });
    }

    res.json(enrollment);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * Update enrollment
 * PUT /enrollments/:id
 * Body: { course_role, status, final_grade, grade_marks, ... }
 * Requires: enrollment.manage permission (course scope)
 * (Admin / Instructor / TA)
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const enrollment = await EnrollmentService.getEnrollmentById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Check enrollment.manage for this offering
    const allowed = await PermissionService.hasPermission(
      req.currentUser.id,
      'enrollment.manage',
      enrollment.offering_id,
      null
    );

    if (!allowed) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const updatedBy = req.currentUser.id;
    const updated = await EnrollmentService.updateEnrollment(
      req.params.id,
      req.body,
      updatedBy
    );

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update course role for a user in an offering
 * PUT /enrollments/offering/:offeringId/user/:userId/role
 * Body: { course_role: 'ta' | 'tutor' | 'student' }
 * Requires: Admin, Instructor, or TA
 */
router.put('/offering/:offeringId/user/:userId/role', ...protect('enrollment.manage', 'course'), async (req, res) => {
  try {
    const updatedBy = req.currentUser.id;
    const { course_role } = req.body;
    if (!course_role || !['student', 'ta', 'tutor'].includes(course_role)) {
      return res.status(400).json({ error: 'Invalid course_role. Must be student, ta, or tutor' });
    }
    const updated = await EnrollmentService.updateCourseRole(
      req.params.offeringId,
      req.params.userId,
      course_role,
      updatedBy
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Drop enrollment (set status to 'dropped')
 * POST /enrollments/offering/:offeringId/user/:userId/drop
 * Requires: self, or enrollment.manage permission (course scope)
 */
router.post('/offering/:offeringId/user/:userId/drop', ensureAuthenticated, async (req, res) => {
  try {
    const { offeringId, userId } = req.params;
    const isSelf = req.currentUser.id === userId;

    let allowed = isSelf;
    if (!allowed) {
      allowed = await PermissionService.hasPermission(
        req.currentUser.id,
        'enrollment.manage',
        offeringId,
        null
      );
    }

    if (!allowed) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const droppedBy = req.currentUser.id;
    const dropped = await EnrollmentService.dropEnrollment(
      offeringId,
      userId,
      droppedBy
    );

    res.json(dropped);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete enrollment (hard delete)
 * DELETE /enrollments/:id
 * Requires: enrollment.manage permission (course scope)
 * (Admin / Instructor / TA)
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const enrollment = await EnrollmentService.getEnrollmentById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const allowed = await PermissionService.hasPermission(
      req.currentUser.id,
      'enrollment.manage',
      enrollment.offering_id,
      null
    );

    if (!allowed) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const deletedBy = req.currentUser.id;
    await EnrollmentService.deleteEnrollment(req.params.id, deletedBy);
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

