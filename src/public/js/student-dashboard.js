// Student Dashboard Page Scripts

(function() {
  // Wait for DashboardService to be available
  if (typeof window.DashboardService === 'undefined') {
    console.error('DashboardService not loaded. Make sure dashboard.service.js is included before this script.');
    return;
  }

  const { getActiveOfferingId, getOfferingWithStats, getUserEnrollment, updateCourseInfo, updateStats, updateCourseProgress } = window.DashboardService;
  
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

      const percentage = typeof stats.attendance_percentage === 'number'
        ? Math.round(stats.attendance_percentage)
        : 0;

      const items = card.querySelectorAll('.attendance-item');
      if (!items.length) return;

      // For now, apply the same percentage to both lecture and team meetings
      items.forEach((item) => {
        const fill = item.querySelector('.progress-fill');
        const label = item.querySelector('.attendance-label');
        const percentageEl = item.querySelector('.progress-percentage');

        if (fill) {
          fill.style.width = `${percentage}%`;
        }
        if (percentageEl) {
          percentageEl.textContent = `${percentage}%`;
        }

        // Optional: tweak label for clarity if needed in the future
        if (label && label.textContent.includes('Lecture')) {
          // label.textContent = 'Lecture Attendance';
        }
      });
    } catch (error) {
      console.error('Error loading student attendance statistics:', error);
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

  // Load and populate welcome banner with the current user's name
  async function loadWelcomeName() {
    const heading = document.querySelector('.welcome-content h2');
    if (!heading) return;

    try {
      const res = await fetch('/api/user', { credentials: 'include' });
      if (!res.ok) return;
      const user = await res.json();
      if (user && user.name) {
        heading.textContent = `Welcome, ${user.name}!`;
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
