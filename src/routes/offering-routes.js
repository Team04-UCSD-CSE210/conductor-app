import { Router } from 'express';
import { pool } from '../db.js';
import { protectAny } from '../middleware/permission-middleware.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

/**
 * Get active course offering
 * GET /api/offerings/active
 * Requires: Authentication
 */
router.get('/active', ensureAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM course_offerings 
       WHERE is_active = TRUE 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active course offering found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching active offering:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all offerings (for query with is_active)
 * GET /api/offerings?is_active=true
 * Requires: Authentication
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { is_active, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM course_offerings WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(Number.parseInt(limit, 10));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching offerings:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get global color palette for active course offering
 * GET /api/offerings/color-palette
 * Public - all authenticated users can read
 */
router.get('/color-palette', ensureAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT color_palette 
       FROM course_offerings 
       WHERE is_active = TRUE 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    const palette = result.rows.length > 0 && result.rows[0].color_palette 
      ? result.rows[0].color_palette 
      : 'default';
    
    res.json({ color_palette: palette });
  } catch (err) {
    console.error('Error fetching color palette:', err);
    res.json({ color_palette: 'default' }); // Return default on error
  }
});

/**
 * Set global color palette for active course offering
 * POST /api/offerings/color-palette
 * Requires: course.manage permission (course scope) - Instructors/Admins only
 */
