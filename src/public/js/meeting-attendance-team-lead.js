(function meetingAttendanceTeamLeadPage() {
  const state = {
    meetings: [],
    filter: 'all',
    offeringId: null,
    userTeam: null,
    currentUser: null,
    currentOffering: null
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
  let liveUpdateInterval = null;
  const LIVE_UPDATE_INTERVAL_MS = 3000; // Check for updates every 3 seconds

  function formatDate(dateString) {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '—';
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
    badge.classList.add('meeting-status-badge'); // Add class for easier selection
    badge.style.transition = 'transform 0.2s ease';
    
    if (sessionState === 'open') {
      badge.textContent = `Open - ${attendanceCount}/${totalMembers}`;
      badge.classList.add('open');
    } else if (sessionState === 'closed') {
      badge.textContent = `Closed - ${attendanceCount}/${totalMembers}`;
      badge.classList.add('open'); // Use yellow/open color for closed meetings too
    } else {
      badge.textContent = 'Upcoming';
      badge.classList.add('present');
    }
    
    return badge;
  }

  async function updateMeetingStats() {
    if (isLoading) return;
    
    // Find all open meetings
    const openMeetings = state.meetings.filter(m => {
      const sessionState = determineMeetingStatus(m);
      return sessionState === 'open';
    });
    
    if (openMeetings.length === 0) {
      return; // Nothing to update
    }
    
    try {
      // Re-fetch meetings to get updated attendance counts
      const updatedMeetings = await fetchMeetings();
      
      // Update only the open meetings in state
      for (const openMeeting of openMeetings) {
        const updated = updatedMeetings.find(m => m.id === openMeeting.id);
        if (!updated) continue;
        
        // Check if attendance count changed
        const oldCount = openMeeting.attendance_count || 0;
        const newCount = updated.attendance_count || 0;
        
        if (oldCount !== newCount) {
          // Update state
          const index = state.meetings.findIndex(m => m.id === openMeeting.id);
          if (index !== -1) {
            state.meetings[index] = updated;
          }
          
          // Update the badge in the DOM
          const meetingRow = document.querySelector(`[data-meeting-id="${updated.id}"]`);
          if (meetingRow) {
            const badge = meetingRow.querySelector('.meeting-status-badge');
            if (badge) {
              const totalMembers = updated.team_member_count || 0;
              badge.textContent = `Open - ${newCount}/${totalMembers}`;
              
              // Add a subtle animation to indicate update
              badge.style.transform = 'scale(1.05)';
              setTimeout(() => {
                badge.style.transform = 'scale(1)';
              }, 200);
              
            }
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing meeting data:', error);
    }
  }

  function startLiveUpdates() {
    stopLiveUpdates();
    const openMeetings = state.meetings.filter(m => determineMeetingStatus(m) === 'open');
    if (openMeetings.length > 0) {
      liveUpdateInterval = setInterval(updateMeetingStats, LIVE_UPDATE_INTERVAL_MS);
      // Do an immediate update
      updateMeetingStats();
    }
  }

  function stopLiveUpdates() {
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
  }

  async function buildLeaderAttendanceBadge(meeting, sessionState) {
    const badge = document.createElement('span');
    badge.classList.add('lecture-badge');
    badge.style.marginLeft = '0.5rem';
    
    // Only show badge for open or closed sessions, not pending
    if (sessionState === 'pending' || !state.currentUser) {
      badge.style.display = 'none';
      return badge;
    }
    
    try {
      const response = await fetch(`/api/attendance/sessions/${meeting.id}/attendance/${state.currentUser.id}`);
      if (response.ok) {
        const attendance = await response.json();
        if (attendance?.status === 'present') {
          badge.textContent = 'Present';
          badge.classList.add('present');
          return badge;
        }
      }
      
      // If closed and no attendance record, show absent
      if (sessionState === 'closed') {
        badge.textContent = 'Absent';
        badge.classList.add('absent');
        return badge;
      }
      
      // If open and no attendance, hide the badge (will show "I'm here" button instead)
      badge.style.display = 'none';
    } catch {
      // Silently handle errors - 404 is expected when no attendance record exists
      badge.style.display = 'none';
    }
    
    // Don't show badge for open sessions without attendance
    badge.style.display = 'none';
    return badge;
  }

function determineMeetingStatus(meeting) {
  const now = new Date();
  
  // FIRST: Check if scheduled time is in the future - always return pending for future meetings
  let scheduledStartTime = null;
  if (meeting.session_date && meeting.session_time) {
    // Parse date directly from YYYY-MM-DD string to avoid timezone issues
    let dateStr = meeting.session_date;
    if (typeof dateStr === 'object') {
      // If it's a Date object, extract local date components
      const year = dateStr.getFullYear();
      const month = String(dateStr.getMonth() + 1).padStart(2, '0');
      const day = String(dateStr.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      // Extract just YYYY-MM-DD from string
      dateStr = String(dateStr).split('T')[0];
    }
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = meeting.session_time.split(':').map(Number);
    scheduledStartTime = new Date(year, month - 1, day, hours, minutes);
    
    // If scheduled start time is in the future, it's always pending
    if (scheduledStartTime > now) {
      return 'pending';
    }
  }
  
  // Scheduled time is NOT in future - now check attendance timestamps
  if (meeting.attendance_opened_at && meeting.attendance_closed_at) {
    // Both timestamps are set - check time range
    const openTime = new Date(meeting.attendance_opened_at);
    const closeTime = new Date(meeting.attendance_closed_at);
    
    if (now >= openTime && now < closeTime) {
      return 'open'; // Meeting is currently open
    } else if (now >= closeTime) {
      return 'closed'; // Meeting has ended
    }
  } else if (meeting.attendance_opened_at && !meeting.attendance_closed_at) {
    // Only open time is set - meeting is currently open
    const openTime = new Date(meeting.attendance_opened_at);
    
    // Check if it's past the open time
    if (now >= openTime) {
      // Check if end time has passed
      if (meeting.code_expires_at) {
        const endTime = new Date(meeting.code_expires_at);
        if (endTime < now) {
          return 'closed';
        }
      }
      return 'open';
    }
  }
  
  // No attendance timestamps or they're in the future - check scheduled time
  if (scheduledStartTime && scheduledStartTime <= now) {
    // Scheduled time has passed without attendance being opened
    return 'closed';
  }
  
  return 'pending';
}  async function buildMeetingRow(meeting) {
    const row = document.createElement('article');
    row.className = 'lecture-item';
    row.dataset.meetingId = meeting.id; // Add meeting ID for live updates
    
    const sessionState = determineMeetingStatus(meeting);
    row.dataset.status = sessionState;
    
    const isOpen = sessionState === 'open';

    const attendanceCount = meeting.attendance_count || 0;
    const totalMembers = meeting.team_member_count || 0;
    const badge = buildStatusBadge(sessionState, attendanceCount, totalMembers);
    
    // Add team leader's attendance status badge (will be appended to meta later)
    const leaderStatusBadge = await buildLeaderAttendanceBadge(meeting, sessionState);

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
    
    // Always prefer session_date + session_time for display (scheduled time)
    if (meeting.session_date && meeting.session_time) {
      // Parse session_date which might be a Date object or string
      const sessionDate = new Date(meeting.session_date);
      const year = sessionDate.getUTCFullYear();
      const month = sessionDate.getUTCMonth();
      const day = sessionDate.getUTCDate();
      
      // Parse time
      const [hours, minutes] = meeting.session_time.split(':').map(Number);
      const startTime = new Date(year, month, day, hours, minutes);
      
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
      
      // Add end time if available from attendance timestamps
      if (meeting.attendance_closed_at) {
        let endTime = new Date(meeting.attendance_closed_at);
        
        // If end time appears to be before start time on same day, it's likely next day
        // Check if dates are same but time is earlier
        if (endTime <= startTime) {
          const startDate = new Date(startTime);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(endTime);
          endDate.setHours(0, 0, 0, 0);
          
          // If same calendar day but earlier time, add 24 hours
          if (startDate.getTime() === endDate.getTime()) {
            endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        
        const endDateStr = dateFormatter.format(endTime);
        const endTimeStr = timeFormatter.format(endTime);
        
        // Show date only if different
        if (endDateStr === dateStr) {
          timeStr = `${dateStr} ${startTimeStr}–${endTimeStr}`;
        } else {
          timeStr = `${dateStr} ${startTimeStr} – ${endDateStr} ${endTimeStr}`;
        }
      } else if (meeting.code_expires_at) {
        let endTime = new Date(meeting.code_expires_at);
        
        // If end time appears to be before start time on same day, it's likely next day
        if (endTime <= startTime) {
          const startDate = new Date(startTime);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(endTime);
          endDate.setHours(0, 0, 0, 0);
          
          // If same calendar day but earlier time, add 24 hours
          if (startDate.getTime() === endDate.getTime()) {
            endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        
        const endDateStr = dateFormatter.format(endTime);
        const endTimeStr = timeFormatter.format(endTime);
        
        // Show date only if different
        if (endDateStr === dateStr) {
          timeStr = `${dateStr} ${startTimeStr}–${endTimeStr}`;
        } else {
          timeStr = `${dateStr} ${startTimeStr} – ${endDateStr} ${endTimeStr}`;
        }
      } else {
        timeStr = `${dateStr} at ${startTimeStr}`;
      }
    } else if (meeting.attendance_opened_at) {
      // Fallback to attendance timestamp if no scheduled time
      const startTime = new Date(meeting.attendance_opened_at);
      
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

    const actions = document.createElement('div');
    actions.className = 'lecture-actions';
    
    // Add "I'm here" button for open meetings (team leader can mark themselves present)
    // Only show if leader hasn't checked in yet (leaderStatusBadge doesn't show "Present")
    const leaderIsPresent = leaderStatusBadge.textContent === 'Present';
    if (isOpen && !leaderIsPresent) {
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
          await globalThis.LectureService.checkIn(meeting.access_code, []);
          // Hide the button after successful check-in
          checkInButton.style.display = 'none';
          // Update the badge to show new attendance count
          const badge = row.querySelector('.lecture-badge');
          if (badge) {
            const newCount = attendanceCount + 1;
            badge.textContent = `Open - ${newCount}/${totalMembers}`;
          }
          // Update the leader attendance badge to show "Present"
          const leaderBadge = badgeContainer.querySelector('.lecture-badge:not(:first-child)');
          if (leaderBadge) {
            leaderBadge.textContent = 'Present';
            leaderBadge.classList.remove('absent');
            leaderBadge.classList.add('present');
            leaderBadge.style.display = '';
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
    
    // Add delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-link btn-delete';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    
    deleteButton.addEventListener('click', async () => {
      if (!confirm(`Are you sure you want to delete "${meeting.title || meeting.name || 'this meeting'}"?`)) {
        return;
      }
      
      deleteButton.disabled = true;
      deleteButton.textContent = 'Deleting...';
      
      try {
        const response = await fetch(`/api/sessions/team/${meeting.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete meeting');
        }
        
        // Remove the meeting from the DOM
        row.remove();
        
        // Update the state
        state.meetings = state.meetings.filter(m => m.id !== meeting.id);
        
        // Update attendance percentages
        await updateTeamAttendance();
        await updateIndividualAttendance();
        
        // Show empty state if no meetings left
        if (state.meetings.length === 0 && selectors.empty) {
          selectors.empty.removeAttribute('hidden');
          selectors.empty.style.display = '';
        }
      } catch (error) {
        console.error('Error deleting meeting:', error);
        alert('Failed to delete meeting. Please try again.');
        deleteButton.disabled = false;
        deleteButton.textContent = 'Delete';
      }
    });
    
    actions.appendChild(deleteButton);
    
    // Create badge container
    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'badge-container';
    badgeContainer.append(badge, leaderStatusBadge);
    
    info.append(badgeContainer, details, actions);
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
      
      // Also update individual attendance
      await updateIndividualAttendance();
    } catch (error) {
      console.error('Error updating team attendance:', error);
      selectors.teamAttendancePercentage.textContent = '0%';
    }
  }

  async function updateIndividualAttendance() {
    const memberList = document.getElementById('member-attendance-list');
    if (!memberList || !state.meetings.length || !state.currentUser) return;

    try {
      // Calculate attendance for the current user (team leader) from meetings data
      const closedMeetings = state.meetings.filter(m => {
        const sessionState = determineMeetingStatus(m);
        return sessionState === 'closed';
      });
      
      const totalClosedMeetings = closedMeetings.length;

      memberList.innerHTML = '';
      
      if (totalClosedMeetings === 0) {
        memberList.innerHTML = '<p style="color: var(--gray-500); font-size: 0.85rem; text-align: center;">No completed meetings yet</p>';
        return;
      }
      
      // Fetch attendance records for the current user
      let presentCount = 0;
      
      for (const meeting of closedMeetings) {
        try {
          const response = await fetch(`/api/attendance/sessions/${meeting.id}/attendance/${state.currentUser.id}`);
          if (response.ok) {
            const attendance = await response.json();
            if (attendance?.status === 'present') {
              presentCount++;
            }
          }
          // 404 means no attendance record (absent) - this is normal, not an error
        } catch {
          // Silently handle errors - 404 is expected when no attendance record exists
        }
      }

      const percentage = totalClosedMeetings > 0
        ? Math.round((presentCount / totalClosedMeetings) * 100)
        : 0;

      // Show the team leader's personal attendance
      memberList.innerHTML = `
        <div style="text-align: center; padding: 1rem 0 2rem 0;">
          <div class="attendance-percentage" style="font-size: 2.8rem; font-weight: 700; color: var(--teal-600, #0d9488);">${percentage}%</div>
        </div>
      `;
    } catch (error) {
      console.error('Error updating individual attendance:', error);
      memberList.innerHTML = `<p style="color: var(--red-500); font-size: 0.85rem; text-align: center;">Error: ${error.message}</p>`;
    }
  }

  function initFlipCard() {
    const flipCard = document.getElementById('attendance-card');
    const flipToMembers = document.getElementById('flip-to-members');
    const flipToAverage = document.getElementById('flip-to-average');

    if (!flipCard || !flipToMembers || !flipToAverage) return;

    flipToMembers.addEventListener('click', () => {
      flipCard.classList.add('flipped');
    });

    flipToAverage.addEventListener('click', () => {
      flipCard.classList.remove('flipped');
    });
  }

  async function renderMeetings() {
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
    }
    if (selectors.empty) {
      selectors.empty.setAttribute('hidden', 'true');
      selectors.empty.style.display = 'none';
    }
    
    // If filtered list is empty but meetings exist, just show nothing
    if (!filtered.length) {
      return;
    }

    // Sort by start time (most recent first)
    filtered.sort((a, b) => {
      let dateA, dateB;
      
      // Always prefer session_date + session_time for sorting
      if (a.session_date && a.session_time) {
        // Parse date directly to avoid timezone issues
        let dateStr = a.session_date;
        if (typeof dateStr === 'object') {
          const year = dateStr.getFullYear();
          const month = String(dateStr.getMonth() + 1).padStart(2, '0');
          const day = String(dateStr.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          dateStr = String(dateStr).split('T')[0];
        }
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = a.session_time.split(':').map(Number);
        dateA = new Date(year, month - 1, day, hours, minutes);
      } else if (a.attendance_opened_at) {
        dateA = new Date(a.attendance_opened_at);
      } else {
        dateA = new Date(a.created_at || 0);
      }
      
      if (b.session_date && b.session_time) {
        // Parse date directly to avoid timezone issues
        let dateStr = b.session_date;
        if (typeof dateStr === 'object') {
          const year = dateStr.getFullYear();
          const month = String(dateStr.getMonth() + 1).padStart(2, '0');
          const day = String(dateStr.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          dateStr = String(dateStr).split('T')[0];
        }
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = b.session_time.split(':').map(Number);
        dateB = new Date(year, month - 1, day, hours, minutes);
      } else if (b.attendance_opened_at) {
        dateB = new Date(b.attendance_opened_at);
      } else {
        dateB = new Date(b.created_at || 0);
      }
      
      return dateB - dateA;
    });

    for (const meeting of filtered) {
      const row = await buildMeetingRow(meeting);
      selectors.list.appendChild(row);
    }
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
      if (globalThis.LectureService) {
        const offeringId = await globalThis.LectureService.getActiveOfferingId();
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

  function updateTeamTitle() {
    if (!selectors.courseTitle) return;
    
    try {
      if (state.userTeam && state.currentOffering) {
        const teamDisplay = state.userTeam.team_number 
          ? `Team ${state.userTeam.team_number}` 
          : state.userTeam.name;
        const courseName = state.currentOffering.name || state.currentOffering.code || 'Course';
        selectors.courseTitle.textContent = `${teamDisplay} - ${courseName}`;
      } else if (state.currentOffering) {
        const courseName = state.currentOffering.name || state.currentOffering.code || 'Course';
        selectors.courseTitle.textContent = `${courseName} - Meeting Management`;
      } else if (state.userTeam) {
        const teamDisplay = state.userTeam.team_number 
          ? `Team ${state.userTeam.team_number}` 
          : state.userTeam.name;
        selectors.courseTitle.textContent = `${teamDisplay} - Meeting Management`;
      } else {
        selectors.courseTitle.textContent = 'Team Meeting Management';
      }
    } catch (error) {
      console.error('Error updating team title:', error);
      selectors.courseTitle.textContent = 'Team Meeting Management';
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
      state.currentOffering = offering;
      if (selectors.container) {
        selectors.container.dataset.offeringId = state.offeringId;
      }

      state.userTeam = await getUserTeam(user.id, state.offeringId);
      
      // Update title immediately after loading team and offering
      updateTeamTitle();
      
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

      // Server-side routing already verified user is a team lead
      // If we're on this page, we should be a team lead - no need to redirect
      // Just verify we have a team, otherwise show appropriate message

      updateTeamTitle();

      const meetings = await fetchMeetings();
      
      // Store meetings with attendance data from API
      state.meetings = meetings;

      await updateTeamAttendance();
      isLoading = false;
      renderMeetings();
      
      // Start live updates for open meetings
      startLiveUpdates();
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

      await response.json();

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
    initFilter();
    initButtons();
    initFlipCard();
    hydrateMeetingView();
    
    // Stop live updates when user leaves the page
    window.addEventListener('beforeunload', stopLiveUpdates);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
