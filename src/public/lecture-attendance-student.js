(function lectureAttendancePage() {
  const state = {
    lectures: [],
    filter: 'all'
  };

  const selectors = {
    list: document.getElementById('lecture-list'),
    empty: document.getElementById('lecture-empty'),
    filter: document.getElementById('lecture-filter'),
    attendancePercentage: document.querySelector('.attendance-percentage'),
    container: document.querySelector('.attendance-content')
  };

  function formatTimeRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' });
    return `${dateFormatter.format(start)} ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
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
    sessionStatus.className = `lecture-status ${lecture.sessionState === 'open' ? 'open' : 'closed'}`;
    sessionStatus.textContent = lecture.sessionState === 'open' ? 'Open' : 'Closed';

    const actions = document.createElement('div');
    actions.className = 'lecture-actions';
    const actionButton = document.createElement('button');
    actionButton.className = 'btn-link';
    actionButton.type = 'button';
    actionButton.textContent = lecture.sessionState === 'open'
      ? (lecture.status === 'present' ? 'View submission' : 'Record attendance')
      : 'View responses';
    actionButton.addEventListener('click', () => {
      if (lecture.sessionState === 'open') {
        if (lecture.status === 'present') {
          // Already marked present, go to view submission
          window.location.href = `/lectures/${lecture.id}/respond`;
        } else {
          // Need to record attendance - show modal
          showAccessCodeModal(lecture);
        }
      } else {
        // Session is closed - navigate directly to view responses
        window.location.href = `/lectures/${lecture.id}/respond`;
      }
    });
    actions.appendChild(actionButton);

    meta.append(sessionStatus, actions);
    info.append(details, meta);
    row.appendChild(info);

    return row;
  }

  function updateOverallAttendance() {
    if (!selectors.attendancePercentage) return;
    const closedLectures = state.lectures.filter((lec) => lec.sessionState === 'closed');
    const presentCount = closedLectures.filter((lec) => lec.status === 'present').length;
    const percent = closedLectures.length
      ? Math.round((presentCount / closedLectures.length) * 100)
      : 0;
    selectors.attendancePercentage.textContent = `${percent}%`;
  }

  function renderLectures() {
    if (!selectors.list) return;
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

  function hydrateStudentView() {
    if (!window.LectureService || !selectors.container) return;
    const studentId = selectors.container.getAttribute('data-student-id') || undefined;
    state.lectures = window.LectureService.getStudentLectureList(studentId);
    updateOverallAttendance();
    renderLectures();
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

  function showAccessCodeModal(lecture) {
    const isOpenSession = lecture.sessionState === 'open';
    const modalTitle = isOpenSession ? 'Record Attendance' : 'View Responses';
    const modalDescription = isOpenSession 
      ? `Enter the 6-digit access code to record your attendance for ${lecture.label}`
      : `Enter the 6-digit access code to view your responses for ${lecture.label}`;
    
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
          <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" aria-label="Digit 1" data-index="0">
          <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" aria-label="Digit 2" data-index="1">
          <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" aria-label="Digit 3" data-index="2">
          <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" aria-label="Digit 4" data-index="3">
          <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" aria-label="Digit 5" data-index="4">
          <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" aria-label="Digit 6" data-index="5">
        </div>
        <div class="modal-error" id="modal-error"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    const modal = overlay.querySelector('.access-code-modal');
    const inputs = Array.from(overlay.querySelectorAll('.code-input'));
    const closeBtn = overlay.querySelector('.modal-close');

    // Auto-focus first input
    setTimeout(() => {
      inputs[0]?.focus();
    }, 100);

    // Function to check if all inputs are filled and redirect
    const checkAndRedirect = () => {
      const code = inputs.map(input => input.value.trim()).join('');
      if (code.length === 6 && /^\d{6}$/.test(code)) {
        // All 6 digits filled, redirect to student-lecture-response
        window.location.href = `/student-lecture-response?lectureId=${lecture.id}`;
      }
    };

    // Handle input navigation with auto-advance
    inputs.forEach((input, index) => {
      // Handle keydown for input filtering
      input.addEventListener('keydown', (e) => {
        // Allow navigation keys
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'].includes(e.key)) {
          return; // Let default behavior happen
        }

        // Handle backspace
        if (e.key === 'Backspace') {
          if (input.value) {
            // Clear current input
            input.value = '';
            input.classList.remove('filled');
          } else if (index > 0) {
            // Move to previous and clear it
            e.preventDefault();
            inputs[index - 1].focus();
            inputs[index - 1].value = '';
            inputs[index - 1].classList.remove('filled');
          }
          return;
        }

        // Handle delete
        if (e.key === 'Delete') {
          input.value = '';
          input.classList.remove('filled');
          return;
        }

        // Only allow numbers
        if (!/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          return;
        }

        // If there's already a value, replace it
        if (input.value) {
          input.value = '';
        }
      });

      // Handle input event for auto-advance
      input.addEventListener('input', (e) => {
        // Get only digits
        let value = e.target.value.replace(/[^0-9]/g, '');
        
        // Only take the first digit
        if (value.length > 0) {
          value = value.charAt(0);
          e.target.value = value;
          input.classList.add('filled');
          
          // Auto-advance to next input IMMEDIATELY
          if (index < inputs.length - 1) {
            // Use requestAnimationFrame for immediate focus change
            requestAnimationFrame(() => {
              inputs[index + 1].focus();
            });
          }
          
          // Check if all digits are filled and redirect
          checkAndRedirect();
        } else {
          input.classList.remove('filled');
        }
      });

      // Handle paste
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasteData.replace(/[^0-9]/g, '').slice(0, 6);
        
        if (digits.length === 0) return;
        
        // Fill inputs starting from current index
        digits.split('').forEach((char, i) => {
          const targetIndex = index + i;
          if (targetIndex < inputs.length) {
            inputs[targetIndex].value = char;
            inputs[targetIndex].classList.add('filled');
          }
        });
        
        // Focus the next empty input or the last input if all filled
        const nextIndex = Math.min(index + digits.length, inputs.length - 1);
        setTimeout(() => {
          inputs[nextIndex].focus();
          checkAndRedirect();
        }, 10);
      });

      // Handle focus - select all text when focused
      input.addEventListener('focus', () => {
        input.select();
      });
    });

    // Close modal function
    const closeModal = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    };
    
    // Close button click handler - use mousedown for better reliability
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
    
    // Close when clicking overlay background (but not the modal itself)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Prevent modal clicks from closing
    modal.addEventListener('click', (e) => {
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
    const contactProfessor = document.getElementById('contact-professor');
    const handler = (recipient) => () => window.alert(`Message the ${recipient} through Slack or email.`);

    if (contactTA) contactTA.addEventListener('click', handler('TA'));
    if (contactProfessor) contactProfessor.addEventListener('click', handler('Professor'));
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

