/**
 * Dashboard Service - Shared functionality for all dashboard types
 * Handles API calls and data fetching for dashboards
 * Usage: Include this before dashboard-specific scripts
 */

(function() {
  'use strict';
  
  const API_BASE = '/api';

  /**
   * Fetch wrapper with authentication
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

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get active offering ID
   */
  async function getActiveOfferingId() {
    try {
      const response = await apiFetch('/offerings/active');
      return response.id;
    } catch (error) {
      console.error('Error getting active offering:', error);
      return null;
    }
  }

  /**
   * Get offering details with stats
   */
  async function getOfferingWithStats(offeringId) {
    return apiFetch(`/offerings/${offeringId}`);
  }

  /**
   * Dashboard TODO API helpers
   */
  async function getDashboardTodos() {
    const data = await apiFetch('/dashboard-todos');
    return Array.isArray(data.todos) ? data.todos : [];
  }

  async function createDashboardTodo(title) {
    return apiFetch('/dashboard-todos', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  }

  async function updateDashboardTodo(id, updates) {
    return apiFetch(`/dashboard-todos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates || {})
    });
  }

  async function deleteDashboardTodo(id) {
    await apiFetch(`/dashboard-todos/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get teams for an offering
   */
  async function getTeams(offeringId) {
    const response = await apiFetch(`/teams?offering_id=${offeringId}`);
    return response.teams || (Array.isArray(response) ? response : []);
  }

  /**
   * Get students for an offering
   */
  async function getStudents(offeringId) {
    const students = await apiFetch(`/enrollments/offering/${offeringId}/students?limit=1000`);
    return Array.isArray(students) ? students : [];
  }

  /**
   * Get TAs for an offering
   */
  async function getTAs(offeringId) {
    return apiFetch(`/enrollments/offering/${offeringId}/tas?limit=1000`);
  }

  /**
   * Get tutors for an offering
   */
  async function getTutors(offeringId) {
    return apiFetch(`/enrollments/offering/${offeringId}/tutors?limit=1000`);
  }

  /**
   * Get user's enrollment in an offering
   */
  async function getUserEnrollment(offeringId, userId) {
    try {
      return await apiFetch(`/enrollments/offering/${offeringId}/user/${userId}`);
    } catch (error) {
      console.error('Error getting user enrollment:', error);
      return null;
    }
  }

  /**
   * Update course info in DOM
   */
  function updateCourseInfo(offering) {
    const courseCode = document.querySelector('.course-code');
    const courseTitle = document.querySelector('.course-title');
    const courseTerm = document.querySelector('.course-term');
    
    if (courseCode && offering.code) {
      courseCode.textContent = offering.code;
    }
    if (courseTitle && offering.name) {
      courseTitle.textContent = offering.name;
    }
    if (courseTerm && offering.term) {
      courseTerm.textContent = offering.term;
    }
  }

  /**
   * Update stats in DOM by matching label text
   */
  function updateStats(stats) {
    const statItems = document.querySelectorAll('.stat-item');
    statItems.forEach((item) => {
      const label = item.querySelector('.stat-label');
      const value = item.querySelector('.stat-value');
      if (!label || !value) return;
      
      const labelText = label.textContent.trim();
      if (stats[labelText] !== undefined) {
        value.textContent = stats[labelText];
      }
    });
  }

  /**
   * Calculate course progress percentage from start/end dates
   */
  function calculateCourseProgress(offering) {
    if (!offering || !offering.start_date || !offering.end_date) {
      return null;
    }

    const start = new Date(offering.start_date);
    const end = new Date(offering.end_date);
    const now = new Date();

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return null;
    }

    const total = end.getTime() - start.getTime();
    const elapsedRaw = now.getTime() - start.getTime();
    const elapsed = Math.min(Math.max(elapsedRaw, 0), total);

    return Math.round((elapsed / total) * 100);
  }

  /**
   * Update course status circular progress card, if present
   */
  function updateCourseProgress(offering) {
    const percent = calculateCourseProgress(offering);
    if (percent == null) return;

    const card = document.querySelector('.course-status-card');
    if (!card) return;

    const progressText = card.querySelector('.progress-text');
    if (progressText) {
      progressText.textContent = `${percent}%`;
    }

    const svgCircle = card.querySelector('.circular-progress svg circle:nth-of-type(2)');
    if (svgCircle) {
      const circumference = 176;
      const offset = circumference * (1 - percent / 100);
      svgCircle.setAttribute('stroke-dashoffset', String(offset));
    }
  }

  /**
   * Render teams list in DOM
   */
  function renderTeamsList(teams, containerSelector = '.teams-list') {
    const teamsList = document.querySelector(containerSelector);
    if (!teamsList) return;

    if (!Array.isArray(teams) || teams.length === 0) {
      teamsList.innerHTML = '<p style="padding: 1rem; color: var(--gray-600);">No teams found</p>';
      return;
    }

    teamsList.innerHTML = teams.map(team => {
      const memberCount = parseInt(team.member_count || team.members?.length || 0);
      const teamName = team.name || (team.team_number ? `Team ${team.team_number}` : `Team ${team.id}`);
      return `
        <a href="/teams/${team.id}" class="team-item" aria-label="${teamName}">
          <span class="team-name">${teamName}</span>
          <span class="team-count">${memberCount} ${memberCount === 1 ? 'member' : 'members'}</span>
        </a>
      `;
    }).join('');
  }

  /**
   * Get announcements for an offering
   */
  async function getAnnouncements(offeringId) {
    try {
      const response = await apiFetch(`/offerings/${offeringId}/announcements`);
      return Array.isArray(response) ? response : (response.announcements || []);
    } catch (error) {
      console.error('Error getting announcements:', error);
      return [];
    }
  }

  /**
   * Create an announcement
   */
  async function createAnnouncement(offeringId, announcementData) {
    return apiFetch(`/offerings/${offeringId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(announcementData)
    });
  }

  /**
   * Get attendance statistics for a session
   */
  async function getSessionStatistics(sessionId) {
    try {
      return await apiFetch(`/attendance/sessions/${sessionId}/statistics`);
    } catch (error) {
      console.error('Error getting session statistics:', error);
      return null;
    }
  }

  /**
   * Get attendance sessions for an offering
   */
  async function getAttendanceSessions(offeringId) {
    try {
      const response = await apiFetch(`/sessions?offering_id=${offeringId}`);
      return Array.isArray(response) ? response : (response.sessions || []);
    } catch (error) {
      console.error('Error getting attendance sessions:', error);
      return [];
    }
  }

  /**
   * Get current user's team for an offering
   */
  async function getMyTeam(offeringId) {
    try {
      const response = await apiFetch(`/teams/my-team?offering_id=${offeringId}`);
      return response.team || null;
    } catch {
      // User might not be in a team, which is fine
      return null;
    }
  }

  /**
   * Format class timings from JSONB to readable format (e.g., "TTh 2:00 PM - 3:20 PM")
   */
  function formatClassTimings(classTimings) {
    if (!classTimings || typeof classTimings !== 'object') {
      return null;
    }

    // Handle array of timing objects
    if (Array.isArray(classTimings)) {
      return classTimings.map(timing => formatSingleTiming(timing)).filter(Boolean).join('; ');
    }

    // Handle single timing object
    return formatSingleTiming(classTimings);
  }

  function formatSingleTiming(timing) {
    if (!timing || typeof timing !== 'object') return null;

    const days = timing.days || timing.day || [];
    const startTime = timing.start_time || timing.startTime;
    const endTime = timing.end_time || timing.endTime;

    if (!days || days.length === 0) return null;

    // Format days (e.g., ["Tuesday", "Thursday"] -> "TTh")
    const dayAbbrev = {
      'Monday': 'M',
      'Tuesday': 'T',
      'Wednesday': 'W',
      'Thursday': 'Th',
      'Friday': 'F',
      'Saturday': 'S',
      'Sunday': 'Su'
    };

    const dayCodes = days.map(day => {
      const dayName = typeof day === 'string' ? day : day.name || day.day;
      return dayAbbrev[dayName] || dayName.substring(0, 2);
    }).join('');

    // Format times
    let timeStr = '';
    if (startTime) {
      const start = formatTime(startTime);
      const end = endTime ? formatTime(endTime) : null;
      timeStr = start + (end ? ` - ${end}` : '');
    }

    return timeStr ? `${dayCodes} ${timeStr}` : dayCodes;
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    
    try {
      // Handle "HH:MM" or "HH:MM:SS" format
      const parts = timeStr.split(':');
      if (parts.length < 2) return timeStr;

      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      if (hours === 0) hours = 12;
      else if (hours > 12) hours -= 12;

      return `${hours}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  }

  /**
   * Get current user info
   */
  async function getCurrentUser() {
    try {
      return await apiFetch('/users/me');
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Update welcome message with user's name and role
   */
  async function updateWelcomeMessage(offeringId) {
    try {
      const welcomeH2 = document.querySelector('.welcome-content h2');
      const welcomeP = document.querySelector('.welcome-content p');
      
      if (!welcomeH2 || !welcomeP) return;

      // Get current user
      const user = await getCurrentUser();
      if (!user) return;

      // Get user's enrollment role in the offering
      let enrollmentRole = null;
      if (offeringId && user.id) {
        const enrollment = await getUserEnrollment(offeringId, user.id);
        if (enrollment && enrollment.course_role) {
          enrollmentRole = enrollment.course_role.toUpperCase(); // "ta", "tutor", "student"
        }
      }

      // Use preferred_name or name
      const displayName = user.preferred_name || user.name || 'User';
      
      // Update welcome heading
      welcomeH2.textContent = `Welcome, ${displayName}!`;

      // Update welcome message based on role
      if (enrollmentRole) {
        const roleDisplay = enrollmentRole === 'TA' ? 'TA' : 
                           enrollmentRole === 'TUTOR' ? 'Tutor' :
                           enrollmentRole === 'STUDENT' ? 'Student' : enrollmentRole;
        welcomeP.textContent = `You are registered in the course as a ${roleDisplay}.`;
      } else if (user.primary_role === 'instructor') {
        welcomeP.textContent = 'See what happened with your course and team!';
      } else if (user.primary_role) {
        // Fallback to primary role if no enrollment role
        const roleDisplay = user.primary_role === 'student' ? 'Student' :
                           user.primary_role.charAt(0).toUpperCase() + user.primary_role.slice(1);
        welcomeP.textContent = `You are registered in the course as a ${roleDisplay}.`;
      } else {
        welcomeP.textContent = 'See what happened with your course and team!';
      }
    } catch (error) {
      console.error('Error updating welcome message:', error);
    }
  }

  /**
   * Update sticky header (polaroid course info) with course details
   */
  async function updateStickyHeader(offeringId) {
    try {
      const courseInfoContainer = document.querySelector('.course-info');
      if (!courseInfoContainer) return;

      // Get offering details
      const offering = await getOfferingWithStats(offeringId);
      if (!offering) return;

      // Get user's team (if any)
      const userTeam = await getMyTeam(offeringId);

      // Build course title
      const courseTitle = courseInfoContainer.querySelector('h3');
      if (courseTitle) {
        const title = offering.code && offering.name 
          ? `${offering.code}: ${offering.name}`
          : offering.code || offering.name || 'Course';
        courseTitle.textContent = title;
      }

      // Build course details
      const detailsContainer = courseInfoContainer.querySelector('p');
      if (detailsContainer) {
        const details = [];

        // Term and Year (e.g., "Fall 2025")
        if (offering.term || offering.year) {
          const termYear = [offering.term, offering.year].filter(Boolean).join(' ');
          if (termYear) details.push(termYear);
        }

        // Department (if available)
        if (offering.department) {
          details.push(offering.department);
        }

        // Credits (if available)
        if (offering.credits) {
          details.push(`${offering.credits} credit${offering.credits !== 1 ? 's' : ''}`);
        }

        // Class timings (e.g., "TTh 2:00 PM - 3:20 PM")
        const timings = formatClassTimings(offering.class_timings);
        if (timings) {
          details.push(`📅 ${timings}`);
        }

        // Location (e.g., "CSE Building, Room 1202")
        if (offering.location) {
          details.push(`📍 ${offering.location}`);
        }

        // Team information (for students only - not for instructors/TAs/tutors)
        if (userTeam) {
          const teamName = userTeam.name || (userTeam.team_number ? `Team ${userTeam.team_number}` : 'Team');
          const role = userTeam.user_role === 'leader' ? 'Leader' : 'Member';
          details.push(`👥 ${teamName} (${role})`);
        }

        // Fallback if no details
        if (details.length === 0) {
          details.push('Course information');
        }

        detailsContainer.innerHTML = details.join('<br>');
      }
    } catch (error) {
      console.error('Error updating sticky header:', error);
    }
  }

  // Expose to global scope
  window.DashboardService = {
    getActiveOfferingId,
    getOfferingWithStats,
    getTeams,
    getStudents,
    getTAs,
    getTutors,
    getUserEnrollment,
    updateCourseInfo,
    updateStats,
    renderTeamsList,
    updateCourseProgress,
    // Dashboard todos
    getDashboardTodos,
    createDashboardTodo,
    updateDashboardTodo,
    deleteDashboardTodo,
    // Announcements
    getAnnouncements,
    createAnnouncement,
    // Attendance
    getSessionStatistics,
    getAttendanceSessions,
    // Team info
    getMyTeam,
    // User info
    getCurrentUser,
    // Sticky header
    updateStickyHeader,
    updateWelcomeMessage
  };
})();
