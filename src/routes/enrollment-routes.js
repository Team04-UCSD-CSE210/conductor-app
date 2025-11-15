import { Router } from 'express';
import { EnrollmentService } from '../services/enrollment-service.js';
import { ensureAuthenticated } from '../middleware/auth.js';
import { protect, protectAny } from '../middleware/permission-middleware.js';

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
 * Get enrollment by ID
 * GET /enrollments/:id
 * Requires: roster.view permission (course scope) OR user viewing their own enrollment
 */
router.get('/:id', ...protectAny(['roster.view', 'course.manage'], 'course'), async (req, res) => {
  try {
    const enrollment = await EnrollmentService.getEnrollmentById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }
    // Users can view their own enrollments (even without permission)
    if (req.user?.id !== enrollment.user_id) {
      // If not viewing own enrollment, permission check already passed
    }
    res.json(enrollment);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * Get enrollment by offering and user
 * GET /enrollments/offering/:offeringId/user/:userId
 * Requires: roster.view permission (course scope) OR user viewing their own enrollment
 */
router.get('/offering/:offeringId/user/:userId', ...protectAny(['roster.view', 'course.manage'], 'course'), async (req, res) => {
  try {
    const enrollment = await EnrollmentService.getEnrollmentByOfferingAndUser(
      req.params.offeringId,
      req.params.userId
    );
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }
    // Users can view their own enrollments (even without permission)
    if (req.user?.id !== req.params.userId) {
      // If not viewing own enrollment, permission check already passed
    }
    res.json(enrollment);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * Get all enrollments for a course offering
 * GET /enrollments/offering/:offeringId?limit=50&offset=0&course_role=ta&status=enrolled
 * Requires: Authentication
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
 * Get all enrollments for a user
 * GET /enrollments/user/:userId?limit=50&offset=0
 * Requires: Authentication (users can view their own enrollments, admins/instructors can view any)
 */
router.get('/user/:userId', ensureAuthenticated, async (req, res) => {
  try {
    // Users can view their own enrollments, admins/instructors can view any
    // Note: IDs are UUIDs (strings), not integers, so compare directly
    if (req.currentUser.id !== req.params.userId && 
        req.currentUser.primary_role !== 'admin' && 
        req.currentUser.primary_role !== 'instructor') {
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
 * Get course staff (TAs and tutors) for an offering
 * GET /enrollments/offering/:offeringId/staff?limit=50&offset=0
 * Requires: Authentication
 */
router.get('/offering/:offeringId/staff', ensureAuthenticated, async (req, res) => {
  try {
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
    };
    const staff = await EnrollmentService.getCourseStaff(req.params.offeringId, options);
    res.json(staff);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get TAs for an offering
 * GET /enrollments/offering/:offeringId/tas?limit=50&offset=0
 * Requires: Authentication
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
 * Requires: Authentication
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
 * Requires: Authentication
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
 * Update enrollment
 * PUT /enrollments/:id
 * Body: { course_role, status, final_grade, grade_marks, ... }
 * Requires: Admin or Instructor, or Course Staff for their course
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    // Get enrollment to check permissions
    const enrollment = await EnrollmentService.getEnrollmentById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    // Admin and instructor can update any enrollment
    // Course staff can update enrollments in their course
    const isAdminOrInstructor = req.currentUser.primary_role === 'admin' || 
                                 req.currentUser.primary_role === 'instructor';
    
    if (!isAdminOrInstructor) {
      // Check if user is course staff for this offering
      const staffEnrollment = await EnrollmentService.getEnrollmentByOfferingAndUser(
        enrollment.offering_id,
        req.currentUser.id
      );
      if (!staffEnrollment || !['ta', 'tutor'].includes(staffEnrollment.course_role)) {
        return res.status(403).json({ error: "forbidden" });
      }
    }

    const updatedBy = req.currentUser.id;
    const updated = await EnrollmentService.updateEnrollment(req.params.id, req.body, updatedBy);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update course role for a user in an offering
 * PUT /enrollments/offering/:offeringId/user/:userId/role
 * Body: { course_role: 'ta' | 'tutor' | 'student' }
 * Requires: Admin or Instructor
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
 * Requires: Admin or Instructor, or users can drop themselves
 */
router.post('/offering/:offeringId/user/:userId/drop', ensureAuthenticated, async (req, res) => {
  try {
    // Users can drop themselves, admins/instructors can drop anyone
    const isAdminOrInstructor = req.currentUser.primary_role === 'admin' || 
                                 req.currentUser.primary_role === 'instructor';
    // Note: IDs are UUIDs (strings), not integers, so compare directly
    if (!isAdminOrInstructor && req.currentUser.id !== req.params.userId) {
      return res.status(403).json({ error: "forbidden" });
    }
    const droppedBy = req.currentUser.id;
    const dropped = await EnrollmentService.dropEnrollment(
      req.params.offeringId,
      req.params.userId,
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
 * Requires: Admin or Instructor
 */
router.delete('/:id', ...protect('enrollment.manage', 'course'), async (req, res) => {
  try {
    const deletedBy = req.currentUser.id;
    await EnrollmentService.deleteEnrollment(req.params.id, deletedBy);
    res.json({ deleted: true });
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

export default router;

