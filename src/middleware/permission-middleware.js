// src/middleware/permission-middleware.js
import { PermissionService } from "../services/permission-service.js";
import { pool } from "../db.js";

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
