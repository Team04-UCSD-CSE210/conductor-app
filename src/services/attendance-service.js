import { AttendanceModel } from '../models/attendance-model.js';
import { SessionModel } from '../models/session-model.js';
import { SessionResponseModel } from '../models/session-response-model.js';
import { SessionService } from './session-service.js';
import { pool } from '../db.js';

/**
 * Attendance Service - Business logic for attendance tracking
 */
export class AttendanceService {
  /**
   * Student check-in with access code
   */
  static async checkIn(accessCode, userId) {
    // Verify access code
    const verification = await SessionService.verifyAccessCode(accessCode);
    
    if (!verification.valid) {
      throw new Error(verification.message);
    }

    const session = verification.session;

    // Check if student is enrolled in the course
    const enrollmentCheck = await pool.query(
      `SELECT * FROM enrollments 
       WHERE user_id = $1 AND offering_id = $2 
       AND status = 'enrolled' AND course_role = 'student'`,
      [userId, session.offering_id]
    );

    if (enrollmentCheck.rows.length === 0) {
      throw new Error('You are not enrolled in this course');
    }

    // Check if already checked in
    const existing = await AttendanceModel.findBySessionAndUser(session.id, userId);
    
    if (existing) {
      // Update to present if was marked absent
      if (existing.status === 'absent') {
        return await AttendanceModel.update(existing.id, {
          status: 'present',
          checked_in_at: new Date(),
          access_code_used: accessCode
        });
      }
      
      return existing; // Already checked in
    }

    // Determine status (late if past certain time, otherwise present)
    let status = 'present';
    
    if (session.session_time) {
      const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
      const lateThreshold = new Date(sessionDateTime.getTime() + 15 * 60 * 1000); // 15 minutes
      
      if (new Date() > lateThreshold) {
        status = 'late';
      }
    }

    // Create attendance record
    return await AttendanceModel.create({
      session_id: session.id,
      user_id: userId,
      status,
      checked_in_at: new Date(),
      access_code_used: accessCode
    });
  }

  /**
   * Submit responses for a session
   */
  static async submitResponses(sessionId, userId, responses) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if student is enrolled
    const enrollmentCheck = await pool.query(
      `SELECT * FROM enrollments 
       WHERE user_id = $1 AND offering_id = $2 
       AND status = 'enrolled'`,
      [userId, session.offering_id]
    );

    if (enrollmentCheck.rows.length === 0) {
      throw new Error('You are not enrolled in this course');
    }

    // Submit responses - include session_id for each response
    const responsesWithUser = responses.map(r => ({
      ...r,
      user_id: userId,
      session_id: sessionId  // Include session_id for constraint matching
    }));

    return await SessionResponseModel.createMany(responsesWithUser);
  }

  /**
   * Get student's attendance records
   */
  static async getStudentAttendance(userId, offeringId = null) {
    const options = offeringId ? { offering_id: offeringId } : {};
    return await AttendanceModel.findByUserId(userId, options);
  }

  /**
   * Get attendance for a session
   */
  static async getSessionAttendance(sessionId, options = {}) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const attendance = await AttendanceModel.findBySessionId(sessionId, options);
    const stats = await AttendanceModel.getSessionStatistics(sessionId);

    return {
      session,
      attendance,
      statistics: stats
    };
  }

  /**
   * Mark attendance manually (professor/TA)
   */
  static async markAttendance(sessionId, userId, status) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if student is enrolled
    const enrollmentCheck = await pool.query(
      `SELECT * FROM enrollments 
       WHERE user_id = $1 AND offering_id = $2 
       AND status = 'enrolled' AND course_role = 'student'`,
      [userId, session.offering_id]
    );

    if (enrollmentCheck.rows.length === 0) {
      throw new Error('Student is not enrolled in this course');
    }

    // Create or update attendance
    return await AttendanceModel.upsert({
      session_id: sessionId,
      user_id: userId,
      status,
      checked_in_at: status === 'present' ? new Date() : null
    });
  }

  /**
   * Update attendance status
   */
  static async updateAttendanceStatus(attendanceId, status) {
    const attendance = await AttendanceModel.findById(attendanceId);
    
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    return await AttendanceModel.updateStatus(attendanceId, status);
  }

  /**
   * Get student attendance statistics
   */
  static async getStudentStatistics(userId, offeringId) {
    return await AttendanceModel.getUserStatistics(userId, offeringId);
  }

  /**
   * Get course attendance summary
   */
  static async getCourseAttendanceSummary(offeringId) {
    return await AttendanceModel.getCourseAttendanceSummary(offeringId);
  }

  /**
   * Mark all non-checked-in students as absent
   */
  static async closeSessionAndMarkAbsent(sessionId, userId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Mark remaining students as absent
    const absentStudents = await AttendanceModel.markAbsentStudents(sessionId);

    // Close attendance
    await SessionModel.closeAttendance(sessionId, userId);

    // Get updated session with closed timestamp
    const updatedSession = await SessionModel.findById(sessionId);

    return {
      session: updatedSession,
      markedAbsent: absentStudents.length,
      absentStudents
    };
  }

  /**
   * Get attendance report with responses
   */
  static async getAttendanceReport(sessionId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Get all enrolled students
    const studentsResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.ucsd_pid
       FROM enrollments e
       JOIN users u ON e.user_id = u.id
       WHERE e.offering_id = $1 
         AND e.status = 'enrolled'
         AND e.course_role = 'student'
       ORDER BY u.name ASC`,
      [session.offering_id]
    );

    const students = studentsResult.rows;

    // Get attendance for all students
    const attendanceRecords = await AttendanceModel.findBySessionId(sessionId);
    
    // Get responses for all students
    const responses = await SessionResponseModel.findBySessionId(sessionId);

    // Build report
    const report = students.map(student => {
      const attendance = attendanceRecords.find(a => a.user_id === student.id);
      const studentResponses = responses.filter(r => r.user_id === student.id);

      return {
        student,
        attendance: attendance || { status: 'absent' },
        responses: studentResponses,
        responseCount: studentResponses.length
      };
    });

    const stats = await AttendanceModel.getSessionStatistics(sessionId);

    return {
      session,
      report,
      statistics: stats
    };
  }

  /**
   * Delete attendance record
   */
  static async deleteAttendance(attendanceId) {
    const attendance = await AttendanceModel.findById(attendanceId);
    
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    return await AttendanceModel.delete(attendanceId);
  }

  /**
   * Bulk import attendance from CSV/array
   */
  static async bulkImportAttendance(sessionId, attendanceData) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results = [];
      
      for (const record of attendanceData) {
        // Find user by email or PID
        const userResult = await client.query(
          `SELECT id FROM users 
           WHERE email = $1 OR ucsd_pid = $2`,
          [record.email, record.ucsd_pid]
        );

        if (userResult.rows.length === 0) {
          results.push({
            ...record,
            status: 'error',
            message: 'User not found'
          });
          continue;
        }

        const userId = userResult.rows[0].id;

        // Create or update attendance
        const attendance = await AttendanceModel.upsert({
          session_id: sessionId,
          user_id: userId,
          status: record.status || 'present',
          checked_in_at: record.checked_in_at || new Date()
        });

        results.push({
          ...record,
          status: 'success',
          attendance
        });
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
}
