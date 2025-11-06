import express from 'express';
import { RoleModel } from '../models/role-model.js';
import { CourseModel } from '../models/course-model.js';
import { UserModel } from '../models/user-model.js';
import { authenticate, requirePermission, requireRole, attachPermissions } from '../middleware/auth-middleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /roles/permissions - Get all available roles and their permissions
 */
router.get('/permissions', async (req, res) => {
  try {
    const rolePermissions = await RoleModel.getRolePermissions();
    const availableRoles = RoleModel.getAvailableRoles();
    const availablePermissions = RoleModel.getAvailablePermissions();

    res.json({
      roles: availableRoles,
      permissions: availablePermissions,
      rolePermissions
    });
  } catch (error) {
    console.error('[roles] Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

/**
 * GET /roles/course/:courseId - Get all role assignments for a course
 */
router.get('/course/:courseId', 
  requirePermission('view_students'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const roles = await RoleModel.getCourseRoles(courseId);
      res.json({ roles });
    } catch (error) {
      console.error('[roles] Error fetching course roles:', error);
      res.status(500).json({ error: 'Failed to fetch course roles' });
    }
  }
);

/**
 * GET /roles/user/:userId - Get all role assignments for a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can view their own roles, or need view_students permission
    if (userId !== req.user.id) {
      // Check if user has permission in any course (simplified check)
      const userCourses = await CourseModel.getUserCourses(req.user.id);
      const hasPermission = userCourses.some(course => 
        ['professor', 'ta'].includes(course.role)
      );
      
      if (!hasPermission && req.user.system_role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const roles = await RoleModel.getUserRoles(userId);
    res.json({ roles });
  } catch (error) {
    console.error('[roles] Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

/**
 * POST /roles/assign - Assign role to user in course
 */
router.post('/assign',
  requirePermission('assign_roles'),
  async (req, res) => {
    try {
      const { userId, courseId, role, reason } = req.body;

      if (!userId || !courseId || !role) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, courseId, role' 
        });
      }

      // Verify user exists
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify course exists
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const assignment = await RoleModel.assignRole(
        userId, 
        courseId, 
        role, 
        req.user.id, 
        reason
      );

      res.status(201).json({ 
        message: 'Role assigned successfully',
        assignment 
      });
    } catch (error) {
      console.error('[roles] Error assigning role:', error);
      res.status(500).json({ error: error.message || 'Failed to assign role' });
    }
  }
);

/**
 * POST /roles/bulk-assign - Bulk assign roles
 */
router.post('/bulk-assign',
  requirePermission('assign_roles'),
  async (req, res) => {
    try {
      const { assignments } = req.body;

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ 
          error: 'assignments must be a non-empty array' 
        });
      }

      // Validate each assignment
      for (const assignment of assignments) {
        if (!assignment.userId || !assignment.courseId || !assignment.role) {
          return res.status(400).json({ 
            error: 'Each assignment must have userId, courseId, and role' 
          });
        }
      }

      const results = await RoleModel.bulkAssignRoles(assignments, req.user.id);

      res.status(201).json({ 
        message: `Successfully assigned ${results.length} roles`,
        assignments: results 
      });
    } catch (error) {
      console.error('[roles] Error bulk assigning roles:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk assign roles' });
    }
  }
);

/**
 * DELETE /roles/remove - Remove role assignment
 */
router.delete('/remove',
  requirePermission('assign_roles'),
  async (req, res) => {
    try {
      const { userId, courseId, reason } = req.body;

      if (!userId || !courseId) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, courseId' 
        });
      }

      const removed = await RoleModel.removeRole(userId, courseId, req.user.id, reason);

      if (!removed) {
        return res.status(404).json({ error: 'Role assignment not found' });
      }

      res.json({ message: 'Role removed successfully' });
    } catch (error) {
      console.error('[roles] Error removing role:', error);
      res.status(500).json({ error: 'Failed to remove role' });
    }
  }
);

/**
 * GET /roles/audit - Get role change audit log
 */
router.get('/audit',
  requireRole(['professor', 'ta']),
  async (req, res) => {
    try {
      const { courseId, userId, limit = 50 } = req.query;
      
      const auditLog = await RoleModel.getAuditLog(
        courseId || null,
        userId || null,
        parseInt(limit)
      );

      res.json({ auditLog });
    } catch (error) {
      console.error('[roles] Error fetching audit log:', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  }
);

/**
 * GET /roles/my-permissions/:courseId - Get current user's permissions in course
 */
router.get('/my-permissions/:courseId', 
  attachPermissions,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      
      const permissions = await RoleModel.getUserPermissions(req.user.id, courseId);
      const userRole = await RoleModel.getUserRole(req.user.id, courseId);

      res.json({ 
        permissions,
        role: userRole?.role || null,
        roleDetails: userRole
      });
    } catch (error) {
      console.error('[roles] Error fetching user permissions:', error);
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  }
);

export default router;
