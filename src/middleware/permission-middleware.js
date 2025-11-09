import { PermissionService } from '../services/permission-service.js';

/**
 * Permission Middleware - Enforces role-based access control
 * Checks user permissions before allowing route access
 */

/**
 * Middleware to require a specific permission
 * @param {string} permissionCode - Permission code (e.g., 'user:create', 'course:assignment:grade')
 * @param {Function} [getOfferingId] - Optional function to extract offering_id from request
 * @param {Function} [getTeamId] - Optional function to extract team_id from request
 */
export function requirePermission(permissionCode, getOfferingId = null, getTeamId = null) {
  return async (req, res, next) => {
    try {
      // TODO: Get user from session/auth middleware when authentication is implemented
      // For now, we'll expect userId in req.user or req.body.userId
      const userId = req.user?.id || req.body.userId || req.query.userId;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
      }

      // Extract offering_id and team_id if provided
      const offeringId = getOfferingId ? getOfferingId(req) : req.params.offeringId || req.body.offering_id;
      const teamId = getTeamId ? getTeamId(req) : req.params.teamId || req.body.team_id;

      // Check permission
      const hasPermission = await PermissionService.hasPermission(
        userId,
        permissionCode,
        offeringId,
        teamId
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Permission required: ${permissionCode}`,
        });
      }

      // Attach permission info to request for downstream use
      req.permission = {
        code: permissionCode,
        offeringId,
        teamId,
      };

      next();
    } catch (error) {
      console.error('[PermissionMiddleware] Error checking permission:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: error.message,
      });
    }
  };
}

/**
 * Middleware to require one of multiple permissions
 */
export function requireAnyPermission(permissionCodes, getOfferingId = null, getTeamId = null) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.body.userId || req.query.userId;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
      }

      const offeringId = getOfferingId ? getOfferingId(req) : req.params.offeringId || req.body.offering_id;
      const teamId = getTeamId ? getTeamId(req) : req.params.teamId || req.body.team_id;

      // Check if user has any of the required permissions
      for (const permissionCode of permissionCodes) {
        const hasPermission = await PermissionService.hasPermission(
          userId,
          permissionCode,
          offeringId,
          teamId
        );
        
        if (hasPermission) {
          req.permission = {
            code: permissionCode,
            offeringId,
            teamId,
          };
          return next();
        }
      }

      return res.status(403).json({
        error: 'Forbidden',
        message: `One of these permissions required: ${permissionCodes.join(', ')}`,
      });
    } catch (error) {
      console.error('[PermissionMiddleware] Error checking permissions:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: error.message,
      });
    }
  };
}

/**
 * Middleware to require a specific global role
 */
export function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.body.userId || req.query.userId;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
      }

      // Get user's global role
      const { pool } = await import('../db.js');
      const { rows } = await pool.query(
        'SELECT role FROM users WHERE id = $1::uuid AND deleted_at IS NULL',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      const userRole = rows[0].role;

      if (!roles.includes(userRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Required role: ${roles.join(' or ')}`,
        });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      console.error('[PermissionMiddleware] Error checking role:', error);
      return res.status(500).json({
        error: 'Role check failed',
        message: error.message,
      });
    }
  };
}

