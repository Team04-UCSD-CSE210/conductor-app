import { Router } from 'express';
import { CourseStaffService } from '../services/course-staff-service.js';
import { CourseStaffModel } from '../models/course-staff-model.js';
// import { requirePermission } from '../middleware/permission-middleware.js';

const router = Router();

/**
 * Get all staff for a course offering
 * GET /courses/:offeringId/staff
 */
router.get('/:offeringId/staff', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const staff = await CourseStaffService.getOfferingStaff(offeringId);
    res.json(staff);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Assign staff to a course offering
 * POST /courses/:offeringId/staff
 * Body: { user_id, staff_role }
 */
router.post('/:offeringId/staff', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const { user_id, staff_role } = req.body;
    const assignedBy = req.body.assigned_by || req.user?.id; // TODO: Get from auth middleware

    if (!user_id || !staff_role) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'user_id and staff_role are required',
      });
    }

    const staff = await CourseStaffService.assignStaff(
      offeringId,
      user_id,
      staff_role,
      assignedBy
    );

    res.status(201).json(staff);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update staff role
 * PUT /courses/:offeringId/staff/:userId
 * Body: { staff_role }
 */
router.put('/:offeringId/staff/:userId', async (req, res) => {
  try {
    const { offeringId, userId } = req.params;
    const { staff_role } = req.body;
    const updatedBy = req.body.updated_by || req.user?.id; // TODO: Get from auth middleware

    if (!staff_role) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'staff_role is required',
      });
    }

    // Find the staff assignment
    const staffList = await CourseStaffModel.findByOffering(offeringId);
    const assignment = staffList.find(s => s.user_id === userId);

    if (!assignment) {
      return res.status(404).json({ error: 'Staff assignment not found' });
    }

    const updated = await CourseStaffService.updateStaffRole(
      assignment.id,
      staff_role,
      updatedBy
    );

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Remove staff from course offering
 * DELETE /courses/:offeringId/staff/:userId
 */
router.delete('/:offeringId/staff/:userId', async (req, res) => {
  try {
    const { offeringId, userId } = req.params;
    const removedBy = req.body.removed_by || req.user?.id; // TODO: Get from auth middleware

    const deleted = await CourseStaffService.removeStaff(offeringId, userId, removedBy);

    if (!deleted) {
      return res.status(404).json({ error: 'Staff assignment not found' });
    }

    res.json({ deleted: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Bulk assign staff to a course
 * POST /courses/:offeringId/staff/bulk
 * Body: { assignments: [{ user_id, staff_role }, ...] }
 */
router.post('/:offeringId/staff/bulk', async (req, res) => {
  try {
    const { offeringId } = req.params;
    const { assignments } = req.body;
    const assignedBy = req.body.assigned_by || req.user?.id; // TODO: Get from auth middleware

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'assignments must be a non-empty array',
      });
    }

    const result = await CourseStaffService.bulkAssignStaff(
      offeringId,
      assignments,
      assignedBy
    );

    const statusCode = result.failed.length === 0 ? 200 : 207; // 207 Multi-Status
    res.status(statusCode).json({
      message: `Bulk assignment completed: ${result.assigned.length} assigned, ${result.failed.length} failed`,
      assigned_count: result.assigned.length,
      failed_count: result.failed.length,
      assigned: result.assigned,
      failed: result.failed,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get all courses where a user is staff
 * GET /users/:userId/staff-assignments
 */
router.get('/users/:userId/staff-assignments', async (req, res) => {
  try {
    const { userId } = req.params;
    const assignments = await CourseStaffService.getUserStaffAssignments(userId);
    res.json(assignments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

