// Student Leader (Team Lead) Dashboard Page Scripts

(function() {
  // Wait for DashboardService to be available
  if (typeof window.DashboardService === 'undefined') {
    console.error('DashboardService not loaded. Make sure dashboard.service.js is included before this script.');
    return;
  }

  const { getActiveOfferingId, getOfferingWithStats, updateCourseInfo, updateCourseProgress, updateStickyHeader, updateWelcomeMessage } = window.DashboardService;
  
  let offeringId = null;
  let refreshInterval = null;


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

      // Load attendance statistics for the current student
      await updateStudentAttendance(offeringId);
      
      // Load announcements
      await loadAnnouncements(offeringId);
      
      // Load journal entries
      await loadJournalEntries();
      
      // Load recent progress
      await loadRecentProgress(offeringId);
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
      if (!res.ok) {
        console.warn('Failed to load attendance statistics');
        return;
      }
      const stats = await res.json();
      
      console.log('[Team Lead Dashboard] Attendance stats from backend:', stats);

      // Get lecture and team meeting percentages separately if available
      const lecturePercentage = typeof stats.lecture_percentage === 'number'
        ? Math.round(stats.lecture_percentage)
        : (typeof stats.attendance_percentage === 'number' ? Math.round(stats.attendance_percentage) : 0);
      
      const teamMeetingPercentage = typeof stats.team_meeting_percentage === 'number'
        ? Math.round(stats.team_meeting_percentage)
        : 0;
      
      console.log('[Team Lead Dashboard] Lecture:', lecturePercentage + '%', 'Team Meetings:', teamMeetingPercentage + '%');

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

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load announcements from backend
  async function loadAnnouncements(offeringId) {
    const announcementsList = document.querySelector('.announcements-list');
    if (!announcementsList || !offeringId) return;

    try {
      // Try to fetch announcements - if no endpoint exists, show empty state
      const res = await fetch(`/api/offerings/${offeringId}/announcements`, {
        credentials: 'include'
      });
      
      if (!res.ok) {
        // If endpoint doesn't exist, show empty state
        announcementsList.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">No announcements available</p>';
        return;
      }
      
      const data = await res.json();
      const announcements = Array.isArray(data) ? data : (data.announcements || []);
      
      if (!announcements.length) {
        announcementsList.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">No announcements</p>';
        return;
      }

      // Render announcements
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
      announcementsList.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">Error loading announcements</p>';
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

  // Load recent progress (weeks timeline)
  async function loadRecentProgress(offeringId) {
    const weeksTimeline = document.querySelector('.weeks-timeline');
    if (!weeksTimeline || !offeringId) return;

    try {
      // Fetch offering to get start/end dates
      const offering = await getOfferingWithStats(offeringId);
      if (!offering || !offering.start_date || !offering.end_date) {
        weeksTimeline.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">Progress information not available</p>';
        return;
      }

      const startDate = new Date(offering.start_date);
      const endDate = new Date(offering.end_date);
      const now = new Date();

      // Calculate weeks
      const weeks = [];
      let currentWeekStart = new Date(startDate);
      let weekNumber = 1;

      while (currentWeekStart < endDate) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        if (weekEnd > endDate) {
          weekEnd.setTime(endDate.getTime());
        }

        const isCurrentWeek = now >= currentWeekStart && now <= weekEnd;
        const isPastWeek = now > weekEnd;

        const statusClass = isCurrentWeek ? 'current' : '';
        const statusText = isPastWeek ? 'completed' : (isCurrentWeek ? 'in-progress' : 'upcoming');
        
        const dateRange = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        
        weeks.push({
          weekNumber,
          dateRange,
          statusClass,
          statusText,
          startDate: new Date(currentWeekStart),
          endDate: new Date(weekEnd)
        });

        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        weekNumber++;
      }

      // Show last 3 weeks (or all if less than 3)
      const displayWeeks = weeks.slice(-3).reverse();

      weeksTimeline.innerHTML = displayWeeks.map(week => {
        return `
          <div class="week-item ${week.statusClass}">
            <div class="week-header">
              <div class="week-number">Week ${week.weekNumber}</div>
              <div class="week-dates">${week.dateRange}</div>
            </div>
            <div class="week-status ${week.statusText}">${week.statusText === 'completed' ? 'Completed' : (week.statusText === 'in-progress' ? 'In Progress' : 'Upcoming')}</div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading recent progress:', error);
      weeksTimeline.innerHTML = '<p style="padding: 1rem; color: var(--palette-primary, var(--gray-600));">Error loading progress</p>';
    }
  }

  // Initialize dashboard
  async function initDashboard() {
    await loadDashboardStats();
    await loadWelcomeName();
    
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
      initDashboard();
    });
  } else {
    initHamburger();
    setActiveNavLink();
    initDashboard();
  }
})();

