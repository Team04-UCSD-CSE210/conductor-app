(function meetingAttendanceTeamLeadPage() {
  const state = {
    meetings: [],
    filter: 'all',
    offeringId: null,
    userTeam: null,
    currentUser: null
  };

  const selectors = {
    list: document.getElementById('meeting-list'),
    empty: document.getElementById('meeting-empty'),
    filter: document.getElementById('meeting-filter'),
    teamAttendancePercentage: document.getElementById('team-attendance-percentage'),
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

  function buildStatusBadge(sessionState, attendanceCount, totalMembers) {
    const badge = document.createElement('span');
    badge.classList.add('lecture-badge');
    
    if (sessionState === 'open') {
      badge.textContent = `Open - ${attendanceCount}/${totalMembers}`;
      badge.classList.add('open');
    } else if (sessionState === 'closed') {
      badge.textContent = `Closed - ${attendanceCount}/${totalMembers}`;
      badge.classList.add('absent');
    } else {
      badge.textContent = 'Upcoming';
      badge.classList.add('present');
    }
    
    return badge;
  }

  function isMeetingOpen(meeting) {
    // Check if explicitly marked as open
    if (meeting.status === 'open') return true;
    
    // If marked as closed, it's not open
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
    row.dataset.status = sessionState;

    const attendanceCount = meeting.attendance_count || 0;
    const totalMembers = meeting.team_member_count || 0;
    const badge = buildStatusBadge(sessionState, attendanceCount, totalMembers);
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
    } else if (isPast) {
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
    actionButton.textContent = 'Manage';
    
    actionButton.addEventListener('click', () => {
      // Navigate to meeting management page
      window.location.href = `/manage-session?sessionId=${meeting.id}`;
    });
    
    actions.appendChild(actionButton);

    meta.append(sessionStatus, actions);
    info.append(details, meta);
    row.appendChild(info);

    return row;
  }

  async function updateTeamAttendance() {
    if (!selectors.teamAttendancePercentage || !state.meetings.length) {
      if (selectors.teamAttendancePercentage) {
        selectors.teamAttendancePercentage.textContent = '0%';
      }
      return;
    }
    
    try {
      // Calculate average attendance across all meetings
      let totalAttendance = 0;
      let totalPossible = 0;
      
      state.meetings.forEach(meeting => {
        if (meeting.status === 'closed') {
          totalAttendance += meeting.attendance_count || 0;
          totalPossible += meeting.team_member_count || 0;
        }
      });
      
      const percent = totalPossible > 0
        ? Math.round((totalAttendance / totalPossible) * 100)
        : 0;
      selectors.teamAttendancePercentage.textContent = `${percent}%`;
    } catch (error) {
      console.error('Error updating team attendance:', error);
      selectors.teamAttendancePercentage.textContent = '0%';
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
      
      const isUpcoming = !isOpen && !isPast;
      
      if (state.filter === 'open') {
        return isOpen;
      } else if (state.filter === 'upcoming') {
        return isUpcoming;
      } else if (state.filter === 'past') {
        return isPast;
      }
      
      return false;
    });

    if (!filtered.length) {
      selectors.empty?.removeAttribute('hidden');
      const emptyMessage = state.meetings.length === 0 
        ? 'No meetings scheduled yet. Click "Create Meeting" to schedule your first team meeting.'
        : 'No meetings match this filter.';
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
      if (window.LectureService) {
        const offeringId = await window.LectureService.getActiveOfferingId();
        if (offeringId) {
          const response = await fetch(`/api/offerings/${offeringId}`, {
            credentials: 'include'
          });
          if (response.ok) {
            return await response.json();
          }
        }
      }
      
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

      const response = await fetch(`/api/sessions?offering_id=${state.offeringId}&limit=1000`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch meetings:', response.status);
        return [];
      }

      const data = await response.json();
      const sessions = Array.isArray(data) ? data : [];
      const meetings = sessions.filter(session => session.team_id != null);
      
      return meetings;
    } catch (error) {
      console.error('Error fetching meetings:', error);
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
      selectors.courseTitle.textContent = 'Team Meetings';
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
      
      state.currentUser = user;

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
          selectors.courseTitle.textContent = 'Team Meetings - No Team Assigned';
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
        return;
      }

      // Verify user is team leader
      const isTeamLeader = state.userTeam.user_role === 'leader' || 
                           state.userTeam.leader_id === user.id;
      
      if (!isTeamLeader) {
        console.log('User is not a team leader, redirecting...');
        window.location.href = '/meeting-attendance';
        return;
      }

      await updateTeamTitle();

      const meetings = await fetchMeetings();
      
      // For each meeting, fetch attendance count
      // TODO: Optimize this with a batch endpoint
      state.meetings = meetings.map(meeting => ({
        ...meeting,
        attendance_count: 0, // Will be populated by real data
        team_member_count: 0 // Will be populated by real data
      }));

      await updateTeamAttendance();
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

  function initButtons() {
    const createMeetingForm = document.getElementById('create-meeting-form');
    
    if (createMeetingForm) {
      createMeetingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCreateMeeting(e);
      });
    }
  }

  async function handleCreateMeeting(e) {
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
      // Disable button and show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      const formData = {
        name: form['meeting-name'].value,
        date: form['meeting-date'].value,
        startTime: form['meeting-start'].value,
        endTime: form['meeting-end'].value
      };

      // Validate times
      if (formData.startTime >= formData.endTime) {
        alert('End time must be after start time');
        return;
      }

      // Create the session
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          offering_id: state.offeringId,
          team_id: state.userTeam.id,
          title: formData.name,
          session_date: formData.date,
          session_time: formData.startTime,
          status: 'pending'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create meeting');
      }

      const newMeeting = await response.json();
      console.log('Meeting created:', newMeeting);

      // Reset form
      form.reset();

      // Refresh the meeting list
      await hydrateMeetingView();

      // Show success message
      alert('Meeting created successfully!');

    } catch (error) {
      console.error('Error creating meeting:', error);
      alert(`Failed to create meeting: ${error.message}`);
    } finally {
      // Re-enable button
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  function init() {
    initHamburger();
    initFilter();
    initButtons();
    hydrateMeetingView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
