// Tutor Dashboard Page Scripts

(function() {
  // Wait for DashboardService to be available
  if (typeof window.DashboardService === 'undefined') {
    console.error('DashboardService not loaded. Make sure dashboard.service.js is included before this script.');
    return;
  }

  const { 
    getActiveOfferingId, 
    getOfferingWithStats, 
    getTeams, 
    updateCourseInfo, 
    updateStats,
    getAnnouncements,
    getAttendanceSessions,
    getSessionStatistics,
    getDashboardTodos,
    updateStickyHeader,
    updateWelcomeMessage,
  } = window.DashboardService;
  
  let offeringId = null;
  let refreshInterval = null;

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

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
      
      // Update welcome message with user's name and role
      await updateWelcomeMessage(offeringId);
      
      // Update sticky header with course details, timings, location, and team info
      await updateStickyHeader(offeringId);

      // For Tutor dashboard, we need:
      // - Teams Assigned (teams assigned to this tutor)
      // - To Grade (assignments/grading items pending)
      
      // Get teams - for now, show all teams (would need backend to filter by tutor assignment)
      const teams = await getTeams(offeringId);
      
      const stats = {
        'Teams Assigned': teams.length || 0,
        'To Grade': 0 // Would need assignments/grading endpoint
      };
      updateStats(stats);

      // Load attendance statistics for overall course
      await loadAttendanceStatistics();
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Load attendance statistics for Tutor dashboard
  async function loadAttendanceStatistics() {
    if (!offeringId) return;

    const attendanceCard = document.querySelector('.attendance-card');
    if (!attendanceCard) return;

    try {
      // Get all attendance sessions for this offering
      const sessions = await getAttendanceSessions(offeringId);
      
      if (!sessions || sessions.length === 0) {
        return; // No sessions yet
      }

      // Get the most recent sessions for display
      const recentSessions = sessions
        .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
        .slice(0, 3);

      // Load statistics for each session and display
      const attendanceList = attendanceCard.querySelector('.attendance-list');
      if (!attendanceList) return;

      const sessionStats = await Promise.all(
        recentSessions.map(async (session) => {
          const stats = await getSessionStatistics(session.id);
          return { session, stats };
        })
      );

      attendanceList.innerHTML = sessionStats.map(({ session, stats }) => {
        const sessionName = session.name || session.title || `Lecture ${session.session_number || ''}`.trim() || 'Session';
        const percentage = stats ? Math.round((stats.present_count / Math.max(stats.total_count, 1)) * 100) : 0;
        
        return `
          <div class="attendance-item">
            <span class="attendance-label">${escapeHtml(sessionName)}</span>
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
              </div>
              <span class="progress-percentage">${percentage}%</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error loading attendance statistics:', error);
    }
  }

  // Load journal entries from backend
  async function loadJournalEntries() {
    const journalList = document.querySelector('.journal-list');
    if (!journalList) return;

    try {
      const res = await fetch('/api/tutor-journals', {
        credentials: 'include'
      });
      
      if (!res.ok) {
        journalList.innerHTML = '<p class="dashboard-empty-state">No journal entries</p>';
        return;
      }
      
      const data = await res.json();
      const entries = Array.isArray(data.logs) ? data.logs : (Array.isArray(data) ? data : []);

      if (!entries.length) {
        journalList.innerHTML = '<p class="dashboard-empty-state">No journal entries yet</p>';
        return;
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
      journalList.innerHTML = '<p class="dashboard-error-state">Error loading journal entries</p>';
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
          let roleText = 'a Tutor';
          
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

  // Load announcements from backend
  async function loadAnnouncements() {
    if (!offeringId) {
      offeringId = await getActiveOfferingId();
      if (!offeringId) return;
    }

    const announcementsList = document.querySelector('.announcements-list');
    if (!announcementsList) return;

    try {
      const announcements = await getAnnouncements(offeringId);
      
      if (!announcements || announcements.length === 0) {
        announcementsList.innerHTML = '<p class="dashboard-empty-state">No announcements</p>';
        return;
      }

      announcementsList.innerHTML = announcements.slice(0, 5).map(announcement => {
        const date = new Date(announcement.created_at || announcement.date || Date.now());
        const dateStr = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
        const title = announcement.title || announcement.subject || 'Announcement';
        const content = announcement.content || announcement.body || announcement.message || '';
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        
        return `
          <div class="announcement-item">
            <div class="announcement-date">${escapeHtml(dateStr)}</div>
            <div class="announcement-content">
              <h5>${escapeHtml(title)}</h5>
              <p>${escapeHtml(preview)}</p>
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error loading announcements:', error);
      announcementsList.innerHTML = '<p class="dashboard-error-state">Error loading announcements</p>';
    }
  }

  // Load TODO items from backend
  async function loadTodos() {
    try {
      const todos = await getDashboardTodos();
      const todoList = document.querySelector('.todo-card .todo-list');
      if (!todoList) return;

      if (!todos || todos.length === 0) {
        todoList.innerHTML = '<p class="dashboard-empty-state">No TODO items</p>';
        return;
      }

      todoList.innerHTML = todos.map(todo => {
        const isCompleted = todo.completed || false;
        return `
          <div class="todo-item">
            <div class="todo-checkbox ${isCompleted ? 'checked' : ''}" data-todo-id="${todo.id}"></div>
            <span class="${isCompleted ? 'completed' : ''}">${escapeHtml(todo.title)}</span>
          </div>
        `;
      }).join('');

      // Add click handlers for todo checkboxes
      todoList.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', async () => {
          const todoId = checkbox.dataset.todoId;
          const isCompleted = checkbox.classList.contains('checked');
          try {
            if (window.DashboardService && window.DashboardService.updateDashboardTodo) {
              await window.DashboardService.updateDashboardTodo(todoId, { completed: !isCompleted });
              checkbox.classList.toggle('checked');
              const span = checkbox.nextElementSibling;
              if (span) span.classList.toggle('completed');
            }
          } catch (error) {
            console.error('Error updating TODO:', error);
          }
        });
      });
    } catch (error) {
      console.error('Error loading TODO items:', error);
    }
  }

  // Initialize dashboard
  async function initDashboard() {
    await loadWelcomeName();
    await loadDashboardStats();
    await loadJournalEntries();
    await loadAnnouncements();
    await loadTodos();
    
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

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initHamburger();
      initDashboard();
    });
  } else {
    initHamburger();
    initDashboard();
  }
})();

