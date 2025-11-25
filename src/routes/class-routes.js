import { Router } from 'express';
import { ClassService } from '../services/class-service.js';

const router = Router();

/**
 * Get all course offerings
 * GET /api/class?limit=50&offset=0&instructor_id=xxx&status=open&term=Fall&year=2024
 * Public endpoint - no authentication required
 */
router.get('/', async (req, res) => {
  try {
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
      instructor_id: req.query.instructor_id || undefined,
      status: req.query.status || undefined,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      term: req.query.term || undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
    };

    const courses = await ClassService.getCourses(options);
    res.json(courses);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get course offering by ID
 * GET /api/class/:id
 * Public endpoint - no authentication required
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ClassService.getCourseById(id);
    res.json(course);
  } catch (err) {
    if (err.message === 'INVALID_UUID') {
      return res.status(400).json({ error: 'Invalid course ID format' });
    }
    if (err.message === 'COURSE_NOT_FOUND') {
      return res.status(404).json({ error: 'Course not found' });
    }
    console.error('Error fetching course:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get professor/instructor for a course offering
 * GET /api/class/:offeringId/professor
 * Public endpoint - no authentication required
 */
router.get('/:offeringId/professor', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const professors = await ClassService.getProfessor(offeringId);
    res.json({
      offeringId,
      professors,
      count: professors.length,
    });
  } catch (err) {
    if (err.message === 'INVALID_UUID') {
      return res.status(400).json({ error: 'Invalid offering ID format' });
    }
    console.error('Error fetching professor:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get TAs for a course offering
 * GET /api/class/:offeringId/tas?search=john&page=1&limit=20
 * Public endpoint - no authentication required
 */
router.get('/:offeringId/tas', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const options = {
      search: req.query.search || undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    };

    const tas = await ClassService.getTAs(offeringId, options);
    res.json({
      offeringId,
      tas,
      count: tas.length,
      page: options.page,
      limit: options.limit,
    });
  } catch (err) {
    if (err.message === 'INVALID_UUID') {
      return res.status(400).json({ error: 'Invalid offering ID format' });
    }
    console.error('Error fetching TAs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get tutors for a course offering
 * GET /api/class/:offeringId/tutors?search=jane&page=1&limit=20
 * Public endpoint - no authentication required
 */
router.get('/:offeringId/tutors', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const options = {
      search: req.query.search || undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    };

    const tutors = await ClassService.getTutors(offeringId, options);
    res.json({
      offeringId,
      tutors,
      count: tutors.length,
      page: options.page,
      limit: options.limit,
    });
  } catch (err) {
    if (err.message === 'INVALID_UUID') {
      return res.status(400).json({ error: 'Invalid offering ID format' });
    }
    console.error('Error fetching tutors:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get students for a course offering
 * GET /api/class/:offeringId/students?search=john&page=1&limit=20
 * Public endpoint - no authentication required
 */
router.get('/:offeringId/students', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const options = {
      search: req.query.search || undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    };

    const students = await ClassService.getStudents(offeringId, options);
    res.json({
      offeringId,
      students,
      count: students.length,
      page: options.page,
      limit: options.limit,
    });
  } catch (err) {
    if (err.message === 'INVALID_UUID') {
      return res.status(400).json({ error: 'Invalid offering ID format' });
    }
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get groups/teams for a course offering
 * GET /api/class/:offeringId/groups?search=team&sort=name&page=1&limit=20
 * Public endpoint - no authentication required
 * Query params:
 *   - search: filter by team name
 *   - sort: 'name' or 'number' (default: 'name')
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 20)
 */
router.get('/:offeringId/groups', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const options = {
      search: req.query.search || undefined,
      sort: req.query.sort || 'name',
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    };

    const groups = await ClassService.getGroups(offeringId, options);
    res.json({
      offeringId,
      groups,
      count: groups.length,
      page: options.page,
      limit: options.limit,
    });
  } catch (err) {
    if (err.message === 'INVALID_UUID') {
      return res.status(400).json({ error: 'Invalid offering ID format' });
    }
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get detailed information about a specific team
 * GET /api/class/team/:teamId
 * Public endpoint - no authentication required
 */
router.get('/team/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await ClassService.getTeamDetails(teamId);
    res.json(team);
  } catch (err) {
    if (err.message === 'INVALID_UUID') {
      return res.status(400).json({ error: 'Invalid team ID format' });
    }
    if (err.message === 'TEAM_NOT_FOUND') {
      return res.status(404).json({ error: 'Team not found' });
    }
    console.error('Error fetching team details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
