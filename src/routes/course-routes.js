import express from 'express';
import { CourseModel } from '../models/course-model.js';
import { authenticate, requirePermission, requireRole } from '../middleware/auth-middleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /courses - Get all courses (with enrollment counts)
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const courses = await CourseModel.findAll(limit, offset);
    res.json({ courses });
  } catch (error) {
    console.error('[courses] Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

/**
 * GET /courses/my - Get current user's courses
 */
router.get('/my', async (req, res) => {
  try {
    const courses = await CourseModel.getUserCourses(req.user.id);
    res.json({ courses });
  } catch (error) {
    console.error('[courses] Error fetching user courses:', error);
    res.status(500).json({ error: 'Failed to fetch user courses' });
  }
});

/**
 * GET /courses/:id - Get specific course
 */
router.get('/:id', async (req, res) => {
  try {
    const course = await CourseModel.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ course });
  } catch (error) {
    console.error('[courses] Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

/**
 * POST /courses - Create new course
 */
router.post('/',
  requireRole(['professor'], { requireCourse: false }),
  async (req, res) => {
    try {
      const course = await CourseModel.create(req.body);
      res.status(201).json({ 
        message: 'Course created successfully',
        course 
      });
    } catch (error) {
      console.error('[courses] Error creating course:', error);
      res.status(500).json({ error: error.message || 'Failed to create course' });
    }
  }
);

/**
 * PUT /courses/:id - Update course
 */
router.put('/:id',
  requirePermission('edit_course'),
  async (req, res) => {
    try {
      const course = await CourseModel.update(req.params.id, req.body);
      res.json({ 
        message: 'Course updated successfully',
        course 
      });
    } catch (error) {
      console.error('[courses] Error updating course:', error);
      res.status(500).json({ error: error.message || 'Failed to update course' });
    }
  }
);

/**
 * DELETE /courses/:id - Delete course
 */
router.delete('/:id',
  requirePermission('delete_course'),
  async (req, res) => {
    try {
      const deleted = await CourseModel.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Course not found' });
      }
      res.json({ message: 'Course deleted successfully' });
    } catch (error) {
      console.error('[courses] Error deleting course:', error);
      res.status(500).json({ error: 'Failed to delete course' });
    }
  }
);

export default router;
