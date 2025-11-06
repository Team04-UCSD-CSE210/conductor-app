import { pool } from '../db.js';

const APP_ROLES = ['student', 'team_leader', 'tutor', 'ta', 'professor'];
const PERMISSIONS = [
  'view_course', 'edit_course', 'delete_course',
  'view_students', 'edit_students', 'assign_roles',
  'view_queue', 'manage_queue', 'help_students',
  'view_teams', 'manage_teams', 'assign_team_leaders',
  'view_assignments', 'create_assignments', 'grade_assignments',
  'view_analytics', 'system_admin'
];

export class RoleModel {
  /**
   * Assign role to user in a course
   */
  static async assignRole(userId, courseId, role, assignedBy, reason = null) {
    if (!APP_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current role for audit
      const { rows: currentRows } = await client.query(
        'SELECT role FROM user_course_roles WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      );
      const oldRole = currentRows[0]?.role || null;

      // Upsert role assignment
      const { rows } = await client.query(`
        INSERT INTO user_course_roles (user_id, course_id, role, assigned_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, course_id)
        DO UPDATE SET role = $3, assigned_by = $4, assigned_at = now()
        RETURNING *
      `, [userId, courseId, role, assignedBy]);

      // Log the change
      await client.query(`
        INSERT INTO role_audit_log (user_id, course_id, old_role, new_role, changed_by, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, courseId, oldRole, role, assignedBy, reason]);

      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk assign roles to multiple users
   */
  static async bulkAssignRoles(assignments, assignedBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const { userId, courseId, role, reason } of assignments) {
        const result = await this.assignRole(userId, courseId, role, assignedBy, reason);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's role in a specific course
   */
  static async getUserRole(userId, courseId) {
    const { rows } = await pool.query(`
      SELECT ucr.*, u.name as user_name, u.email, c.name as course_name, c.code
      FROM user_course_roles ucr
      JOIN users u ON ucr.user_id = u.id
      JOIN courses c ON ucr.course_id = c.id
      WHERE ucr.user_id = $1 AND ucr.course_id = $2
    `, [userId, courseId]);
    return rows[0] || null;
  }

  /**
   * Get all roles for a user across all courses
   */
  static async getUserRoles(userId) {
    const { rows } = await pool.query(`
      SELECT ucr.*, c.name as course_name, c.code, c.semester, c.year
      FROM user_course_roles ucr
      JOIN courses c ON ucr.course_id = c.id
      WHERE ucr.user_id = $1
      ORDER BY c.year DESC, c.semester, c.name
    `, [userId]);
    return rows;
  }

  /**
   * Get all users with their roles in a specific course
   */
  static async getCourseRoles(courseId) {
    const { rows } = await pool.query(`
      SELECT ucr.*, u.name, u.email, u.system_role,
             ab.name as assigned_by_name
      FROM user_course_roles ucr
      JOIN users u ON ucr.user_id = u.id
      LEFT JOIN users ab ON ucr.assigned_by = ab.id
      WHERE ucr.course_id = $1
      ORDER BY ucr.role, u.name
    `, [courseId]);
    return rows;
  }

  /**
   * Check if user has specific permission in course
   */
  static async hasPermission(userId, courseId, permission) {
    if (!PERMISSIONS.includes(permission)) {
      return false;
    }

    const { rows } = await pool.query(`
      SELECT 1
      FROM user_course_roles ucr
      JOIN role_permissions rp ON ucr.role = rp.role
      WHERE ucr.user_id = $1 
        AND ucr.course_id = $2 
        AND rp.permission = $3
    `, [userId, courseId, permission]);
    
    return rows.length > 0;
  }

  /**
   * Get all permissions for user in course
   */
  static async getUserPermissions(userId, courseId) {
    const { rows } = await pool.query(`
      SELECT DISTINCT rp.permission
      FROM user_course_roles ucr
      JOIN role_permissions rp ON ucr.role = rp.role
      WHERE ucr.user_id = $1 AND ucr.course_id = $2
    `, [userId, courseId]);
    
    return rows.map(row => row.permission);
  }

  /**
   * Remove role assignment
   */
  static async removeRole(userId, courseId, removedBy, reason = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current role for audit
      const { rows: currentRows } = await client.query(
        'SELECT role FROM user_course_roles WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      );
      const oldRole = currentRows[0]?.role || null;

      // Remove role
      const { rowCount } = await client.query(
        'DELETE FROM user_course_roles WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      );

      if (rowCount > 0 && oldRole) {
        // Log the removal
        await client.query(`
          INSERT INTO role_audit_log (user_id, course_id, old_role, new_role, changed_by, reason)
          VALUES ($1, $2, $3, NULL, $4, $5)
        `, [userId, courseId, oldRole, removedBy, reason]);
      }

      await client.query('COMMIT');
      return rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get role change audit log
   */
  static async getAuditLog(courseId = null, userId = null, limit = 50) {
    let query = `
      SELECT ral.*, u.name as user_name, u.email,
             cb.name as changed_by_name, c.name as course_name, c.code
      FROM role_audit_log ral
      JOIN users u ON ral.user_id = u.id
      JOIN users cb ON ral.changed_by = cb.id
      LEFT JOIN courses c ON ral.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (courseId) {
      params.push(courseId);
      query += ` AND ral.course_id = $${params.length}`;
    }

    if (userId) {
      params.push(userId);
      query += ` AND ral.user_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY ral.created_at DESC LIMIT $${params.length}`;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  /**
   * Get available roles and their permissions
   */
  static async getRolePermissions() {
    const { rows } = await pool.query(`
      SELECT role, array_agg(permission ORDER BY permission) as permissions
      FROM role_permissions
      GROUP BY role
      ORDER BY 
        CASE role
          WHEN 'student' THEN 1
          WHEN 'team_leader' THEN 2
          WHEN 'tutor' THEN 3
          WHEN 'ta' THEN 4
          WHEN 'professor' THEN 5
        END
    `);
    return rows;
  }

  static getAvailableRoles() {
    return APP_ROLES;
  }

  static getAvailablePermissions() {
    return PERMISSIONS;
  }
}
