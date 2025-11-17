import crypto from 'crypto';
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
   */
  static async deleteSession(sessionId) {
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
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
