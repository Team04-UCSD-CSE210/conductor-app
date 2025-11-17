import crypto from 'crypto';
import { pool } from '../db.js';
import { SessionModel } from '../models/session-model.js';
import { SessionQuestionModel } from '../models/session-question-model.js';
import { SessionResponseModel } from '../models/session-response-model.js';

/**
 * Session Service - Business logic for session management
 */
export class SessionService {
  /**
   * Generate a unique access code
   */
  static generateAccessCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
    let code = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      code += chars[randomIndex];
    }
    
    return code;
  }

  /**
   * Generate a unique access code (ensures uniqueness in database)
   */
  static async generateUniqueAccessCode(maxAttempts = 10) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = this.generateAccessCode();
      const isUnique = await SessionModel.isAccessCodeUnique(code);
      
      if (isUnique) {
        return code;
      }
    }
    
    throw new Error('Failed to generate unique access code after multiple attempts');
  }

  /**
   * Create a new session with auto-generated access code
   */
  static async createSession(sessionData, createdBy) {
    // Authorization: only instructors or team leaders may create sessions for an offering
    const offeringId = sessionData.offering_id;
    if (!offeringId) throw new Error('offering_id is required');

    const canCreate = await this.userCanCreateSession(createdBy, offeringId);
    if (!canCreate) {
      throw new Error('Not authorized to create sessions for this offering');
    }

    const accessCode = await this.generateUniqueAccessCode();
    
    // Set code expiration (default: 24 hours from session date)
    const codeExpiresAt = sessionData.code_expires_at || 
      new Date(new Date(sessionData.session_date).getTime() + 24 * 60 * 60 * 1000);

    const session = await SessionModel.create({
      ...sessionData,
      access_code: accessCode,
      code_expires_at: codeExpiresAt,
      created_by: createdBy
    });

    // Create questions if provided
    if (sessionData.questions && sessionData.questions.length > 0) {
      const questions = await SessionQuestionModel.createMany(
        sessionData.questions.map((q, index) => ({
          ...q,
          session_id: session.id,
          question_order: q.question_order ?? index + 1
        })),
        createdBy
      );

      session.questions = questions;
    }

    return session;
  }

  /**
   * Returns true if the user is allowed to create sessions for the offering
   * Allowed if user.primary_role = 'instructor' OR user is a team leader for a team
   * in the same offering.
   */
  static async userCanCreateSession(userId, offeringId) {
    // Check primary role
    const userRes = await pool.query('SELECT primary_role FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return false;
    const primaryRole = userRes.rows[0].primary_role;
    if (primaryRole === 'instructor') return true;

    // Check if user is a team leader for a team in this offering
    const leaderRes = await pool.query(
      `SELECT 1 FROM team t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       WHERE t.offering_id = $1 AND (t.leader_id = $2 OR (tm.user_id = $2 AND tm.role = 'leader'))
       LIMIT 1`,
      [offeringId, userId]
    );

    return leaderRes.rows.length > 0;
  }

  /**
   * Get session by ID with questions
   */
  static async getSession(sessionId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Get questions for this session
    const questions = await SessionQuestionModel.findBySessionId(sessionId);
    session.questions = questions;

    // Get statistics
    const stats = await SessionModel.getStatistics(sessionId);
    session.statistics = stats;

    return session;
  }

  /**
   * Get sessions for a course offering
   */
  static async getSessionsByOffering(offeringId, options = {}) {
    return await SessionModel.findByOfferingId(offeringId, options);
  }

  /**
   * Update session
   */
  static async updateSession(sessionId, updates, updatedBy) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Only the creator may manage the session
    if (session.created_by !== updatedBy) {
      throw new Error('Not authorized to manage this session');
    }

    // If updating access code, ensure it's unique
    if (updates.access_code) {
      const isUnique = await SessionModel.isAccessCodeUnique(updates.access_code, sessionId);
      if (!isUnique) {
        throw new Error('Access code already in use');
      }
    }

    return await SessionModel.update(sessionId, updates, updatedBy);
  }

  /**
   * Delete session
   * Only the creator may delete the session
   */
  static async deleteSession(sessionId, userId) {
    const session = await SessionModel.findById(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.created_by !== userId) {
      throw new Error('Not authorized to manage this session');
    }

    return await SessionModel.delete(sessionId);
  }

  /**
   * Verify access code
   */
  static async verifyAccessCode(accessCode) {
    const session = await SessionModel.findByAccessCode(accessCode);
    
    if (!session) {
      return { valid: false, message: 'Invalid access code' };
    }

    // Check if session is active
    if (!session.is_active) {
      return { valid: false, message: 'Session is not active', session };
    }

    // Check if attendance is open (must be opened and not closed)
    if (!session.attendance_opened_at) {
      return { valid: false, message: 'Attendance has not been opened for this session', session };
    }

    // Check if attendance is closed
    if (session.attendance_closed_at) {
      return { valid: false, message: 'Attendance is closed for this session', session };
    }

    // Check if code is expired
    if (session.code_expires_at && new Date(session.code_expires_at) < new Date()) {
      return { valid: false, message: 'Access code has expired', session };
    }

    return { valid: true, session };
  }

  /**
   * Open attendance for a session
   */
  static async openAttendance(sessionId, userId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.created_by !== userId) {
      throw new Error('Not authorized to manage this session');
    }

    return await SessionModel.openAttendance(sessionId, userId);
  }

  /**
   * Close attendance for a session
   */
  static async closeAttendance(sessionId, userId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.created_by !== userId) {
      throw new Error('Not authorized to manage this session');
    }

    return await SessionModel.closeAttendance(sessionId, userId);
  }

  /**
   * Add questions to a session
   */
  static async addQuestions(sessionId, questions, createdBy) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.created_by !== createdBy) {
      throw new Error('Not authorized to manage this session');
    }

    // Get current question count to set proper order
    const existingQuestions = await SessionQuestionModel.findBySessionId(sessionId);
    const startOrder = existingQuestions.length + 1;

    const questionsWithOrder = questions.map((q, index) => ({
      ...q,
      session_id: sessionId,
      question_order: q.question_order ?? startOrder + index
    }));

    return await SessionQuestionModel.createMany(questionsWithOrder, createdBy);
  }

  /**
   * Get all responses for a session
   */
  static async getSessionResponses(sessionId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const responses = await SessionResponseModel.findBySessionId(sessionId);
    const questions = await SessionQuestionModel.findBySessionId(sessionId);

    // Group responses by question
    const responsesByQuestion = {};
    
    for (const question of questions) {
      responsesByQuestion[question.id] = {
        question,
        responses: responses.filter(r => r.question_id === question.id)
      };
    }

    return {
      session,
      questions,
      responses,
      responsesByQuestion
    };
  }

  /**
   * Get statistics for a session
   */
  static async getSessionStatistics(sessionId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const stats = await SessionModel.getStatistics(sessionId);
    const responseStats = await SessionResponseModel.getSessionStatistics(sessionId);

    return {
      ...stats,
      questions: responseStats
    };
  }

  /**
   * Regenerate access code for a session
   */
  static async regenerateAccessCode(sessionId, userId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const newCode = await this.generateUniqueAccessCode();
    
    return await SessionModel.update(
      sessionId,
      { access_code: newCode },
      userId
    );
  }
}
