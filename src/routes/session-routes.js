import { Router } from 'express';
import { SessionService } from '../services/session-service.js';
import { SessionQuestionModel } from '../models/session-question-model.js';
import { SessionResponseModel } from '../models/session-response-model.js';
import { ensureAuthenticated } from '../middleware/auth.js';
import { protect, protectAny } from '../middleware/permission-middleware.js';

const router = Router();

/**
 * Create a new session
 * POST /api/sessions
 * Body: { offering_id, title, description, session_date, session_time, questions? }
 * Requires: session.create permission (course scope) - Professor/Instructor
 */
router.post('/', ...protect('session.create', 'course'), async (req, res) => {
  try {
    // Ensure req.body exists (bodyParser should have parsed it by now)
    // If not, it might be an empty body which is still valid - just use empty object
    const sessionData = req.body || {};
    
    // If offering_id is missing, ensure it gets set by middleware or service
    // The middleware already sets it, but ensure it's in req.body for the service
    if (!sessionData.offering_id && req.offeringId) {
      sessionData.offering_id = req.offeringId;
    }
    
    const session = await SessionService.createSession(sessionData, req.currentUser.id);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all sessions for a course offering
 * GET /api/sessions?offering_id=<uuid>&is_active=true
 * Requires: Authentication
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { offering_id, is_active, limit, offset } = req.query;

    if (!offering_id) {
      return res.status(400).json({ error: 'offering_id is required' });
    }

    const options = {
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    };

    const sessions = await SessionService.getSessionsByOffering(offering_id, options);
    res.json(sessions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get session by ID
 * GET /api/sessions/:sessionId
 * Requires: Authentication
 */
router.get('/:sessionId', ensureAuthenticated, async (req, res) => {
  try {
    const session = await SessionService.getSession(req.params.sessionId);
    res.json(session);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update session
 * PUT /api/sessions/:sessionId
 * Body: { title?, description?, session_date?, session_time?, is_active?, ... }
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.put('/:sessionId', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const session = await SessionService.updateSession(
      req.params.sessionId,
      req.body,
      req.currentUser.id
    );
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete session
 * DELETE /api/sessions/:sessionId
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.delete('/:sessionId', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const deleted = await SessionService.deleteSession(req.params.sessionId, req.currentUser.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Verify access code
 * GET /api/sessions/verify-code/:code
 * Requires: Authentication
 */
router.get('/verify-code/:code', ensureAuthenticated, async (req, res) => {
  try {
    const verification = await SessionService.verifyAccessCode(req.params.code);
    res.json(verification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Open attendance for a session
 * POST /api/sessions/:sessionId/open-attendance
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.post('/:sessionId/open-attendance', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const session = await SessionService.openAttendance(req.params.sessionId, req.currentUser.id);
    res.json(session);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Close attendance for a session
 * POST /api/sessions/:sessionId/close-attendance
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.post('/:sessionId/close-attendance', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const session = await SessionService.closeAttendance(req.params.sessionId, req.currentUser.id);
    res.json(session);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Regenerate access code
 * POST /api/sessions/:sessionId/regenerate-code
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.post('/:sessionId/regenerate-code', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const session = await SessionService.regenerateAccessCode(req.params.sessionId, req.currentUser.id);
    res.json(session);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Add questions to a session
 * POST /api/sessions/:sessionId/questions
 * Body: { questions: [{ question_text, question_type, options?, is_required? }] }
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.post('/:sessionId/questions', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'questions array is required' });
    }

    const created = await SessionService.addQuestions(
      req.params.sessionId,
      questions,
      req.currentUser.id
    );

    res.status(201).json(created);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get questions for a session
 * GET /api/sessions/:sessionId/questions
 * Requires: Authentication
 */
router.get('/:sessionId/questions', ensureAuthenticated, async (req, res) => {
  try {
    const questions = await SessionQuestionModel.findBySessionId(req.params.sessionId);
    res.json(questions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update a question
 * PUT /api/sessions/questions/:questionId
 * Body: { question_text?, question_type?, options?, is_required? }
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.put('/questions/:questionId', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const question = await SessionQuestionModel.update(
      req.params.questionId,
      req.body,
      req.currentUser.id
    );

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete a question
 * DELETE /api/sessions/questions/:questionId
 * Requires: session.manage permission (course scope) - Professor/Instructor
 */
router.delete('/questions/:questionId', ...protect('session.manage', 'course'), async (req, res) => {
  try {
    const deleted = await SessionQuestionModel.delete(req.params.questionId);

    if (!deleted) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all responses for a session
 * GET /api/sessions/:sessionId/responses
 * Requires: session.manage or attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/:sessionId/responses', ...protectAny(['session.manage', 'attendance.view'], 'course'), async (req, res) => {
  try {
    const responses = await SessionService.getSessionResponses(req.params.sessionId);
    res.json(responses);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get session statistics
 * GET /api/sessions/:sessionId/statistics
 * Requires: session.manage or attendance.view permission (course scope) - Professor/Instructor/TA
 */
router.get('/:sessionId/statistics', ...protectAny(['session.manage', 'attendance.view'], 'course'), async (req, res) => {
  try {
    const stats = await SessionService.getSessionStatistics(req.params.sessionId);
    res.json(stats);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Submit response to a question (student)
 * POST /api/sessions/questions/:questionId/responses
 * Body: { response_text?, response_option? }
 * Requires: Authentication - Students only
 */
router.post('/questions/:questionId/responses', ensureAuthenticated, async (req, res) => {
  try {
    const { response_text, response_option } = req.body;

    const response = await SessionResponseModel.upsert({
      question_id: req.params.questionId,
      user_id: req.currentUser.id,
      response_text,
      response_option
    });

    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get my responses for a session
 * GET /api/sessions/:sessionId/my-responses
 * Requires: Authentication - Students
 */
router.get('/:sessionId/my-responses', ensureAuthenticated, async (req, res) => {
  try {
    const responses = await SessionResponseModel.findBySessionAndUser(
      req.params.sessionId,
      req.currentUser.id
    );
    res.json(responses);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
