// Authentication and authorization middleware
import { pool } from '../db.js';

/**
 * Middleware to ensure user is authenticated
 * Must be used after passport session middleware
 */
export const ensureAuthenticated = async (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
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
const getCurrentUser = async (req) => {
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
 * Middleware to require specific primary_role
 * Usage: requireRole('admin') or requireRole(['admin', 'instructor'])
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
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to require instructor role
 */
export const requireInstructor = requireRole('instructor');

/**
 * Middleware to require admin or instructor role
 */
export const requireAdminOrInstructor = requireRole(['admin', 'instructor']);

/**
 * Middleware to require user to be enrolled as TA or instructor in a course offering
 * Expects offeringId in req.params.offeringId
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
 */
export const attachUser = async (req, res, next) => {
  const user = await getCurrentUser(req);
  if (user) {
    req.currentUser = user;
  }
  next();
};

