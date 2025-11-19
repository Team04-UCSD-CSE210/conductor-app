import crypto from 'crypto';
import { pool } from '../db.js';
import { SessionModel } from '../models/session-model.js';
import { SessionQuestionModel } from '../models/session-question-model.js';
import { SessionResponseModel } from '../models/session-response-model.js';

/**
 * Get the active course offering ID (CSE 210 or any active offering)
 */
async function getActiveOfferingId() {
  try {
    const result = await pool.query(
      'SELECT id FROM course_offerings WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[SessionService] Error getting active course offering:', error);
    return null;
  }
}

/**
 * Check if session should be auto-opened and open it if needed
 * This is called whenever sessions are retrieved to ensure they auto-open when start time arrives
 */
async function checkAndAutoOpenSession(session) {
  if (!session || !session.session_date || !session.session_time || session.attendance_opened_at) {
    return session; // Already opened or missing required fields
  }

  try {
    // Parse date - handle both Date objects and strings
    let dateStr;
    if (session.session_date instanceof Date) {
      const year = session.session_date.getFullYear();
      const month = String(session.session_date.getMonth() + 1).padStart(2, '0');
      const day = String(session.session_date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = String(session.session_date).split('T')[0].split(' ')[0];
    }
    
    // Parse time
    let timeStr = String(session.session_time);
    timeStr = timeStr.split('.')[0]; // Remove milliseconds
    
    // Ensure time is in HH:MM:SS format
    let timeParts = timeStr.split(':');
    if (timeParts.length === 2) {
      timeStr = `${timeStr}:00`;
      timeParts = timeStr.split(':');
    }
    
    // Combine date and time
    const [year, month, day] = dateStr.split('-').map(Number);
    timeParts = timeStr.split(':').map(Number);
    const [hours, minutes] = timeParts;
    const seconds = timeParts[2] || 0;
    
    // Create date in local timezone
    const sessionStart = new Date(year, month - 1, day, hours, minutes, seconds);
    
    // Validate the date was parsed correctly
    if (isNaN(sessionStart.getTime())) {
      console.warn('[SessionService] Invalid date/time for auto-open check:', {
        session_id: session.id,
        session_date: session.session_date,
        session_time: session.session_time
      });
      return session;
    }
    
    const now = new Date();
    
    // If session start time has passed, automatically open attendance
    if (sessionStart <= now) {
      console.log('[SessionService] Auto-opening attendance for session:', session.id, {
        sessionStart: sessionStart.toISOString(),
        now: now.toISOString()
      });
      
      // Use the session creator as the updater, or system if not available
      const updatedBy = session.created_by || '00000000-0000-0000-0000-000000000000';
      await SessionModel.openAttendance(session.id, updatedBy);
      
      // Refresh session to get updated attendance_opened_at
      const updatedSession = await SessionModel.findById(session.id);
      if (updatedSession) {
        Object.assign(session, updatedSession);
        console.log('[SessionService] Attendance auto-opened. attendance_opened_at:', updatedSession.attendance_opened_at);
      }
    }
  } catch (error) {
    // Log error but don't fail - just return the session as-is
    console.error('[SessionService] Error checking/auto-opening session:', error);
  }
  
  return session;
}

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
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('Session data is required');
    }
    
    // Get offering_id - use provided one or fallback to active offering (CSE 210)
    let offeringId = sessionData.offering_id;
    
    // If no offering_id provided, automatically use the active offering (CSE 210)
    if (!offeringId) {
      offeringId = await getActiveOfferingId();
      if (!offeringId) {
        throw new Error('No active course offering found. Please ensure CSE 210 or another offering is marked as active.');
      }
      // Set it in sessionData so it's included in the database insert
      sessionData.offering_id = offeringId;
    }

    const canCreate = await this.userCanCreateSession(createdBy, offeringId);
    if (!canCreate) {
      throw new Error('Not authorized to create sessions for this offering');
    }

    const accessCode = await this.generateUniqueAccessCode();
    
    // Set code_expires_at to the end time (endsAt) from the form
    // If endsAt is provided, use it; otherwise default to 24 hours from session date
    let codeExpiresAt = sessionData.code_expires_at;
    if (!codeExpiresAt && sessionData.endsAt) {
      // Use the endsAt from the form as the code expiration (end time)
      codeExpiresAt = new Date(sessionData.endsAt);
    } else if (!codeExpiresAt) {
      // Fallback: 24 hours from session date if no end time provided
      codeExpiresAt = new Date(new Date(sessionData.session_date).getTime() + 24 * 60 * 60 * 1000);
    }

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

    // Automatically open attendance if session start time has passed
    if (session.session_date && session.session_time) {
      try {
        // Parse date - handle both Date objects and strings
        let dateStr;
        if (session.session_date instanceof Date) {
          // If it's already a Date object, extract YYYY-MM-DD
          const year = session.session_date.getFullYear();
          const month = String(session.session_date.getMonth() + 1).padStart(2, '0');
          const day = String(session.session_date.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          // If it's a string, use it directly (should be YYYY-MM-DD)
          dateStr = String(session.session_date).split('T')[0].split(' ')[0];
        }
        
        // Parse time - handle both Time objects and strings
        let timeStr = String(session.session_time);
        // Remove milliseconds if present
        timeStr = timeStr.split('.')[0];
        
        // Ensure time is in HH:MM:SS format
        let timeParts = timeStr.split(':');
        if (timeParts.length === 2) {
          timeStr = `${timeStr}:00`; // Add seconds if missing
          timeParts = timeStr.split(':');
        }
        
        // Combine date and time
        // Use local timezone by creating date components
        // This avoids timezone interpretation issues with ISO strings
        const [year, month, day] = dateStr.split('-').map(Number);
        timeParts = timeStr.split(':').map(Number);
        const [hours, minutes] = timeParts;
        const seconds = timeParts[2] || 0;
        
        // Create date in local timezone (month is 0-indexed in JavaScript)
        let sessionStart = new Date(year, month - 1, day, hours, minutes, seconds);
        
        // Validate the date was parsed correctly
        if (isNaN(sessionStart.getTime())) {
          console.error('[SessionService] Invalid date/time for auto-open:', { 
            dateStr, 
            timeStr, 
            session_date: session.session_date,
            session_time: session.session_time,
            session_date_type: typeof session.session_date,
            session_time_type: typeof session.session_time
          });
        } else {
          const now = new Date();
          
          console.log('[SessionService] Auto-open check:', {
            sessionStart: sessionStart.toISOString(),
            now: now.toISOString(),
            sessionStartLocal: sessionStart.toLocaleString(),
            nowLocal: now.toLocaleString(),
            shouldOpen: sessionStart <= now,
            alreadyOpened: !!session.attendance_opened_at
          });
          
          // If session start time has passed, automatically open attendance
          if (sessionStart <= now && !session.attendance_opened_at) {
            console.log('[SessionService] Auto-opening attendance for session:', session.id);
            await SessionModel.openAttendance(session.id, createdBy);
            // Refresh session to get updated attendance_opened_at
            const updatedSession = await SessionModel.findById(session.id);
            if (updatedSession) {
              Object.assign(session, updatedSession);
              console.log('[SessionService] Attendance auto-opened. attendance_opened_at:', updatedSession.attendance_opened_at);
            }
          }
        }
      } catch (error) {
        // Log error but don't fail session creation if auto-open fails
        console.error('[SessionService] Error auto-opening attendance:', error);
      }
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

    // Check and auto-open if start time has passed
    await checkAndAutoOpenSession(session);

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
    const sessions = await SessionModel.findByOfferingId(offeringId, options);
    
    // Check and auto-open each session if start time has passed
    // Use Promise.allSettled to avoid failing all if one fails
    await Promise.allSettled(
      sessions.map(session => checkAndAutoOpenSession(session))
    );
    
    // Return sessions (checkAndAutoOpenSession modifies in place)
    return sessions;
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

    // Handle questions update if provided
    const { questions, endsAt, ...sessionUpdates } = updates;
    
    // Update code_expires_at to the end time (endsAt) if provided
    if (endsAt) {
      try {
        const endDate = new Date(endsAt);
        if (!isNaN(endDate.getTime())) {
          sessionUpdates.code_expires_at = endDate;
        }
      } catch (error) {
        console.warn('[SessionService] Error setting code_expires_at from endsAt:', error);
      }
    }
    
    // Update session fields
    const updatedSession = await SessionModel.update(sessionId, sessionUpdates, updatedBy);

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      // Delete existing questions
      const existingQuestions = await SessionQuestionModel.findBySessionId(sessionId);
      for (const question of existingQuestions) {
        await SessionQuestionModel.delete(question.id);
      }

      // Create new questions
      if (questions.length > 0) {
        await SessionQuestionModel.createMany(
          questions.map((q, index) => ({
            ...q,
            session_id: sessionId,
            question_order: q.question_order ?? index + 1
          })),
          updatedBy
        );
      }

      // Reload session with questions
      const questionsList = await SessionQuestionModel.findBySessionId(sessionId);
      updatedSession.questions = questionsList;
    }

    return updatedSession;
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
