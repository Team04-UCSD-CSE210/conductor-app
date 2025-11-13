/**
 * PermissionService
 * ------------------------------------------------------------
 * Unified RBAC permission checker for global, course, and team
 * role layers. Uses a single SQL query per check and optional
 * LRU caching for performance.
 *
 * Role layers supported:
 *   - Global role (users.role)
 *   - Course roles (enrollments.role, course_staff.staff_role)
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
 * ------------------------------------------------------------
 */

import LRU from "lru-cache";
import { pool } from "../db.js";

// ------------------------------------------------------------
// Cache each permission check for 1 minute
// ------------------------------------------------------------
const cache = new LRU({ max: 10000, ttl: 60_000 });



export class PermissionService {

  /**
   * Check whether a user has a specific permission.
   *
   * Resolution order (highest → lowest priority):
   *   1. Course-level role (if offeringId provided)
   *   2. Team-level role (if teamId provided)
   *   3. Global role
   *
   * All checks use the same permission code (string).
   *
   * @param {string} userId         - UUID of user
   * @param {string} permissionCode - Permission code (e.g. 'roster.import')
   * @param {string|null} offeringId - Optional course offering ID
   * @param {string|null} teamId     - Optional team ID
   * @returns {Promise<boolean>} whether user is allowed
   */
  static async hasPermission(userId, permissionCode, offeringId = null, teamId = null) {
    if (!userId || !permissionCode) return false;

    // Cache key
    const key = `${userId}:${permissionCode}:${offeringId ?? "no-course"}:${teamId ?? "no-team"}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    // ------------------------------------------------------------
    // Single SQL that checks:
    //   - global role
    //   - course roles (enrollments + course_staff)
    //   - team roles
    //
    // Using EXISTS and UNION avoids multiple round-trips.
    // ------------------------------------------------------------
    const sql = `
      WITH perm AS (
        SELECT id FROM permissions WHERE code = $1
      ),

      -- User global role
      user_global AS (
        SELECT role FROM users
        WHERE id = $2::uuid AND deleted_at IS NULL
      ),

      -- Global role → permission mapping
      has_global AS (
        SELECT 1
        FROM user_global ug
        JOIN user_role_permissions urp
          ON urp.user_role = ug.role::text
        WHERE urp.permission_id = (SELECT id FROM perm)
        LIMIT 1
      ),

      -- Combine enrollment + course_staff roles
      course_roles AS (
        SELECT role AS role_name
        FROM enrollments
        WHERE offering_id = $3::uuid AND user_id = $2::uuid

        UNION ALL

        SELECT staff_role AS role_name
        FROM course_staff
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

    cache.set(key, allowed);
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
        SELECT role FROM users WHERE id = $1::uuid AND deleted_at IS NULL
      ),

      global_codes AS (
        SELECT p.code
        FROM user_role ur
        JOIN user_role_permissions urp ON urp.user_role = ur.role
        JOIN permissions p ON p.id = urp.permission_id
      ),

      course_codes AS (
        SELECT p.code
        FROM permissions p
        WHERE $2::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM (
              SELECT role FROM enrollments WHERE offering_id = $2::uuid AND user_id = $1::uuid
              UNION ALL
              SELECT staff_role FROM course_staff WHERE offering_id = $2::uuid AND user_id = $1::uuid
            ) cr
            JOIN enrollment_role_permissions erp
              ON erp.enrollment_role = cr.role
            WHERE erp.permission_id = p.id
          )
      ),

      team_codes AS (
        SELECT p.code
        FROM team_members tm
        JOIN team_role_permissions trp ON trp.team_role = tm.role
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
