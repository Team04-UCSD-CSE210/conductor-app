import { Router } from 'express';
import { EnrollmentService } from '../services/enrollment-service.js';
import { requirePermission, requireAnyPermission } from '../middleware/permission-middleware.js';

const router = Router();

/**
 * Create a new enrollment
 * POST /enrollments
 * Body: { offering_id, user_id, course_role, status, ... }
 */
router.post('/', requireRole('admin', 'instructor'), async (req, res) => {
  try {
    // TODO: Get createdBy from auth middleware when authentication is implemented
    const createdBy = req.body.created_by || null;
    const enrollment = await EnrollmentService.createEnrollment(req.body, createdBy);
    res.status(201).json(enrollment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get enrollment by ID
 * GET /enrollments/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const enrollment = await EnrollmentService.getEnrollmentById(req.params.id);
    res.json(enrollment);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * Get enrollment by offering and user
 * GET /enrollments/offering/:offeringId/user/:userId
 */
router.get('/offering/:offeringId/user/:userId', async (req, res) => {
  try {
    const enrollment = await EnrollmentService.getEnrollmentByOfferingAndUser(
      req.params.offeringId,
      req.params.userId
    );
    res.json(enrollment);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * Get all enrollments for a course offering
 * GET /enrollments/offering/:offeringId?limit=50&offset=0&course_role=ta&status=enrolled
 */
router.get('/offering/:offeringId', async (req, res) => {
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
 */
router.get('/user/:userId', async (req, res) => {
  try {
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
 */
router.get('/offering/:offeringId/staff', async (req, res) => {
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
 */
router.get('/offering/:offeringId/tas', async (req, res) => {
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
 */
router.get('/offering/:offeringId/tutors', async (req, res) => {
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
 */
router.get('/offering/:offeringId/students', async (req, res) => {
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
 */
router.put('/:id', async (req, res) => {
  try {
    // TODO: Get updatedBy from auth middleware when authentication is implemented
    const updatedBy = req.body.updated_by || null;
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
 */
router.put('/offering/:offeringId/user/:userId/role', requireRole('admin', 'instructor'), async (req, res) => {
  try {
    // TODO: Get updatedBy from auth middleware when authentication is implemented
    const updatedBy = req.body.updated_by || null;
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
 */
router.post('/offering/:offeringId/user/:userId/drop', async (req, res) => {
  try {
    // TODO: Get droppedBy from auth middleware when authentication is implemented
    const droppedBy = req.body.dropped_by || null;
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
 */
router.delete('/:id', requireRole('admin', 'instructor'), async (req, res) => {
  try {
    // TODO: Get deletedBy from auth middleware when authentication is implemented
    const deletedBy = req.body.deleted_by || null;
    await EnrollmentService.deleteEnrollment(req.params.id, deletedBy);
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get enrollment statistics for an offering
 * GET /enrollments/offering/:offeringId/stats
 */
router.get('/offering/:offeringId/stats', requireAnyPermission(['roster.view', 'course.manage'], 'course'), async (req, res) => {
  try {
    const stats = await EnrollmentService.getEnrollmentStats(req.params.offeringId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

