(function meetingAttendancePage() {
  const state = {
    meetings: [],
    filter: 'all',
    offeringId: null,
    teamId: null,
    teamName: null
  };

  const selectors = {
    list: document.getElementById('meeting-list'),
    empty: document.getElementById('meeting-empty'),
    filter: document.getElementById('meeting-filter'),
    attendancePercentage: document.getElementById('attendance-percentage'),
    container: document.querySelector('.attendance-content'),
    teamName: document.getElementById('team-name'),
    courseTitle: document.getElementById('course-title')
  };

  let isLoading = false;

  function determineMeetingStatus(meeting) {
    const now = new Date();
    
    if (meeting.attendance_opened_at && meeting.attendance_closed_at) {
      // Both timestamps are set (scheduled start/end times)
      const openTime = new Date(meeting.attendance_opened_at);
      const closeTime = new Date(meeting.attendance_closed_at);
      
      if (now < openTime) {
        return 'pending'; // Meeting hasn't started yet
      } else if (now >= openTime && now < closeTime) {
        return 'open'; // Meeting is currently open
      } else {
        return 'closed'; // Meeting has ended
      }
    } else if (meeting.attendance_opened_at && !meeting.attendance_closed_at) {
      // Only open time is set
      const openTime = new Date(meeting.attendance_opened_at);
      
      if (now < openTime) {
        return 'pending';
      }
      
      // Check if end time has passed
      if (meeting.code_expires_at) {
        const endTime = new Date(meeting.code_expires_at);
        if (endTime < now) {
          return 'closed';
        }
      }
      return 'open';
    }
    // No attendance timestamps - fall back to session_date/session_time
    if (meeting.session_date && meeting.session_time) {
      // Parse date directly to avoid timezone issues
      let dateStr = meeting.session_date;
      if (typeof dateStr === 'object') {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else {
        dateStr = String(dateStr).split('T')[0];
      }
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = meeting.session_time.split(':').map(Number);
      const startTime = new Date(year, month - 1, day, hours, minutes);
      
      if (startTime > now) {
        return 'pending';
      }
      return 'closed';
    }
    
    return 'pending';
  }

  function formatTimeRange(startIso, endIso) {
    // If both are provided, format as range
    if (startIso && endIso) {
      try {
        let start = new Date(startIso);
        let end = new Date(endIso);
        
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return '—';
        }
        
        // If end time appears to be before start time on same day, it's likely next day
        if (end <= start) {
          const startDate = new Date(start);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(end);
          endDate.setHours(0, 0, 0, 0);
          
          // If same calendar day but earlier time, add 24 hours
          if (startDate.getTime() === endDate.getTime()) {
            end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        
        const dateFormatter = new Intl.DateTimeFormat('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric'
        });
        const timeFormatter = new Intl.DateTimeFormat('en-US', { 
          hour: 'numeric', 
          minute: 'numeric'
        });
        
        const startDateStr = dateFormatter.format(start);
        const endDateStr = dateFormatter.format(end);
        const startTimeStr = timeFormatter.format(start);
        const endTimeStr = timeFormatter.format(end);
        
        // Show date only if different (end time goes to next day)
        if (endDateStr !== startDateStr) {
          return `${startDateStr} ${startTimeStr} – ${endDateStr} ${endTimeStr}`;
        } else {
          return `${startDateStr} ${startTimeStr}–${endTimeStr}`;
        }
      } catch (e) {
        console.warn('Error formatting time range:', e, startIso, endIso);
        return '—';
      }
    }
    
    // If only start is provided, format just the start
    if (startIso) {
      try {
        const start = new Date(startIso);
        if (Number.isNaN(start.getTime())) return '—';
        
        const dateFormatter = new Intl.DateTimeFormat('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric'
        });
        const timeFormatter = new Intl.DateTimeFormat('en-US', { 
          hour: 'numeric', 
          minute: 'numeric'
        });
        return `${dateFormatter.format(start)} at ${timeFormatter.format(start)}`;
      } catch (e) {
        console.warn('Error formatting start time:', e, startIso);
        return '—';
      }
    }
    
    return '—';
  }

  function buildStatusBadge(status) {
    const badge = document.createElement('span');
    badge.classList.add('lecture-badge');
    let statusLabel = status;
    if (status === 'open') {
      statusLabel = 'Needs response';
    } else if (status === 'pending') {
      statusLabel = 'Upcoming';
    }
    badge.textContent = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
    
    // Apply appropriate CSS class for styling
    if (status === 'present') {
      badge.classList.add('present');
    } else if (status === 'absent') {
      badge.classList.add('absent');
    } else if (status === 'open') {
      badge.classList.add('open');
    } else if (status === 'pending') {
      badge.classList.add('present'); // Use 'present' class for green background (same as team leader view)
    } else {
      badge.classList.add('present'); // Default
    }
    
    return badge;
  }

  function buildMeetingRow(meeting) {
    const row = document.createElement('article');
    row.className = 'lecture-item';
    row.dataset.status = meeting.status;

    const badge = buildStatusBadge(meeting.status);
    row.appendChild(badge);

    const info = document.createElement('div');
    info.className = 'lecture-info';

    const details = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'lecture-number';
    label.textContent = meeting.label;
    const time = document.createElement('p');
    time.className = 'lecture-time';
    time.textContent = formatTimeRange(meeting.startsAt, meeting.endsAt);
    details.append(label, time);

    const meta = document.createElement('div');
    meta.className = 'lecture-meta';

    const sessionStatus = document.createElement('span');
    // Only show session status for open/closed states (badge already shows 'Upcoming' for pending)
    if (meeting.sessionState === 'open') {
      sessionStatus.className = 'lecture-status open';
      sessionStatus.textContent = 'Open';
    } else if (meeting.sessionState === 'closed') {
      sessionStatus.className = 'lecture-status closed';
      sessionStatus.textContent = 'Closed';
    }
    // Don't show sessionStatus for pending state to avoid duplication with badge

    const actions = document.createElement('div');
    actions.className = 'lecture-actions';
    const actionButton = document.createElement('button');
    actionButton.className = 'btn-link';
    actionButton.type = 'button';
    if (meeting.sessionState === 'open') {
      if (meeting.status === 'present') {
        // For team meetings, hide the button when already present (no responses to view)
        actionButton.style.display = 'none';
      } else {
        actionButton.textContent = 'I\'m here';
      }
    } else if (meeting.sessionState === 'pending') {
      actionButton.textContent = 'Not available';
      actionButton.disabled = true;
      actionButton.style.opacity = '0.6';
      actionButton.style.cursor = 'not-allowed';
    } else {
      actionButton.textContent = 'Closed';
      actionButton.disabled = true;
      actionButton.style.opacity = '0.6';
      actionButton.style.cursor = 'not-allowed';
    }
    
    actionButton.addEventListener('click', async () => {
      if (meeting.sessionState === 'open' && meeting.status !== 'present') {
        // For team meetings, directly check in using the meeting's access code
        if (!meeting.accessCode) {
          alert('Unable to check in: no access code available');
          return;
        }
        
        actionButton.disabled = true;
        actionButton.textContent = 'Checking in...';
        try {
          await window.LectureService.checkIn(meeting.accessCode, []);
          // Update the meeting status
          meeting.status = 'present';
          // Hide the button after successful check-in
          actionButton.style.display = 'none';
          // Update the badge to show "Present" status
          const badge = row.querySelector('.lecture-badge');
          if (badge) {
            badge.textContent = 'Present';
            badge.className = 'lecture-badge present';
          }
          // Update overall attendance percentage
          updateOverallAttendance();
        } catch (error) {
          console.error('Error checking in:', error);
          alert(`Failed to record attendance: ${error.message}`);
          actionButton.disabled = false;
          actionButton.textContent = 'I\'m here';
        }
      }
    });
    actions.appendChild(actionButton);

    // Only append sessionStatus if it has content (open/closed, not pending)
    if (meeting.sessionState !== 'pending') {
      meta.append(sessionStatus, actions);
    } else {
      meta.appendChild(actions);
    }
    info.append(details, meta);
    row.appendChild(info);

    return row;
  }

  async function updateOverallAttendance() {
    if (!selectors.attendancePercentage || !state.offeringId) return;
    
    try {
      // Get team-specific attendance statistics - only count closed meetings
      const teamMeetings = state.meetings.filter(m => m.team_id === state.teamId);
      
      // Only count closed meetings for percentage calculation
      const closedMeetings = teamMeetings.filter(m => {
        const sessionState = determineMeetingStatus(m);
        return sessionState === 'closed';
      });
      
      const totalMeetings = closedMeetings.length;
      const presentCount = closedMeetings.filter((m) => m.status === 'present').length;
      const percent = totalMeetings > 0
        ? Math.round((presentCount / totalMeetings) * 100)
        : 0;
      selectors.attendancePercentage.textContent = `${percent}%`;
    } catch (error) {
      console.error('Error updating overall attendance:', error);
      selectors.attendancePercentage.textContent = '0%';
    }
  }

  function renderMeetings() {
    if (!selectors.list || isLoading) return;
    selectors.list.innerHTML = '';
    
    const filtered = state.meetings.filter((meeting) => {
      if (state.filter === 'all') return true;
      return meeting.status === state.filter || meeting.sessionState === state.filter;
    });

    if (!filtered.length) {
      selectors.empty?.removeAttribute('hidden');
      return;
    }
    selectors.empty?.setAttribute('hidden', 'true');

    filtered.forEach((meeting) => {
      selectors.list.appendChild(buildMeetingRow(meeting));
    });
  }

  function showLoading() {
    isLoading = true;
    if (selectors.list) {
      selectors.list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-600);">Loading meetings...</p>';
    }
  }

  async function getTeamInfo() {
    try {
      // Get user's team using the my-team endpoint
      if (!state.offeringId) return null;
      
      const myTeamResponse = await fetch(`/api/teams/my-team?offering_id=${state.offeringId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!myTeamResponse.ok) {
        return null;
      }
      
      const teamData = await myTeamResponse.json();
      
      // Handle both response formats: { team: {...} } or direct object
      const team = teamData.team || teamData;
      
      if (team && team.id) {
        return { 
          id: team.id, 
          name: team.name || `Team ${team.team_number || ''}`,
          number: team.team_number
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting team info:', error);
      return null;
    }
  }

  function updateCourseTitle(offering, teamInfo) {
    if (!selectors.courseTitle) return;
    
    try {
      const courseName = offering?.name || offering?.code || 'Course';
      const teamDisplay = teamInfo?.number ? `Team ${teamInfo.number}` : (teamInfo?.name || 'Your Team');
      
      if (teamInfo) {
        selectors.courseTitle.textContent = `${teamDisplay} - ${courseName}`;
      } else {
        selectors.courseTitle.textContent = `${courseName} - Meeting Attendance`;
      }
    } catch (error) {
      console.error('Error updating course title:', error);
      selectors.courseTitle.textContent = 'Meeting Attendance';
    }
  }

  async function hydrateStudentView() {
    if (!window.LectureService || !selectors.container) return;

    showLoading();

    try {
      // Server-side routing already handles team lead vs student view
      // No need to check and redirect here - if we're on this page, we should be a student
      
      // Get offering ID and offering info
      state.offeringId = selectors.container.getAttribute('data-offering-id');
      if (!state.offeringId) {
        state.offeringId = await window.LectureService.getActiveOfferingId();
        selectors.container.dataset.offeringId = state.offeringId;
      }

      // Get course offering details
      let offering = null;
      try {
        const offeringResponse = await fetch(`/api/offerings/${state.offeringId}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (offeringResponse.ok) {
          offering = await offeringResponse.json();
        }
      } catch (err) {
        console.warn('Could not fetch offering details:', err);
      }

      // Get team info
      const teamInfo = await getTeamInfo();
      if (teamInfo) {
        state.teamId = teamInfo.id;
        state.teamName = teamInfo.name;
        if (selectors.teamName) {
          selectors.teamName.textContent = `Team ${teamInfo.number || teamInfo.name}`;
        }
      } else if (selectors.teamName) {
        selectors.teamName.textContent = 'No team assigned';
      }

      // Update course title
      updateCourseTitle(offering, teamInfo);

      // Get meeting list (team-specific sessions)
      // Fetch sessions directly from API to get team_id
      try {
        const sessionsResponse = await fetch(`/api/sessions?offering_id=${state.offeringId}&limit=1000`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (sessionsResponse.ok) {
          const sessionsArray = await sessionsResponse.json();
          const attendanceResponse = await fetch(`/api/attendance/my-attendance?offering_id=${state.offeringId}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          const attendanceArray = attendanceResponse.ok ? await attendanceResponse.json() : [];
          
          const attendanceMap = {};
          attendanceArray.forEach(record => {
            attendanceMap[record.session_id] = record.status;
          });
          
          // Transform sessions and filter to team meetings (ONLY sessions with team_id, NOT lectures)
          const transformedSessions = sessionsArray
            .filter(s => s.team_id && s.team_id === state.teamId)
            .map(session => {
              // If a transformSession helper exists, use it. Otherwise fall back to a safe default
              let transformed;
              if (globalThis.LectureService && typeof globalThis.LectureService.transformSession === 'function') {
                transformed = globalThis.LectureService.transformSession(session);
              } else {
                transformed = {
                  id: session.id,
                  label: session.title,
                  startsAt: null,
                  endsAt: null,
                  status: 'closed',
                  team_id: session.team_id,
                  accessCode: session.access_code
                };
              }
              const attendanceStatus = attendanceMap[session.id] || 'absent';
              const sessionState = transformed?.status || 'closed';
              let status = attendanceStatus;
              
              // For open sessions where user hasn't attended, show as 'open'
              if (sessionState === 'open' && attendanceStatus === 'absent') {
                status = 'open';
              }
              
              // For pending/upcoming sessions, show as 'pending' instead of 'absent'
              if (sessionState === 'pending') {
                status = 'pending';
              }
              
              // Build proper start/end times from session_date and session_time
              let startsAt = null;
              let endsAt = null;
              
              if (session.session_date && session.session_time) {
                // Parse the date and time components
                const sessionDate = new Date(session.session_date);
                const year = sessionDate.getUTCFullYear();
                const month = sessionDate.getUTCMonth();
                const day = sessionDate.getUTCDate();
                
                const [hours, minutes] = session.session_time.split(':').map(Number);
                
                // Create start time in LOCAL time (not UTC) - matching team leader view
                startsAt = new Date(year, month, day, hours, minutes);
              }
              
              // Calculate end time - try session_end_time first, then fallback to attendance timestamps
              if (startsAt && session.session_end_time) {
                const sessionDate = new Date(session.session_date);
                const year = sessionDate.getUTCFullYear();
                const month = sessionDate.getUTCMonth();
                const day = sessionDate.getUTCDate();
                
                const [hours, minutes] = session.session_end_time.split(':').map(Number);
                endsAt = new Date(year, month, day, hours, minutes);
              } else if (session.attendance_closed_at) {
                endsAt = new Date(session.attendance_closed_at);
              } else if (session.code_expires_at) {
                endsAt = new Date(session.code_expires_at);
              }
              
              return {
                ...session, // Preserve all original fields (timestamps, etc.)
                id: transformed.id,
                label: transformed.label || session.title,
                title: session.title,
                status,
                sessionState,
                startsAt,
                endsAt,
                team_id: session.team_id,
                accessCode: transformed.accessCode || session.access_code
              };
            })
            .sort((a, b) => {
              if (!a.startsAt && !b.startsAt) return 0;
              if (!a.startsAt) return 1;
              if (!b.startsAt) return -1;
              return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
            });
          
          state.meetings = transformedSessions;
        } else {
          state.meetings = [];
        }
      } catch (error) {
        console.error('Error fetching meetings:', error);
        state.meetings = [];
      }
      
      await updateOverallAttendance();
      isLoading = false;
      renderMeetings();
    } catch (error) {
      console.error('Error hydrating student view:', error);
      isLoading = false;
      if (selectors.list) {
        selectors.list.innerHTML = `<p style="color: var(--red-600); text-align: center; padding: 2rem;">Error loading meetings: ${error.message}</p>`;
      }
      alert(`Error loading meetings: ${error.message}`);
    }
  }

  function initFilter() {
    if (!selectors.filter) return;
    selectors.filter.addEventListener('change', (event) => {
      state.filter = event.target.value;
      renderMeetings();
    });
  }

  function initHamburger() {
    const hamburger = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    if (!hamburger || !sidebar) return;

    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      sidebar.classList.toggle('open');
      body.classList.toggle('menu-open');
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 &&
          sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !hamburger.contains(e.target)) {
        hamburger.setAttribute('aria-expanded', 'false');
        sidebar.classList.remove('open');
        body.classList.remove('menu-open');
      }
    });
  }

  function init() {
    initHamburger();
    initFilter();
    hydrateStudentView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

