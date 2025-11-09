import { pool } from '../db.js';

/**
 * CourseStaff Model - Handles course staff assignments (TA, Tutor, Grader)
 * Manages the relationship between users and course offerings for staff roles
 */
export class CourseStaffModel {
  /**
   * Validate course staff data
   */
  static validate(data) {
    const errors = [];
    const validRoles = ['ta', 'tutor', 'grader'];
    
    if (!data.offering_id) {
      errors.push('offering_id is required');
    }
    if (!data.user_id) {
      errors.push('user_id is required');
    }
    if (!data.staff_role || !validRoles.includes(data.staff_role)) {
      errors.push(`staff_role must be one of: ${validRoles.join(', ')}`);
    }
    
    return errors;
  }

  /**
   * Create a course staff assignment
   */
  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) {
      throw new Error(errors.join(', '));
    }

    const query = `
      INSERT INTO course_staff (offering_id, user_id, staff_role)
      VALUES ($1::uuid, $2::uuid, $3::staff_role_enum)
      ON CONFLICT (offering_id, user_id) 
      DO UPDATE SET 
        staff_role = EXCLUDED.staff_role,
        updated_at = NOW()
      RETURNING id, offering_id, user_id, staff_role, created_at, updated_at
    `;

    const { rows } = await pool.query(query, [
      data.offering_id,
      data.user_id,
      data.staff_role,
    ]);

    return rows[0];
  }

  /**
   * Find course staff by ID
   */
  static async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, offering_id, user_id, staff_role, created_at, updated_at
       FROM course_staff WHERE id = $1::uuid`,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Find all staff for a course offering
   */
  static async findByOffering(offeringId) {
    const { rows } = await pool.query(
      `SELECT cs.id, cs.offering_id, cs.user_id, cs.staff_role, cs.created_at, cs.updated_at,
              u.name, u.email, u.role as user_role
       FROM course_staff cs
       INNER JOIN users u ON cs.user_id = u.id
       WHERE cs.offering_id = $1::uuid AND u.deleted_at IS NULL
       ORDER BY cs.staff_role, u.name`,
      [offeringId]
    );
    return rows;
  }

  /**
   * Find all courses where a user is staff
   */
  static async findByUser(userId) {
    const { rows } = await pool.query(
      `SELECT cs.id, cs.offering_id, cs.user_id, cs.staff_role, cs.created_at, cs.updated_at,
              co.term, co.year, ct.code as course_code, ct.name as course_name
       FROM course_staff cs
       INNER JOIN course_offerings co ON cs.offering_id = co.id
       INNER JOIN course_template ct ON co.template_id = ct.id
       WHERE cs.user_id = $1::uuid
       ORDER BY co.year DESC, co.term DESC`,
      [userId]
    );
    return rows;
  }

  /**
   * Update course staff role
   */
  static async update(id, staffRole) {
    const validRoles = ['ta', 'tutor', 'grader'];
    if (!validRoles.includes(staffRole)) {
      throw new Error(`Invalid staff_role. Must be one of: ${validRoles.join(', ')}`);
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE course_staff 
       SET staff_role = $1::staff_role_enum, updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING id, offering_id, user_id, staff_role, created_at, updated_at`,
      [staffRole, id]
    );

    if (rowCount === 0) {
      throw new Error('Course staff assignment not found');
    }

    return rows[0];
  }

  /**
   * Delete course staff assignment
   */
  static async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM course_staff WHERE id = $1::uuid',
      [id]
    );
    return rowCount > 0;
  }

  /**
   * Delete course staff assignment by offering and user
   */
  static async deleteByOfferingAndUser(offeringId, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM course_staff WHERE offering_id = $1::uuid AND user_id = $2::uuid',
      [offeringId, userId]
    );
    return rowCount > 0;
  }

  /**
   * Get staff count for an offering
   */
  static async countByOffering(offeringId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count 
       FROM course_staff 
       WHERE offering_id = $1::uuid`,
      [offeringId]
    );
    return rows[0].count;
  }
}