router.post('/color-palette', ...protectAny(['course.manage'], 'course'), async (req, res) => {
  try {
    const { color_palette } = req.body;
    
    // Validate palette value
    const validPalettes = ['default', 'blue', 'purple', 'green', 'orange', 'red'];
    if (!validPalettes.includes(color_palette)) {
      return res.status(400).json({ error: `Invalid color palette. Must be one of: ${validPalettes.join(', ')}` });
    }
    
    // Update active course offering
    const result = await pool.query(
      `UPDATE course_offerings 
       SET color_palette = $1, updated_at = NOW()
       WHERE is_active = TRUE
       RETURNING id, color_palette`,
      [color_palette]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active course offering found' });
    }

    res.json({ 
      success: true, 
      color_palette: result.rows[0].color_palette,
      message: 'Color palette saved successfully. Changes will apply to all users across the website.'
    });
  } catch (err) {
    console.error('Error saving color palette:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update active course offering
 * PUT /api/offerings/active
 * Requires: course.manage permission (course scope) - Instructors/Admins only
 */
router.put('/active', ...protectAny(['course.manage'], 'course'), async (req, res) => {
  try {
    const userId = req.currentUser?.id;
    const {
      code,
      name,
      department,
      term,
      year,
      credits,
      instructor_id,
      start_date,
      end_date,
      enrollment_cap,
      status,
      location,
      class_timings,
      syllabus_url,
      color_palette
    } = req.body;

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (code !== undefined) {
      updateFields.push(`code = $${paramIndex++}`);
      updateValues.push(code);
    }
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }
    if (department !== undefined) {
      updateFields.push(`department = $${paramIndex++}`);
      updateValues.push(department);
    }
    if (term !== undefined) {
      updateFields.push(`term = $${paramIndex++}`);
      updateValues.push(term);
    }
    if (year !== undefined) {
      updateFields.push(`year = $${paramIndex++}`);
      updateValues.push(year);
    }
    if (credits !== undefined) {
      updateFields.push(`credits = $${paramIndex++}`);
      updateValues.push(credits);
    }
    if (instructor_id !== undefined) {
      updateFields.push(`instructor_id = $${paramIndex++}`);
      updateValues.push(instructor_id);
    }
    if (start_date !== undefined) {
      updateFields.push(`start_date = $${paramIndex++}`);
      updateValues.push(start_date);
    }
    if (end_date !== undefined) {
      updateFields.push(`end_date = $${paramIndex++}`);
      updateValues.push(end_date);
    }
    if (enrollment_cap !== undefined) {
      updateFields.push(`enrollment_cap = $${paramIndex++}`);
      updateValues.push(enrollment_cap);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}::course_offering_status_enum`);
      updateValues.push(status);
    }
    if (location !== undefined) {
      updateFields.push(`location = $${paramIndex++}`);
      updateValues.push(location);
    }
    if (class_timings !== undefined) {
      updateFields.push(`class_timings = $${paramIndex++}::jsonb`);
      updateValues.push(typeof class_timings === 'string' ? class_timings : JSON.stringify(class_timings));
    }
    if (syllabus_url !== undefined) {
      updateFields.push(`syllabus_url = $${paramIndex++}`);
      updateValues.push(syllabus_url);
    }
    if (color_palette !== undefined) {
      const validPalettes = ['default', 'blue', 'purple', 'green', 'orange', 'red'];
      if (!validPalettes.includes(color_palette)) {
        return res.status(400).json({ error: `Invalid color palette. Must be one of: ${validPalettes.join(', ')}` });
      }
      updateFields.push(`color_palette = $${paramIndex++}`);
      updateValues.push(color_palette);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(userId);

    const query = `
      UPDATE course_offerings 
      SET ${updateFields.join(', ')}
      WHERE is_active = TRUE
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active course offering found' });
    }

    res.json({
      success: true,
      offering: result.rows[0],
      message: 'Course settings updated successfully'
    });
  } catch (err) {
    console.error('Error updating course offering:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get offering details
 * GET /api/offerings/:offeringId
 * Requires: roster.view or course.manage permission (course scope), OR enrollment in the offering
 */
router.get('/:offeringId', ensureAuthenticated, async (req, res) => {
  try {
    const { offeringId } = req.params;
    const userId = req.currentUser?.id;

    // Check if user has permission OR is enrolled in the offering
    let hasPermission = false;
    let isEnrolled = false;

    // First check permissions
    try {
      const { PermissionService } = await import('../services/permission-service.js');
      const hasRosterView = await PermissionService.hasPermission(userId, 'roster.view', offeringId, null);
      const hasCourseManage = await PermissionService.hasPermission(userId, 'course.manage', offeringId, null);
      hasPermission = hasRosterView || hasCourseManage;
    } catch (permError) {
      // Permission check failed, will check enrollment
      console.warn('Permission check failed, checking enrollment:', permError);
    }

    // If no permission, check if user is enrolled (including team leads)
    if (!hasPermission && userId) {
      // Check regular enrollment (including team-lead enrollment role)
      const enrollmentCheck = await pool.query(
        `SELECT 1 FROM enrollments 
         WHERE offering_id = $1 AND user_id = $2 AND status = 'enrolled' 
         LIMIT 1`,
        [offeringId, userId]
      );
      isEnrolled = enrollmentCheck.rows.length > 0;
      
      // Also check if user is a team member or team leader (team leads might not be explicitly enrolled but are team members)
      if (!isEnrolled) {
        // Check if user is a team member
        const teamMemberCheck = await pool.query(
          `SELECT 1 FROM team_members tm
           INNER JOIN team t ON tm.team_id = t.id
           WHERE t.offering_id = $1 AND tm.user_id = $2 AND tm.left_at IS NULL
           LIMIT 1`,
          [offeringId, userId]
        );
        if (teamMemberCheck.rows.length > 0) {
          isEnrolled = true;
        } else {
          // Also check if user is a team leader (via team.leader_id)
          const teamLeaderCheck = await pool.query(
            `SELECT 1 FROM team
             WHERE offering_id = $1 AND leader_id = $2
             LIMIT 1`,
            [offeringId, userId]
          );
          isEnrolled = teamLeaderCheck.rows.length > 0;
        }
      }
    }

    if (!hasPermission && !isEnrolled) {
      return res.status(403).json({ error: 'Forbidden: You must be enrolled in this course to view its details' });
    }

    // Build query based on permissions
    let query;
    if (hasPermission) {
      // Full details for users with permissions
      query = `
        SELECT 
        co.*,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role::text = 'student' AND e.status = 'enrolled') as student_count,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role::text = 'ta' AND e.status = 'enrolled') as ta_count,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.course_role::text = 'tutor' AND e.status = 'enrolled') as tutor_count,
        COUNT(DISTINCT t.id) as team_count
      FROM course_offerings co
      LEFT JOIN enrollments e ON co.id = e.offering_id
      LEFT JOIN team t ON co.id = t.offering_id
      WHERE co.id = $1
        GROUP BY co.id
      `;
    } else {
      // Basic info for enrolled students/team leads (no sensitive stats, but include course details)
      query = `
        SELECT 
          co.id,
          co.code,
          co.name,
          co.term,
          co.year,
          co.location,
          co.class_timings,
          co.start_date,
          co.end_date,
          co.is_active,
          co.color_palette,
          co.created_at,
          co.updated_at
        FROM course_offerings co
        WHERE co.id = $1
      `;
    }

    const result = await pool.query(query, [offeringId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offering not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching offering:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get offering statistics
 * GET /api/offerings/:offeringId/stats
 * Requires: roster.view or course.manage permission (course scope)
 */
router.get('/:offeringId/stats', ...protectAny(['roster.view', 'course.manage'], 'course'), async (req, res) => {
  try {
    const { offeringId } = req.params;

    // Get enrollment stats by role
    const enrollmentStats = await pool.query(
      `SELECT 
        course_role,
        status,
        COUNT(*) as count
      FROM enrollments
      WHERE offering_id = $1
      GROUP BY course_role, status`,
      [offeringId]
    );

    // Get team stats
    const teamStats = await pool.query(
      `SELECT 
        status,
        COUNT(*) as count
      FROM team
      WHERE offering_id = $1
      GROUP BY status`,
      [offeringId]
    );

    // Get total team members
    const teamMemberCount = await pool.query(
      `SELECT COUNT(DISTINCT tm.user_id) as count
       FROM team_members tm
       INNER JOIN team t ON tm.team_id = t.id
       WHERE t.offering_id = $1 AND tm.left_at IS NULL`,
      [offeringId]
    );

    res.json({
      enrollments: enrollmentStats.rows,
      teams: teamStats.rows,
      total_team_members: Number.parseInt(teamMemberCount.rows[0]?.count || 0)
    });
  } catch (err) {
    console.error('Error fetching offering stats:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

