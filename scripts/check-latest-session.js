import 'dotenv/config';
import { pool } from '../src/db.js';

async function getLatestSession() {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.session_date,
        s.session_time,
        s.access_code,
        s.attendance_opened_at,
        s.attendance_closed_at,
        s.created_at,
        s.updated_at,
        co.code as course_code,
        co.name as course_name,
        co.term,
        co.year,
        u.name as created_by_name,
        u.email as created_by_email
      FROM sessions s
      LEFT JOIN course_offerings co ON s.offering_id = co.id
      LEFT JOIN users u ON s.created_by = u.id
      ORDER BY s.created_at DESC
      LIMIT 5
    `);

    if (result.rows.length === 0) {
      console.log('No sessions found in the database.');
      return;
    }

    console.log('\n=== Latest Sessions (Most Recent First) ===\n');
    
    result.rows.forEach((session, index) => {
      console.log(`Session ${index + 1}:`);
      console.log(`  ID: ${session.id}`);
      console.log(`  Title: ${session.title || 'N/A'}`);
      console.log(`  Description: ${session.description || 'N/A'}`);
      console.log(`  Date: ${session.session_date}`);
      console.log(`  Time: ${session.session_time || 'N/A'}`);
      console.log(`  Access Code: ${session.access_code}`);
      console.log(`  Course: ${session.course_code || 'N/A'} - ${session.course_name || 'N/A'} (${session.term || 'N/A'} ${session.year || 'N/A'})`);
      console.log(`  Attendance Opened: ${session.attendance_opened_at || 'Not opened'}`);
      console.log(`  Attendance Closed: ${session.attendance_closed_at || 'Not closed'}`);
      console.log(`  Created At: ${session.created_at}`);
      console.log(`  Created By: ${session.created_by_name || 'N/A'} (${session.created_by_email || 'N/A'})`);
      console.log('');
    });

    // Get attendance stats for the latest session
    if (result.rows.length > 0) {
      const latestSession = result.rows[0];
      const attendanceStats = await pool.query(`
        SELECT 
          COUNT(*) as total_attendance,
          COUNT(*) FILTER (WHERE status = 'present') as present_count,
          COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
          COUNT(*) FILTER (WHERE status = 'excused') as excused_count
        FROM attendance
        WHERE session_id = $1
      `, [latestSession.id]);

      const stats = attendanceStats.rows[0];
      console.log('=== Attendance Statistics for Latest Session ===');
      console.log(`  Total Records: ${stats.total_attendance}`);
      console.log(`  Present: ${stats.present_count}`);
      console.log(`  Absent: ${stats.absent_count}`);
      console.log(`  Excused: ${stats.excused_count}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await pool.end();
  }
}

getLatestSession();

