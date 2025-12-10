import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuthenticated } from '../middleware/auth.js';


import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();


const avatarDir = path.resolve('uploads/avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const userId = req.params.userId || 'user';
    cb(null, `${userId}-${Date.now()}${ext || '.png'}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * GET /api/class-directory?offering_id=:id
 * 
 * - professors
 * - tas
 * - tutors
 * - students
 * - teams
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
        u.primary_role,
        u.avatar_url
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
        u.primary_role,
        u.avatar_url
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
        u.primary_role,
        u.avatar_url
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.offering_id = $1::uuid
        AND e.status = 'enrolled'::enrollment_status_enum
        AND e.course_role = 'tutor'::enrollment_role_enum
      ORDER BY u.name;
    `;

    // ---------- Students ----------
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
        u.avatar_url,
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

    // ---------- Teams ----------
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
 * POST /api/class-directory/user/:userId/avatar
 * Body: FormData { avatar: <file> }
 */
router.post(
  '/user/:userId/avatar',
  ensureAuthenticated,
  upload.single('avatar'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'avatar file is required' });
      }

      
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const relativePath = `/uploads/avatars/${req.file.filename}`;
      const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

      await pool.query(
        `
        UPDATE users
        SET avatar_url = $2,
            updated_at = now()
        WHERE id = $1::uuid
        `,
        [userId, absoluteUrl]
      );

      return res.json({ avatar_url: absoluteUrl });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);


/**
 * GET /api/class-directory/:userId/activity?days=7
 */
router.get('/:userId/activity', ensureAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const days = Number(req.query.days ?? 7);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

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
