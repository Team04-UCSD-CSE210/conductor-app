/**
 * Sidebar navigation: builds role-aware links so every page mirrors the dashboard nav.
 * Fetches the user's context (primary role, enrollment role, team lead flag) and renders links accordingly.
 */

(function () {
  const NAV_CONFIG = {
    admin: [
      { href: "/admin-dashboard", text: "Admin Dashboard" },
      { href: "/instructor-dashboard", text: "Instructor View" },
      { href: "/course-settings", text: "Course Settings", icon: "/assets/settings.png" },
      {
        href: "/instructor-lectures",
        text: "Attendance",
        match: ["/instructor-lectures", "/lecture-builder", "/lecture-responses"]
      },
      { href: "/roster", text: "Roster", icon: "/assets/roster.png" },
      { href: "/class-directory", text: "Directory" }
    ],
    instructor: [
      { href: "/instructor-dashboard", text: "Dashboard" },
      { href: "/course-settings", text: "Course Settings", icon: "/assets/settings.png" },
      {
        href: "/instructor-lectures",
        text: "Attendance",
        match: ["/instructor-lectures", "/lecture-builder", "/lecture-responses"]
      },
      { href: "/roster", text: "Roster", icon: "/assets/roster.png" },
      { href: "/class-directory", text: "Directory" },
      { href: "/instructor-meetings", text: "Team Meetings", icon: "/assets/conversation.png" },
      { href: "/instructor-journal", text: "Journal", icon: "/assets/journal.png" }
    ],
    tutor: [
      { href: "/tutor-dashboard", text: "Dashboard" },
      {
        href: "/instructor-lectures",
        text: "Attendance",
        match: ["/instructor-lectures", "/lecture-builder", "/lecture-responses"]
      },
      { href: "/class-directory", text: "Directory" },
      { href: "/tutor-journal", text: "Journal", icon: "/assets/journal.png" }
    ],
    ta: [
      { href: "/ta-dashboard", text: "Dashboard" },
      {
        href: "/instructor-lectures",
        text: "Attendance",
        match: ["/instructor-lectures", "/lecture-builder", "/lecture-responses"]
      },
      { href: "/roster", text: "Roster", icon: "/assets/roster.png" },
      { href: "/class-directory", text: "Directory" },
      { href: "/ta-journal", text: "Journal", icon: "/assets/journal.png" },
      { href: "/instructor-meetings", text: "Team Meetings", icon: "/assets/conversation.png" }
    ],
    teamLead: [
      { 
        href: "/student-dashboard", 
        text: "Courses",
        match: ["/student-dashboard", "/team-lead-dashboard"]
      },
      {
        href: "/lecture-attendance-student",
        text: "Lectures",
        match: ["/lecture-attendance-student", "/student-lecture-response"]
      },
      { href: "/meetings", text: "Meetings", icon: "/assets/conversation.png" },
      { href: "/team-edit", text: "Edit Team", icon: "/assets/settings.png" },
      {
        href: "/work-journal",
        text: "Work Journal",
        match: ["/work-journal", "/student-work-journal", "/lead-journal"]
      },
      { href: "/class-directory", text: "Directory" }
    ],
    student: [
      { 
        href: "/student-dashboard", 
        text: "Courses",
        match: ["/student-dashboard", "/team-lead-dashboard"]
      },
      {
        href: "/lecture-attendance-student",
        text: "Lectures",
        match: ["/lecture-attendance-student", "/student-lecture-response"]
      },
      { href: "/meetings", text: "Meetings", icon: "/assets/conversation.png" },
      {
        href: "/work-journal",
        text: "Work Journal",
        match: ["/work-journal", "/student-work-journal", "/lead-journal"]
      },
      { href: "/class-directory", text: "Directory" }
    ]
  };

  const fetchJson = async (url) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  };

  const determineNavLinks = (context) => {
    if (!context) return NAV_CONFIG.student;

    const { primary_role, enrollment_role, is_team_lead } = context;

    if (primary_role === "admin") return NAV_CONFIG.admin;
    if (primary_role === "instructor") return NAV_CONFIG.instructor;
    if (enrollment_role === "tutor") return NAV_CONFIG.tutor;
    if (enrollment_role === "ta") return NAV_CONFIG.ta;
    if (is_team_lead) return NAV_CONFIG.teamLead;
    return NAV_CONFIG.student;
  };

  const populateUserDisplay = (context) => {
    const sidebarUserEl = document.getElementById('sidebarUser');
    if (!sidebarUserEl) {
      // Element doesn't exist on this page, that's okay
      return;
    }

    if (!context) {
      console.warn('[sidebar-nav] No context provided for user display');
      return;
    }

    const nameEl = sidebarUserEl.querySelector('.sidebar-user-name');
    const roleEl = sidebarUserEl.querySelector('.sidebar-user-role');

    if (!nameEl || !roleEl) {
      console.warn('[sidebar-nav] User display elements not found');
      return;
    }

    // Populate name
    if (context.name) {
      nameEl.textContent = context.name;
    } else if (context.preferred_name) {
      nameEl.textContent = context.preferred_name;
    } else {
      nameEl.textContent = 'User';
    }

    // Populate role
    if (context.display_role) {
      roleEl.textContent = context.display_role;
    } else if (context.enrollment_role) {
      // Fallback: format enrollment role
      const roleMap = {
        'ta': 'TA',
        'tutor': 'Tutor',
        'team-lead': 'Team Lead',
        'student': 'Student'
      };
      roleEl.textContent = roleMap[context.enrollment_role] || context.enrollment_role;
    } else if (context.primary_role) {
      // Fallback: format primary role
      const roleMap = {
        'admin': 'Admin',
        'instructor': 'Instructor',
        'student': 'Student'
      };
      roleEl.textContent = roleMap[context.primary_role] || context.primary_role;
    } else {
      roleEl.textContent = 'User';
    }
  };

  const renderNav = (navEl, links) => {
    navEl.innerHTML = links
      .map(
        (link) => {
          const iconHtml = link.icon ? `<img src="${link.icon}" alt="${link.text}" class="nav-icon">` : '';
          const hasIconClass = link.icon ? ' has-icon' : '';
          return `<a href="${link.href}" data-match='${JSON.stringify(link.match || [link.href])}' class="${hasIconClass}">${iconHtml}${link.text}</a>`;
        }
      )
      .join("");

    const currentPath = window.location.pathname;
    navEl.querySelectorAll("a").forEach((anchor) => {
      const matchPaths = JSON.parse(anchor.dataset.match || "[]");
      const isActive = matchPaths.some((matchPath) => currentPath.startsWith(matchPath));
      if (isActive) {
        anchor.classList.add("active");
      }
    });
  };

  // Ensure global sidebar elements exist (Main Menu header and colorblind toggle)
  function ensureGlobalSidebarElements() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const sidebarTitle = sidebar.querySelector('.sidebar-title');
    if (!sidebarTitle) return;

    // Ensure colorblind toggle exists
    let colorblindToggle = document.getElementById('colorblindToggle');
    if (!colorblindToggle) {
      const toggleContainer = document.createElement('div');
      toggleContainer.className = 'colorblind-toggle-container';
      
      const label = document.createElement('label');
      label.className = 'colorblind-toggle-label';
      
      colorblindToggle = document.createElement('input');
      colorblindToggle.type = 'checkbox';
      colorblindToggle.id = 'colorblindToggle';
      colorblindToggle.className = 'colorblind-toggle-input';
      
      const slider = document.createElement('span');
      slider.className = 'colorblind-toggle-slider';
      
      const text = document.createElement('span');
      text.className = 'colorblind-toggle-text';
      text.textContent = 'Colorblind Mode';
      
      label.appendChild(colorblindToggle);
      label.appendChild(slider);
      label.appendChild(text);
      toggleContainer.appendChild(label);
      
      // Insert right after the title
      sidebarTitle.parentElement.insertBefore(toggleContainer, sidebarTitle.nextSibling);
    }

    // Ensure Main Menu header exists (before nav)
    const navEl = sidebar.querySelector('nav');
    if (navEl && !sidebar.querySelector('.main-menu-header')) {
      const mainMenuHeader = document.createElement('div');
      mainMenuHeader.className = 'main-menu-header';
      mainMenuHeader.textContent = 'Main Menu';
      
      // Insert before the nav element
      navEl.parentElement.insertBefore(mainMenuHeader, navEl);
    }
  }

  const init = async () => {
    // Ensure global sidebar elements first
    ensureGlobalSidebarElements();
    
    const navEl = document.querySelector(".sidebar nav");
    if (!navEl) return;

    let links = NAV_CONFIG.student;
    let context = null;

    try {
      context = await fetchJson("/api/users/navigation-context");
      links = determineNavLinks(context);
    } catch (error) {
      console.warn("[sidebar-nav] Falling back to student navigation:", error.message);
    }

    // Always try to populate user display, even if context fetch failed
    if (context) {
      populateUserDisplay(context);
    } else {
      // If context fetch failed, try to populate with empty/default values
      const sidebarUserEl = document.getElementById('sidebarUser');
      if (sidebarUserEl) {
        const nameEl = sidebarUserEl.querySelector('.sidebar-user-name');
        const roleEl = sidebarUserEl.querySelector('.sidebar-user-role');
        if (nameEl) nameEl.textContent = 'User';
        if (roleEl) roleEl.textContent = 'Student';
      }
    }

    renderNav(navEl, links);
  };

  // Hamburger menu toggle for mobile
  function initHamburger() {
    const hamburger = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    
    if (!hamburger || !sidebar) {
      return;
    }

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !isExpanded);
      sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.setAttribute('aria-expanded', 'false');
        sidebar.classList.remove('open');
      }
    });
  }

  // Run global sidebar elements setup immediately (doesn't depend on nav)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureGlobalSidebarElements);
  } else {
    ensureGlobalSidebarElements();
  }

  // Initialize navigation
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
      initHamburger();
    });
  } else {
    init();
    initHamburger();
  }
})();

