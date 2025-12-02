import { Router } from 'express';
import { AttendanceService } from '../services/attendance-service.js';
import { AttendanceModel } from '../models/attendance-model.js';
import { ensureAuthenticated } from '../middleware/auth.js';
import { protect } from '../middleware/permission-middleware.js';

const router = Router();

/**
 * Student check-in with access code
 * POST /api/attendance/check-in
 * Body: { access_code, responses?: [{ question_id, response_text?, response_option? }] }
 * Requires: Authentication - Students
 */
router.post('/check-in', ensureAuthenticated, async (req, res) => {
  try {
    const { access_code, responses } = req.body;

    if (!access_code) {
      return res.status(400).json({ error: 'access_code is required' });
    }

    // Check in
    const attendance = await AttendanceService.checkIn(access_code, req.currentUser.id);

    // Submit responses if provided
    let submittedResponses = null;
    if (responses && Array.isArray(responses) && responses.length > 0) {
      submittedResponses = await AttendanceService.submitResponses(
        attendance.session_id,
        req.currentUser.id,
        responses
      );
    }

    res.status(201).json({
      attendance,
      responses: submittedResponses
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Submit responses for a session
 * POST /api/attendance/sessions/:sessionId/responses
 * Body: { responses: [{ question_id, response_text?, response_option? }] }
 * Requires: Authentication - Students
 */
router.post('/sessions/:sessionId/responses', ensureAuthenticated, async (req, res) => {
  try {
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'responses array is required' });
    }

    const submittedResponses = await AttendanceService.submitResponses(
      req.params.sessionId,
      req.currentUser.id,
      responses
    );

    res.status(201).json(submittedResponses);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get my attendance records
 * GET /api/attendance/my-attendance?offering_id=<uuid>
 * Requires: Authentication - Students
 */
router.get('/my-attendance', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id } = req.query;
    
    const attendance = await AttendanceService.getStudentAttendance(
      req.currentUser.id,
      offering_id || null
    );

    res.json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get my attendance statistics for a course
 * GET /api/attendance/my-statistics/:offeringId
 * Requires: Authentication - Students
 */
router.get('/my-statistics/:offeringId', ensureAuthenticated, async (req, res) => {
  try {
    const stats = await AttendanceService.getStudentStatistics(
      req.currentUser.id,
      req.params.offeringId
    );

    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get attendance for a specific user in a session
 * GET /api/sessions/:sessionId/attendance/:userId
 * Requires: Authentication - Team members can view their own team's attendance
 */
router.get('/sessions/:sessionId/attendance/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const attendance = await AttendanceModel.findBySessionAndUser(
      req.params.sessionId,
      req.params.userId
    );
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    res.json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get attendance for a session
 * GET /api/attendance/sessions/:sessionId?status=present
 * Requires: attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/sessions/:sessionId', ...protect('attendance.view', 'course'), async (req, res) => {
  try {
    const { status } = req.query;
    const options = status ? { status } : {};

    const result = await AttendanceService.getSessionAttendance(req.params.sessionId, options);
    res.json(result);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get attendance statistics for a session
 * GET /api/attendance/sessions/:sessionId/statistics
 * Requires: attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/sessions/:sessionId/statistics', ...protect('attendance.view', 'course'), async (req, res) => {
  try {
    const stats = await AttendanceModel.getSessionStatistics(req.params.sessionId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get attendance statistics for multiple sessions (batch)
 * GET /api/attendance/sessions/batch/statistics?session_ids=uuid1,uuid2,uuid3
 * Requires: attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/sessions/batch/statistics', ...protect('attendance.view', 'course'), async (req, res) => {
  try {
    const { session_ids } = req.query;
    
    if (!session_ids) {
      return res.status(400).json({ error: 'session_ids query parameter is required (comma-separated UUIDs)' });
    }

    const sessionIdArray = session_ids.split(',').map(id => id.trim()).filter(id => id);
    
    if (sessionIdArray.length === 0) {
      return res.json({});
    }

    // Fetch statistics for all sessions in one query
    const stats = await AttendanceModel.getBatchSessionStatistics(sessionIdArray);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get attendance report for a session (with responses)
 * GET /api/attendance/sessions/:sessionId/report
 * Requires: attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/sessions/:sessionId/report', ...protect('attendance.view', 'course'), async (req, res) => {
  try {
    const report = await AttendanceService.getAttendanceReport(req.params.sessionId);
    res.json(report);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Mark attendance manually for a student
 * POST /api/attendance/mark
 * Body: { session_id, user_id, status }
 * Requires: attendance.mark permission (course scope) - Professor/Instructor/TA
 */
router.post('/mark', ...protect('attendance.mark', 'course'), async (req, res) => {
  try {
    const { session_id, user_id, status } = req.body;

    if (!session_id || !user_id || !status) {
      return res.status(400).json({ 
        error: 'session_id, user_id, and status are required' 
      });
    }

    const attendance = await AttendanceService.markAttendance(session_id, user_id, status);
    res.status(201).json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update attendance status
 * PUT /api/attendance/:attendanceId
 * Body: { status }
 * Requires: attendance.mark permission (course scope) - Professor/Instructor/TA
 */
router.put('/:attendanceId', ...protect('attendance.mark', 'course'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const attendance = await AttendanceService.updateAttendanceStatus(
      req.params.attendanceId,
      status
    );

    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete attendance record
 * DELETE /api/attendance/:attendanceId
 * Requires: attendance.mark permission (course scope) - Professor/Instructor/TA
 */
router.delete('/:attendanceId', ...protect('attendance.mark', 'course'), async (req, res) => {
  try {
    const deleted = await AttendanceService.deleteAttendance(req.params.attendanceId);

    if (!deleted) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get student's attendance for a user
 * GET /api/attendance/student/:userId?offering_id=<uuid>
 * Requires: attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/student/:userId', ...protect('attendance.view', 'course'), async (req, res) => {
  try {
    const { offering_id } = req.query;

    const attendance = await AttendanceService.getStudentAttendance(
      req.params.userId,
      offering_id || null
    );

    res.json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get student's attendance statistics
 * GET /api/attendance/student/:userId/statistics/:offeringId
 * Requires: attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/student/:userId/statistics/:offeringId', ...protect('attendance.view', 'course'), async (req, res) => {
  try {
    const stats = await AttendanceService.getStudentStatistics(
      req.params.userId,
      req.params.offeringId
    );

    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get course attendance summary for all students
 * GET /api/attendance/course/:offeringId/summary
 * Requires: attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/course/:offeringId/summary', ...protect('attendance.view', 'course'), async (req, res) => {
  try {
    const summary = await AttendanceService.getCourseAttendanceSummary(req.params.offeringId);
    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Close session and mark remaining students as absent
 * POST /api/attendance/sessions/:sessionId/close-and-mark-absent
 * Requires: attendance.mark permission (course scope) - Professor/Instructor/TA
 */
router.post('/sessions/:sessionId/close-and-mark-absent', ...protect('attendance.mark', 'course'), async (req, res) => {
  try {
    const result = await AttendanceService.closeSessionAndMarkAbsent(
      req.params.sessionId,
      req.currentUser.id
    );

    res.json(result);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Bulk import attendance from array
 * POST /api/attendance/bulk-import/:sessionId
 * Body: { attendance: [{ email, ucsd_pid, status, checked_in_at? }] }
 * Requires: attendance.mark permission (course scope) - Professor/Instructor/TA
 */
router.post('/bulk-import/:sessionId', ...protect('attendance.mark', 'course'), async (req, res) => {
  try {
    const { attendance } = req.body;

    if (!attendance || !Array.isArray(attendance)) {
      return res.status(400).json({ error: 'attendance array is required' });
    }

    const results = await AttendanceService.bulkImportAttendance(
      req.params.sessionId,
      attendance,
      req.currentUser.id
    );

    res.json(results);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

export default router;
