// Instructor Dashboard Page Scripts

(function() {
  // DashboardService is optional for the modal UI; provide safe fallbacks so
  // the script still initializes (modal, hamburger, forms) even if the
  // service bundle didn't load yet.
  const DS = window.DashboardService || {};
  if (!window.DashboardService) {
    console.warn('DashboardService not loaded — some dashboard features will be disabled, but UI handlers will still work.');
  }

  const {
    getActiveOfferingId = async () => null,
    getOfferingWithStats = async () => ({}),
    getTeams = async () => [],
    getStudents = async () => [],
    updateCourseInfo = () => {},
    updateStats = () => {},
    updateCourseProgress = () => {},
  } = DS;
  
  let offeringId = null;
  let refreshInterval = null;

  // Load dashboard statistics
  async function loadDashboardStats() {
    if (!offeringId) {
      offeringId = await getActiveOfferingId();
      if (!offeringId) {
        console.error('No active offering found');
        return;
      }
    }

    try {
      // Fetch offering details with stats
      const offering = await getOfferingWithStats(offeringId);
      
      // Update course info and course progress
      updateCourseInfo(offering);
      updateCourseProgress(offering);

      // Update stats
      const stats = {
        'Students': offering.student_count || 0,
        'Teams': offering.team_count || 0,
        'TAs': offering.ta_count || 0,
        'Tutors': offering.tutor_count || 0
      };
      updateStats(stats);

      // Teams list removed - replaced with journal entries

      // Update instructor attendance summary on the card
      await updateInstructorAttendance(offeringId);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Load journal entries from backend
  async function loadJournalEntries() {
    const journalList = document.querySelector('.journal-list');
    if (!journalList) return;

    try {
      const res = await fetch('/api/instructor-journals', {
        credentials: 'include'
      });
      
      if (!res.ok) {
        journalList.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">No journal entries</p>';
        return;
      }
      
      const data = await res.json();
      const entries = Array.isArray(data.logs) ? data.logs : (Array.isArray(data) ? data : []);

      if (!entries.length) {
        journalList.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">No journal entries yet</p>';
        return;
      }

      // Helper function to escape HTML
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      // Sort by date (most recent first) and show latest 5
      const sortedEntries = entries
        .sort((a, b) => {
          const dateA = new Date(a.created_at || a.date || 0);
          const dateB = new Date(b.created_at || b.date || 0);
          return dateB - dateA;
        })
        .slice(0, 5);

      journalList.innerHTML = sortedEntries.map(entry => {
        const date = new Date(entry.created_at || entry.date || Date.now());
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const title = entry.title || entry.content?.substring(0, 30) || 'Journal Entry';
        
        return `<div class="journal-entry">${escapeHtml(dateStr)} - ${escapeHtml(title)}</div>`;
      }).join('');
    } catch (error) {
      console.error('Error loading journal entries:', error);
      journalList.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">Error loading journal entries</p>';
    }
  }

  // Update instructor attendance card with per-lecture statistics
  async function updateInstructorAttendance(currentOfferingId) {
    if (!currentOfferingId) return;

    const card = document.querySelector('.attendance-card');
    if (!card) return;

    const list = card.querySelector('.attendance-list');
    if (!list) return;

    try {
      // Get recent lecture sessions for this offering
      const sessionsRes = await fetch(
        `/api/sessions?offering_id=${encodeURIComponent(currentOfferingId)}&limit=20`,
        { credentials: 'include' }
      );
      if (!sessionsRes.ok) return;
      const sessions = await sessionsRes.json();

      const lectureSessions = (Array.isArray(sessions) ? sessions : [])
        .filter(s => !s.team_id) // lectures only, not team meetings
        .sort((a, b) => new Date(b.session_date) - new Date(a.session_date))
        .slice(0, 8); // show most recent 8

      if (!lectureSessions.length) return;

      // Fetch attendance statistics per session in parallel
      const statsList = await Promise.all(
        lectureSessions.map(async (session) => {
          try {
            const statsRes = await fetch(
              `/api/attendance/sessions/${encodeURIComponent(session.id)}/statistics`,
              { credentials: 'include' }
            );
            if (!statsRes.ok) return null;
            const stats = await statsRes.json();
            return { session, stats };
          } catch {
            return null;
          }
        })
      );

      const items = statsList.filter(Boolean);
      if (!items.length) return;

      list.innerHTML = '';

      items.forEach(({ session, stats }) => {
        const percentage = typeof stats.attendance_percentage === 'number'
          ? Math.round(stats.attendance_percentage)
          : 0;

        const date = session.session_date ? new Date(session.session_date) : null;
        const timeStr = session.session_time || '';
        const dateLabel = date
          ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : '';
        const metaLabel = dateLabel && timeStr
          ? `${dateLabel} • ${timeStr}`
          : dateLabel || timeStr;

        const title = session.title || 'Lecture';
        const shortTitle = title.length > 26 ? `${title.slice(0, 23)}...` : title;

        const itemEl = document.createElement('div');
        itemEl.className = 'attendance-item';

        const infoEl = document.createElement('div');
        infoEl.className = 'attendance-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'attendance-title';
        titleEl.textContent = shortTitle;

        const metaEl = document.createElement('div');
        metaEl.className = 'attendance-meta';
        metaEl.textContent = metaLabel;

        infoEl.appendChild(titleEl);
        if (metaLabel) infoEl.appendChild(metaEl);

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = `${percentage}%`;

        const pctEl = document.createElement('span');
        pctEl.className = 'progress-percentage';
        pctEl.textContent = `${percentage}%`;

        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(pctEl);

        itemEl.appendChild(infoEl);
        itemEl.appendChild(progressContainer);

        list.appendChild(itemEl);
      });
    } catch (error) {
      console.error('Error loading instructor attendance statistics:', error);
    }
  }

  // Load teams and students for interaction form
  async function loadInteractionFormData() {
    if (!offeringId) return;

    const teamSelect = document.getElementById('team-select');
    const studentSelect = document.getElementById('student-select');

    if (!teamSelect && !studentSelect) return;

    try {
      // Load teams for dropdown
      if (teamSelect) {
        const teams = await getTeams(offeringId);
        teamSelect.innerHTML = '<option value="">Select team</option>' +
          (Array.isArray(teams) ? teams.map(team => {
            const teamName = team.name || (team.team_number ? `Team ${team.team_number}` : `Team ${team.id}`);
            return `<option value="${team.id}">${teamName}</option>`;
          }).join('') : '');
      }

      // Load students for dropdown
      if (studentSelect) {
        const students = await getStudents(offeringId);
        const studentsList = Array.isArray(students) ? students : [];
        studentSelect.innerHTML = '<option value="">Select student</option>' +
          studentsList.map(student => 
            `<option value="${student.user_id || student.id}">${student.user_name || student.name || 'Unknown'}</option>`
          ).join('');
      }
    } catch (error) {
      console.error('Error loading interaction form data:', error);
    }
  }

  // Initialize dashboard
  async function initDashboard() {
    await loadDashboardStats();
    await loadInteractionFormData();
    await loadWelcomeName();
    await loadJournalEntries();
    
    // Refresh stats every 30 seconds for live updates
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
      loadDashboardStats();
    }, 30000); // Refresh every 30 seconds
  }

  // Load and populate the welcome banner with the current user's name
  async function loadWelcomeName() {
    const heading = document.querySelector('.welcome-content h2');
    const subtitle = document.querySelector('.welcome-content p');
    if (!heading) return;

    try {
      // Get user name and role information from navigation context
      const contextRes = await fetch('/api/users/navigation-context', { credentials: 'include' });
      if (contextRes.ok) {
        const context = await contextRes.json();
        
        // Update heading with user name
        if (context.name) {
          heading.textContent = `Welcome, ${context.name}!`;
        }
        
        // Update subtitle with role information
        if (subtitle) {
          let roleText = 'an Instructor';
          
          if (context.enrollment_role === 'instructor' || context.primary_role === 'instructor') {
            roleText = 'an Instructor';
          } else if (context.enrollment_role === 'ta') {
            roleText = 'a TA';
          } else if (context.enrollment_role === 'tutor') {
            roleText = 'a Tutor';
          }
          
          subtitle.textContent = `You are registered in the course as ${roleText}.`;
        }
      }
    } catch (error) {
      console.error('Error loading current user for instructor welcome banner:', error);
    }
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

    // Close menu when clicking outside on mobile
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

  function initInteractionForm() {
    const posBtn = document.getElementById('positive-btn');
    const negBtn = document.getElementById('negative-btn');
    const notesField = document.getElementById('interaction-notes');
    const submitBtn = document.querySelector('.interaction-submit-row .btn.btn-primary');
    const teamSelect = document.getElementById('team-select');
    const studentSelect = document.getElementById('student-select');

    // If the form isn't on this page, skip
    if (!notesField && !posBtn && !negBtn && !teamSelect && !studentSelect && !submitBtn) return;

    // Positive/Negative selection toggle
    let selected = null;
    function updateSelected() {
      if (posBtn) posBtn.classList.toggle('selected', selected === 'positive');
      if (negBtn) negBtn.classList.toggle('selected', selected === 'negative');
    }
    if (posBtn) {
      posBtn.addEventListener('click', () => {
        selected = 'positive';
        updateSelected();
      });
    }
    if (negBtn) {
      negBtn.addEventListener('click', () => {
        selected = 'negative';
        updateSelected();
      });
    }

    // Disable submit when the notes field is empty
    function updateSubmitState() {
      const hasText = notesField && notesField.value.trim().length > 0;
      if (submitBtn) submitBtn.disabled = !hasText;
    }
    if (notesField) {
      notesField.addEventListener('input', updateSubmitState);
      updateSubmitState();
    }

    // Lighter placeholder styling for selects when value is empty
    function updatePlaceholderState(sel) {
      if (!sel) return;
      const isEmpty = sel.value === '';
      sel.classList.toggle('is-placeholder', isEmpty);
    }
    if (teamSelect) {
      teamSelect.addEventListener('change', () => updatePlaceholderState(teamSelect));
      updatePlaceholderState(teamSelect);
    }
    if (studentSelect) {
      studentSelect.addEventListener('change', () => updatePlaceholderState(studentSelect));
      updatePlaceholderState(studentSelect);
    }
  }

  // Announcement modal handling
  function initAnnouncementModal() {
    const openBtn = document.getElementById('createAnnouncementBtn');
    const overlay = document.getElementById('announcementModal');
    const closeBtn = document.getElementById('announcementModalClose');
    const cancelBtn = document.getElementById('announcementCancel');
    const form = document.getElementById('announcementForm');
    const subjectInput = document.getElementById('announcement-subject');
    const bodyInput = document.getElementById('announcement-body');
    const announcementsList = document.querySelector('.announcements-list');

    if (!openBtn || !overlay || !form) return;

    let previouslyFocused = null;
    const mainContent = document.querySelector('main');

    function openModal() {
      // save focused element to restore later
      previouslyFocused = document.activeElement;

      // make the modal visible/accessible
      overlay.setAttribute('aria-hidden', 'false');
      try { overlay.inert = false; } catch { /* ignore if not available */ }

      // hide background content from assistive tech
      if (mainContent) mainContent.setAttribute('aria-hidden', 'true');

      // prevent body scroll while modal open
      document.body.style.overflow = 'hidden';

      // move focus into modal (subject input preferred)
      setTimeout(() => {
        if (subjectInput) subjectInput.focus();
        else if (closeBtn) closeBtn.focus();
      }, 50);
    }

    function closeModal() {
      // hide the modal from AT
      overlay.setAttribute('aria-hidden', 'true');
      try { overlay.inert = true; } catch { /* ignore if not available */ }

      // restore background content visibility to AT
      if (mainContent) mainContent.removeAttribute('aria-hidden');

      // restore scrolling
      document.body.style.overflow = '';

      // reset form and restore focus
      form.reset();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      } else if (openBtn) {
        openBtn.focus();
      }
    }

    openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Close when clicking the overlay outside the modal
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Escape key closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') {
        closeModal();
      }
    });

    // Submit handler: insert new announcement locally and optionally call service
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = subjectInput.value.trim();
      const body = bodyInput.value.trim();
      if (!subject || !body) return;

      // Build announcement element
      const item = document.createElement('div');
      item.className = 'announcement-item';
      const date = new Date().toLocaleDateString();
      item.innerHTML = `
        <div class="announcement-date">${date}</div>
        <div class="announcement-content">
          <h5>${escapeHtml(subject)}</h5>
          <p>${escapeHtml(body)}</p>
        </div>
      `;

      if (announcementsList) {
        announcementsList.prepend(item);
      }

      // Optionally call server via DashboardService (if available)
      if (window.DashboardService && typeof window.DashboardService.createAnnouncement === 'function') {
        try {
          await window.DashboardService.createAnnouncement({ subject, body });
        } catch (err) {
          console.error('Failed to create announcement on server:', err);
        }
      }

      closeModal();
    });

    // small HTML escape to avoid injection when inserting content
    function escapeHtml(str) {
      return str.replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
    }
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initHamburger();
      initInteractionForm();
      initAnnouncementModal();
      initDashboard();
    });
  } else {
    initHamburger();
    initInteractionForm();
    initAnnouncementModal();
    initDashboard();
  }
})();

