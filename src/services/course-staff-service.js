import { CourseStaffModel } from '../models/course-staff-model.js';
import { AuditService } from './audit-service.js';

/**
 * CourseStaff Service - Business logic for course staff management
 * Handles TA and Tutor assignments for course offerings
 */
export class CourseStaffService {
  /**
   * Assign staff to a course offering
   * @param {string} offeringId - Course offering ID
   * @param {string} userId - User ID to assign as staff
   * @param {string} staffRole - Role: 'ta' or 'tutor'
   * @param {string} assignedBy - User ID who is making the assignment (for audit)
   */
  static async assignStaff(offeringId, userId, staffRole, assignedBy) {
    const staff = await CourseStaffModel.create({
      offering_id: offeringId,
      user_id: userId,
      staff_role: staffRole,
    });

    // Log the assignment
    await AuditService.logCourseStaffAssign(assignedBy, offeringId, userId, staffRole);

    return staff;
  }

  /**
   * Get all staff for a course offering
   */
  static async getOfferingStaff(offeringId) {
    return CourseStaffModel.findByOffering(offeringId);
  }

  /**
   * Get all courses where a user is staff
   */
  static async getUserStaffAssignments(userId) {
    return CourseStaffModel.findByUser(userId);
  }

  /**
   * Update staff role
   */
  static async updateStaffRole(staffId, newRole, updatedBy) {
    const staff = await CourseStaffModel.findById(staffId);
    if (!staff) {
      throw new Error('Course staff assignment not found');
    }

    const updated = await CourseStaffModel.update(staffId, newRole);

    // Log the role change
    await AuditService.logRoleChange(
      updatedBy,
      staff.user_id,
      staff.staff_role,
      newRole,
      'course'
    );

    return updated;
  }

  /**
   * Remove staff from course offering
   */
  static async removeStaff(offeringId, userId, removedBy) {
    const deleted = await CourseStaffModel.deleteByOfferingAndUser(offeringId, userId);
    
    if (deleted) {
      await AuditService.logActivity({
        userId: removedBy,
        offeringId,
        action: 'course.staff.removed',
        metadata: { removed_user_id: userId },
      });
    }

    return deleted;
  }

  /**
   * Bulk assign staff to a course
   */
  static async bulkAssignStaff(offeringId, assignments, assignedBy) {
    const results = {
      assigned: [],
      failed: [],
    };

    for (const assignment of assignments) {
      try {
        const staff = await this.assignStaff(
          offeringId,
          assignment.user_id,
          assignment.staff_role,
          assignedBy
        );
        results.assigned.push(staff);
      } catch (error) {
        results.failed.push({
          user_id: assignment.user_id,
          error: error.message,
        });
      }
    }

    return results;
  }
}

