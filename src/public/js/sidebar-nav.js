/**
 * Sidebar navigation: builds role-aware links so every page mirrors the dashboard nav.
 * Fetches the user's context (primary role, enrollment role, team lead flag) and renders links accordingly.
 */

(function () {
  const NAV_CONFIG = {
    admin: [
      { href: "/admin-dashboard", text: "Admin Dashboard" },
      { href: "/instructor-dashboard", text: "Instructor View" },
      { href: "/course-settings", text: "Course Settings" },
      {
        href: "/instructor-lectures",
        text: "Attendance",
        match: ["/instructor-lectures", "/lecture-builder", "/lecture-responses"]
      },
      { href: "/roster", text: "Roster" }
    ],
    instructor: [
      { href: "/instructor-dashboard", text: "Dashboard" },
      { href: "/course-settings", text: "Course Settings" },
      {
        href: "/instructor-lectures",
        text: "Attendance",
        match: ["/instructor-lectures", "/lecture-builder", "/lecture-responses"]
      },
      { href: "/roster", text: "Roster" },
      { href: "/instructor-meetings", text: "Team Meetings" }
    ],
    ta: [
      { href: "/ta-dashboard", text: "Dashboard" },
      {
        href: "/instructor-lectures",
        text: "Attendance",
        match: ["/instructor-lectures", "/lecture-builder", "/lecture-responses"]
      },
      { href: "/roster", text: "Roster" },
      { href: "/class-directory", text: "Class Directory" }
    ],
    teamLead: [
      { href: "/team-lead-dashboard", text: "Dashboard" },
      {
        href: "/lecture-attendance-student",
        text: "Lectures",
        match: ["/lecture-attendance-student", "/student-lecture-response"]
      },
      { href: "/meetings/team-lead", text: "Team Meetings" },
      { href: "/roster", text: "Roster" },
      {
        href: "/work-journal",
        text: "Work Journal",
        match: ["/work-journal", "/lead-journal"]
      },
      { href: "/my-team", text: "My Team" }
    ],
    student: [
      { href: "/student-dashboard", text: "Dashboard" },
      {
        href: "/lecture-attendance-student",
        text: "Lectures",
        match: ["/lecture-attendance-student", "/student-lecture-response"]
      },
      { href: "/meetings", text: "Meetings" },
      { href: "/roster", text: "Roster" },
      {
        href: "/work-journal",
        text: "Work Journal",
        match: ["/work-journal", "/student-work-journal", "/lead-journal"]
      },
      { href: "/my-team", text: "My Team" }
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
    if (enrollment_role === "ta" || enrollment_role === "tutor") return NAV_CONFIG.ta;
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
        (link) =>
          `<a href="${link.href}" data-match='${JSON.stringify(link.match || [link.href])}'>${link.text}</a>`
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

  const init = async () => {
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

    // Debug: Log context to help troubleshoot
    if (context) {
      console.log('[sidebar-nav] Context received:', context);
    }

    renderNav(navEl, links);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

