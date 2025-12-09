import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/class-directory?offering_id=:id
 * 返回某一個 offering 的班級通訊錄資料：
 * - professors
 * - tas
 * - tutors
 * - students（含 team 資訊）
 * - teams（含成員列表）
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id is required' });
    }

    const offeringId = offering_id;

    // ---------- Professors ----------
    const professorsQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.github_username,
        u.linkedin_url,
        u.pronouns,
        u.availability        AS availability_general,
        u.social_links,
        u.last_activity,
        e.course_role,
        u.primary_role
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.offering_id = $1::uuid
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role = 'professor'::enrollment_role_enum
      ORDER BY u.name;
    `;

    // ---------- TAs ----------
    const tasQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.github_username,
        u.linkedin_url,
        u.pronouns,
        u.availability        AS availability_general,
        u.social_links,
        u.last_activity,
        e.course_role,
        u.primary_role
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.offering_id = $1::uuid
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role = 'ta'::enrollment_role_enum
      ORDER BY u.name;
    `;

    // ---------- Tutors ----------
    const tutorsQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.github_username,
        u.linkedin_url,
        u.pronouns,
        u.availability        AS availability_general,
        u.social_links,
        u.last_activity,
        e.course_role,
        u.primary_role
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.offering_id = $1::uuid
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role = 'tutor'::enrollment_role_enum
      ORDER BY u.name;
    `;

    // ---------- Students（含 team 資訊） ----------
    const studentsQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.github_username,
        u.linkedin_url,
        u.pronouns,
        u.availability        AS availability_general,
        u.social_links,
        u.last_activity,
        e.course_role,
        u.primary_role,
        tm.team_id,
        t.name AS team_name,
        tm.role AS team_role
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN team_members tm ON tm.user_id = u.id
      LEFT JOIN team t
        ON t.id = tm.team_id
       AND t.offering_id = $1::uuid
      WHERE e.offering_id = $1::uuid
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role = 'student'::enrollment_role_enum
      ORDER BY u.name;
    `;

    // ---------- Teams（含 leader + 成員） ----------
    const teamsQuery = `
      SELECT
        t.id,
        t.name,
        t.team_number,
        t.status,
        t.leader_id,
        jsonb_build_object(
          'id', leader.id,
          'name', leader.name,
          'email', leader.email
        ) AS leader,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::jsonb
        ) AS members
      FROM team t
      LEFT JOIN users leader ON leader.id = t.leader_id
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE t.offering_id = $1::uuid
      GROUP BY t.id, leader.id
      ORDER BY t.team_number NULLS LAST, t.name;
    `;

    const [
      professorsResult,
      tasResult,
      tutorsResult,
      studentsResult,
      teamsResult
    ] = await Promise.all([
      pool.query(professorsQuery, [offeringId]),
      pool.query(tasQuery, [offeringId]),
      pool.query(tutorsQuery, [offeringId]),
      pool.query(studentsQuery, [offeringId]),
      pool.query(teamsQuery, [offeringId])
    ]);

    res.json({
      professors: professorsResult.rows,
      tas: tasResult.rows,
      tutors: tutorsResult.rows,
      students: studentsResult.rows,
      teams: teamsResult.rows
    });
  } catch (error) {
    console.error('Error fetching class directory:', error);
    res.status(500).json({ error: 'Failed to fetch class directory' });
  }
});

/**
 * GET /api/class-directory/:userId/activity?days=7
 * 取某位使用者最近若干天的活動紀錄 & 出勤情況
 * （目前前端不一定用得到，但保留這個端點以後可以做 drill-down）
 */
router.get('/:userId/activity', ensureAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const days = Number(req.query.days ?? 7);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // 這裡假設有 activity_logs / attendance 兩張表，
    // 如果你的實際欄位名字不同，可以對應改掉。
    const activityQuery = `
      SELECT
        al.id,
        al.user_id,
        al.action,
        al.metadata,
        al.created_at
      FROM activity_logs al
      WHERE al.user_id = $1::uuid
        AND al.created_at >= now() - ($2 || ' days')::interval
      ORDER BY al.created_at DESC
      LIMIT 200;
    `;

    const attendanceQuery = `
      SELECT
        a.id,
        a.session_id,
        a.user_id,
        a.status,
        a.recorded_at
      FROM attendance a
      WHERE a.user_id = $1::uuid
        AND a.recorded_at >= now() - ($2 || ' days')::interval
      ORDER BY a.recorded_at DESC
      LIMIT 200;
    `;

    const [activityResult, attendanceResult] = await Promise.all([
      pool.query(activityQuery, [userId, days]),
      pool.query(attendanceQuery, [userId, days])
    ]);

    res.json({
      activity: activityResult.rows,
      attendance: attendanceResult.rows
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

export default router;
