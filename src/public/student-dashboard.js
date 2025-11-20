// Student Dashboard Page Scripts

(function() {
  // Wait for DashboardService to be available
  if (typeof window.DashboardService === 'undefined') {
    console.error('DashboardService not loaded. Make sure dashboard.service.js is included before this script.');
    return;
  }

  const { getActiveOfferingId, getOfferingWithStats, getUserEnrollment, updateCourseInfo, updateStats } = window.DashboardService;
  
  let offeringId = null;
  let refreshInterval = null;

  // Get current user ID (from window or extract from session)
  function getCurrentUserId() {
    // This would typically come from the session or a global variable set by the server
    return window.currentUserId || null;
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

      // Get user's enrollment to find their team
      const userId = getCurrentUserId();
      let enrollment = null;
      if (userId) {
        enrollment = await getUserEnrollment(offeringId, userId);
      }
      
      // For student dashboard, we need:
      // - Group Members (team members count)
      // - Assignments Due (would need assignments endpoint)
      // - Weeks Left (calculated from term dates)
      
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
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Initialize dashboard
  async function initDashboard() {
    await loadDashboardStats();
    
    // Refresh stats every 30 seconds for live updates
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
      loadDashboardStats();
    }, 30000); // Refresh every 30 seconds
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
