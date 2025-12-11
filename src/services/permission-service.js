/**
 * PermissionService
 * ------------------------------------------------------------
 * Unified RBAC permission checker for global, course, and team
 * role layers. Uses a single SQL query per check with Redis caching.
 *
 * Role layers supported:
 *   - Global role (users.primary_role)
 *   - Course roles (enrollments.course_role)
 *   - Team roles (team_members.role)
 *
 * Permission tables used:
 *   - permissions
 *   - user_role_permissions (global role → permission)
 *   - enrollment_role_permissions (course role → permission)
 *   - team_role_permissions (team role → permission)
 *
 * Pattern:
 *   user → (global / course / team role) → role-permission table → permissions
 *
 * Caching:
 *   - Redis cache with 5-minute TTL
 *   - Cache key: perm:{userId}:{permissionCode}:{offeringId}:{teamId}
 *   - Falls back to database if Redis unavailable
 * ------------------------------------------------------------
 */

import { pool } from "../db.js";

// Redis client (optional - will be set by server)
let redisClient = null;
let redisConnected = false;

// Cache TTL in seconds (5 minutes)
const PERMISSION_CACHE_TTL = 300;

export class PermissionService {
  
  /**
   * Set the Redis client for caching (called from server.js)
   * @param {Object} client - Redis client instance
   * @param {boolean} connected - Whether Redis is connected
   */
  static setRedisClient(client, connected = true) {
    redisClient = client;
    redisConnected = connected;
  }

  /**
   * Generate cache key for permission check
   * @private
   */
  static _getCacheKey(userId, permissionCode, offeringId, teamId) {
    return `perm:${userId}:${permissionCode}:${offeringId || 'null'}:${teamId || 'null'}`;
  }

  /**
   * Get cached permission result
   * @private
   */
  static async _getCached(cacheKey) {
    if (!redisConnected || !redisClient) {
      return null;
    }
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }
    } catch (error) {
      console.error('[PermissionService] Redis get error:', error.message);
    }
    
    return null;
  }

  /**
   * Set cached permission result
   * @private
   */
  static async _setCached(cacheKey, allowed) {
    if (!redisConnected || !redisClient) {
      return;
    }
    
    try {
      await redisClient.set(cacheKey, allowed ? 'true' : 'false', {
        EX: PERMISSION_CACHE_TTL
      });
    } catch (error) {
      console.error('[PermissionService] Redis set error:', error.message);
    }
  }

  /**
   * Invalidate cached permissions for a user
   * Useful when user roles/permissions change
   */
  static async invalidateUserCache(userId) {
    if (!redisConnected || !redisClient) {
      return;
    }
    
    try {
      // Delete all keys matching pattern perm:{userId}:*
      const pattern = `perm:${userId}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('[PermissionService] Cache invalidation error:', error.message);
    }
  }

  /**
   * Check whether a user has a specific permission.
   *
   * Resolution order (highest → lowest priority):
   *   1. Course-level role (if offeringId provided)
   *   2. Team-level role (if teamId provided)
   *   3. Global role
   *
   * All checks use the same permission code (string).
   * Results are cached in Redis for 5 minutes.
   *
   * @param {string} userId         - UUID of user
   * @param {string} permissionCode - Permission code (e.g. 'roster.import')
   * @param {string|null} offeringId - Optional course offering ID
   * @param {string|null} teamId     - Optional team ID
   * @returns {Promise<boolean>} whether user is allowed
   */
  static async hasPermission(userId, permissionCode, offeringId = null, teamId = null) {
    if (!userId || !permissionCode) return false;

    // Check cache first
    const cacheKey = this._getCacheKey(userId, permissionCode, offeringId, teamId);
    const cached = await this._getCached(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    // ------------------------------------------------------------
    // Single SQL that checks:
    //   - global role
    //   - course roles (enrollments)
    //   - team roles
    //
    // Using EXISTS and UNION avoids multiple round-trips.
    // ------------------------------------------------------------
    const sql = `
      WITH perm AS (
        SELECT id FROM permissions WHERE code = $1
      ),

      -- User global role (using primary_role)
      user_global AS (
        SELECT primary_role AS role FROM users
        WHERE id = $2::uuid AND deleted_at IS NULL
      ),

      -- Global role → permission mapping
      has_global AS (
        SELECT 1
        FROM user_global ug
        JOIN user_role_permissions urp
          ON urp.user_role::text = ug.role::text
        WHERE urp.permission_id = (SELECT id FROM perm)
        LIMIT 1
      ),

      -- Course enrollment roles
      course_roles AS (
        SELECT course_role AS role_name
        FROM enrollments
        WHERE offering_id = $3::uuid AND user_id = $2::uuid
      ),

      -- Course-level role → permission mapping
      has_course AS (
        SELECT 1
        FROM perm
        WHERE $3::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM course_roles cr
            JOIN enrollment_role_permissions erp
              ON erp.enrollment_role::text = cr.role_name::text
            WHERE erp.permission_id = (SELECT id FROM perm)
          )
        LIMIT 1
      ),

      -- Team-level role → permission mapping
      has_team AS (
        SELECT 1
        FROM perm
        WHERE $4::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM team_members tm
            JOIN team_role_permissions trp
              ON trp.team_role::text = tm.role::text
            WHERE tm.team_id = $4::uuid
              AND tm.user_id = $2::uuid
              AND tm.left_at IS NULL
              AND trp.permission_id = (SELECT id FROM perm)
          )
        LIMIT 1
      )

      SELECT COALESCE(
        (SELECT 1 FROM has_course),
        (SELECT 1 FROM has_team),
        (SELECT 1 FROM has_global),
        NULL
      ) IS NOT NULL AS allowed;
    `;

    const { rows } = await pool.query(sql, [permissionCode, userId, offeringId, teamId]);
    const allowed = rows[0]?.allowed === true;

    // Cache the result
    await this._setCached(cacheKey, allowed);

    return allowed;
  }



  /**
   * Get all permission codes for a user across global, course, team.
   *
   * @param {string} userId
   * @param {string|null} offeringId
   * @param {string|null} teamId
   * @returns {Promise<string[]>}
   */
  static async listPermissionCodes(userId, offeringId = null, teamId = null) {
    const sql = `
      WITH user_role AS (
        SELECT primary_role AS role FROM users WHERE id = $1::uuid AND deleted_at IS NULL
      ),

      global_codes AS (
        SELECT p.code
        FROM user_role ur
        JOIN user_role_permissions urp ON urp.user_role::text = ur.role::text
        JOIN permissions p ON p.id = urp.permission_id
      ),

      course_codes AS (
        SELECT p.code
        FROM permissions p
        WHERE $2::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM enrollments e
            JOIN enrollment_role_permissions erp
              ON erp.enrollment_role::text = e.course_role::text
            WHERE e.offering_id = $2::uuid 
              AND e.user_id = $1::uuid
              AND erp.permission_id = p.id
          )
      ),

      team_codes AS (
        SELECT p.code
        FROM team_members tm
        JOIN team_role_permissions trp ON trp.team_role::text = tm.role::text
        JOIN permissions p ON p.id = trp.permission_id
        WHERE $3::uuid IS NOT NULL
          AND tm.team_id = $3::uuid
          AND tm.user_id = $1::uuid
      )

      SELECT DISTINCT code
      FROM (
        SELECT code FROM global_codes
        UNION ALL
        SELECT code FROM course_codes
        UNION ALL
        SELECT code FROM team_codes
      ) combined
      ORDER BY code;
    `;

    const { rows } = await pool.query(sql, [userId, offeringId, teamId]);
    return rows.map(r => r.code);
  }
}