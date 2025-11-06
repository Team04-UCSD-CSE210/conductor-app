import { RoleModel } from '../models/role-model.js';
import { UserModel } from '../models/user-model.js';

/**
 * Mock authentication middleware - replace with real JWT/session auth
 * For demo purposes, expects user ID in X-User-Id header
 */
export async function authenticate(req, res, next) {
  try {
    // In production, this would validate JWT token or session
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Authorization middleware factory - checks if user has required permission in course
 */
export function requirePermission(permission, options = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const courseId = req.params.courseId || req.body.courseId || options.courseId;
      
      if (!courseId && options.requireCourse !== false) {
        return res.status(400).json({ error: 'Course ID required' });
      }

      // System admins bypass course-level permissions
      if (req.user.system_role === 'admin') {
        return next();
      }

      // Check course-level permission
      if (courseId) {
        const hasPermission = await RoleModel.hasPermission(req.user.id, courseId, permission);
        if (!hasPermission) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: permission,
            courseId 
          });
        }
      }

      next();
    } catch (error) {
      console.error('[auth] Authorization error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
}

/**
 * Role-based authorization middleware
 */
export function requireRole(roles, options = {}) {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const courseId = req.params.courseId || req.body.courseId || options.courseId;
      
      // System admins bypass role checks
      if (req.user.system_role === 'admin') {
        return next();
      }

      if (courseId) {
        const userRole = await RoleModel.getUserRole(req.user.id, courseId);
        if (!userRole || !roleArray.includes(userRole.role)) {
          return res.status(403).json({ 
            error: 'Insufficient role',
            required: roleArray,
            current: userRole?.role || null,
            courseId 
          });
        }
      } else if (options.requireCourse !== false) {
        return res.status(400).json({ error: 'Course ID required' });
      }

      next();
    } catch (error) {
      console.error('[auth] Role check error:', error);
      res.status(500).json({ error: 'Role check failed' });
    }
  };
}

/**
 * Performance monitoring middleware
 */
export function performanceCheck(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 50) { // Log slow permission checks
      console.warn(`[perf] Slow permission check: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
}

/**
 * Middleware to attach user permissions to request
 */
export async function attachPermissions(req, res, next) {
  try {
    if (!req.user) {
      return next();
    }

    const courseId = req.params.courseId || req.body.courseId;
    
    if (courseId) {
      req.permissions = await RoleModel.getUserPermissions(req.user.id, courseId);
      req.userRole = await RoleModel.getUserRole(req.user.id, courseId);
    }

    next();
  } catch (error) {
    console.error('[auth] Error attaching permissions:', error);
    next(); // Continue without permissions rather than failing
  }
}
