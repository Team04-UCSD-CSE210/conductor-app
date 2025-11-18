/**
 * Lecture Data Service - API client for lecture attendance features
 * Handles all API communication with proper authentication and error handling
 */
(function initLectureService() {
  const API_BASE = '/api';

  /**
   * Fetch wrapper with authentication and error handling
   */
  async function apiFetch(endpoint, options = {}) {
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  /**
   * Get active course offering
   */
  async function getActiveOffering() {
    try {
      // Try to get active offering using the new endpoint
      const response = await apiFetch('/offerings/active');
      
      if (!response || !response.id) {
        // Fallback: try query param endpoint
        const offerings = await apiFetch('/offerings?is_active=true&limit=1');
        if (Array.isArray(offerings) && offerings.length > 0) {
          return offerings[0].id;
        }
        
        // Last resort: try to get user's enrollments and use first offering
        const enrollments = await apiFetch('/my-courses');
        if (enrollments?.courses?.length > 0) {
          return enrollments.courses[0].offering.id;
        }
        throw new Error('No active course offering found');
      }
      
      return response.id;
    } catch (error) {
      console.error('Error getting active offering:', error);
      throw error;
    }
  }

  /**
   * Transform backend session to frontend format
   */
  function transformSession(session) {
    if (!session) return null;

    // Combine session_date and session_time into ISO strings
    let startsAt = null;
    if (session.session_date && session.session_time) {
      try {
        // Handle date format from PostgreSQL (could be string or Date object)
        let dateStr = session.session_date;
        if (dateStr instanceof Date) {
          dateStr = dateStr.toISOString().split('T')[0]; // Extract YYYY-MM-DD
        } else if (typeof dateStr === 'string') {
          // Extract just the date part (YYYY-MM-DD) if it includes time
          dateStr = dateStr.split('T')[0].split(' ')[0];
        }
        
        // Handle time format from PostgreSQL (HH:MM:SS or HH:MM:SS.mmm)
        let timeStr = session.session_time;
        if (typeof timeStr === 'string') {
          // Remove milliseconds if present, ensure HH:MM:SS format
          timeStr = timeStr.split('.')[0];
          // Ensure it's in HH:MM:SS format (not just HH:MM)
          const timeParts = timeStr.split(':');
          if (timeParts.length === 2) {
            timeStr = `${timeStr}:00`; // Add seconds if missing
          }
        } else {
          timeStr = String(timeStr).split('.')[0];
          const timeParts = timeStr.split(':');
          if (timeParts.length === 2) {
            timeStr = `${timeStr}:00`;
          }
        }
        
        // Ensure we have valid date and time strings
        if (dateStr && timeStr) {
          // Combine date and time with timezone (use local timezone, then convert to ISO)
          const dateTimeStr = `${dateStr}T${timeStr}`;
          const dateObj = new Date(dateTimeStr);
          
          // Validate the date
          if (!isNaN(dateObj.getTime())) {
            startsAt = dateObj.toISOString();
          } else {
            console.warn('Invalid date parsed:', dateTimeStr, 'from', session.session_date, session.session_time);
          }
        }
      } catch (e) {
        console.warn('Error parsing session date/time:', e, session);
      }
    } else {
      // Log when date/time is missing for debugging
      if (!session.session_date) {
        console.warn('Session missing session_date:', session.id);
      }
      if (!session.session_time) {
        console.warn('Session missing session_time:', session.id);
      }
    }
    
    // Calculate endsAt from duration or use default (80 minutes)
    let endsAt = null;
    if (startsAt) {
      try {
        const endDate = new Date(startsAt);
        endDate.setMinutes(endDate.getMinutes() + 80);
        endsAt = endDate.toISOString();
      } catch (e) {
        console.warn('Error calculating end time:', e);
      }
    }

    // Determine status based on attendance_opened_at and attendance_closed_at
    let status = 'closed';
    if (session.attendance_opened_at && !session.attendance_closed_at) {
      status = 'open';
    }

    // Calculate attendance percent from statistics if available
    const attendancePercent = session.statistics?.attendance_percent 
      || session.attendance_percent 
      || (session.attendance_count && session.total_students 
          ? Math.round((session.attendance_count / session.total_students) * 100) 
          : 0);

    return {
      id: session.id,
      courseId: session.offering_id, // Keep for compatibility
      offering_id: session.offering_id,
      label: session.title || session.label,
      title: session.title,
      description: session.description,
      attendancePercent,
      status,
      startsAt,
      endsAt,
      session_date: session.session_date,
      session_time: session.session_time,
      accessCode: session.access_code,
      access_code: session.access_code,
      code_expires_at: session.code_expires_at,
      attendance_opened_at: session.attendance_opened_at,
      attendance_closed_at: session.attendance_closed_at,
      is_active: session.is_active,
      questions: (session.questions || []).map(transformQuestion),
      statistics: session.statistics
    };
  }

  /**
   * Transform backend question to frontend format
   */
  function transformQuestion(question) {
    // Map backend question types to frontend types
    let type = 'text';
    if (question.question_type === 'multiple_choice' || question.question_type === 'mcq') {
      type = 'multiple_choice';
    } else if (question.question_type === 'pulse_check' || question.question_type === 'pulse') {
      type = 'pulse_check';
    } else if (question.question_type === 'text') {
      type = 'text';
    }
    
    return {
      id: question.id,
      prompt: question.question_text,
      question_text: question.question_text,
      type: type,
      question_type: question.question_type,
      options: question.options || [],
      is_required: question.is_required !== undefined ? question.is_required : true,
      question_order: question.question_order
    };
  }

  /**
   * Transform frontend session to backend format for creation
   */
  function transformSessionForCreate(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('Session data is required and must be an object');
    }

    const { startsAt, label, questions, ...rest } = sessionData;

    // Ensure offering_id is present - check multiple possible locations with strict validation
    let offering_id = sessionData.offering_id;
    
    // If not found, check rest object
    if (!offering_id && rest && typeof rest === 'object') {
      offering_id = rest.offering_id;
    }
    
    // If still not found, check alternative property name
    if (!offering_id) {
      offering_id = sessionData.offeringId;
    }
    
    // If offering_id is still missing, don't throw error - backend will use active offering
    // Just log a warning
    if (!offering_id || offering_id === 'undefined' || offering_id === 'null' || typeof offering_id === 'undefined') {
      console.warn('transformSessionForCreate: offering_id not provided, backend will use active offering (CSE 210)');
      // Don't throw - let backend handle it
      offering_id = undefined;
    }

    // Extract date and time from ISO strings
    const startDate = startsAt ? new Date(startsAt) : null;

    const session_date = startDate ? startDate.toISOString().split('T')[0] : null;
    const session_time = startDate ? startDate.toTimeString().split(' ')[0].substring(0, 5) : null;

    // Transform questions
    const transformedQuestions = (questions || []).map((q, index) => ({
      question_text: q.prompt || q.question_text,
      question_type: q.type || q.question_type || 'text',
      options: q.options || [],
      is_required: q.is_required !== undefined ? q.is_required : true,
      question_order: q.question_order || index + 1
      }));

    const result = {
      ...rest,
      title: label || rest.title,
      session_date,
      session_time,
      questions: transformedQuestions
    };
    
    // Only include offering_id if it exists, otherwise backend will use active offering
    if (offering_id) {
      result.offering_id = offering_id;
    }
    
    return result;
  }

  /**
   * Transform backend response to frontend format
   */
  function transformResponse(response) {
    return {
      id: response.id,
      question_id: response.question_id,
      studentId: response.user_id,
      user_id: response.user_id,
      name: response.student_name || response.user_name || 'Unknown',
      team: response.team_name || response.team || 'No team',
      response: response.response_text || response.response_option || '',
      response_text: response.response_text,
      response_option: response.response_option,
      submitted_at: response.created_at || response.submitted_at
    };
  }

  window.LectureService = {
    /**
     * Get active offering ID
     */
    async getActiveOfferingId() {
      return await getActiveOffering();
    },

    /**
     * Get instructor overview (all sessions for a course)
     */
    async getInstructorOverview(offeringId) {
      try {
        if (!offeringId) {
          offeringId = await getActiveOffering();
        }

        const sessions = await apiFetch(`/sessions?offering_id=${offeringId}`);
        const sessionsArray = Array.isArray(sessions) ? sessions : [];

        // Transform sessions
        const transformedSessions = sessionsArray
          .map(transformSession)
          .filter(Boolean)
          .sort((a, b) => {
            // Handle null/undefined dates safely
            if (!a.startsAt && !b.startsAt) return 0;
            if (!a.startsAt) return 1;
            if (!b.startsAt) return -1;
            try {
              return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
            } catch {
              return 0;
            }
          }); // Most recent first

        // Get statistics for last session
        const lastSession = transformedSessions[0];
        const summaryPercent = lastSession?.attendancePercent || 0;

        // Get current open lecture
        const currentLecture = transformedSessions.find(s => s.status === 'open');

      return {
          summaryPercent,
          history: transformedSessions,
          lectures: transformedSessions,
          currentLectureId: currentLecture?.id || null
      };
      } catch (error) {
        console.error('Error getting instructor overview:', error);
        alert(`Error loading lectures: ${error.message}`);
        return { summaryPercent: 0, history: [], lectures: [], currentLectureId: null };
      }
    },

    /**
     * Get lecture with questions
     */
    async getLectureWithQuestions(lectureId) {
      try {
        if (!lectureId) return null;
        const session = await apiFetch(`/sessions/${lectureId}`);
        return transformSession(session);
      } catch (error) {
        console.error('Error getting lecture:', error);
        alert(`Error loading lecture: ${error.message}`);
        return null;
      }
    },

    /**
     * Get question responses
     */
    async getQuestionResponses(lectureId, questionId) {
      try {
        const responses = await apiFetch(`/sessions/${lectureId}/responses`);
        
        if (!responses || !responses.responsesByQuestion) {
          return [];
        }

        const questionResponses = responses.responsesByQuestion[questionId];
        if (!questionResponses || !questionResponses.responses) {
          return [];
        }

        return questionResponses.responses.map(transformResponse);
      } catch (error) {
        console.error('Error getting responses:', error);
        alert(`Error loading responses: ${error.message}`);
        return [];
      }
    },

    /**
     * Create a new lecture session
     */
    async createLecture(sessionData) {
      try {
        if (!sessionData) {
          throw new Error('Session data is required');
        }
        
        // If offering_id is missing, try to get active offering (backend will also do this)
        if (!sessionData.offering_id) {
          try {
            const activeOfferingId = await getActiveOffering();
            if (activeOfferingId) {
              sessionData.offering_id = activeOfferingId;
            }
          } catch {
            // Backend will handle fallback to active offering
            console.warn('Could not fetch active offering in frontend, backend will handle it');
          }
        }
        
        const transformed = transformSessionForCreate(sessionData);
        const session = await apiFetch('/sessions', {
          method: 'POST',
          body: JSON.stringify(transformed)
        });
        return transformSession(session);
      } catch (error) {
        console.error('Error creating lecture:', error);
        throw error;
      }
    },

    /**
     * Delete a lecture
     */
    async deleteLecture(lectureId) {
      try {
        await apiFetch(`/sessions/${lectureId}`, {
          method: 'DELETE'
        });
        return { deleted: true };
      } catch (error) {
        console.error('Error deleting lecture:', error);
        throw error;
      }
    },

    /**
     * Record student responses
     */
    async recordStudentResponses({ lectureId, answers }) {
      try {
        // Transform answers to backend format
        const responses = answers.map(answer => ({
          question_id: answer.questionId,
          response_text: answer.response || answer.response_text,
          response_option: answer.response_option || null
        }));

        const result = await apiFetch(`/attendance/sessions/${lectureId}/responses`, {
          method: 'POST',
          body: JSON.stringify({ responses })
        });

        return { success: true, responses: result };
      } catch (error) {
        console.error('Error recording responses:', error);
        throw error;
      }
    },

    /**
     * Check in with access code
     */
    async checkIn(accessCode, responses = []) {
      try {
        const transformedResponses = responses.map(r => ({
          question_id: r.questionId,
          response_text: r.response_text,
          response_option: r.response_option
        }));

        const result = await apiFetch('/attendance/check-in', {
          method: 'POST',
          body: JSON.stringify({
            access_code: accessCode,
            responses: transformedResponses
          })
        });

        return result;
      } catch (error) {
        console.error('Error checking in:', error);
        throw error;
      }
    },

    /**
     * Verify access code
     */
    async verifyAccessCode(code) {
      try {
        const result = await apiFetch(`/sessions/verify-code/${code}`);
        return result;
      } catch (error) {
        console.error('Error verifying code:', error);
        throw error;
        }
    },

    /**
     * Get student lecture list (with attendance status)
     */
    async getStudentLectureList(offeringId) {
      try {
        if (!offeringId) {
          offeringId = await getActiveOffering();
      }

        // Get sessions - fetch all (limit=1000 to ensure we get all sessions)
        const sessions = await apiFetch(`/sessions?offering_id=${offeringId}&limit=1000`);
        const sessionsArray = Array.isArray(sessions) ? sessions : [];

        // Get student's attendance
        const attendance = await apiFetch(`/attendance/my-attendance?offering_id=${offeringId}`);
        const attendanceArray = Array.isArray(attendance) ? attendance : [];

        // Create a map of session_id -> attendance status
        const attendanceMap = {};
        attendanceArray.forEach(record => {
          attendanceMap[record.session_id] = record.status;
        });

        // Transform and combine
        return sessionsArray.map(session => {
          const transformed = transformSession(session);
          const attendanceStatus = attendanceMap[session.id] || 'absent';
          const sessionState = transformed.status;

          // Determine overall status
          let status = attendanceStatus;
          if (sessionState === 'open' && attendanceStatus === 'absent') {
            status = 'open'; // Needs response
          }

        return {
            id: transformed.id,
            label: transformed.label,
            status,
            sessionState,
            startsAt: transformed.startsAt,
            endsAt: transformed.endsAt
          };
        }).sort((a, b) => {
          // Handle null/undefined dates safely
          if (!a.startsAt && !b.startsAt) return 0;
          if (!a.startsAt) return 1;
          if (!b.startsAt) return -1;
          try {
            return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
          } catch {
            return 0;
          }
        });
      } catch (error) {
        console.error('Error getting student lecture list:', error);
        alert(`Error loading lectures: ${error.message}`);
        return [];
      }
    },

    /**
     * Check if student has submitted responses
     */
    async hasStudentSubmittedResponses(lectureId) {
      try {
        const responses = await apiFetch(`/sessions/${lectureId}/my-responses`);
        return Array.isArray(responses) && responses.length > 0;
      } catch (error) {
        console.error('Error checking submissions:', error);
        return false;
      }
    },

    /**
     * Open attendance for a session
     */
    async openAttendance(sessionId) {
      try {
        const session = await apiFetch(`/sessions/${sessionId}/open-attendance`, {
          method: 'POST'
        });
        return transformSession(session);
      } catch (error) {
        console.error('Error opening attendance:', error);
        throw error;
      }
    },

    /**
     * Close attendance for a session
     */
    async closeAttendance(sessionId) {
      try {
        const session = await apiFetch(`/sessions/${sessionId}/close-attendance`, {
          method: 'POST'
        });
        return transformSession(session);
      } catch (error) {
        console.error('Error closing attendance:', error);
        throw error;
      }
    },

    /**
     * Get session statistics
     */
    async getSessionStatistics(sessionId) {
      try {
        return await apiFetch(`/sessions/${sessionId}/statistics`);
      } catch (error) {
        console.error('Error getting statistics:', error);
        throw error;
      }
    },

    /**
     * Get student statistics for a course offering
     */
    async getStudentStatistics(offeringId) {
      try {
        if (!offeringId) {
          offeringId = await getActiveOffering();
        }
        return await apiFetch(`/attendance/my-statistics/${offeringId}`);
      } catch (error) {
        console.error('Error getting student statistics:', error);
        return null;
      }
    }
  };
})();
