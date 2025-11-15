// Authentication middleware
// ============================================================
// This file provides basic authentication middleware.
// For permission-based authorization, use permission-middleware.js
// ============================================================
import { pool } from '../db.js';

/**
 * Middleware to ensure user is authenticated via passport session
 * Must be used after passport session middleware
 * Also sets req.currentUser for backward compatibility
 * 
 * Used for:
 * - Basic authentication checks (dashboards, user info endpoints)
 * - Routes that need simple auth but not specific permissions
 * 
 * For permission-based checks, use protect() from permission-middleware.js
 */
export const ensureAuthenticated = async (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    // Set req.currentUser for backward compatibility
    if (!req.currentUser) {
      const user = await getCurrentUser(req);
      if (user) {
        req.currentUser = user;
      }
    }
    return next();
  }

  const prefersJson = req.xhr
    || req.get("x-requested-with") === "XMLHttpRequest"
    || req.accepts(["json", "html"]) === "json";

  if (prefersJson) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return res.redirect("/login");
};

/**
 * Get current user from session and database
 */
export const getCurrentUser = async (req) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return null;
  }

  const email = req.user?.emails?.[0]?.value;
  if (!email) {
    return null;
  }

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );
  return result.rows[0] || null;
};

/**
 * Get user's enrollment role for a specific course offering
 */
const getUserEnrollmentRole = async (userId, offeringId) => {
  const result = await pool.query(
    `SELECT course_role FROM enrollments 
     WHERE user_id = $1 AND offering_id = $2 AND status = 'enrolled'`,
    [userId, offeringId]
  );
  return result.rows[0]?.course_role || null;
};

/**
 * @deprecated Use protect() or protectRole() from permission-middleware.js instead
 * 
 * Middleware to require specific primary_role
 * Usage: requireRole('admin') or requireRole(['admin', 'instructor'])
 * 
 * NOTE: This is deprecated. All routes should use permission-based middleware:
 * - For role checks: use protectRole('admin', 'instructor') from permission-middleware.js
 * - For permission checks: use protect('user.manage', 'global') from permission-middleware.js
 */
export const requireRole = (...allowedRoles) => {
  const roles = Array.isArray(allowedRoles[0]) ? allowedRoles[0] : allowedRoles;
  
  return async (req, res, next) => {
    const user = await getCurrentUser(req);
    
    if (!user) {
      const prefersJson = req.xhr
        || req.get("x-requested-with") === "XMLHttpRequest"
        || req.accepts(["json", "html"]) === "json";
      
      if (prefersJson) {
        return res.status(401).json({ error: "unauthorized" });
      }
      return res.redirect("/login");
    }

    if (!roles.includes(user.primary_role)) {
      const prefersJson = req.xhr
        || req.get("x-requested-with") === "XMLHttpRequest"
        || req.accepts(["json", "html"]) === "json";
      
      if (prefersJson) {
        return res.status(403).json({ error: "forbidden", message: `Requires one of: ${roles.join(", ")}` });
      }
      return res.status(403).send("Forbidden: Insufficient permissions");
    }

    // Attach user to request for use in route handlers
    req.currentUser = user;
    next();
  };
};

/**
 * @deprecated Use protectRole('admin') from permission-middleware.js instead
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * @deprecated Use protectRole('instructor') from permission-middleware.js instead
 * Middleware to require instructor role
 */
export const requireInstructor = requireRole('instructor');

/**
 * @deprecated Use protectRole('admin', 'instructor') from permission-middleware.js instead
 * Middleware to require admin or instructor role
 */
export const requireAdminOrInstructor = requireRole(['admin', 'instructor']);

/**
 * @deprecated Use protect('course.manage', 'course') from permission-middleware.js instead
 * 
 * Middleware to require user to be enrolled as TA or instructor in a course offering
 * Expects offeringId in req.params.offeringId
 * 
 * NOTE: This is deprecated. Use permission-based middleware:
 * protect('course.manage', 'course') which checks course-level permissions including TA/tutor roles
 */
export const requireCourseStaff = async (req, res, next) => {
  const user = await getCurrentUser(req);
  
  if (!user) {
    const prefersJson = req.xhr
      || req.get("x-requested-with") === "XMLHttpRequest"
      || req.accepts(["json", "html"]) === "json";
    
    if (prefersJson) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return res.redirect("/login");
  }

  // Admin and instructor (primary_role) have access to all courses
  if (user.primary_role === 'admin' || user.primary_role === 'instructor') {
    req.currentUser = user;
    return next();
  }

  const offeringId = req.params.offeringId;
  if (!offeringId) {
    return res.status(400).json({ error: "offeringId required" });
  }

  const enrollmentRole = await getUserEnrollmentRole(user.id, offeringId);
  if (!enrollmentRole || !['ta', 'tutor'].includes(enrollmentRole)) {
    const prefersJson = req.xhr
      || req.get("x-requested-with") === "XMLHttpRequest"
      || req.accepts(["json", "html"]) === "json";
    
    if (prefersJson) {
      return res.status(403).json({ error: "forbidden", message: "Must be TA or tutor for this course" });
    }
    return res.status(403).send("Forbidden: Must be TA or tutor for this course");
  }

  req.currentUser = user;
  req.enrollmentRole = enrollmentRole;
  next();
};

/**
 * Middleware to attach current user to request (optional, doesn't require auth)
 * 
 * Used for routes that want user info if available but don't require authentication
 * 
 * NOTE: Permission middleware automatically sets req.currentUser when authentication passes
 */
export const attachUser = async (req, res, next) => {
  const user = await getCurrentUser(req);
  if (user) {
    req.currentUser = user;
  }
  next();
};
