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

  function formatTimeRange(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    try {
      const start = new Date(startIso);
      const end = new Date(endIso);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return '—';
      }
      
      const dateFormatter = new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', { 
        hour: 'numeric', 
        minute: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      return `${dateFormatter.format(start)} ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
    } catch (e) {
      console.warn('Error formatting time range:', e, startIso, endIso);
      return '—';
    }
  }

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

  function formatTime(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      console.warn('Error formatting time:', e, dateString);
      return '';
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
    if (meeting.status !== 'open') return false;
    
    const now = new Date();
    const startTime = meeting.start_time ? new Date(meeting.start_time) : null;
    const endTime = meeting.end_time ? new Date(meeting.end_time) : null;
    
    if (startTime && endTime) {
      return now >= startTime && now <= endTime;
    }
    
    return meeting.status === 'open';
  }

  function buildMeetingRow(meeting) {
    const row = document.createElement('article');
    row.className = 'lecture-item';
    
    const isOpen = isMeetingOpen(meeting);
    const sessionState = isOpen ? 'open' : (meeting.status === 'closed' ? 'closed' : 'pending');
    row.dataset.status = meeting.attendanceStatus || (isOpen ? 'open' : 'pending');

    const badge = buildStatusBadge(meeting.attendanceStatus, sessionState);
    row.appendChild(badge);

    const info = document.createElement('div');
    info.className = 'lecture-info';

    const details = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'lecture-number';
    label.textContent = meeting.name || 'Team Meeting';
    
    const time = document.createElement('p');
    time.className = 'lecture-time';
    if (meeting.start_time && meeting.end_time) {
      time.textContent = formatTimeRange(meeting.start_time, meeting.end_time);
    } else {
      const displayDate = meeting.scheduled_date || meeting.start_time || meeting.created_at;
      const dateStr = formatDate(displayDate);
      const timeStr = meeting.start_time ? formatTime(meeting.start_time) : '';
      time.textContent = `${dateStr}${timeStr ? ' at ' + timeStr : ''}`;
    }
    
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
      const isPast = meeting.status === 'closed' || (!isOpen && meeting.end_time && new Date(meeting.end_time) < new Date());
      
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
      const dateA = new Date(a.start_time || a.scheduled_date || a.created_at);
      const dateB = new Date(b.start_time || b.scheduled_date || b.created_at);
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
      const response = await fetch(`/api/teams?offering_id=${offeringId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch teams:', response.status);
        return null;
      }

      const data = await response.json();
      const teams = data.teams || [];
      
      for (const team of teams) {
        if (team.leader_id === userId) {
          return team;
        }
        
        try {
          const membersResponse = await fetch(`/api/teams/${team.id}/members`, {
            credentials: 'include'
          });
          
          if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            const isMember = membersData.members?.some(m => m.user_id === userId);
            if (isMember) {
              return team;
            }
          }
        } catch (err) {
          console.error('Error checking team membership:', err);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user team:', error);
      return null;
    }
  }

  async function fetchMeetings() {
    try {
      if (!state.offeringId) return [];

      const response = await fetch(`/api/sessions?offering_id=${state.offeringId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch meetings:', response.status);
        return [];
      }

      const data = await response.json();
      let sessions = data.sessions || [];
      
      if (state.userTeam) {
        sessions = sessions.filter(session => session.team_id === state.userTeam.id);
      } else {
        sessions = [];
      }
      
      return sessions;
    } catch (error) {
      console.error('Error fetching meetings:', error);
      return [];
    }
  }

  async function fetchAttendanceRecords() {
    try {
      if (!state.offeringId) return [];

      const response = await fetch(`/api/attendance/my-records?offering_id=${state.offeringId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Failed to fetch attendance records:', response.status);
        return [];
      }

      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }
  }

  async function updateTeamTitle() {
    if (!selectors.courseTitle || !state.userTeam) return;
    
    try {
      console.log('User Team ID:', state.userTeam.id);
      console.log('User Team Data:', state.userTeam);

      const teamDisplay = state.userTeam.team_number 
        ? `Team ${state.userTeam.team_number}` 
        : state.userTeam.name;
      selectors.courseTitle.innerHTML = `${teamDisplay} Meetings<br><small style="font-size: 0.75em; color: var(--gray-600); font-weight: normal;">Team ID: ${state.userTeam.id}</small>`;
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



