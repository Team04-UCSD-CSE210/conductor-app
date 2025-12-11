// Tutor Dashboard Page Scripts
/* global openViewAnnouncementModal */

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
    updateCourseInfo = () => {},
    updateStats = () => {},
    updateCourseProgress = () => {},
    updateStickyHeader = async () => {},
    updateWelcomeMessage = async () => {},
    loadRecentProgress = async () => {},
    getAnnouncements = async () => [],
    getAttendanceSessions = async () => [],
    getSessionStatistics = async () => null,
  } = DS;
  
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
      
      // Update course info and course progress
      updateCourseInfo(offering);
      updateCourseProgress(offering);
      
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
      
      const attendanceList = attendanceCard.querySelector('.attendance-list');
      if (!attendanceList) return;

      if (!sessions || sessions.length === 0) {
        attendanceList.innerHTML = '<p class="dashboard-empty-state">No attendance sessions yet</p>';
        return;
      }

      // Get the most recent sessions for display
      const recentSessions = sessions
        .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
        .slice(0, 3);

      const sessionStats = await Promise.all(
        recentSessions.map(async (session) => {
          const stats = await getSessionStatistics(session.id);
          return { session, stats };
        })
      );

      const validStats = sessionStats.filter(item => item && item.session && item.stats);
      
      if (validStats.length === 0) {
        attendanceList.innerHTML = '<p class="dashboard-empty-state">No attendance data available</p>';
        return;
      }

      attendanceList.innerHTML = validStats.map(({ session, stats }) => {
        const sessionName = session.name || session.title || `Lecture ${session.session_number || ''}`.trim() || 'Session';
        // Use attendance_percentage if available, otherwise calculate from present_count/total_count
        let percentage = 0;
        if (stats) {
          if (typeof stats.attendance_percentage === 'number' && !Number.isNaN(stats.attendance_percentage)) {
            percentage = Math.round(stats.attendance_percentage);
          } else if (typeof stats.present_count === 'number' && typeof stats.total_count === 'number' && stats.total_count > 0) {
            percentage = Math.round((stats.present_count / stats.total_count) * 100);
          }
        }
        
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
      const attendanceList = attendanceCard?.querySelector('.attendance-list');
      if (attendanceList) {
        attendanceList.innerHTML = '<p class="dashboard-error-state">Error loading attendance</p>';
      }
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
        if (res.status === 404 || res.status === 403) {
          journalList.innerHTML = '<p class="dashboard-empty-state">No journal entries</p>';
        } else {
          journalList.innerHTML = '<p class="dashboard-error-state">Error loading journal entries</p>';
        }
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
        // Format date as MM/DD/YY (e.g., 12/01/25)
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const dateStr = `${month}/${day}/${year}`;
        
        const title = announcement.title || announcement.subject || 'Announcement';
        const content = announcement.content || announcement.body || announcement.message || '';
        const isLongContent = content.length > 100;
        const preview = isLongContent ? content.substring(0, 100) : content;
        const creatorName = announcement.creator_name || 'Unknown';
        const teamBadge = announcement.team_name ? `<span class="team-badge">${escapeHtml(announcement.team_name)}</span>` : '';
        const viewMoreLink = isLongContent ? ` <button class="announcement-view-more" data-announcement-id="${announcement.id}" aria-label="View full announcement">View More</button>` : '';
        
        return `
          <div class="announcement-item clickable-announcement" data-announcement-id="${announcement.id}">
            <div class="announcement-date">${escapeHtml(dateStr)}</div>
            <div class="announcement-content">
              <h5><span class="announcement-title-text">${escapeHtml(title)}</span>${teamBadge}</h5>
              <p class="announcement-preview">${escapeHtml(preview)}${viewMoreLink}</p>
              <div class="announcement-creator">by ${escapeHtml(creatorName)}</div>
            </div>
          </div>
        `;
      }).join('');

      // Store announcements data for access in event handlers
      announcements.forEach(announcement => {
        const item = announcementsList.querySelector(`[data-announcement-id="${announcement.id}"]`);
        if (item) {
          item._announcementData = announcement;
        }
      });

      // Add click listener to "View More" buttons - opens modal
      announcementsList.querySelectorAll('.announcement-view-more').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const announcementId = btn.dataset.announcementId;
          const announcement = announcements.find(a => a.id === announcementId);
          if (announcement) {
            openViewAnnouncementModal(announcement);
          }
        });
      });

      // Add click listener to announcement items to expand
      announcementsList.querySelectorAll('.clickable-announcement').forEach(item => {
        item.addEventListener('click', (e) => {
          // Don't expand if clicking on view more button
          if (e.target.closest('.announcement-view-more')) {
            return;
          }
          const announcement = item._announcementData;
          if (announcement) {
            openViewAnnouncementModal(announcement);
          }
        });
      });
    } catch (error) {
      console.error('Error loading announcements:', error);
      announcementsList.innerHTML = '<p class="dashboard-error-state">Error loading announcements</p>';
    }
  }

  // TODO items are handled by todo-widget.js - no manual loading needed

  // Initialize dashboard
  async function initDashboard() {
    await loadWelcomeName();
    await loadDashboardStats();
    await loadJournalEntries();
    await loadAnnouncements();
    // TODO items are handled by todo-widget.js - no manual loading needed
    
    // Load recent progress (weeks timeline)
    if (offeringId) {
      await loadRecentProgress(offeringId, { showCount: 8 });
    }
    
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

  // View announcement modal (for expanding announcements)
  function initViewAnnouncementModal() {
    const overlay = document.getElementById('viewAnnouncementModal');
    const closeBtn = document.getElementById('viewAnnouncementModalClose');
    if (!overlay) return;

    function closeModal() {
      overlay.setAttribute('aria-hidden', 'true');
      try { overlay.inert = true; } catch { /* ignore if not available */ }
      document.body.style.overflow = '';
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') {
        closeModal();
      }
    });

    // Expose function to open the modal
    window.openViewAnnouncementModal = function(announcement) {
      function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      const date = new Date(announcement.created_at || announcement.date || Date.now());
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      const dateStr = `${month}/${day}/${year}`;
      
      const title = announcement.title || announcement.subject || 'Announcement';
      const content = announcement.content || announcement.body || announcement.message || '';
      const creatorName = announcement.creator_name || 'Unknown';
      
      const dateEl = document.getElementById('viewAnnouncementDate');
      const creatorEl = document.getElementById('viewAnnouncementCreator');
      const subjectEl = document.getElementById('viewAnnouncementSubject');
      const messageEl = document.getElementById('viewAnnouncementMessage');
      
      if (dateEl) dateEl.textContent = dateStr;
      if (creatorEl) creatorEl.textContent = `by ${escapeHtml(creatorName)}`;
      if (subjectEl) subjectEl.textContent = title;
      if (messageEl) {
        messageEl.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
      }
      
      overlay.setAttribute('aria-hidden', 'false');
      try { overlay.inert = false; } catch { /* ignore if not available */ }
      document.body.style.overflow = 'hidden';
      
      setTimeout(() => {
        if (closeBtn) closeBtn.focus();
      }, 50);
    };
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
      initViewAnnouncementModal();
      initDashboard();
    });
  } else {
    initHamburger();
    initViewAnnouncementModal();
    initDashboard();
  }
})();

