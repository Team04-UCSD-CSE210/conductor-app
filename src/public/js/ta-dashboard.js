// TA Dashboard Page Scripts

(function() {
  // Wait for DashboardService to be available
  if (typeof window.DashboardService === 'undefined') {
    console.error('DashboardService not loaded. Make sure dashboard.service.js is included before this script.');
    return;
  }

  const { getActiveOfferingId, getOfferingWithStats, getTeams, getStudents, updateCourseInfo, updateStats } = window.DashboardService;
  
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
      initDashboard();
    });
  } else {
    initHamburger();
    initInteractionForm();
    initDashboard();
  }
})();

