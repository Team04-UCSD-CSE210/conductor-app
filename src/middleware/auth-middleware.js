/**
 * Database-based authentication middleware for RBAC system
 * 
 * Uses existing user management system with API key authentication
 * Supports email-based lookup with role-based authorization
 */

import { pool } from '../db.js';

/**
 * Real authentication middleware using database whitelist
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
async function authenticateByApiKey(apiKey, req, res, next) {
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