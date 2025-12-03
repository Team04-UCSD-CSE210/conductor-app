// Student Dashboard Page Scripts
/* global openViewAnnouncementModal */

(function() {
  // Wait for DashboardService to be available
  if (typeof window.DashboardService === 'undefined') {
    console.error('DashboardService not loaded. Make sure dashboard.service.js is included before this script.');
    return;
  }

  const { getActiveOfferingId, getOfferingWithStats, getUserEnrollment, updateCourseInfo, updateStats, updateCourseProgress, updateStickyHeader, updateWelcomeMessage, getAnnouncements, loadRecentProgress, formatCreatorWithRole } = window.DashboardService;
  
  let offeringId = null;
  let refreshInterval = null;

  // Get current user ID (from window or extract from session)
  function getCurrentUserId() {
    // This would typically come from the session or a global variable set by the server
    return window.currentUserId || null;
  }

  // Load dashboard statistics (including attendance)
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

      // Get user's enrollment to find their team
      const userId = getCurrentUserId();
      let enrollment = null;
      if (userId) {
        enrollment = await getUserEnrollment(offeringId, userId);
      }
      
      const stats = {};
      
        // Group Members - get from user's team
      if (enrollment) {
        // Get user's team (this would need team membership endpoint)
        // For now, placeholder - would need backend to get team members
        stats['Group Members'] = 0;
      } else {
        stats['Group Members'] = 0;
      }
      
      // Assignments Due - would need assignments endpoint
      stats['Assignments Due'] = 0;
      
      // Weeks Left - calculate from term dates (placeholder)
      stats['Weeks Left'] = 4;
      
      updateStats(stats);

      // Load attendance statistics for the current student
      await updateStudentAttendance(offeringId);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Update attendance card (Lecture / Team Meetings) from backend stats
  async function updateStudentAttendance(currentOfferingId) {
    const card = document.querySelector('.attendance-card');
    if (!card || !currentOfferingId) return;

    try {
      const res = await fetch(`/api/attendance/my-statistics/${currentOfferingId}`, {
        credentials: 'include'
      });
      if (!res.ok) return;
      const stats = await res.json();

      // Get lecture and team meeting percentages separately if available
      const lecturePercentage = typeof stats.lecture_percentage === 'number'
        ? Math.round(stats.lecture_percentage)
        : (typeof stats.attendance_percentage === 'number' ? Math.round(stats.attendance_percentage) : 0);
      
      const teamMeetingPercentage = typeof stats.team_meeting_percentage === 'number'
        ? Math.round(stats.team_meeting_percentage)
        : 0;

      const items = card.querySelectorAll('.attendance-item');
      if (!items.length) return;

      items.forEach((item) => {
        const fill = item.querySelector('.progress-fill');
        const label = item.querySelector('.attendance-label');
        const percentageEl = item.querySelector('.progress-percentage');

        if (!label) return;
        
        const labelText = label.textContent.trim();
        let percentage = 0;
        
        if (labelText.includes('Lecture')) {
          percentage = lecturePercentage;
        } else if (labelText.includes('Team Meeting')) {
          percentage = teamMeetingPercentage;
        }

        if (fill) {
          fill.style.width = `${percentage}%`;
        }
        if (percentageEl) {
          percentageEl.textContent = `${percentage}%`;
        }
      });
    } catch (error) {
      console.error('Error loading student attendance statistics:', error);
    }
  }

  // Load journal entries from backend
  async function loadJournalEntries() {
    const journalList = document.querySelector('.journal-list');
    if (!journalList) return;

    try {
      const res = await fetch('/api/journals', {
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

      // Sort by date (most recent first) and show latest 5
      const sortedEntries = entries
        .sort((a, b) => {
          const dateA = new Date(a.created_at || a.date || 0);
          const dateB = new Date(b.created_at || b.date || 0);
          return dateB - dateA;
        })
        .slice(0, 5);

      // Helper function to escape HTML
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

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

      // Helper function to escape HTML
      function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        const creatorDisplay = formatCreatorWithRole(announcement);
        const teamBadge = announcement.team_name ? `<span class="team-badge">${escapeHtml(announcement.team_name)}</span>` : '';
        
        return `
          <div class="announcement-item clickable-announcement" data-announcement-id="${announcement.id}">
            <div class="announcement-date">${escapeHtml(dateStr)}</div>
            <div class="announcement-content">
              <h5>${escapeHtml(title)} ${teamBadge}</h5>
              <p>${escapeHtml(preview)}</p>
              <div class="announcement-creator">by ${escapeHtml(creatorDisplay)}</div>
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

      // Add click listener to announcement items to expand
      announcementsList.querySelectorAll('.clickable-announcement').forEach(item => {
        item.addEventListener('click', () => {
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
      const creatorDisplay = formatCreatorWithRole(announcement);
      
      const dateEl = document.getElementById('viewAnnouncementDate');
      const creatorEl = document.getElementById('viewAnnouncementCreator');
      const subjectEl = document.getElementById('viewAnnouncementSubject');
      const messageEl = document.getElementById('viewAnnouncementMessage');
      
      if (dateEl) dateEl.textContent = dateStr;
      if (creatorEl) creatorEl.textContent = `by ${escapeHtml(creatorDisplay)}`;
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

  // Initialize dashboard
  async function initDashboard() {
    await loadDashboardStats();
    await loadWelcomeName();
    await loadJournalEntries();
    await loadAnnouncements();
    
    // Load recent progress (weeks timeline)
    if (offeringId) {
      await loadRecentProgress(offeringId, { showCount: 3 });
    }
    
    // Refresh stats every 30 seconds for live updates
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
      loadDashboardStats();
    }, 30000); // Refresh every 30 seconds
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
          let roleText = 'a Student';
          
          if (context.enrollment_role === 'instructor' || context.primary_role === 'instructor') {
            roleText = 'an Instructor';
          } else if (context.enrollment_role === 'ta') {
            roleText = 'a TA';
          } else if (context.enrollment_role === 'tutor') {
            roleText = 'a Tutor';
          } else if (context.is_team_lead || context.enrollment_role === 'team-lead') {
            roleText = 'a Student (Team Lead)';
          } else if (context.enrollment_role === 'student' || context.primary_role === 'student') {
            roleText = 'a Student';
          }
          
          subtitle.textContent = `You are registered in the course as ${roleText}.`;
        }
      }
    } catch (error) {
      console.error('Error loading current user for welcome banner:', error);
    }
  }

  // Set active navigation link based on current URL
  function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.sidebar nav a');
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      const linkPath = new URL(link.href).pathname;
      
      // Set active if current path matches link path
      if (currentPath === linkPath || 
          (currentPath.startsWith('/lecture-attendance-student') && linkPath === '/lecture-attendance-student') ||
          (currentPath.startsWith('/student-lecture-response') && linkPath === '/lecture-attendance-student')) {
        link.classList.add('active');
      }
    });
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
      setActiveNavLink();
      initViewAnnouncementModal();
      initDashboard();
    });
  } else {
    initHamburger();
    setActiveNavLink();
    initViewAnnouncementModal();
    initDashboard();
  }
})();
