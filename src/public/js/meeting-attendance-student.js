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

  function buildStatusBadge(status) {
    const badge = document.createElement('span');
    badge.classList.add('lecture-badge');
    const statusLabel = status === 'open' ? 'Needs response' : status;
    badge.textContent = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
    badge.classList.add(status === 'present' ? 'present' : status === 'absent' ? 'absent' : 'present');
    if (status === 'absent') {
      badge.classList.remove('present');
      badge.classList.add('absent');
    }
    if (status === 'open') {
      badge.classList.remove('present');
      badge.classList.add('open');
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
    if (meeting.sessionState === 'open') {
      sessionStatus.className = 'lecture-status open';
      sessionStatus.textContent = 'Open';
    } else if (meeting.sessionState === 'pending') {
      sessionStatus.className = 'lecture-status pending';
      sessionStatus.textContent = 'Not Opened';
    } else {
      sessionStatus.className = 'lecture-status closed';
      sessionStatus.textContent = 'Closed';
    }

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
    
    actionButton.addEventListener('click', () => {
      if (meeting.sessionState === 'open') {
        if (meeting.status === 'present') {
          window.location.href = `/student-lecture-response?sessionId=${meeting.id}`;
        } else {
          showAccessCodeModal(meeting);
        }
      }
    });
    actions.appendChild(actionButton);

    meta.append(sessionStatus, actions);
    info.append(details, meta);
    row.appendChild(info);

    return row;
  }

  async function updateOverallAttendance() {
    if (!selectors.attendancePercentage || !state.offeringId) return;
    
    try {
      // Get team-specific attendance statistics
      const teamMeetings = state.meetings.filter(m => m.team_id === state.teamId);
      const totalMeetings = teamMeetings.length;
      const presentCount = teamMeetings.filter((m) => m.status === 'present').length;
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
      const response = await fetch('/api/users/me', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) return null;
      
      const user = await response.json();
      
      // Get user's team for the active offering
      if (!state.offeringId) return null;
      
      const teamsResponse = await fetch(`/api/teams?offering_id=${state.offeringId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!teamsResponse.ok) return null;
      
      const teamsData = await teamsResponse.json();
      const teams = teamsData.teams || [];
      
      // Find team where user is a member
      for (const team of teams) {
        const teamDetailResponse = await fetch(`/api/teams/${team.id}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (teamDetailResponse.ok) {
          const teamDetail = await teamDetailResponse.json();
          const isMember = teamDetail.members?.some(m => m.user_id === user.id);
          if (isMember) {
            return { id: team.id, name: team.name || `Team ${team.team_number || ''}` };
          }
        }
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
          selectors.teamName.textContent = teamInfo.name;
        }
      } else {
        if (selectors.teamName) {
          selectors.teamName.textContent = 'No team';
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
          
          // Transform sessions and filter to team meetings
          const transformedSessions = sessionsArray
            .filter(s => s.team_id === state.teamId)
            .map(session => {
              // If a transformSession helper exists, use it. Otherwise fall back to a safe default
              // Avoid optional-chaining + conditional that can yield `undefined` for `transformed`
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
              if (sessionState === 'open' && attendanceStatus === 'absent') {
                status = 'open';
              }
              return {
                id: transformed.id,
                label: transformed.label || session.title,
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

