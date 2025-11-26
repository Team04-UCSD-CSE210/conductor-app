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
    } else {
      // No attendance timestamps - fall back to session_date/session_time
      if (meeting.session_date && meeting.session_time) {
        const startTime = new Date(`${meeting.session_date}T${meeting.session_time}`);
        if (startTime > now) {
          return 'pending';
        }
        return 'closed';
      }
    }
    
    return 'pending';
  }

  function buildMeetingRow(meeting) {
    const row = document.createElement('article');
    row.className = 'lecture-item';
    
    const sessionState = determineMeetingStatus(meeting);
    row.dataset.status = sessionState;
    
    const isOpen = sessionState === 'open';
    const isPast = sessionState === 'closed';

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
    
    // Format date and time display using attendance timestamps if available
    let timeStr = '';
    
    if (meeting.attendance_opened_at || (meeting.session_date && meeting.session_time)) {
      // Use attendance_opened_at for start time if available, otherwise session_date/time
      const startTime = meeting.attendance_opened_at 
        ? new Date(meeting.attendance_opened_at)
        : new Date(`${meeting.session_date}T${meeting.session_time}`);
      
      const dateFormatter = new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric'
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', { 
        hour: 'numeric', 
        minute: 'numeric'
      });
      
      const dateStr = dateFormatter.format(startTime);
      const startTimeStr = timeFormatter.format(startTime);
      
      // Add end time if available
      if (meeting.attendance_closed_at) {
        const endTime = new Date(meeting.attendance_closed_at);
        const endTimeStr = timeFormatter.format(endTime);
        timeStr = `${dateStr} ${startTimeStr}–${endTimeStr}`;
      } else if (meeting.code_expires_at) {
        const endTime = new Date(meeting.code_expires_at);
        const endTimeStr = timeFormatter.format(endTime);
        timeStr = `${dateStr} ${startTimeStr}–${endTimeStr}`;
      } else {
        timeStr = `${dateStr} at ${startTimeStr}`;
      }
    } else {
      // Fallback to old logic
      const displayDate = meeting.session_date || meeting.scheduled_date || meeting.created_at;
      timeStr = formatDate(displayDate);
    }
    
    time.textContent = timeStr;
    
    details.append(label, time);

    const meta = document.createElement('div');
    meta.className = 'lecture-meta';

    // Only show session status for open/closed meetings (not pending)
    // The badge already shows "Upcoming" for pending meetings
    const sessionStatus = document.createElement('span');
    if (isOpen) {
      sessionStatus.className = 'lecture-status open';
      sessionStatus.textContent = 'Open';
    } else if (isPast) {
      sessionStatus.className = 'lecture-status closed';
      sessionStatus.textContent = 'Closed';
    }

    const actions = document.createElement('div');
    actions.className = 'lecture-actions';
    
    // Add "I'm here" button for open meetings (team leader can mark themselves present)
    if (isOpen && attendanceCount < totalMembers) {
      const checkInButton = document.createElement('button');
      checkInButton.className = 'btn-link';
      checkInButton.type = 'button';
      checkInButton.textContent = 'I\'m here';
      checkInButton.style.marginRight = '0.5rem';
      
      checkInButton.addEventListener('click', async () => {
        if (!meeting.access_code) {
          alert('Unable to check in: no access code available');
          return;
        }
        
        checkInButton.disabled = true;
        checkInButton.textContent = 'Checking in...';
        try {
          await window.LectureService.checkIn(meeting.access_code, []);
          // Hide the button after successful check-in
          checkInButton.style.display = 'none';
          // Update the badge to show new attendance count
          const badge = row.querySelector('.lecture-badge');
          if (badge) {
            const newCount = attendanceCount + 1;
            badge.textContent = `Open - ${newCount}/${totalMembers}`;
          }
        } catch (error) {
          console.error('Error checking in:', error);
          alert(`Failed to record attendance: ${error.message}`);
          checkInButton.disabled = false;
          checkInButton.textContent = 'I\'m here';
        }
      });
      
      actions.appendChild(checkInButton);
    }
    
    // Add manage button
    const manageButton = document.createElement('button');
    manageButton.className = 'btn-link';
    manageButton.type = 'button';
    manageButton.textContent = 'Manage';
    
    manageButton.addEventListener('click', () => {
      // Navigate to meeting management page
      window.location.href = `/manage-session?sessionId=${meeting.id}`;
    });
    
    actions.appendChild(manageButton);

    // Only append sessionStatus if it has content (open or closed)
    if (isOpen || isPast) {
      meta.append(sessionStatus, actions);
    } else {
      meta.appendChild(actions);
    }
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
      // Calculate average attendance across all meetings (only closed meetings)
      let totalAttendance = 0;
      let totalPossible = 0;
      
      state.meetings.forEach(meeting => {
        const sessionState = determineMeetingStatus(meeting);
        if (sessionState === 'closed') {
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
      
      const sessionState = determineMeetingStatus(meeting);
      const isOpen = sessionState === 'open';
      const isPast = sessionState === 'closed';
      const isUpcoming = sessionState === 'pending';
      
      if (state.filter === 'open') {
        return isOpen;
      } else if (state.filter === 'upcoming') {
        return isUpcoming;
      } else if (state.filter === 'past') {
        return isPast;
      }
      
      return false;
    });

    // Only show empty state if there are NO meetings at all
    if (state.meetings.length === 0) {
      if (selectors.empty) {
        selectors.empty.removeAttribute('hidden');
        selectors.empty.style.display = '';
      }
      return;
    } else {
      if (selectors.empty) {
        selectors.empty.setAttribute('hidden', 'true');
        selectors.empty.style.display = 'none';
      }
    }
    
    // If filtered list is empty but meetings exist, just show nothing
    if (!filtered.length) {
      return;
    }

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
        window.location.href = '/meeting-attendance';
        return;
      }

      await updateTeamTitle();

      const meetings = await fetchMeetings();
      
      // Store meetings with attendance data from API
      state.meetings = meetings;

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

      // Create the session with attendance times
      // Build timestamps that preserve the local time
      // Get the timezone offset and format as ISO string with timezone
      const formatLocalDateTime = (dateStr, timeStr) => {
        const date = new Date(`${dateStr}T${timeStr}:00`);
        const tzOffset = -date.getTimezoneOffset();
        const offsetHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
        const offsetMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
        const offsetSign = tzOffset >= 0 ? '+' : '-';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}:00${offsetSign}${offsetHours}:${offsetMins}`;
      };
      
      const sessionDateTimeStr = formatLocalDateTime(formData.date, formData.startTime);
      const endDateTimeStr = formatLocalDateTime(formData.date, formData.endTime);
      
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
          endsAt: endDateTimeStr,
          status: 'pending'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create meeting');
      }

      const newMeeting = await response.json();

      // Reset form
      form.reset();

      // Small delay to allow backend auto-open to complete
      await new Promise(resolve => setTimeout(resolve, 500));

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
