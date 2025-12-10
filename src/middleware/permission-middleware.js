// src/middleware/permission-middleware.js
import { PermissionService } from "../services/permission-service.js";
import { getCurrentUser } from "./auth.js";
import { pool } from "../db.js";

/**
 * Authentication middleware using OAuth session
 * Converts OAuth user format to permission system format
 */
export async function authenticate(req, res, next) {
  try {
    // TEST MODE: Bypass authentication for load testing
    if (process.env.TEST_MODE === 'true' || process.env.BYPASS_AUTH === 'true') {
      req.user = {
        emails: [{ value: 'admin@ucsd.edu' }]
      };
      req.currentUser = {
        id: '963f7bb3-438d-4dea-ae8c-995e23aecf5c',
        email: 'admin@ucsd.edu',
        name: 'System Administrator',
        primary_role: 'admin',
        status: 'active'
      };
      return next();
    }

    if (!(req.isAuthenticated?.() && req.user)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required. Please log in via OAuth.",
      });
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not found or inactive",
      });
    }

    if (user.status !== "active") {
      return res.status(401).json({
        error: "Unauthorized",
        message: `User account is ${user.status}. Only active users can authenticate.`,
      });
    }

    req.currentUser = user;

    return next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Skip authentication for health checks and public endpoints
 */
export function skipAuthForPublic(req, res, next) {
  const publicPaths = ['/health', '/'];
  if (publicPaths.includes(req.path)) {
    return next();
  }
  return authenticate(req, res, next);
}

import { isUuid } from '../utils/validation.js';

/**
 * Get the active course offering ID
 */
async function getActiveCourseOfferingId() {
  try {
    const result = await pool.query(
      'SELECT id FROM course_offerings WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[PermissionMiddleware] Error getting active course offering:', error);
    return null;
  }
}

/**
 * Extract userId + scope IDs from request in one place.
 */
async function getAuthContext(req, scope) {
  try {
  const userId = req.currentUser?.id;

    // Safely extract request properties with defaults
    const params = req.params || {};
    const body = req.body || {};
    const query = req.query || {};

    // Safely extract offeringId with proper null checks
    let offeringId = null;
    if (scope === "course") {
      const rawOfferingId = 
        params.offeringId ?? 
        params.courseId ?? 
        body?.offering_id ??
        body?.offeringId ?? 
        body?.courseId ?? 
        query.offering_id ?? 
        null;
      
      // Validate that offeringId is a valid UUID
      if (rawOfferingId) {
        if (isUuid(rawOfferingId)) {
          offeringId = rawOfferingId;
        } else {
          console.error('[PermissionMiddleware] Invalid offeringId format (expected UUID):', rawOfferingId);
        }
      }
    }

    // If course scope but no offeringId provided or invalid, try to get active offering
    if (scope === "course" && !offeringId) {
      offeringId = await getActiveCourseOfferingId();
    }

    // Safely extract teamId with proper null checks
  const teamId =
    scope === "team"
        ? params.teamId ?? body.teamId ?? query.team_id ?? null
      : null;

    return { userId: userId || null, offeringId, teamId };
  } catch (error) {
    console.error('[PermissionMiddleware] Error in getAuthContext:', error);
    // Return safe defaults on error
    return { userId: req.currentUser?.id || null, offeringId: null, teamId: null };
  }
}

/**
 * Require a specific permission.
 *
 * @param {string} permissionCode
 * @param {"global"|"course"|"team"} scope
 */
export function requirePermission(permissionCode, scope = "global") {
  return async (req, res, next) => {
    try {
      const { userId, offeringId, teamId } = await getAuthContext(req, scope);

      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User authentication required",
        });
      }

      const allowed = await PermissionService.hasPermission(
        userId,
        permissionCode,
        offeringId,
        teamId
      );

      if (!allowed) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Permission required: ${permissionCode}`,
        });
      }
      
      // Attach offeringId to request for use in routes
      if (offeringId) {
        req.offeringId = offeringId;
      }
      
      next();
    } catch (err) {
      console.error("[PermissionMiddleware] Error checking permission:", err);
      return res.status(500).json({
        error: "Permission check failed",
        message: err.message,
      });
    }
  };
}

/**
 * Require at least one of multiple permissions.
 *
 * @param {string[]} permissionCodes
 * @param {"global"|"course"|"team"} scope
 */
export function requireAnyPermission(permissionCodes, scope = "global") {
  return async (req, res, next) => {
    try {
      const { userId, offeringId, teamId } = await getAuthContext(req, scope);

      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User authentication required",
        });
      }

      for (const code of permissionCodes) {
        const allowed = await PermissionService.hasPermission(
          userId,
          code,
          offeringId,
          teamId
        );
        if (allowed) {
          // Attach offeringId to request for use in routes
          if (offeringId) {
            req.offeringId = offeringId;
          }
          return next();
        }
      }

      return res.status(403).json({
        error: "Forbidden",
        message: `One of these permissions required: ${permissionCodes.join(", ")}`,
      });
    } catch (err) {
      console.error("[PermissionMiddleware] Error checking permissions:", err);
      return res.status(500).json({
        error: "Permission check failed",
        message: err.message,
      });
    }
  };
}

/**
 * Require a specific global role (bypassing permissions).
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.currentUser;

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User authentication required",
      });
    }

    const userRole = user.primary_role;

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Required role: ${roles.join(" or ")}`,
      });
    }

    req.userRole = userRole;
    return next();
  };
}

// Convenience helpers to attach auth + RBAC in routes

/**
 * Protect a route with a single permission.
 * Usage: ...protect("roster.view", "course")
 */
export function protect(permissionCode, scope = "global") {
  return [authenticate, requirePermission(permissionCode, scope)];
}

/**
 * Protect a route with "any of" multiple permissions.
 * Usage: ...protectAny(["roster.view", "course.manage"], "course")
 */
export function protectAny(permissionCodes, scope = "global") {
  return [authenticate, requireAnyPermission(permissionCodes, scope)];
}

/**
 * Protect a route by global role(s) only.
 * Usage: ...protectRole("admin", "instructor")
 */
export function protectRole(...roles) {
  return [authenticate, requireRole(...roles)];
}