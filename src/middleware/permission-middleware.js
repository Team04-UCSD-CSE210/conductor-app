// src/middleware/permission-middleware.js
import { PermissionService } from "../services/permission-service.js";
import { pool } from "../db.js";

/**
 * Authentication middleware using database lookup
 * Supports multiple authentication methods:
 * 1. API Key in Authorization header
 * 2. Email-based lookup with X-User-Email header  
 * 3. Basic user ID with X-User-Id header
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const userEmail = req.headers['x-user-email'];
  const userId = req.headers['x-user-id'];

  // Method 1: API Key authentication (future enhancement)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    return authenticateByApiKey(apiKey, req, res, next);
  }

  // Method 2: Email-based authentication
  if (userEmail) {
    return authenticateByEmail(userEmail, req, res, next);
  }

  // Method 3: Direct user ID (for development/testing)
  if (userId) {
    return authenticateByUserId(userId, req, res, next);
  }

  // No authentication provided
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required. Provide Authorization header, X-User-Email, or X-User-Id'
  });
}

/**
 * Authenticate using email and verify user is active
 */
async function authenticateByEmail(email, req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT id, email, name, primary_role, status, institution_type 
      FROM users 
      WHERE email = $1 AND deleted_at IS NULL
    `, [email]);

    if (rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found or inactive'
      });
    }

    const user = rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Unauthorized', 
        message: `User account is ${user.status}. Only active users can authenticate.`
      });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.primary_role,
      status: user.status,
      institution: user.institution_type
    };

    next();
  } catch (err) {
    console.error('Email authentication error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Authenticate using user ID directly
 */
async function authenticateByUserId(userId, req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT id, email, name, primary_role, status, institution_type
      FROM users 
      WHERE id = $1::uuid AND deleted_at IS NULL
    `, [userId]);

    if (rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found or inactive'
      });
    }

    const user = rows[0];

    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: `User account is ${user.status}. Only active users can authenticate.`
      });
    }

    req.user = {
      id: user.id,
      email: user.email, 
      name: user.name,
      role: user.primary_role,
      status: user.status,
      institution: user.institution_type
    };

    next();
  } catch (err) {
    console.error('User ID authentication error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Future: API Key authentication with database lookup
 */
async function authenticateByApiKey(apiKey, req, res) {
  try {
    // TODO: Implement API key table and lookup
    // For now, reject API key auth
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key authentication not yet implemented'
    });
  } catch (err) {
    console.error('API key authentication error:', err);
    res.status(500).json({ error: 'Authentication failed' });
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

/**
 * Extract userId + scope IDs from request in one place.
 */
function getAuthContext(req, scope) {
  const userId = req.user?.id;

  const offeringId =
    scope === "course"
      ? req.params.offeringId ?? req.body.offeringId ?? null
      : null;

  const teamId =
    scope === "team"
      ? req.params.teamId ?? req.body.teamId ?? null
      : null;

  return { userId, offeringId, teamId };
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
      const { userId, offeringId, teamId } = getAuthContext(req, scope);

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
      const { userId, offeringId, teamId } = getAuthContext(req, scope);

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
        if (allowed) return next();
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
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User authentication required",
        });
      }

      const { rows } = await pool.query(
        "SELECT role FROM users WHERE id = $1::uuid AND deleted_at IS NULL",
        [userId]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User not found",
        });
      }

      const userRole = rows[0].role;

      if (!roles.includes(userRole)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Required role: ${roles.join(" or ")}`,
        });
      }

      req.userRole = userRole;
      next();
    } catch (err) {
      console.error("[PermissionMiddleware] Error checking role:", err);
      return res.status(500).json({
        error: "Role check failed",
        message: err.message,
      });
    }
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