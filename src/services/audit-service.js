import { pool } from '../db.js';

/**
 * Audit Service - Handles activity logging for user actions
 * Logs all CRUD operations, role changes, and important system events
 */
export class AuditService {
  /**
   * Log an activity to the activity_logs table
   * @param {Object} logData - Activity log data
   * @param {string} logData.userId - User ID performing the action
   * @param {string} [logData.offeringId] - Optional course offering ID
   * @param {string} logData.action - Action type (must match CHECK constraint values)
   * @param {Object} [logData.metadata] - Additional metadata about the action
   */
  static async logActivity({ userId, offeringId = null, action, metadata = null }) {
    try {
      // Validate userId exists before logging (for foreign key constraint)
      if (userId) {
        const userCheck = await pool.query(
          'SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL',
          [userId]
        );
        if (userCheck.rows.length === 0) {
          // User doesn't exist or is deleted - skip logging
          console.warn(`[AuditService] Skipping log for non-existent user: ${userId}`);
          return null;
        }
      }
      
      // Map old action names to new action_type values if needed
      const actionTypeMap = {
        'user.created': 'enroll',
        'user.updated': 'update_assignment',
        'user.deleted': 'drop',
        'role.changed': 'enroll',
        'course.staff.assigned': 'enroll',
        'user.restored': 'enroll',
      };
      
      const actionType = actionTypeMap[action] || action;
      
      const query = `
        INSERT INTO activity_logs (user_id, offering_id, action_type, metadata)
        VALUES ($1::uuid, $2::uuid, $3::activity_action_type_enum, $4::jsonb)
        RETURNING id, created_at
      `;
      
      const { rows } = await pool.query(query, [
        userId,
        offeringId,
        actionType,
        metadata ? JSON.stringify(metadata) : null,
      ]);
      
      return rows[0];
    } catch (error) {
      // Don't throw - audit logging failures shouldn't break the main operation
      console.error('[AuditService] Failed to log activity:', error.message);
      return null;
    }
  }

  /**
   * Log user creation
   */
  static async logUserCreate(userId, userData) {
    return this.logActivity({
      userId,
      action: 'user.created',
      metadata: {
        email: userData.email,
        primary_role: userData.primary_role,
      },
    });
  }

  /**
   * Log user update
   */
  static async logUserUpdate(userId, changes, previousData) {
    return this.logActivity({
      userId,
      action: 'user.updated',
      metadata: {
        changes,
        previous: previousData,
      },
    });
  }

  /**
   * Log user deletion (soft delete)
   */
  static async logUserDelete(userId, deletedUserId) {
    return this.logActivity({
      userId,
      action: 'user.deleted',
      metadata: {
        deleted_user_id: deletedUserId,
      },
    });
  }

  /**
   * Log user restoration
   */
  static async logUserRestore(userId, restoredUserId) {
    return this.logActivity({
      userId,
      action: 'user.restored',
      metadata: {
        restored_user_id: restoredUserId,
      },
    });
  }

  /**
   * Log role change
   */
  static async logRoleChange(userId, targetUserId, oldRole, newRole, roleType = 'global') {
    return this.logActivity({
      userId,
      action: 'role.changed',
      metadata: {
        target_user_id: targetUserId,
        old_role: oldRole,
        new_role: newRole,
        role_type: roleType, // 'global', 'course', 'team'
      },
    });
  }


  /**
   * Get activity logs for a user
   */
  static async getUserActivityLogs(userId, limit = 50, offset = 0) {
    const query = `
      SELECT id, user_id, offering_id, action_type, metadata, created_at
      FROM activity_logs
      WHERE user_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const { rows } = await pool.query(query, [userId, limit, offset]);
    return rows;
  }

  /**
   * Get activity logs for a course offering
   */
  static async getOfferingActivityLogs(offeringId, limit = 50, offset = 0) {
    const query = `
      SELECT id, user_id, offering_id, action_type, metadata, created_at
      FROM activity_logs
      WHERE offering_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const { rows } = await pool.query(query, [offeringId, limit, offset]);
    return rows;
  }
}

