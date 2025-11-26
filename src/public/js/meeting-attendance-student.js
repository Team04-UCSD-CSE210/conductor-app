(function meetingAttendancePage() {
  const state = {
    meetings: [],
    filter: 'all',
    offeringId: null,
    userTeam: null
  };

  const selectors = {
    list: document.getElementById('meeting-list'),
    empty: document.getElementById('meeting-empty'),
    filter: document.getElementById('meeting-filter'),
    attendancePercentage: document.getElementById('attendance-percentage'),
    container: document.querySelector('.attendance-content'),
    courseTitle: document.getElementById('course-title')
  };

  let isLoading = false;

  function formatDate(dateString) {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (e) {
      console.warn('Error formatting date:', e, dateString);
      return '—';
    }
  }

  function buildStatusBadge(status, sessionState) {
    const badge = document.createElement('span');
    badge.classList.add('lecture-badge');
    
    if (sessionState === 'open') {
      badge.textContent = 'Open';
      badge.classList.add('open');
    } else if (status === 'present') {
      badge.textContent = 'Checked In';
      badge.classList.add('present');
    } else if (sessionState === 'closed' && status !== 'present') {
      badge.textContent = 'Missed';
      badge.classList.add('absent');
    } else {
      badge.textContent = 'Upcoming';
      badge.classList.add('present');
    }
    
    return badge;
  }

  function isMeetingOpen(meeting) {
    if (meeting.status === 'open') return true;
    
    if (meeting.status === 'closed') return false;
    
    // Otherwise, check if it's currently within the meeting time
    // For now, without end_time, we can't determine this automatically
    return false;
  }

  function buildMeetingRow(meeting) {
    const row = document.createElement('article');
    row.className = 'lecture-item';
    
    const isOpen = isMeetingOpen(meeting);
    
    // Determine if meeting is past by comparing session_date + session_time with now
    let isPast = false;
    if (meeting.status === 'closed') {
      isPast = true;
    } else if (meeting.session_date && meeting.session_time) {
      // Combine session_date and session_time to create a full datetime
      const meetingDateTime = new Date(`${meeting.session_date}T${meeting.session_time}`);
      const now = new Date();
      // If the meeting time is more than 2 hours ago, consider it past
      isPast = !isOpen && (now - meetingDateTime) > (2 * 60 * 60 * 1000);
    }
    
    const sessionState = isOpen ? 'open' : (isPast ? 'closed' : 'pending');
    row.dataset.status = meeting.attendanceStatus || (isOpen ? 'open' : 'pending');

    const badge = buildStatusBadge(meeting.attendanceStatus, sessionState);
    row.appendChild(badge);

    const info = document.createElement('div');
    info.className = 'lecture-info';

    const details = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'lecture-number';
    label.textContent = meeting.title || meeting.name || 'Team Meeting';
    
    const time = document.createElement('p');
    time.className = 'lecture-time';
    
    // Format date and time display
    const displayDate = meeting.session_date || meeting.scheduled_date || meeting.created_at;
    const dateStr = formatDate(displayDate);
    
    // Format time if available
    let timeStr = '';
    if (meeting.session_time) {
      // session_time is stored as HH:MM:SS, format it nicely
      const timeParts = meeting.session_time.split(':');
      if (timeParts.length >= 2) {
        const hour = parseInt(timeParts[0], 10);
        const minute = timeParts[1];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        timeStr = `${displayHour}:${minute} ${ampm}`;
      }
    }
    
    time.textContent = timeStr ? `${dateStr} at ${timeStr}` : dateStr;
    
    details.append(label, time);

    const meta = document.createElement('div');
    meta.className = 'lecture-meta';

    const sessionStatus = document.createElement('span');
    if (isOpen) {
      sessionStatus.className = 'lecture-status open';
      sessionStatus.textContent = 'Open';
    } else if (meeting.status === 'closed') {
      sessionStatus.className = 'lecture-status closed';
      sessionStatus.textContent = 'Closed';
    } else {
      sessionStatus.className = 'lecture-status pending';
      sessionStatus.textContent = 'Upcoming';
    }

    const actions = document.createElement('div');
    actions.className = 'lecture-actions';
    const actionButton = document.createElement('button');
    actionButton.className = 'btn-link';
    actionButton.type = 'button';
    
    if (isOpen) {
      actionButton.textContent = meeting.attendanceStatus === 'present' ? 'View responses' : 'Check In';
    } else if (meeting.status === 'closed') {
      actionButton.textContent = 'View responses';
    } else {
      actionButton.textContent = 'Not available';
      actionButton.disabled = true;
      actionButton.style.opacity = '0.6';
      actionButton.style.cursor = 'not-allowed';
    }
    
    actionButton.addEventListener('click', () => {
      if (isOpen || meeting.status === 'closed') {
        window.location.href = `/student-lecture-response?sessionId=${meeting.id}`;
      }
    });
    
    actions.appendChild(actionButton);

    meta.append(sessionStatus, actions);
    info.append(details, meta);
    row.appendChild(info);

    return row;
  }

  async function updateOverallAttendance() {
    if (!selectors.attendancePercentage || !state.meetings.length) {
      if (selectors.attendancePercentage) {
        selectors.attendancePercentage.textContent = '0%';
      }
      return;
    }
    
    try {
      const totalMeetings = state.meetings.length;
      const presentCount = state.meetings.filter((meeting) => meeting.attendanceStatus === 'present').length;
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
      
      const isOpen = isMeetingOpen(meeting);
      
      // Determine if past using same logic as buildMeetingRow
      let isPast = false;
      if (meeting.status === 'closed') {
        isPast = true;
      } else if (meeting.session_date && meeting.session_time) {
        const meetingDateTime = new Date(`${meeting.session_date}T${meeting.session_time}`);
        const now = new Date();
        isPast = !isOpen && (now - meetingDateTime) > (2 * 60 * 60 * 1000);
      }
      
      if (state.filter === 'open') {
        return isOpen;
      } else if (state.filter === 'present') {
        return meeting.attendanceStatus === 'present';
      } else if (state.filter === 'absent') {
        return isPast && meeting.attendanceStatus !== 'present';
      }
      
      return false;
    });

    if (!filtered.length) {
      selectors.empty?.removeAttribute('hidden');
      const emptyMessage = state.userTeam 
        ? (state.meetings.length === 0 
            ? 'No team meetings scheduled yet. Your team lead will create meetings when ready.'
            : 'No meetings match this filter.')
        : 'You are not currently assigned to a team. Please contact your instructor.';
      if (selectors.empty) {
        const emptyP = selectors.empty.querySelector('p');
        if (emptyP) emptyP.textContent = emptyMessage;
      }
      return;
    }
    
    selectors.empty?.setAttribute('hidden', 'true');

    // Sort by date (most recent first)
    filtered.sort((a, b) => {
      // Use session_date + session_time for sorting
      const dateA = a.session_date && a.session_time 
        ? new Date(`${a.session_date}T${a.session_time}`)
        : new Date(a.created_at || 0);
      const dateB = b.session_date && b.session_time
        ? new Date(`${b.session_date}T${b.session_time}`)
        : new Date(b.created_at || 0);
      return dateB - dateA;
    });

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

  async function getUserInfo() {
    try {
      const response = await fetch('/api/user', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch user info');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  }

  async function getActiveCourseOffering() {
    try {
      // Use LectureService if available (same as lecture page)
      if (window.LectureService) {
        const offeringId = await window.LectureService.getActiveOfferingId();
        if (offeringId) {
          // Fetch full offering details
          const response = await fetch(`/api/offerings/${offeringId}`, {
            credentials: 'include'
          });
          if (response.ok) {
            return await response.json();
          }
        }
      }
      
      // Fallback: try direct API call
      const response = await fetch('/api/offerings/active', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch active offering');
      const data = await response.json();
      return data.offering || data;
    } catch (error) {
      console.error('Error fetching active offering:', error);
      return null;
    }
  }

  async function getUserTeam(userId, offeringId) {
    try {
      const response = await fetch(`/api/teams/my-team?offering_id=${offeringId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.error('User is not assigned to a team');
        } else {
          console.error('Failed to fetch user team:', response.status);
        }
        return null;
      }

      const data = await response.json();
      return data.team || null;
    } catch (error) {
      console.error('Error fetching user team:', error);
      return null;
    }
  }

  async function fetchMeetings() {
    try {
      if (!state.offeringId) return [];

      // Use the same endpoint as lectures - server already filters by team membership
      const response = await fetch(`/api/sessions?offering_id=${state.offeringId}&limit=1000`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch meetings:', response.status);
        return [];
      }

      const data = await response.json();
      // Server returns: course-wide sessions (team_id=null) + user's team sessions
      // We only want team sessions (meetings), so filter out course-wide lectures
      const sessions = Array.isArray(data) ? data : [];
      const meetings = sessions.filter(session => session.team_id != null);
      
      return meetings;
    } catch (error) {
      console.error('Error fetching meetings:', error);
      return [];
    }
  }

  async function fetchAttendanceRecords() {
    try {
      if (!state.offeringId) return [];

      // Use the same endpoint as lectures
      const response = await fetch(`/api/attendance/my-attendance?offering_id=${state.offeringId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Failed to fetch attendance records:', response.status);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }
  }

  async function updateTeamTitle() {
    if (!selectors.courseTitle || !state.userTeam) return;
    
    try {
      const teamDisplay = state.userTeam.team_number 
        ? `Team ${state.userTeam.team_number}` 
        : state.userTeam.name;
      selectors.courseTitle.textContent = `${teamDisplay} Meetings`;
    } catch (error) {
      console.error('Error updating team title:', error);
      selectors.courseTitle.textContent = 'Meeting Attendance';
    }
  }

  async function hydrateMeetingView() {
    if (!selectors.container) return;

    showLoading();

    try {
      const user = await getUserInfo();
      if (!user) {
        throw new Error('Failed to get user info');
      }

      const offering = await getActiveCourseOffering();
      if (!offering) {
        throw new Error('No active course offering found');
      }

      state.offeringId = offering.id;
      if (selectors.container) {
        selectors.container.setAttribute('data-offering-id', state.offeringId);
      }

      state.userTeam = await getUserTeam(user.id, state.offeringId);
      
      if (!state.userTeam) {
        console.log('User is not assigned to a team');
        if (selectors.courseTitle) {
          selectors.courseTitle.textContent = 'Meeting Attendance - No Team Assigned';
        }
        isLoading = false;
        if (selectors.list) {
          selectors.list.hidden = true;
        }
        if (selectors.empty) {
          selectors.empty.hidden = false;
          const emptyP = selectors.empty.querySelector('p');
          if (emptyP) {
            emptyP.textContent = 'You are not currently assigned to a team. Please contact your instructor.';
          }
        }
        if (selectors.attendancePercentage) {
          selectors.attendancePercentage.textContent = '0%';
        }
        return;
      }

      // Redirect team leaders to the team lead page
      const isTeamLeader = state.userTeam.user_role === 'leader' || 
                           state.userTeam.leader_id === user.id;
      
      if (isTeamLeader) {
        console.log('User is team leader, redirecting to team lead page...');
        window.location.href = '/meeting-attendance-team-lead';
        return;
      }

      await updateTeamTitle();

      const [meetings, records] = await Promise.all([
        fetchMeetings(),
        fetchAttendanceRecords()
      ]);

      const recordMap = {};
      records.forEach(record => {
        recordMap[record.session_id] = record;
      });

      state.meetings = meetings.map(meeting => ({
        ...meeting,
        attendanceStatus: recordMap[meeting.id]?.status || null
      }));

      await updateOverallAttendance();
      isLoading = false;
      renderMeetings();
    } catch (error) {
      console.error('Error hydrating meeting view:', error);
      isLoading = false;
      if (selectors.list) {
        selectors.list.innerHTML = `<p style="color: var(--red-600); text-align: center; padding: 2rem;">Error loading meetings: ${error.message}</p>`;
      }
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

  function initContactButtons() {
    const contactTA = document.getElementById('contact-ta');
    const contactInstructor = document.getElementById('contact-instructor');
    const handler = (recipient) => () => window.alert(`Message the ${recipient} through Slack or email.`);

    if (contactTA) contactTA.addEventListener('click', handler('TA'));
    if (contactInstructor) contactInstructor.addEventListener('click', handler('Instructor'));
  }

  function init() {
    initHamburger();
    initFilter();
    initContactButtons();
    hydrateMeetingView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();



