import { EnrollmentModel } from '../models/enrollment-model.js';
import { AuditService } from './audit-service.js';
import { pool } from '../db.js';

/**
 * Enrollment Service - Business logic layer for enrollment management
 * Handles CRUD operations with audit logging
 */
export class EnrollmentService {
  /**
   * Create a new enrollment with audit logging
   * @param {Object} enrollmentData - Enrollment data
   * @param {string} [createdBy] - User ID who is creating this enrollment (for audit)
   */
  static async createEnrollment(enrollmentData, createdBy = null) {
    // Check for duplicate enrollment
    const existing = await EnrollmentModel.findByOfferingAndUser(
      enrollmentData.offering_id,
      enrollmentData.user_id
    );
    if (existing) {
      throw new Error('User is already enrolled in this course');
    }

    // Verify offering exists
    const offeringCheck = await pool.query(
      'SELECT id FROM course_offerings WHERE id = $1::uuid',
      [enrollmentData.offering_id]
    );
    if (offeringCheck.rows.length === 0) {
      throw new Error('Course offering not found');
    }

    // Verify user exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1::uuid AND deleted_at IS NULL',
      [enrollmentData.user_id]
    );
    if (userCheck.rows.length === 0) {
      throw new Error('User not found');
    }

    const enrollment = await EnrollmentModel.create({
      ...enrollmentData,
      created_by: createdBy,
      updated_by: createdBy,
    });

    // Log the enrollment
    if (createdBy) {
      await AuditService.logActivity({
        userId: createdBy,
        offeringId: enrollmentData.offering_id,
        action: 'enroll',
        metadata: {
          enrollment_id: enrollment.id,
          user_id: enrollmentData.user_id,
          course_role: enrollment.course_role,
          status: enrollment.status,
        },
      });
    }

    return enrollment;
  }

  /**
   * Get enrollment by ID
   */
  static async getEnrollmentById(id) {
    const enrollment = await EnrollmentModel.findById(id);
    if (!enrollment) throw new Error('Enrollment not found');
    return enrollment;
  }

  /**
   * Get enrollment by offering and user
   * Returns null if not found (doesn't throw) - allows caller to handle gracefully
   */
  static async getEnrollmentByOfferingAndUser(offeringId, userId) {
    const enrollment = await EnrollmentModel.findByOfferingAndUser(offeringId, userId);
    return enrollment || null;
  }

  /**
   * Get all enrollments for a course offering
   */
  static async getEnrollmentsByOffering(offeringId, options = {}) {
    return EnrollmentModel.findByOffering(offeringId, options);
  }

  /**
   * Get all enrollments for a user
   */
  static async getEnrollmentsByUser(userId, options = {}) {
    return EnrollmentModel.findByUser(userId, options);
  }

  /**
   * Get course staff (TAs and tutors) for an offering
   */
  static async getCourseStaff(offeringId, options = {}) {
    // Get all enrollments for the offering (without course_role filter)
    const { course_role: _course_role, ...otherOptions } = options;
    const enrollments = await EnrollmentModel.findByOffering(offeringId, otherOptions);
    
    // Filter to only TAs and tutors
    return enrollments.filter(e => e.course_role === 'ta' || e.course_role === 'tutor');
  }

  /**
   * Get TAs for an offering
   */
  static async getTAs(offeringId, options = {}) {
    return EnrollmentModel.findByCourseRole(offeringId, 'ta', options);
  }

  /**
   * Get tutors for an offering
   */
  static async getTutors(offeringId, options = {}) {
    return EnrollmentModel.findByCourseRole(offeringId, 'tutor', options);
  }

  /**
   * Get students for an offering
   */
  static async getStudents(offeringId, options = {}) {
    return EnrollmentModel.findByCourseRole(offeringId, 'student', options);
  }

  /**
   * Update enrollment with audit logging
   */
  static async updateEnrollment(id, updateData, updatedBy = null) {
    const current = await EnrollmentModel.findById(id);
    if (!current) throw new Error('Enrollment not found');

    const updated = await EnrollmentModel.update(id, {
      ...updateData,
      updated_by: updatedBy,
    });

    // Log the update
    if (updatedBy) {
      await AuditService.logActivity({
        userId: updatedBy,
        offeringId: current.offering_id,
        action: 'enroll', // Using 'enroll' for enrollment updates
        metadata: {
          enrollment_id: id,
          changes: {
            course_role: updateData.course_role ? { from: current.course_role, to: updateData.course_role } : undefined,
            status: updateData.status ? { from: current.status, to: updateData.status } : undefined,
          },
        },
      });
    }

    return updated;
  }

  /**
   * Update course role (e.g., promote student to TA)
   */
  static async updateCourseRole(offeringId, userId, newRole, updatedBy = null) {
    const enrollment = await EnrollmentModel.findByOfferingAndUser(offeringId, userId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    return this.updateEnrollment(enrollment.id, { course_role: newRole }, updatedBy);
  }

  /**
   * Drop enrollment (set status to 'dropped')
   */
  static async dropEnrollment(offeringId, userId, droppedBy = null) {
    const enrollment = await EnrollmentModel.findByOfferingAndUser(offeringId, userId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    return this.updateEnrollment(
      enrollment.id,
      {
        status: 'dropped',
        dropped_at: new Date().toISOString().split('T')[0],
      },
      droppedBy
    );
  }

  /**
   * Delete enrollment (hard delete)
   */
  static async deleteEnrollment(id, deletedBy = null) {
    const enrollment = await EnrollmentModel.findById(id);
    if (!enrollment) throw new Error('Enrollment not found');

    const deleted = await EnrollmentModel.delete(id);

    // Log the deletion
    if (deletedBy) {
      await AuditService.logActivity({
        userId: deletedBy,
        offeringId: enrollment.offering_id,
        action: 'drop',
        metadata: {
          enrollment_id: id,
          user_id: enrollment.user_id,
          course_role: enrollment.course_role,
        },
      });
    }

    return deleted;
  }

  /**
   * Get enrollment statistics for an offering
   */
  static async getEnrollmentStats(offeringId) {
    const total = await EnrollmentModel.countByOffering(offeringId);
    const students = await EnrollmentModel.countByOffering(offeringId, { course_role: 'student' });
    const tas = await EnrollmentModel.countByOffering(offeringId, { course_role: 'ta' });
    const tutors = await EnrollmentModel.countByOffering(offeringId, { course_role: 'tutor' });
    const enrolled = await EnrollmentModel.countByOffering(offeringId, { status: 'enrolled' });
    const waitlisted = await EnrollmentModel.countByOffering(offeringId, { status: 'waitlisted' });
    const dropped = await EnrollmentModel.countByOffering(offeringId, { status: 'dropped' });
    const completed = await EnrollmentModel.countByOffering(offeringId, { status: 'completed' });

    return {
      total,
      by_role: {
        students,
        tas,
        tutors,
      },
      by_status: {
        enrolled,
        waitlisted,
        dropped,
        completed,
      },
    };
  }
}

