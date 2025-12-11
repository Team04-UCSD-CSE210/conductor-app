import { pool } from '../db.js';

/**
 * Attendance Model - CRUD operations for attendance table
 */
export class AttendanceModel {
  /**
   * Create attendance record (student check-in)
   */
  static async create(attendanceData) {
    const {
      session_id,
      user_id,
      status,
      checked_in_at = new Date(),
      access_code_used
    } = attendanceData;

    const result = await pool.query(
      `INSERT INTO attendance 
       (session_id, user_id, status, checked_in_at, access_code_used)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session_id, user_id, status, checked_in_at, access_code_used]
    );

    return result.rows[0];
  }

  /**
   * Create or update attendance (upsert)
   */
  static async upsert(attendanceData) {
    const {
      session_id,
      user_id,
      status,
      checked_in_at = new Date(),
      access_code_used
    } = attendanceData;

    const result = await pool.query(
      `INSERT INTO attendance 
       (session_id, user_id, status, checked_in_at, access_code_used)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id, user_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         checked_in_at = EXCLUDED.checked_in_at,
         access_code_used = EXCLUDED.access_code_used,
         updated_at = NOW()
       RETURNING *`,
      [session_id, user_id, status, checked_in_at, access_code_used]
    );

    return result.rows[0];
  }

  /**
   * Get attendance by ID
   */
  static async findById(attendanceId) {
    const result = await pool.query(
      `SELECT a.*,
              s.title as session_title,
              s.session_date,
              u.name as user_name,
              u.email as user_email
       FROM attendance a
       LEFT JOIN sessions s ON a.session_id = s.id
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [attendanceId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get attendance for a specific session and user
   */
  static async findBySessionAndUser(sessionId, userId) {
    const result = await pool.query(
      `SELECT a.*,
              s.title as session_title,
              s.session_date
       FROM attendance a
       LEFT JOIN sessions s ON a.session_id = s.id
       WHERE a.session_id = $1 AND a.user_id = $2`,
      [sessionId, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all attendance records for a session
   */
  static async findBySessionId(sessionId, options = {}) {
    const { status, limit = 100, offset = 0 } = options;

    let query = `
      SELECT a.*,
             u.name as user_name,
             u.email as user_email,
             u.ucsd_pid
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.session_id = $1
    `;

    const params = [sessionId];
    let paramIndex = 2;

    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += `
      ORDER BY a.checked_in_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get all attendance records for a user
   */
  static async findByUserId(userId, options = {}) {
    const { offering_id, status, limit = 50, offset = 0 } = options;

    let query = `
      SELECT a.*,
             s.title as session_title,
             s.session_date,
             s.offering_id,
             co.name as course_name,
             co.code as course_code
      FROM attendance a
      LEFT JOIN sessions s ON a.session_id = s.id
      LEFT JOIN course_offerings co ON s.offering_id = co.id
      WHERE a.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (offering_id) {
      query += ` AND s.offering_id = $${paramIndex}`;
      params.push(offering_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += `
      ORDER BY s.session_date DESC, a.checked_in_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update attendance status
   */
  static async updateStatus(attendanceId, status) {
    const result = await pool.query(
      `UPDATE attendance
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [attendanceId, status]
    );

    return result.rows[0] || null;
  }

  /**
   * Update attendance record
   */
  static async update(attendanceId, updates) {
    const allowedFields = new Set(['status', 'checked_in_at', 'access_code_used']);

    const setFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.has(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(attendanceId);

    const query = `
      UPDATE attendance
      SET ${setFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete attendance record
   */
  static async delete(attendanceId) {
    const result = await pool.query(
      `DELETE FROM attendance WHERE id = $1 RETURNING *`,
      [attendanceId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get attendance statistics for a session
   */
  static async getSessionStatistics(sessionId) {
    const result = await pool.query(
      `SELECT 
         s.id as session_id,
         s.title,
         s.session_date,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'present')::INTEGER as present_count,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'absent')::INTEGER as absent_count,
         0::INTEGER as late_count,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'excused')::INTEGER as excused_count,
         COUNT(DISTINCT a.user_id)::INTEGER as total_marked,
         (SELECT COUNT(*)::INTEGER FROM enrollments 
          WHERE offering_id = s.offering_id 
          AND status = 'enrolled' 
          AND (course_role = 'student' OR course_role = 'team-lead')) as total_enrolled,
         ROUND(
           COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'present')::NUMERIC / 
           NULLIF((SELECT COUNT(*) FROM enrollments 
                   WHERE offering_id = s.offering_id 
                   AND status = 'enrolled' 
                   AND (course_role = 'student' OR course_role = 'team-lead')), 0) * 100,
           2
         )::FLOAT as attendance_percentage
       FROM sessions s
       LEFT JOIN attendance a ON s.id = a.session_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [sessionId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get attendance statistics for multiple sessions (batch)
   * Returns an object with session_id as keys
   */
  static async getBatchSessionStatistics(sessionIds) {
    if (!sessionIds || sessionIds.length === 0) {
      return {};
    }

    const result = await pool.query(
      `SELECT 
         s.id as session_id,
         s.title,
         s.session_date,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'present')::INTEGER as present_count,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'absent')::INTEGER as absent_count,
         0::INTEGER as late_count,
         COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'excused')::INTEGER as excused_count,
         COUNT(DISTINCT a.user_id)::INTEGER as total_marked
       FROM sessions s
       LEFT JOIN attendance a ON s.id = a.session_id
       WHERE s.id = ANY($1::UUID[])
       GROUP BY s.id`,
      [sessionIds]
    );

    // Convert array to object with session_id as key
    const statsMap = {};
    for (const row of result.rows) {
      statsMap[row.session_id] = row;
    }

    return statsMap;
  }

  /**
   * Get attendance statistics for a user in a course
   */
  static async getUserStatistics(userId, offeringId) {
    // Use a CTE-based approach to calculate lecture and team meeting stats separately
    const result = await pool.query(
      `WITH lecture_stats AS (
        SELECT 
          COUNT(DISTINCT s.id)::INTEGER as total_lecture_sessions,
          COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'present')::INTEGER as lecture_sessions_present,
          COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'absent')::INTEGER as lecture_sessions_absent,
          COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'excused')::INTEGER as lecture_sessions_excused,
          ROUND(
            COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'present')::NUMERIC / 
            NULLIF(COUNT(DISTINCT s.id), 0) * 100,
            2
          )::FLOAT as lecture_percentage
        FROM users u
        CROSS JOIN sessions s
        LEFT JOIN attendance a ON s.id = a.session_id AND a.user_id = u.id
        WHERE u.id = $1 AND s.offering_id = $2 AND s.team_id IS NULL
      ),
      team_meeting_stats AS (
        SELECT 
          COUNT(DISTINCT s.id)::INTEGER as total_team_meetings,
          COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'present')::INTEGER as team_meeting_sessions_present,
          COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'absent')::INTEGER as team_meeting_sessions_absent,
          COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'excused')::INTEGER as team_meeting_sessions_excused,
          ROUND(
            COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'present')::NUMERIC / 
            NULLIF(COUNT(DISTINCT s.id), 0) * 100,
            2
          )::FLOAT as team_meeting_percentage
        FROM users u
        INNER JOIN team_members tm ON u.id = tm.user_id AND tm.left_at IS NULL
        INNER JOIN sessions s ON s.team_id = tm.team_id AND s.offering_id = $2
        LEFT JOIN attendance a ON s.id = a.session_id AND a.user_id = u.id
        WHERE u.id = $1 AND s.team_id IS NOT NULL
      )
      SELECT 
        $1::UUID as user_id,
        u.name as user_name,
        COALESCE(ls.total_lecture_sessions, 0) as total_sessions,
        COALESCE(ls.lecture_sessions_present, 0) as sessions_present,
        COALESCE(ls.lecture_sessions_absent, 0) as sessions_absent,
        0::INTEGER as sessions_late,
        COALESCE(ls.lecture_sessions_excused, 0) as sessions_excused,
        COALESCE(ls.lecture_percentage, 0)::FLOAT as attendance_percentage,
        COALESCE(ls.lecture_percentage, 0)::FLOAT as lecture_percentage,
        COALESCE(tms.team_meeting_percentage, 0)::FLOAT as team_meeting_percentage
      FROM users u
      CROSS JOIN lecture_stats ls
      LEFT JOIN team_meeting_stats tms ON true
      WHERE u.id = $1
      LIMIT 1`,
      [userId, offeringId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get attendance summary for all students in a course
   */
  static async getCourseAttendanceSummary(offeringId) {
    const result = await pool.query(
      `SELECT 
         u.id as user_id,
         u.name as user_name,
         u.email as user_email,
         u.ucsd_pid,
         COUNT(DISTINCT s.id) as total_sessions,
         COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'present') as sessions_present,
         COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'absent') as sessions_absent,
         0 as sessions_late,
         COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'excused') as sessions_excused,
         ROUND(
           COUNT(DISTINCT a.session_id) FILTER (WHERE a.status = 'present')::NUMERIC / 
           NULLIF(COUNT(DISTINCT s.id), 0) * 100,
           2
         ) as attendance_percentage
       FROM enrollments e
       JOIN users u ON e.user_id = u.id
       CROSS JOIN sessions s
       LEFT JOIN attendance a ON s.id = a.session_id AND a.user_id = u.id
       WHERE e.offering_id = $1 
         AND e.status = 'enrolled'
         AND (e.course_role = 'student' OR e.course_role = 'team-lead')
         AND s.offering_id = $1
       GROUP BY u.id
       ORDER BY u.name ASC`,
      [offeringId]
    );

    return result.rows;
  }

  /**
   * Mark absent students for a session
   */
  static async markAbsentStudents(sessionId) {
    const result = await pool.query(
      `INSERT INTO attendance (session_id, user_id, status)
       SELECT $1, e.user_id, 'absent'
       FROM enrollments e
       JOIN sessions s ON e.offering_id = s.offering_id
       WHERE s.id = $1
         AND e.status = 'enrolled'
         AND (e.course_role = 'student' OR e.course_role = 'team-lead')
         AND NOT EXISTS (
           SELECT 1 FROM attendance a 
           WHERE a.session_id = $1 AND a.user_id = e.user_id
         )
       RETURNING *`,
      [sessionId]
    );

    return result.rows;
  }
}
