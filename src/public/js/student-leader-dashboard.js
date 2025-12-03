// Student Leader (Team Lead) Dashboard Page Scripts
/* global openViewAnnouncementModal, openEditAnnouncementModal */

(function() {
  // Wait for DashboardService to be available
  if (typeof window.DashboardService === 'undefined') {
    console.error('DashboardService not loaded. Make sure dashboard.service.js is included before this script.');
    return;
  }

  const { getActiveOfferingId, getOfferingWithStats, updateCourseInfo, updateCourseProgress, updateStickyHeader, updateWelcomeMessage, getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, loadRecentProgress } = window.DashboardService;
  
  let offeringId = null;
  let refreshInterval = null;
  let userTeamId = null;
  let currentUserId = null;

  // Load current user ID from navigation context
  async function loadCurrentUserId() {
    try {
      const contextRes = await fetch('/api/users/navigation-context', { credentials: 'include' });
      if (contextRes.ok) {
        const context = await contextRes.json();
        if (context.id) {
          currentUserId = context.id;
        }
      }
    } catch (error) {
      console.error('Error loading current user ID:', error);
    }
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

    // Get current user ID first before loading anything
    if (!currentUserId) {
      await loadCurrentUserId();
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
      await loadRecentProgress(offeringId, { showCount: 3 });
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
        const creatorName = announcement.creator_name || 'Unknown';
        const teamBadge = announcement.team_name ? `<span class="team-badge">${escapeHtml(announcement.team_name)}</span>` : '';
        
        // Show edit/delete buttons only for team announcements created by the current user
        const canEdit = announcement.team_id && announcement.created_by === currentUserId;
        const editDeleteButtons = canEdit ? `
          <div class="announcement-actions">
            <button class="announcement-edit-btn" data-announcement-id="${announcement.id}" aria-label="Edit announcement">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="announcement-delete-btn" data-announcement-id="${announcement.id}" aria-label="Delete announcement">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        ` : '';
        
        return `
          <div class="announcement-item clickable-announcement" data-announcement-id="${announcement.id}">
            <div class="announcement-date">${escapeHtml(dateStr)}</div>
            <div class="announcement-content">
              <h5>${escapeHtml(title)} ${teamBadge}</h5>
              <p>${escapeHtml(preview)}</p>
              <div class="announcement-creator">by ${escapeHtml(creatorName)}</div>
            </div>
            ${editDeleteButtons}
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
        item.addEventListener('click', (e) => {
          // Don't expand if clicking on edit/delete buttons
          if (e.target.closest('.announcement-actions')) {
            return;
          }
          
          const announcement = item._announcementData;
          if (announcement) {
            openViewAnnouncementModal(announcement);
          }
        });
      });

      // Add event listeners for edit and delete buttons
      announcementsList.querySelectorAll('.announcement-edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const announcementId = btn.dataset.announcementId;
          const announcement = announcements.find(a => a.id === announcementId);
          if (announcement) {
            openEditAnnouncementModal(announcement);
          }
        });
      });

      announcementsList.querySelectorAll('.announcement-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const announcementId = btn.dataset.announcementId;
          if (confirm('Are you sure you want to delete this announcement?')) {
            try {
              await deleteAnnouncement(announcementId);
              await loadAnnouncements();
            } catch (err) {
              console.error('Failed to delete announcement:', err);
              alert('Failed to delete announcement. Please try again.');
            }
          }
        });
      });
    } catch (error) {
      console.error('Error loading announcements:', error);
      announcementsList.innerHTML = '<p class="dashboard-error-state">Error loading announcements</p>';
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

  // Recent progress is now handled by DashboardService.loadRecentProgress()
  // (removed local implementation to use shared function)

  // Initialize dashboard
  async function initDashboard() {
    await loadDashboardStats();
    await loadWelcomeName();
    
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
        
        // Set current user ID for edit/delete permissions
        if (context.id) {
          currentUserId = context.id;
        }
        
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

  // Get team leader's team ID
  async function getUserTeam() {
    if (!offeringId) return null;
    
    try {
      // Use the my-team endpoint to get the current user's team
      const response = await fetch(`/api/teams/my-team?offering_id=${offeringId}`, {
        credentials: 'include'
      });
      
      if (response.status === 404) {
        console.error('User is not assigned to a team');
        alert('You are not assigned to a team yet. Please contact your instructor.');
        return null;
      }
      
      if (!response.ok) {
        console.error('Failed to get user team:', response.status);
        return null;
      }
      
      const data = await response.json();
      const team = data.team || data;
      
      // Check if user has a team
      if (team && team.id) {
        return team.id;
      }
      
      console.error('No team found for user');
      return null;
    } catch (error) {
      console.error('Error getting user team:', error);
      return null;
    }
  }

  // Initialize announcement creation modal
  function initAnnouncementModal() {
    const overlay = document.getElementById('announcementModal');
    const form = document.getElementById('announcement-form');
    const openBtn = document.getElementById('createAnnouncementBtn');
    const closeBtn = document.getElementById('announcementModalClose');
    const cancelBtn = document.getElementById('announcementCancel');
    const submitBtn = document.getElementById('announcementSend');
    const modalTitle = document.getElementById('announcementModalTitle');
    const subjectInput = document.getElementById('announcement-subject');
    const bodyInput = document.getElementById('announcement-body');

    if (!overlay || !form) return;

    const mainContent = document.querySelector('main');
    let previouslyFocused = null;
    let editingAnnouncementId = null;

    function openModal(isEdit = false, announcement = null) {
      editingAnnouncementId = isEdit && announcement ? announcement.id : null;

      // Update modal title
      if (modalTitle) {
        modalTitle.textContent = isEdit ? 'Edit Team Announcement' : 'New Team Announcement';
      }
      
      // Update submit button text
      if (submitBtn) {
        submitBtn.textContent = isEdit ? 'Update' : 'Send';
      }

      // Reset or populate form
      if (isEdit && announcement) {
        if (subjectInput) subjectInput.value = announcement.subject || '';
        if (bodyInput) bodyInput.value = announcement.message || announcement.body || '';
      } else {
        form.reset();
      }

      // save focused element to restore later
      previouslyFocused = document.activeElement;

      // make the modal visible/accessible
      overlay.setAttribute('aria-hidden', 'false');
      try { overlay.inert = false; } catch { /* ignore if not available */ }

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
      try { overlay.inert = true; } catch { /* ignore if not available */ }

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

    if (openBtn) {
      openBtn.addEventListener('click', () => openModal());
    }
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

    // Submit handler: create or update team announcement
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = subjectInput.value.trim();
      const body = bodyInput.value.trim();
      if (!subject || !body) return;

      if (!offeringId) {
        offeringId = await getActiveOfferingId();
      }

      try {
        if (editingAnnouncementId) {
          // Update existing announcement
          await updateAnnouncement(editingAnnouncementId, { subject, message: body });
        } else {
          // Create new team announcement
          if (!userTeamId) {
            userTeamId = await getUserTeam();
          }

          if (!userTeamId) {
            alert('Could not find your team. Please try again.');
            return;
          }

          await createAnnouncement(offeringId, { 
            subject, 
            message: body,
            team_id: userTeamId  // Set team_id for team announcement
          });
        }
        
        closeModal();
        await loadAnnouncements(offeringId);
      } catch (error) {
        console.error('Error saving announcement:', error);
        alert(`Failed to ${editingAnnouncementId ? 'update' : 'create'} announcement. Please try again.`);
      }
    });

    // Expose function to open modal in edit mode
    window.openEditAnnouncementModal = function(announcement) {
      openModal(true, announcement);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initHamburger();
      setActiveNavLink();
      initViewAnnouncementModal();
      initAnnouncementModal();
      initDashboard();
    });
  } else {
    initHamburger();
    setActiveNavLink();
    initViewAnnouncementModal();
    initAnnouncementModal();
    initDashboard();
  }
})();

