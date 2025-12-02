// TA Dashboard Page Scripts

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
    renderTeamsList = () => {},
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
      // Fetch offering details
      const offering = await getOfferingWithStats(offeringId);
      
      // Update course info
      updateCourseInfo(offering);

      // For TA dashboard, we need:
      // - Teams Assigned (teams assigned to this TA)
      // - To Grade (assignments/grading items pending)
      
      // Get teams - for now, show all teams (would need backend to filter by TA assignment)
      const teams = await getTeams(offeringId);
      
      const stats = {
        'Teams Assigned': teams.length || 0,
        'To Grade': 0 // Would need assignments/grading endpoint
      };
      updateStats(stats);

      // Teams list removed - replaced with journal entries
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Load journal entries from backend
  async function loadJournalEntries() {
    const journalList = document.querySelector('.journal-list');
    if (!journalList) return;

    try {
      const res = await fetch('/api/ta-journals', {
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

  // Load and populate welcome banner with the current user's name and role
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
          let roleText = 'a TA';
          
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
      console.error('Error loading current user for welcome banner:', error);
    }
  }

  // Initialize dashboard
  async function initDashboard() {
    await loadWelcomeName();
    await loadDashboardStats();
    await loadInteractionFormData();
    await loadJournalEntries();
    
    // Refresh stats every 30 seconds for live updates
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
      loadDashboardStats();
    }, 30000); // Refresh every 30 seconds
  }

  // Hamburger menu
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

  function initInteractionForm() {
    const posBtn = document.getElementById('positive-btn');
    const negBtn = document.getElementById('negative-btn');
    const notesField = document.getElementById('interaction-notes');
    const submitBtn = document.querySelector('.interaction-submit-row .btn.btn-primary');
    const teamSelect = document.getElementById('team-select');
    const studentSelect = document.getElementById('student-select');

    if (!notesField && !posBtn && !negBtn && !teamSelect && !studentSelect && !submitBtn) return;

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

    function updateSubmitState() {
      const hasText = notesField && notesField.value.trim().length > 0;
      if (submitBtn) submitBtn.disabled = !hasText;
    }
    if (notesField) {
      notesField.addEventListener('input', updateSubmitState);
      updateSubmitState();
    }

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
    const form = document.getElementById('announcement-form');
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
      try { overlay.inert = false; } catch (e) { /* ignore if not available */ }

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
      try { overlay.inert = true; } catch (e) { /* ignore if not available */ }

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

