// TA Dashboard Page Scripts

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
    getStudents = async () => [],
    updateCourseInfo = () => {},
    updateStats = () => {},
    getAnnouncements = async () => [],
    createAnnouncement = async () => ({}),
    updateAnnouncement = async () => ({}),
    deleteAnnouncement = async () => ({}),
    getAttendanceSessions = async () => [],
    getSessionStatistics = async () => null,
    getDashboardTodos = async () => [],
    updateStickyHeader = async () => {},
    updateWelcomeMessage = async () => {},
  } = DS;
  
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
      
      // Update welcome message with user's name and role
      await updateWelcomeMessage(offeringId);
      
      // Update sticky header with course details, timings, location, and team info
      await updateStickyHeader(offeringId);

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

      // Load attendance statistics for overall course
      await loadAttendanceStatistics();
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Load attendance statistics for TA dashboard
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

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

      // Check if user can manage announcements (instructor or TA)
      let canManageAnnouncements = false;
      try {
        const contextRes = await fetch('/api/users/navigation-context', { credentials: 'include' });
        if (contextRes.ok) {
          const context = await contextRes.json();
          canManageAnnouncements = 
            context.primary_role === 'instructor' || 
            context.enrollment_role === 'instructor' || 
            context.enrollment_role === 'ta';
        }
      } catch (error) {
        console.error('Error checking user permissions:', error);
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
        
        const editDeleteButtons = canManageAnnouncements ? `
          <div class="announcement-actions">
            <button class="announcement-edit-btn" data-announcement-id="${announcement.id}" aria-label="Edit announcement">✏️</button>
            <button class="announcement-delete-btn" data-announcement-id="${announcement.id}" aria-label="Delete announcement">🗑️</button>
          </div>
        ` : '';
        
        return `
          <div class="announcement-item clickable-announcement" data-announcement-id="${announcement.id}">
            <div class="announcement-date">${escapeHtml(dateStr)}</div>
            <div class="announcement-content">
              <h5>${escapeHtml(title)}</h5>
              <p>${escapeHtml(preview)}</p>
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

      // Add click listener to announcement items to expand (except when clicking edit/delete buttons)
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
      if (canManageAnnouncements) {
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
              } catch (error) {
                console.error('Error deleting announcement:', error);
                alert('Failed to delete announcement. Please try again.');
              }
            }
          });
        });
      }
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
            if (DS.updateDashboardTodo) {
              await DS.updateDashboardTodo(todoId, { completed: !isCompleted });
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
    await loadInteractionFormData();
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

  // Announcement modal handling
  let editingAnnouncementId = null;
  
  function initAnnouncementModal() {
    const openBtn = document.getElementById('createAnnouncementBtn');
    const overlay = document.getElementById('announcementModal');
    const closeBtn = document.getElementById('announcementModalClose');
    const cancelBtn = document.getElementById('announcementCancel');
    const form = document.getElementById('announcement-form');
    const subjectInput = document.getElementById('announcement-subject');
    const bodyInput = document.getElementById('announcement-body');
    const modalTitle = document.getElementById('announcementModalTitle');
    const submitBtn = document.getElementById('announcementSend');
    if (!overlay || !form) return;

    let previouslyFocused = null;
    const mainContent = document.querySelector('main');

    function openModal(isEdit = false, announcement = null) {
      editingAnnouncementId = isEdit && announcement ? announcement.id : null;
      
      // Update modal title
      if (modalTitle) {
        modalTitle.textContent = isEdit ? 'Edit Announcement' : 'New Announcement';
      }
      
      // Update submit button text
      if (submitBtn) {
        submitBtn.textContent = isEdit ? 'Update' : 'Send';
      }

      // Populate form if editing
      if (isEdit && announcement) {
        if (subjectInput) {
          subjectInput.value = announcement.subject || announcement.title || '';
        }
        if (bodyInput) {
          bodyInput.value = announcement.message || announcement.body || announcement.content || '';
        }
      } else {
        // Reset form for new announcement
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
      editingAnnouncementId = null;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      } else if (openBtn) {
        openBtn.focus();
      }
    }

    // Open edit modal function (exposed for use by edit buttons)
    window.openEditAnnouncementModal = function(announcement) {
      openModal(true, announcement);
    };

    if (openBtn) {
      openBtn.addEventListener('click', () => openModal(false));
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

    // Submit handler: create or update announcement and reload list
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = subjectInput.value.trim();
      const body = bodyInput.value.trim();
      if (!subject || !body) return;

      if (!offeringId) {
        offeringId = await getActiveOfferingId();
        if (!offeringId) {
          alert('Error: No active offering found');
          return;
        }
      }

      try {
        if (editingAnnouncementId) {
          // Update existing announcement
          await updateAnnouncement(editingAnnouncementId, { subject, message: body });
        } else {
          // Create new announcement
          await createAnnouncement(offeringId, { subject, message: body });
        }
        
        // Reload announcements list
        await loadAnnouncements();
        
        closeModal();
      } catch (err) {
        console.error('Failed to save announcement:', err);
        alert(`Failed to ${editingAnnouncementId ? 'update' : 'create'} announcement. Please try again.`);
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
      // Helper function to escape HTML
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
      
      const dateEl = document.getElementById('viewAnnouncementDate');
      const subjectEl = document.getElementById('viewAnnouncementSubject');
      const messageEl = document.getElementById('viewAnnouncementMessage');
      
      if (dateEl) dateEl.textContent = dateStr;
      if (subjectEl) subjectEl.textContent = title;
      if (messageEl) {
        // Preserve line breaks in the message
        messageEl.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
      }
      
      overlay.setAttribute('aria-hidden', 'false');
      try { overlay.inert = false; } catch { /* ignore if not available */ }
      document.body.style.overflow = 'hidden';
      
      // Focus on close button for accessibility
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
      initInteractionForm();
      initAnnouncementModal();
      initViewAnnouncementModal();
      initDashboard();
    });
  } else {
    initHamburger();
    initInteractionForm();
    initAnnouncementModal();
    initViewAnnouncementModal();
    initDashboard();
  }
})();

