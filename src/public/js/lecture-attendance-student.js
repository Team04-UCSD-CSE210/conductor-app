(function lectureAttendancePage() {
  const state = {
    lectures: [],
    filter: 'all',
    offeringId: null
  };

  const selectors = {
    list: document.getElementById('lecture-list'),
    empty: document.getElementById('lecture-empty'),
    filter: document.getElementById('lecture-filter'),
    attendancePercentage: document.getElementById('attendance-percentage'),
    container: document.querySelector('.attendance-content')
  };

  let isLoading = false;

  function formatTimeRange(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    try {
    const start = new Date(startIso);
    const end = new Date(endIso);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return '—';
      }
      
    // Always format in local timezone (explicitly use local timezone)
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

  function buildLectureRow(lecture) {
    const row = document.createElement('article');
    row.className = 'lecture-item';
    row.dataset.status = lecture.status;

    const badge = buildStatusBadge(lecture.status);
    row.appendChild(badge);

    const info = document.createElement('div');
    info.className = 'lecture-info';

    const details = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'lecture-number';
    label.textContent = lecture.label;
    const time = document.createElement('p');
    time.className = 'lecture-time';
    time.textContent = formatTimeRange(lecture.startsAt, lecture.endsAt);
    details.append(label, time);

    const meta = document.createElement('div');
    meta.className = 'lecture-meta';

    const sessionStatus = document.createElement('span');
    if (lecture.sessionState === 'open') {
      sessionStatus.className = 'lecture-status open';
      sessionStatus.textContent = 'Open';
    } else if (lecture.sessionState === 'pending') {
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
    if (lecture.sessionState === 'open') {
      actionButton.textContent = lecture.status === 'present' ? 'View responses' : 'Record attendance';
    } else if (lecture.sessionState === 'pending') {
      actionButton.textContent = 'Not available';
      actionButton.disabled = true;
      actionButton.style.opacity = '0.6';
      actionButton.style.cursor = 'not-allowed';
    } else {
      actionButton.textContent = 'View responses';
    }
    
    actionButton.addEventListener('click', () => {
      if (lecture.sessionState === 'open') {
        if (lecture.status === 'present') {
          // Already marked present, go to view responses
          window.location.href = `/student-lecture-response?sessionId=${lecture.id}`;
        } else {
          // Need to record attendance - show modal
          showAccessCodeModal(lecture);
        }
      } else if (lecture.sessionState === 'pending') {
        // Session not opened yet - do nothing (button is disabled)
        return;
      } else {
        // Session is closed - navigate directly to view responses
        window.location.href = `/student-lecture-response?sessionId=${lecture.id}`;
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
      const stats = await window.LectureService.getStudentStatistics?.(state.offeringId);
      if (stats && stats.attendance_percentage !== undefined) {
        // Use attendance_percentage from backend (matches SQL column name)
        selectors.attendancePercentage.textContent = `${Math.round(stats.attendance_percentage)}%`;
      } else if (stats && stats.attendance_percent !== undefined) {
        // Fallback to attendance_percent if attendance_percentage not available
        selectors.attendancePercentage.textContent = `${Math.round(stats.attendance_percent)}%`;
      } else {
        // Calculate from closed lectures only (exclude open/pending lectures)
        const closedLectures = state.lectures.filter((lec) => 
          lec.sessionState === 'closed' || lec.status === 'present' || lec.status === 'absent'
        );
        const totalLectures = closedLectures.length;
        const presentCount = closedLectures.filter((lec) => lec.status === 'present').length;
        const percent = totalLectures > 0
          ? Math.round((presentCount / totalLectures) * 100)
          : 0;
        selectors.attendancePercentage.textContent = `${percent}%`;
      }
    } catch (error) {
      console.error('Error updating overall attendance:', error);
      // Fallback calculation - use closed lectures only
      const closedLectures = state.lectures.filter((lec) => 
        lec.sessionState === 'closed' || lec.status === 'present' || lec.status === 'absent'
      );
      const totalLectures = closedLectures.length;
      const presentCount = closedLectures.filter((lec) => lec.status === 'present').length;
      const percent = totalLectures > 0
        ? Math.round((presentCount / totalLectures) * 100)
      : 0;
    selectors.attendancePercentage.textContent = `${percent}%`;
    }
  }

  function renderLectures() {
    if (!selectors.list || isLoading) return;
    selectors.list.innerHTML = '';
    
    const filtered = state.lectures.filter((lecture) => {
      if (state.filter === 'all') return true;
      return lecture.status === state.filter || lecture.sessionState === state.filter;
    });

    if (!filtered.length) {
      selectors.empty?.removeAttribute('hidden');
      return;
    }
    selectors.empty?.setAttribute('hidden', 'true');

    filtered.forEach((lecture) => {
      selectors.list.appendChild(buildLectureRow(lecture));
    });
  }

  function showLoading() {
    isLoading = true;
    if (selectors.list) {
      selectors.list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-600);">Loading lectures...</p>';
    }
  }

  async function updateCourseTitle() {
    const courseTitleEl = document.getElementById('header-title');
    if (!courseTitleEl || !state.offeringId) return;
    
    try {
      const response = await fetch(`/api/offerings/${state.offeringId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const offering = await response.json();
        courseTitleEl.textContent = offering.name || offering.code || 'Course';
      } else {
        courseTitleEl.textContent = 'Course';
      }
    } catch (error) {
      console.error('Error fetching course title:', error);
      courseTitleEl.textContent = 'Course';
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
        if (state.offeringId) {
        selectors.container.setAttribute('data-offering-id', state.offeringId);
        }
      }

      // Update course title dynamically (must have offeringId)
      if (state.offeringId) {
      await updateCourseTitle();
      }

      // Get lecture list (only lectures, not team meetings)
      if (state.offeringId) {
      state.lectures = await window.LectureService.getStudentLectureList(state.offeringId);
      await updateOverallAttendance();
      } else {
        state.lectures = [];
        if (selectors.attendancePercentage) {
          selectors.attendancePercentage.textContent = '0%';
        }
      }
      
      isLoading = false;
    renderLectures();
    } catch (error) {
      console.error('Error hydrating student view:', error);
      isLoading = false;
      if (selectors.list) {
        selectors.list.innerHTML = `<p style="color: var(--red-600); text-align: center; padding: 2rem;">Error loading lectures: ${error.message}</p>`;
      }
      alert(`Error loading lectures: ${error.message}`);
    }
  }

  function initFilter() {
    if (!selectors.filter) return;
    selectors.filter.addEventListener('change', (event) => {
      state.filter = event.target.value;
      renderLectures();
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

  async function showAccessCodeModal(lecture) {
    const isOpenSession = lecture.sessionState === 'open';
    const modalTitle = isOpenSession ? 'Record Attendance' : 'View Responses';
    const modalDescription = isOpenSession 
      ? `Enter the 6-character access code to record your attendance for ${lecture.label}`
      : `Enter the 6-character access code to view your responses for ${lecture.label}`;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="access-code-modal">
        <button class="modal-close" aria-label="Close modal" type="button">&times;</button>
        <div class="modal-header">
          <h3>${modalTitle}</h3>
          <p>${modalDescription}</p>
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

    // Auto-focus first input
    setTimeout(() => {
      inputs[0]?.focus();
    }, 100);

    // Function to check code and check in
    const checkCodeAndCheckIn = async () => {
      const code = inputs.map(input => input.value.trim().toUpperCase()).join('');
      console.log('Checking code:', code, 'Length:', code.length);
      
      // Validate: 6 alphanumeric characters (A-Z, 0-9)
      if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
        console.log('Code validation failed:', code);
        return;
      }
      
      // Show loading state
      errorDiv.style.display = 'none';
      errorDiv.classList.remove('show');
      inputs.forEach(input => {
        input.disabled = true;
      });
      
      try {
        console.log('Verifying access code...');
          // Verify code first
          const verification = await window.LectureService.verifyAccessCode(code);
        console.log('Verification result:', verification);
          
        if (!verification || !verification.valid) {
            // Code is incorrect or session is closed - reset and show error
          const errorMsg = verification?.message || 'Incorrect access code. Please try again.';
          console.log('Code invalid:', errorMsg);
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

          // Code is correct and session is open - check in with access code
        console.log('Code valid, checking in...');
          try {
            await window.LectureService.checkIn(code, []);
          console.log('Check-in successful, redirecting...');
            
            // Successfully checked in - redirect to response page
            window.location.href = `/student-lecture-response?sessionId=${lecture.id}`;
          } catch (checkInError) {
            console.error('Error checking in:', checkInError);
            // Check-in failed - reset and show error
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
          console.error('Error verifying code:', error);
          // Error occurred - reset and show error
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

    // Handle input navigation with auto-advance
    inputs.forEach((input, index) => {
      // Ensure input is not disabled and can receive focus
      input.disabled = false;
      input.readOnly = false;
      
      // Handle keydown for input filtering
      input.addEventListener('keydown', (e) => {
        // Allow navigation keys
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

        // Handle backspace
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

        // Handle delete
        if (e.key === 'Delete') {
          input.value = '';
          input.classList.remove('filled');
          errorDiv.style.display = 'none';
          errorDiv.textContent = '';
          return;
        }

        // Only allow alphanumeric characters (A-Z, 0-9)
        const key = e.key.toUpperCase();
        if (!/^[A-Z0-9]$/.test(key)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Don't set value here - let the input event handle it to avoid double processing
      });

      // Handle input event for auto-advance
      input.addEventListener('input', (e) => {
        e.stopPropagation();
        // Allow alphanumeric characters (A-Z, 0-9) and convert to uppercase
        let value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        
        if (value.length > 0) {
          value = value.charAt(0);
          e.target.value = value;
          input.classList.add('filled');
          errorDiv.style.display = 'none';
          errorDiv.classList.remove('show');
          errorDiv.textContent = '';
          
          // Auto-advance to next input immediately
          if (index < inputs.length - 1) {
            setTimeout(() => {
              inputs[index + 1].focus();
              inputs[index + 1].select();
            }, 0);
          } else {
            // This is the last input - check code when filled
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
      
      // Also handle keypress for immediate response
      input.addEventListener('keypress', (e) => {
        const key = e.key.toUpperCase();
        if (/^[A-Z0-9]$/.test(key)) {
          // Set value immediately for better UX
          e.target.value = key;
          e.target.classList.add('filled');
          errorDiv.style.display = 'none';
          errorDiv.classList.remove('show');
          errorDiv.textContent = '';
          
          // Auto-advance to next input
          if (index < inputs.length - 1) {
            e.preventDefault();
            setTimeout(() => {
              inputs[index + 1].focus();
              inputs[index + 1].select();
            }, 0);
          } else {
            // This is the last input - check code when filled
            e.preventDefault();
            // Wait a bit to ensure value is set, then check
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
      
      // Handle focus to ensure input is ready
      input.addEventListener('focus', (e) => {
        e.stopPropagation();
        input.select();
      });
      
      // Handle click to ensure input is ready
      input.addEventListener('click', (e) => {
        e.stopPropagation();
        input.focus();
        input.select();
      });

      // Handle paste
      input.addEventListener('paste', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          const pasteData = (e.clipboardData || window.clipboardData).getData('text');
          if (!pasteData) return;
          
          // Allow alphanumeric characters (A-Z, 0-9) and convert to uppercase
          const chars = pasteData.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
          
          if (chars.length === 0) return;
          
          // Fill inputs starting from current index
          chars.split('').forEach((char, i) => {
            const targetIndex = index + i;
            if (targetIndex < inputs.length) {
              inputs[targetIndex].value = char;
              inputs[targetIndex].classList.add('filled');
            }
          });
          
          // Focus the next empty input or the last input if all filled
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

    // Close modal function
    const closeModal = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    };
    
    // Close button click handler
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
    
    // Close when clicking overlay background
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Prevent modal clicks from closing, but allow input interactions
    modal.addEventListener('click', (e) => {
      // Don't close if clicking on inputs or input container
      if (e.target.closest('.access-code-inputs') || e.target.classList.contains('code-input')) {
        return;
      }
      e.stopPropagation();
    });

    // Close on Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
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
    hydrateStudentView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
