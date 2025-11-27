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
    renderTeamsList
  };
})();
