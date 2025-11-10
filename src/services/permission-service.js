import { pool } from '../db.js';

/**
 * Permission Service - Handles role-based permission checking
 * Supports three-tier permission system: global, course, and team roles
 */
export class PermissionService {
  /**
   * Get all permissions for a user role (global role)
   * @param {string} userRole - Global role: 'admin', 'instructor', 'student'
   */
  static async getGlobalRolePermissions(userRole) {
    const query = `
      SELECT p.id, p.scope, p.resource, p.action, p.code, p.description
      FROM permissions p
      INNER JOIN user_role_permissions urp ON p.id = urp.permission_id
      WHERE urp.user_role = $1::user_role_enum
    `;
    
    const { rows } = await pool.query(query, [userRole]);
    return rows;
  }

  /**
   * Get all permissions for an enrollment role (course role)
   * @param {string} enrollmentRole - Course role: 'ta', 'tutor', 'student'
   */
  static async getCourseRolePermissions(enrollmentRole) {
    const query = `
      SELECT p.id, p.scope, p.resource, p.action, p.code, p.description
      FROM permissions p
      INNER JOIN enrollment_role_permissions erp ON p.id = erp.permission_id
      WHERE erp.enrollment_role = $1::enrollment_role_enum
    `;
    
    const { rows } = await pool.query(query, [enrollmentRole]);
    return rows;
  }

  /**
   * Get all permissions for a team role
   * @param {string} teamRole - Team role: 'leader', 'member'
   */
  static async getTeamRolePermissions(teamRole) {
    const query = `
      SELECT p.id, p.scope, p.resource, p.action, p.code, p.description
      FROM permissions p
      INNER JOIN team_role_permissions trp ON p.id = trp.permission_id
      WHERE trp.team_role = $1::team_member_role_enum
    `;
    
    const { rows } = await pool.query(query, [teamRole]);
    return rows;
  }

  /**
   * Check if a user has a specific permission
   * Checks all three role levels: global, course, and team
   * @param {string} userId - User ID
   * @param {string} permissionCode - Permission code (e.g., 'user:create', 'course:assignment:grade')
   * @param {string} [offeringId] - Optional course offering ID for course-level permissions
   * @param {string} [teamId] - Optional team ID for team-level permissions
   */
  static async hasPermission(userId, permissionCode, offeringId = null, teamId = null) {
    // Get user's global role
    const userQuery = `SELECT role FROM users WHERE id = $1::uuid AND deleted_at IS NULL`;
    const { rows: userRows } = await pool.query(userQuery, [userId]);
    
    if (userRows.length === 0) return false;
    
    const globalRole = userRows[0].role;
    
    // Check global permissions first
    const globalPerms = await this.getGlobalRolePermissions(globalRole);
    if (globalPerms.some(p => p.code === permissionCode)) {
      return true;
    }
    
    // Admin has all permissions
    if (globalRole === 'admin') {
      return true;
    }
    
    // Check course-level permissions if offeringId provided
    if (offeringId) {
      // Check enrollment role
      const enrollmentQuery = `
        SELECT role FROM enrollments 
        WHERE offering_id = $1::uuid AND user_id = $2::uuid
      `;
      const { rows: enrollmentRows } = await pool.query(enrollmentQuery, [offeringId, userId]);
      
      if (enrollmentRows.length > 0) {
        const coursePerms = await this.getCourseRolePermissions(enrollmentRows[0].role);
        if (coursePerms.some(p => p.code === permissionCode)) {
          return true;
        }
      }
      
      // Check course_staff role
      const staffQuery = `
        SELECT staff_role FROM course_staff 
        WHERE offering_id = $1::uuid AND user_id = $2::uuid
      `;
      const { rows: staffRows } = await pool.query(staffQuery, [offeringId, userId]);
      
      if (staffRows.length > 0) {
        const staffPerms = await this.getCourseRolePermissions(staffRows[0].staff_role);
        if (staffPerms.some(p => p.code === permissionCode)) {
          return true;
        }
      }
    }
    
    // Check team-level permissions if teamId provided
    if (teamId) {
      const teamQuery = `
        SELECT role FROM team_members 
        WHERE team_id = $1::uuid AND user_id = $2::uuid
      `;
      const { rows: teamRows } = await pool.query(teamQuery, [teamId, userId]);
      
      if (teamRows.length > 0) {
        const teamPerms = await this.getTeamRolePermissions(teamRows[0].role);
        if (teamPerms.some(p => p.code === permissionCode)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get all permissions for a user across all role levels
   */
  static async getUserPermissions(userId, offeringId = null, teamId = null) {
    const userQuery = `SELECT role FROM users WHERE id = $1::uuid AND deleted_at IS NULL`;
    const { rows: userRows } = await pool.query(userQuery, [userId]);
    
    if (userRows.length === 0) return [];
    
    const globalRole = userRows[0].role;
    const permissions = new Set();
    
    // Get global permissions
    const globalPerms = await this.getGlobalRolePermissions(globalRole);
    globalPerms.forEach(p => permissions.add(p.code));
    
    // Admin gets all permissions
    if (globalRole === 'admin') {
      const allPermsQuery = `SELECT code FROM permissions`;
      const { rows: allPerms } = await pool.query(allPermsQuery);
      allPerms.forEach(p => permissions.add(p.code));
      return Array.from(permissions);
    }
    
    // Get course permissions if offeringId provided
    if (offeringId) {
      const enrollmentQuery = `
        SELECT role FROM enrollments 
        WHERE offering_id = $1::uuid AND user_id = $2::uuid
      `;
      const { rows: enrollmentRows } = await pool.query(enrollmentQuery, [offeringId, userId]);
      
      if (enrollmentRows.length > 0) {
        const coursePerms = await this.getCourseRolePermissions(enrollmentRows[0].role);
        coursePerms.forEach(p => permissions.add(p.code));
      }
      
      const staffQuery = `
        SELECT staff_role FROM course_staff 
        WHERE offering_id = $1::uuid AND user_id = $2::uuid
      `;
      const { rows: staffRows } = await pool.query(staffQuery, [offeringId, userId]);
      
      if (staffRows.length > 0) {
        const staffPerms = await this.getCourseRolePermissions(staffRows[0].staff_role);
        staffPerms.forEach(p => permissions.add(p.code));
      }
    }
    
    // Get team permissions if teamId provided
    if (teamId) {
      const teamQuery = `
        SELECT role FROM team_members 
        WHERE team_id = $1::uuid AND user_id = $2::uuid
      `;
      const { rows: teamRows } = await pool.query(teamQuery, [teamId, userId]);
      
      if (teamRows.length > 0) {
        const teamPerms = await this.getTeamRolePermissions(teamRows[0].role);
        teamPerms.forEach(p => permissions.add(p.code));
      }
    }
    
    return Array.from(permissions);
  }
}

