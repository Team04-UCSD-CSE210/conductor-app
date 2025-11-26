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
    teamName: document.getElementById('team-name')
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

  function formatTimeRange(startIso, endIso) {
    // If both are provided, format as range
    if (startIso && endIso) {
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
    
    // If only start is provided, format just the start
    if (startIso) {
      try {
        const start = new Date(startIso);
        if (isNaN(start.getTime())) return '—';
        
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
    const statusLabel = status === 'open' ? 'Needs response' : status === 'pending' ? 'Upcoming' : status;
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
      actionButton.textContent = meeting.status === 'present' ? 'View responses' : 'I\'m here';
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
      if (meeting.sessionState === 'open') {
        if (meeting.status === 'present') {
          window.location.href = `/student-lecture-response?sessionId=${meeting.id}`;
        } else {
          // For team meetings, directly check in using the meeting's access code
          if (!meeting.accessCode) {
            alert('Unable to check in: no access code available');
            return;
          }
          
          actionButton.disabled = true;
          actionButton.textContent = 'Checking in...';
          try {
            await window.LectureService.checkIn(meeting.accessCode, []);
            // Refresh the page to show updated status
            window.location.reload();
          } catch (error) {
            console.error('Error checking in:', error);
            alert(`Failed to record attendance: ${error.message}`);
            actionButton.disabled = false;
            actionButton.textContent = 'I\'m here';
          }
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

  async function hydrateStudentView() {
    if (!window.LectureService || !selectors.container) return;

    showLoading();

    try {
      // Get offering ID
      state.offeringId = selectors.container.getAttribute('data-offering-id');
      if (!state.offeringId) {
        state.offeringId = await window.LectureService.getActiveOfferingId();
        selectors.container.setAttribute('data-offering-id', state.offeringId);
      }

      // Get team info
      const teamInfo = await getTeamInfo();
      if (teamInfo) {
        state.teamId = teamInfo.id;
        state.teamName = teamInfo.name;
        if (selectors.teamName) {
          selectors.teamName.textContent = `Team ${teamInfo.number || teamInfo.name}`;
        }
      } else {
        if (selectors.teamName) {
          selectors.teamName.textContent = 'No team assigned';
        }
      }

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
              if (window.LectureService && typeof window.LectureService.transformSession === 'function') {
                transformed = window.LectureService.transformSession(session);
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
              return {
                ...session, // Preserve all original fields (timestamps, etc.)
                id: transformed.id,
                label: transformed.label || session.title,
                title: session.title,
                status,
                sessionState,
                startsAt: transformed.startsAt,
                endsAt: transformed.endsAt,
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

  async function showAccessCodeModal(meeting) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="access-code-modal">
        <button class="modal-close" aria-label="Close modal" type="button">&times;</button>
        <div class="modal-header">
          <h3>Record Attendance</h3>
          <p>Enter the 6-character access code to record your attendance for ${meeting.label}</p>
        </div>
        <div class="access-code-inputs">
          <input type="text" class="code-input" maxlength="1" autocomplete="off" aria-label="Character 1" data-index="0" tabindex="1" style="text-transform: uppercase;">
          <input type="text" class="code-input" maxlength="1" autocomplete="off" aria-label="Character 2" data-index="1" tabindex="2" style="text-transform: uppercase;">
          <input type="text" class="code-input" maxlength="1" autocomplete="off" aria-label="Character 3" data-index="2" tabindex="3" style="text-transform: uppercase;">
          <input type="text" class="code-input" maxlength="1" autocomplete="off" aria-label="Character 4" data-index="3" tabindex="4" style="text-transform: uppercase;">
          <input type="text" class="code-input" maxlength="1" autocomplete="off" aria-label="Character 5" data-index="4" tabindex="5" style="text-transform: uppercase;">
          <input type="text" class="code-input" maxlength="1" autocomplete="off" aria-label="Character 6" data-index="5" tabindex="6" style="text-transform: uppercase;">
        </div>
        <div class="modal-error" id="modal-error"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    const modal = overlay.querySelector('.access-code-modal');
    const inputs = Array.from(overlay.querySelectorAll('.code-input'));
    const closeBtn = overlay.querySelector('.modal-close');
    const errorDiv = overlay.querySelector('.modal-error');

    setTimeout(() => {
      inputs[0]?.focus();
    }, 100);

    const checkCodeAndCheckIn = async () => {
      const code = inputs.map(input => input.value.trim().toUpperCase()).join('');
      
      if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
        return;
      }
      
      errorDiv.style.display = 'none';
      errorDiv.classList.remove('show');
      inputs.forEach(input => {
        input.disabled = true;
      });
      
      try {
        const verification = await window.LectureService.verifyAccessCode(code);
          
        if (!verification || !verification.valid) {
          const errorMsg = verification?.message || 'Incorrect access code. Please try again.';
          errorDiv.textContent = errorMsg;
          errorDiv.style.display = 'block';
          errorDiv.classList.add('show');
          inputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled');
            input.disabled = false;
          });
          setTimeout(() => {
            inputs[0]?.focus();
          }, 100);
          return;
        }

        try {
          await window.LectureService.checkIn(code, []);
          window.location.href = `/student-lecture-response?sessionId=${meeting.id}`;
        } catch (checkInError) {
          errorDiv.textContent = checkInError.message || 'Failed to check in. Please try again.';
          errorDiv.style.display = 'block';
          errorDiv.classList.add('show');
          inputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled');
            input.disabled = false;
          });
          setTimeout(() => {
            inputs[0]?.focus();
          }, 100);
        }
      } catch (error) {
        errorDiv.textContent = error.message || 'Incorrect access code. Please try again.';
        errorDiv.style.display = 'block';
        errorDiv.classList.add('show');
        inputs.forEach(input => {
          input.value = '';
          input.classList.remove('filled');
          input.disabled = false;
        });
        setTimeout(() => {
          inputs[0]?.focus();
        }, 100);
      }
    };

    // Handle input navigation (similar to lecture-attendance-student.js)
    inputs.forEach((input, index) => {
      input.disabled = false;
      input.readOnly = false;
      
      input.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab', 'Enter'].includes(e.key)) {
          if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            inputs[index - 1].focus();
          } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
            e.preventDefault();
            inputs[index + 1].focus();
          }
          return;
        }

        if (e.key === 'Backspace') {
          if (input.value) {
            input.value = '';
            input.classList.remove('filled');
          } else if (index > 0) {
            e.preventDefault();
            inputs[index - 1].focus();
            inputs[index - 1].value = '';
            inputs[index - 1].classList.remove('filled');
          }
          errorDiv.style.display = 'none';
          errorDiv.textContent = '';
          return;
        }

        const key = e.key.toUpperCase();
        if (!/^[A-Z0-9]$/.test(key)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      });

      input.addEventListener('input', (e) => {
        e.stopPropagation();
        let value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        
        if (value.length > 0) {
          value = value.charAt(0);
          e.target.value = value;
          input.classList.add('filled');
          errorDiv.style.display = 'none';
          errorDiv.classList.remove('show');
          errorDiv.textContent = '';
          
          if (index < inputs.length - 1) {
            setTimeout(() => {
              inputs[index + 1].focus();
              inputs[index + 1].select();
            }, 0);
          } else {
            setTimeout(() => {
              const allFilled = inputs.every(inp => inp.value.trim().length > 0);
              if (allFilled) {
                checkCodeAndCheckIn().catch(err => {
                  console.error('Error in checkCodeAndCheckIn:', err);
                  errorDiv.textContent = 'An error occurred. Please try again.';
                  errorDiv.style.display = 'block';
                  errorDiv.classList.add('show');
                  inputs.forEach(inp => inp.disabled = false);
                });
              }
            }, 150);
          }
        } else {
          input.classList.remove('filled');
        }
      });
      
      input.addEventListener('keypress', (e) => {
        const key = e.key.toUpperCase();
        if (/^[A-Z0-9]$/.test(key)) {
          e.target.value = key;
          e.target.classList.add('filled');
          errorDiv.style.display = 'none';
          errorDiv.classList.remove('show');
          errorDiv.textContent = '';
          
          if (index < inputs.length - 1) {
            e.preventDefault();
            setTimeout(() => {
              inputs[index + 1].focus();
              inputs[index + 1].select();
            }, 0);
          } else {
            e.preventDefault();
            setTimeout(() => {
              const allFilled = inputs.every(inp => inp.value.trim().length > 0);
              if (allFilled) {
                checkCodeAndCheckIn().catch(err => {
                  console.error('Error in checkCodeAndCheckIn:', err);
                  errorDiv.textContent = 'An error occurred. Please try again.';
                  errorDiv.style.display = 'block';
                  errorDiv.classList.add('show');
                  inputs.forEach(inp => inp.disabled = false);
                });
              }
            }, 150);
          }
        }
      });
      
      input.addEventListener('focus', (e) => {
        e.stopPropagation();
        input.select();
      });
      
      input.addEventListener('click', (e) => {
        e.stopPropagation();
        input.focus();
        input.select();
      });

      input.addEventListener('paste', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          const pasteData = (e.clipboardData || window.clipboardData).getData('text');
          if (!pasteData) return;
          
          const chars = pasteData.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
          
          if (chars.length === 0) return;
          
          chars.split('').forEach((char, i) => {
            const targetIndex = index + i;
            if (targetIndex < inputs.length) {
              inputs[targetIndex].value = char;
              inputs[targetIndex].classList.add('filled');
            }
          });
          
          const nextIndex = Math.min(index + chars.length, inputs.length - 1);
          requestAnimationFrame(async () => {
            inputs[nextIndex].focus();
            await checkCodeAndCheckIn();
          });
        } catch (error) {
          console.error('Error handling paste:', error);
        }
      });
    });

    const closeModal = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    };
    
    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target.closest('.access-code-inputs') || e.target.classList.contains('code-input')) {
        return;
      }
      e.stopPropagation();
    });

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
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

