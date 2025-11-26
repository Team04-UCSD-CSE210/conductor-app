/**
 * Meeting Attendance Views Integration Tests
 * 
 * Tests for different user perspectives on meeting attendance:
 * - Student view: See their own attendance across all team meetings
 * - Team Leader view: See team's attendance, manage meetings, check in
 * - Instructor view: See all teams' meetings and attendance statistics
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { pool } from '../db.js';

describe('Meeting Attendance Views Integration', () => {
  let testOffering;
  let instructor;
  let teamLeader;
  let teamMember1;
  let teamMember2;
  let studentWithoutTeam;
  let team;
  let pastSession;
  let openSession;
  let futureSession;
  let adminId;

  beforeAll(async () => {
    // Get or create admin user
    let adminResult = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@ucsd.edu' AND deleted_at IS NULL LIMIT 1"
    );
    
    if (adminResult.rows.length === 0) {
      adminResult = await pool.query(
        `INSERT INTO users (email, name, primary_role, status)
         VALUES ('admin@ucsd.edu', 'Test Admin', 'admin', 'active')
         RETURNING id`
      );
    }
    adminId = adminResult.rows[0].id;

    // Create test offering with unique code
    const uniqueCode = `ATTVIEW-${Date.now()}`;
    const offeringResult = await pool.query(
      `INSERT INTO course_offerings (name, code, term, year, instructor_id, start_date, end_date, created_by, updated_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $5, TRUE)
       RETURNING *`,
      ['Attendance Views Test', uniqueCode, 'Fall', 2025, adminId, '2025-09-01', '2025-12-15']
    );
    testOffering = offeringResult.rows[0];

    // Create instructor
    const instructorResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `instructor-views-${Date.now()}@test.edu`,
        'Instructor Views',
        'instructor',
        'active',
        adminId
      ]
    );
    instructor = instructorResult.rows[0];

    // Create team leader
    const teamLeaderResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `teamleader-views-${Date.now()}@test.edu`,
        'Team Leader Views',
        'student',
        'active',
        adminId
      ]
    );
    teamLeader = teamLeaderResult.rows[0];

    // Create team members
    const member1Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `member1-views-${Date.now()}@test.edu`,
        'Team Member 1',
        'student',
        'active',
        adminId
      ]
    );
    teamMember1 = member1Result.rows[0];

    const member2Result = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `member2-views-${Date.now()}@test.edu`,
        'Team Member 2',
        'student',
        'active',
        adminId
      ]
    );
    teamMember2 = member2Result.rows[0];

    // Create student without team
    const studentResult = await pool.query(
      `INSERT INTO users (email, name, primary_role, status, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        `student-noteam-${Date.now()}@test.edu`,
        'Student No Team',
        'student',
        'active',
        adminId
      ]
    );
    studentWithoutTeam = studentResult.rows[0];

    // Create team
    const teamResult = await pool.query(
      `INSERT INTO team (offering_id, name, team_number, leader_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [testOffering.id, 'Attendance Test Team', 11, teamLeader.id, adminId]
    );
    team = teamResult.rows[0];

    // Add team members
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4), ($1, $5, $6, $4), ($1, $7, $6, $4)`,
      [team.id, teamLeader.id, 'leader', adminId, teamMember1.id, 'member', teamMember2.id]
    );

    // Enroll all team members in the offering (use ON CONFLICT due to auto-enrollment trigger)
    await pool.query(
      `INSERT INTO enrollments (user_id, offering_id, course_role, status, created_by)
       VALUES ($1, $2, $3, $4, $5), ($6, $2, $3, $4, $5), ($7, $2, $3, $4, $5)
       ON CONFLICT (offering_id, user_id) DO NOTHING`,
      [teamLeader.id, testOffering.id, 'student', 'enrolled', adminId, teamMember1.id, teamMember2.id]
    );

    // Create past session (closed)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    const pastSessionResult = await pool.query(
      `INSERT INTO sessions (
        offering_id, team_id, title, description, 
        session_date, session_time, created_by, updated_by, access_code,
        attendance_opened_at, attendance_closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)
      RETURNING *`,
      [
        testOffering.id,
        team.id,
        'Past Team Meeting',
        'This meeting has ended',
        pastDateStr,
        '14:00:00',
        teamLeader.id,
        'PAST001',
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000)
      ]
    );
    pastSession = pastSessionResult.rows[0];

    // Add attendance records for past session
    await pool.query(
      `INSERT INTO attendance (session_id, user_id, status, checked_in_at)
       VALUES ($1, $2, $3, NOW()), ($1, $4, $5, NOW())`,
      [pastSession.id, teamLeader.id, 'present', teamMember1.id, 'present']
    );
    // teamMember2 was absent (no record)

    // Create currently open session
    const todayStr = new Date().toISOString().split('T')[0];
    const openSessionResult = await pool.query(
      `INSERT INTO sessions (
        offering_id, team_id, title, description, 
        session_date, session_time, created_by, updated_by, access_code,
        attendance_opened_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)
      RETURNING *`,
      [
        testOffering.id,
        team.id,
        'Current Team Meeting',
        'This meeting is open now',
        todayStr,
        '15:00:00',
        teamLeader.id,
        'OPEN001',
        new Date()
      ]
    );
    openSession = openSessionResult.rows[0];

    // Add one attendance record for open session
    await pool.query(
      `INSERT INTO attendance (session_id, user_id, status, checked_in_at)
       VALUES ($1, $2, $3, NOW())`,
      [openSession.id, teamMember1.id, 'present']
    );

    // Create future session (pending)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // Use 7 days to ensure it's definitely in future
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const futureSessionResult = await pool.query(
      `INSERT INTO sessions (
        offering_id, team_id, title, description, 
        session_date, session_time, created_by, updated_by, access_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
      RETURNING *`,
      [
        testOffering.id,
        team.id,
        'Future Team Meeting',
        'This meeting hasnt started yet',
        futureDateStr,
        '23:59:00', // Late time to ensure it's in future
        teamLeader.id,
        'FUTURE01'
      ]
    );
    futureSession = futureSessionResult.rows[0];
  });

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    if (pastSession) {
      await pool.query('DELETE FROM attendance WHERE session_id = $1', [pastSession.id]);
    }
    if (openSession) {
      await pool.query('DELETE FROM attendance WHERE session_id = $1', [openSession.id]);
    }

    const sessionIds = [pastSession?.id, openSession?.id, futureSession?.id].filter(Boolean);
    if (sessionIds.length > 0) {
      await pool.query('DELETE FROM sessions WHERE id = ANY($1::uuid[])', [sessionIds]);
    }

    if (team) {
      await pool.query('DELETE FROM enrollments WHERE offering_id = $1', [testOffering.id]);
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [team.id]);
      await pool.query('DELETE FROM team WHERE id = $1', [team.id]);
    }

    const userIds = [
      instructor?.id,
      teamLeader?.id,
      teamMember1?.id,
      teamMember2?.id,
      studentWithoutTeam?.id
    ].filter(Boolean);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }

    if (testOffering) {
      await pool.query('DELETE FROM course_offerings WHERE id = $1', [testOffering.id]);
    }
  });

  describe('Student Meeting Attendance View', () => {
    
    it('should retrieve all team sessions for a team member', async () => {
      const sessions = await pool.query(
        `SELECT s.* FROM sessions s
         INNER JOIN team_members tm ON s.team_id = tm.team_id
         WHERE tm.user_id = $1 AND s.offering_id = $2
         ORDER BY s.session_date DESC, s.session_time DESC`,
        [teamMember1.id, testOffering.id]
      );

      expect(sessions.rows.length).toBe(3);
      expect(sessions.rows.some(s => s.id === pastSession.id)).toBeTruthy();
      expect(sessions.rows.some(s => s.id === openSession.id)).toBeTruthy();
      expect(sessions.rows.some(s => s.id === futureSession.id)).toBeTruthy();
    });

    it('should show student their own attendance status for each meeting', async () => {
      const attendanceRecords = await pool.query(
        `SELECT s.id as session_id, s.title, a.status, a.checked_in_at
         FROM sessions s
         INNER JOIN team_members tm ON s.team_id = tm.team_id
         LEFT JOIN attendance a ON s.id = a.session_id AND a.user_id = tm.user_id
         WHERE tm.user_id = $1 AND s.offering_id = $2
         ORDER BY s.session_date DESC`,
        [teamMember1.id, testOffering.id]
      );

      expect(attendanceRecords.rows.length).toBe(3);
      
      // Check past meeting - should show present
      const pastRecord = attendanceRecords.rows.find(r => r.session_id === pastSession.id);
      expect(pastRecord.status).toBe('present');
      expect(pastRecord.checked_in_at).toBeTruthy();

      // Check open meeting - should show present
      const openRecord = attendanceRecords.rows.find(r => r.session_id === openSession.id);
      expect(openRecord.status).toBe('present');

      // Check future meeting - no attendance yet
      const futureRecord = attendanceRecords.rows.find(r => r.session_id === futureSession.id);
      expect(futureRecord.status).toBeNull();
    });

    it('should show absent status when student has no attendance record for closed meeting', async () => {
      const attendanceRecords = await pool.query(
        `SELECT s.id as session_id, s.title, 
                COALESCE(a.status, 'absent') as status
         FROM sessions s
         INNER JOIN team_members tm ON s.team_id = tm.team_id
         LEFT JOIN attendance a ON s.id = a.session_id AND a.user_id = tm.user_id
         WHERE tm.user_id = $1 AND s.id = $2`,
        [teamMember2.id, pastSession.id]
      );

      expect(attendanceRecords.rows.length).toBe(1);
      expect(attendanceRecords.rows[0].status).toBe('absent');
    });

    it('should calculate student overall attendance percentage', async () => {
      // Get closed meetings count and present count for teamMember1
      const stats = await pool.query(
        `SELECT 
           COUNT(DISTINCT s.id) as total_closed_meetings,
           COUNT(DISTINCT CASE WHEN a.status = 'present' THEN s.id END) as attended_meetings
         FROM sessions s
         INNER JOIN team_members tm ON s.team_id = tm.team_id
         LEFT JOIN attendance a ON s.id = a.session_id AND a.user_id = tm.user_id
         WHERE tm.user_id = $1 
           AND s.offering_id = $2
           AND s.attendance_closed_at IS NOT NULL`,
        [teamMember1.id, testOffering.id]
      );

      const { total_closed_meetings, attended_meetings } = stats.rows[0];
      expect(parseInt(total_closed_meetings)).toBe(1); // Only pastSession is closed
      expect(parseInt(attended_meetings)).toBe(1); // teamMember1 attended
      
      const percentage = Math.round((attended_meetings / total_closed_meetings) * 100);
      expect(percentage).toBe(100);
    });

    it('should return empty list for student not in any team', async () => {
      const sessions = await pool.query(
        `SELECT s.* FROM sessions s
         INNER JOIN team_members tm ON s.team_id = tm.team_id
         WHERE tm.user_id = $1 AND s.offering_id = $2`,
        [studentWithoutTeam.id, testOffering.id]
      );

      expect(sessions.rows.length).toBe(0);
    });

    it('should allow student to check in to open meeting', async () => {
      // Verify meeting is open
      const sessionCheck = await pool.query(
        `SELECT attendance_opened_at, attendance_closed_at 
         FROM sessions WHERE id = $1`,
        [openSession.id]
      );
      
      expect(sessionCheck.rows[0].attendance_opened_at).toBeTruthy();
      expect(sessionCheck.rows[0].attendance_closed_at).toBeNull();

      // Check in teamMember2 (who hasn't checked in yet)
      const checkInResult = await pool.query(
        `INSERT INTO attendance (session_id, user_id, status, checked_in_at)
         VALUES ($1, $2, 'present', NOW())
         ON CONFLICT (session_id, user_id) 
         DO UPDATE SET status = 'present', checked_in_at = NOW()
         RETURNING *`,
        [openSession.id, teamMember2.id]
      );

      expect(checkInResult.rows.length).toBe(1);
      expect(checkInResult.rows[0].status).toBe('present');
    });
  });

  describe('Team Leader Meeting Attendance View', () => {
    
    it('should retrieve all team sessions created by team leader', async () => {
      const sessions = await pool.query(
        `SELECT * FROM sessions 
         WHERE team_id = $1 AND offering_id = $2
         ORDER BY session_date DESC`,
        [team.id, testOffering.id]
      );

      expect(sessions.rows.length).toBe(3);
      sessions.rows.forEach(session => {
        expect(session.created_by).toBe(teamLeader.id);
      });
    });

    it('should show team leader their team average attendance', async () => {
      const teamSize = await pool.query(
        `SELECT COUNT(*) as count FROM team_members WHERE team_id = $1`,
        [team.id]
      );

      const attendanceStats = await pool.query(
        `SELECT 
           COUNT(DISTINCT s.id) as total_closed_meetings,
           COUNT(DISTINCT a.id) as total_present
         FROM sessions s
         LEFT JOIN attendance a ON s.id = a.session_id AND a.status = 'present'
         WHERE s.team_id = $1 
           AND s.attendance_closed_at IS NOT NULL`,
        [team.id]
      );

      const teamMemberCount = parseInt(teamSize.rows[0].count);
      const closedMeetings = parseInt(attendanceStats.rows[0].total_closed_meetings);
      const totalPresent = parseInt(attendanceStats.rows[0].total_present);
      
      expect(teamMemberCount).toBe(3);
      expect(closedMeetings).toBe(1); // Only pastSession is closed
      expect(totalPresent).toBe(2); // teamLeader and teamMember1 attended
      
      const percentage = Math.round((totalPresent / (teamMemberCount * closedMeetings)) * 100);
      expect(percentage).toBe(67); // 2 out of 3 attended = 67%
    });

    it('should show team leader their individual attendance', async () => {
      const leaderAttendance = await pool.query(
        `SELECT 
           COUNT(DISTINCT s.id) as total_closed,
           COUNT(DISTINCT CASE WHEN a.status = 'present' THEN s.id END) as attended
         FROM sessions s
         LEFT JOIN attendance a ON s.id = a.session_id AND a.user_id = $1
         WHERE s.team_id = $2 
           AND s.attendance_closed_at IS NOT NULL`,
        [teamLeader.id, team.id]
      );

      const { total_closed, attended } = leaderAttendance.rows[0];
      expect(parseInt(total_closed)).toBe(1);
      expect(parseInt(attended)).toBe(1);
      
      const percentage = Math.round((attended / total_closed) * 100);
      expect(percentage).toBe(100);
    });

    it('should show meeting status based on timestamps and scheduled time', async () => {
      const now = new Date();

      // Past session should be closed
      const pastCheck = await pool.query(
        `SELECT 
           session_date, session_time, 
           attendance_opened_at, attendance_closed_at
         FROM sessions WHERE id = $1`,
        [pastSession.id]
      );
      
      expect(pastCheck.rows[0].attendance_closed_at).toBeTruthy();
      expect(new Date(pastCheck.rows[0].attendance_closed_at) < now).toBeTruthy();

      // Open session should be open (has opened_at but no closed_at)
      const openCheck = await pool.query(
        `SELECT 
           session_date, session_time, 
           attendance_opened_at, attendance_closed_at
         FROM sessions WHERE id = $1`,
        [openSession.id]
      );
      
      expect(openCheck.rows[0].attendance_opened_at).toBeTruthy();
      expect(openCheck.rows[0].attendance_closed_at).toBeNull();

      // Future session should be pending (no opened_at, no closed_at)
      const futureCheck = await pool.query(
        `SELECT session_date, session_time, attendance_opened_at, attendance_closed_at 
         FROM sessions WHERE id = $1`,
        [futureSession.id]
      );
      
      expect(futureCheck.rows[0].attendance_opened_at).toBeNull();
      expect(futureCheck.rows[0].attendance_closed_at).toBeNull();
    });

    it('should allow team leader to open attendance for their meeting', async () => {
      // Open attendance for future session
      const openResult = await pool.query(
        `UPDATE sessions 
         SET attendance_opened_at = NOW()
         WHERE id = $1 AND created_by = $2
         RETURNING *`,
        [futureSession.id, teamLeader.id]
      );

      expect(openResult.rows.length).toBe(1);
      expect(openResult.rows[0].attendance_opened_at).toBeTruthy();

      // Reset for other tests
      await pool.query(
        `UPDATE sessions SET attendance_opened_at = NULL WHERE id = $1`,
        [futureSession.id]
      );
    });

    it('should allow team leader to close attendance for their meeting', async () => {
      // Close attendance for open session
      const closeResult = await pool.query(
        `UPDATE sessions 
         SET attendance_closed_at = NOW()
         WHERE id = $1 AND created_by = $2
         RETURNING *`,
        [openSession.id, teamLeader.id]
      );

      expect(closeResult.rows.length).toBe(1);
      expect(closeResult.rows[0].attendance_closed_at).toBeTruthy();

      // Reset for other tests
      await pool.query(
        `UPDATE sessions SET attendance_closed_at = NULL WHERE id = $1`,
        [openSession.id]
      );
    });

    it('should show attendance count for each meeting', async () => {
      const meetingStats = await pool.query(
        `SELECT 
           s.id, s.title,
           COUNT(a.id) FILTER (WHERE a.status = 'present') as present_count,
           (SELECT COUNT(*) FROM team_members WHERE team_id = s.team_id) as team_size
         FROM sessions s
         LEFT JOIN attendance a ON s.id = a.session_id
         WHERE s.team_id = $1
         GROUP BY s.id, s.title, s.team_id
         ORDER BY s.session_date DESC`,
        [team.id]
      );

      expect(meetingStats.rows.length).toBe(3);

      // Past session: 2 present (teamLeader, teamMember1)
      const pastStats = meetingStats.rows.find(r => r.id === pastSession.id);
      expect(parseInt(pastStats.present_count)).toBe(2);
      expect(parseInt(pastStats.team_size)).toBe(3);

      // Open session: 2 present (teamMember1 + teamMember2 from check-in test)
      const openStats = meetingStats.rows.find(r => r.id === openSession.id);
      expect(parseInt(openStats.present_count)).toBeGreaterThanOrEqual(1);

      // Future session: 0 present
      const futureStats = meetingStats.rows.find(r => r.id === futureSession.id);
      expect(parseInt(futureStats.present_count)).toBe(0);
    });
  });

  describe('Instructor Meeting Attendance View', () => {
    
    it('should retrieve all teams in the offering', async () => {
      const teams = await pool.query(
        `SELECT t.*, COUNT(tm.user_id) as member_count
         FROM team t
         LEFT JOIN team_members tm ON t.id = tm.team_id
         WHERE t.offering_id = $1
         GROUP BY t.id
         ORDER BY t.team_number`,
        [testOffering.id]
      );

      expect(teams.rows.length).toBeGreaterThanOrEqual(1);
      const testTeam = teams.rows.find(t => t.id === team.id);
      expect(testTeam).toBeTruthy();
      expect(parseInt(testTeam.member_count)).toBe(3);
    });

    it('should retrieve all sessions for a specific team', async () => {
      const sessions = await pool.query(
        `SELECT * FROM sessions 
         WHERE team_id = $1 AND offering_id = $2
         ORDER BY session_date DESC, session_time DESC`,
        [team.id, testOffering.id]
      );

      expect(sessions.rows.length).toBe(3);
    });

    it('should calculate team average attendance for instructor view', async () => {
      const teamStats = await pool.query(
        `SELECT 
           t.id,
           t.name,
           COUNT(DISTINCT tm.user_id) as team_size,
           COUNT(DISTINCT s.id) FILTER (WHERE s.attendance_closed_at IS NOT NULL) as closed_meetings,
           COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present' AND s.attendance_closed_at IS NOT NULL) as total_present
         FROM team t
         LEFT JOIN team_members tm ON t.id = tm.team_id
         LEFT JOIN sessions s ON t.id = s.team_id
         LEFT JOIN attendance a ON s.id = a.session_id
         WHERE t.id = $1
         GROUP BY t.id, t.name`,
        [team.id]
      );

      const stats = teamStats.rows[0];
      const teamSize = parseInt(stats.team_size);
      const closedMeetings = parseInt(stats.closed_meetings);
      const totalPresent = parseInt(stats.total_present);

      expect(teamSize).toBe(3);
      expect(closedMeetings).toBe(1); // Only pastSession is closed
      expect(totalPresent).toBe(2); // teamLeader and teamMember1

      const percentage = closedMeetings > 0
        ? Math.round((totalPresent / (teamSize * closedMeetings)) * 100)
        : 0;
      
      expect(percentage).toBe(67); // 2/3 = 67%
    });

    it('should show attendance statistics for individual meeting', async () => {
      const meetingStats = await pool.query(
        `SELECT 
           COUNT(a.id) FILTER (WHERE a.status = 'present') as present_count,
           COUNT(a.id) FILTER (WHERE a.status = 'absent') as absent_count,
           (SELECT COUNT(*) FROM team_members WHERE team_id = $2) as team_size
         FROM attendance a
         WHERE a.session_id = $1`,
        [pastSession.id, team.id]
      );

      const stats = meetingStats.rows[0];
      expect(parseInt(stats.present_count)).toBe(2);
      expect(parseInt(stats.absent_count)).toBe(0); // No explicit absent records
      expect(parseInt(stats.team_size)).toBe(3);
    });

    it('should list all meetings across all teams for instructor', async () => {
      const allMeetings = await pool.query(
        `SELECT s.*, t.name as team_name, t.team_number
         FROM sessions s
         INNER JOIN team t ON s.team_id = t.id
         WHERE s.offering_id = $1
         ORDER BY s.session_date DESC, s.session_time DESC`,
        [testOffering.id]
      );

      expect(allMeetings.rows.length).toBeGreaterThanOrEqual(3);
      const teamMeetings = allMeetings.rows.filter(m => m.team_id === team.id);
      expect(teamMeetings.length).toBe(3);
    });

    it('should show meeting time with proper formatting', async () => {
      const meeting = await pool.query(
        `SELECT session_date, session_time, 
                attendance_opened_at, attendance_closed_at
         FROM sessions WHERE id = $1`,
        [pastSession.id]
      );

      const session = meeting.rows[0];
      expect(session.session_date).toBeTruthy();
      expect(session.session_time).toBeTruthy();
      
      // Convert date object to string for verification
      const dateStr = session.session_date.toISOString().split('T')[0];
      const timeStr = session.session_time;
      
      // Verify date is in YYYY-MM-DD format
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Verify time is in HH:MM:SS format
      expect(timeStr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should filter meetings by status (pending/open/closed)', async () => {
      
      // Get all sessions with calculated status
      const sessions = await pool.query(
        `SELECT 
           s.*,
           CASE 
             WHEN s.attendance_closed_at IS NOT NULL 
               AND s.attendance_closed_at < NOW() 
             THEN 'closed'
             WHEN s.attendance_opened_at IS NOT NULL 
               AND s.attendance_closed_at IS NULL 
             THEN 'open'
             ELSE 'pending'
           END as status
         FROM sessions s
         WHERE s.team_id = $1`,
        [team.id]
      );

      const closed = sessions.rows.filter(s => s.status === 'closed');
      const open = sessions.rows.filter(s => s.status === 'open');
      const pending = sessions.rows.filter(s => s.status === 'pending');

      expect(closed.length).toBeGreaterThanOrEqual(1); // pastSession
      expect(open.length).toBeGreaterThanOrEqual(1); // openSession
      expect(pending.length).toBeGreaterThanOrEqual(1); // futureSession
    });

    it('should calculate overall attendance across all teams', async () => {
      const overallStats = await pool.query(
        `SELECT 
           COUNT(DISTINCT t.id) as total_teams,
           COUNT(DISTINCT s.id) FILTER (WHERE s.attendance_closed_at IS NOT NULL) as total_closed_meetings,
           SUM((SELECT COUNT(*) FROM team_members WHERE team_id = t.id)) as total_students,
           COUNT(a.id) FILTER (WHERE a.status = 'present' AND s.attendance_closed_at IS NOT NULL) as total_present
         FROM team t
         LEFT JOIN sessions s ON t.id = s.team_id
         LEFT JOIN attendance a ON s.id = a.session_id
         WHERE t.offering_id = $1`,
        [testOffering.id]
      );

      const stats = overallStats.rows[0];
      expect(parseInt(stats.total_teams)).toBeGreaterThanOrEqual(1);
      expect(parseInt(stats.total_closed_meetings)).toBeGreaterThanOrEqual(1);
      expect(parseInt(stats.total_present)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Cross-View Data Consistency', () => {
    
    it('should show same attendance count across all views', async () => {
      // Student view - teamMember1's attendance
      const studentView = await pool.query(
        `SELECT COUNT(*) as count
         FROM attendance 
         WHERE user_id = $1 AND session_id = $2 AND status = 'present'`,
        [teamMember1.id, pastSession.id]
      );

      // Team leader view - same data
      const leaderView = await pool.query(
        `SELECT COUNT(*) as count
         FROM attendance a
         INNER JOIN sessions s ON a.session_id = s.id
         WHERE s.team_id = $1 AND a.user_id = $2 AND s.id = $3`,
        [team.id, teamMember1.id, pastSession.id]
      );

      // Instructor view - same data
      const instructorView = await pool.query(
        `SELECT COUNT(*) as count
         FROM attendance a
         INNER JOIN sessions s ON a.session_id = s.id
         WHERE s.offering_id = $1 AND a.user_id = $2 AND s.id = $3`,
        [testOffering.id, teamMember1.id, pastSession.id]
      );

      expect(parseInt(studentView.rows[0].count)).toBe(1);
      expect(parseInt(leaderView.rows[0].count)).toBe(1);
      expect(parseInt(instructorView.rows[0].count)).toBe(1);
    });

    it('should show same meeting count across views', async () => {
      // Team leader view
      const leaderMeetings = await pool.query(
        `SELECT COUNT(*) as count FROM sessions WHERE team_id = $1`,
        [team.id]
      );

      // Instructor view for same team
      const instructorMeetings = await pool.query(
        `SELECT COUNT(*) as count 
         FROM sessions 
         WHERE team_id = $1 AND offering_id = $2`,
        [team.id, testOffering.id]
      );

      // Student view (team member)
      const studentMeetings = await pool.query(
        `SELECT COUNT(DISTINCT s.id) as count
         FROM sessions s
         INNER JOIN team_members tm ON s.team_id = tm.team_id
         WHERE tm.user_id = $1 AND s.offering_id = $2`,
        [teamMember1.id, testOffering.id]
      );

      const expectedCount = 3;
      expect(parseInt(leaderMeetings.rows[0].count)).toBe(expectedCount);
      expect(parseInt(instructorMeetings.rows[0].count)).toBe(expectedCount);
      expect(parseInt(studentMeetings.rows[0].count)).toBe(expectedCount);
    });

    it('should calculate same team average across team leader and instructor views', async () => {
      // Team leader calculation
      const leaderCalc = await pool.query(
        `SELECT 
           COUNT(DISTINCT s.id) FILTER (WHERE s.attendance_closed_at IS NOT NULL) as closed_meetings,
           COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present' AND s.attendance_closed_at IS NOT NULL) as total_present,
           (SELECT COUNT(*) FROM team_members WHERE team_id = $1) as team_size
         FROM sessions s
         LEFT JOIN attendance a ON s.id = a.session_id
         WHERE s.team_id = $1`,
        [team.id]
      );

      // Instructor calculation
      const instructorCalc = await pool.query(
        `SELECT 
           COUNT(DISTINCT s.id) FILTER (WHERE s.attendance_closed_at IS NOT NULL) as closed_meetings,
           COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present' AND s.attendance_closed_at IS NOT NULL) as total_present,
           COUNT(DISTINCT tm.user_id) as team_size
         FROM team t
         LEFT JOIN team_members tm ON t.id = tm.team_id
         LEFT JOIN sessions s ON t.id = s.team_id
         LEFT JOIN attendance a ON s.id = a.session_id
         WHERE t.id = $1`,
        [team.id]
      );

      const leaderStats = leaderCalc.rows[0];
      const instructorStats = instructorCalc.rows[0];

      expect(parseInt(leaderStats.closed_meetings)).toBe(parseInt(instructorStats.closed_meetings));
      expect(parseInt(leaderStats.total_present)).toBe(parseInt(instructorStats.total_present));
      expect(parseInt(leaderStats.team_size)).toBe(parseInt(instructorStats.team_size));

      const leaderPercentage = Math.round(
        (leaderStats.total_present / (leaderStats.team_size * leaderStats.closed_meetings)) * 100
      );
      const instructorPercentage = Math.round(
        (instructorStats.total_present / (instructorStats.team_size * instructorStats.closed_meetings)) * 100
      );

      expect(leaderPercentage).toBe(instructorPercentage);
      expect(leaderPercentage).toBe(67); // 2/3 = 67%
    });
  });
});
