const state = {
  offeringId: null,
  offerings: [],
  roster: [],
  stats: {
    total: 0,
    roles: { student: 0, ta: 0, tutor: 0 },
    statuses: { enrolled: 0, waitlisted: 0, dropped: 0, completed: 0 },
  },
  pagination: { limit: 10, page: 1, totalPages: 1, total: 0 },
  filters: { course_role: null, status: null, team: null, search: '', sort: 'name' },
  teams: [], // Available teams for filtering
  lastImport: null,
  roleEditing: null,
  canEdit: false, // Whether user can edit roster (instructor/admin only)
  canSelect: false, // Whether user can select/email/drop (admin/instructor/TA only)
  selectedItems: new Set(), // Track selected enrollment IDs
};

// Elements will be initialized when DOM is ready
let elements = {};

const initializeElements = () => {
  elements = {
    activeOfferingName: document.getElementById('activeOfferingName'),
  rosterTableBody: document.getElementById('rosterTableBody'),
  emptyState: document.getElementById('emptyState'),
  statTotal: document.getElementById('statTotal'),
  statTotalMeta: document.getElementById('statTotalMeta'),
  statStudents: document.getElementById('statStudents'),
  statStudentsMeta: document.getElementById('statStudentsMeta'),
  statTAs: document.getElementById('statTAs'),
  statTAsMeta: document.getElementById('statTAsMeta'),
  statTutors: document.getElementById('statTutors'),
  statTutorsMeta: document.getElementById('statTutorsMeta'),
  searchInput: document.getElementById('search-input'),
  sortSelect: document.getElementById('sortSelect'),
  roleFilters: document.querySelectorAll('[data-role-filter]'),
  statusFilters: document.querySelectorAll('[data-status-filter]'),
  teamFilterWrapper: document.getElementById('teamFilterWrapper'),
  teamFilterSelect: document.getElementById('teamFilterSelect'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageNumber: document.getElementById('pageNumber'),
  totalPages: document.getElementById('totalPages'),
  showingStart: document.getElementById('showingStart'),
  showingEnd: document.getElementById('showingEnd'),
  showingTotal: document.getElementById('showingTotal'),
  pageSize: document.getElementById('pageSize'),
  clearFilters: document.getElementById('clearFilters'),
  selectAll: document.getElementById('select-all'),
  bulkActions: document.getElementById('bulkActions'),
  selectedCount: document.getElementById('selectedCount'),
  bulkEmailBtn: document.getElementById('bulkEmailBtn'),
  bulkDropBtn: document.getElementById('bulkDropBtn'),
  toastContainer: document.getElementById('toastContainer'),
  addPersonOverlay: document.getElementById('addPersonOverlay'),
  addPersonForm: document.getElementById('addPersonForm'),
  importOverlay: document.getElementById('importOverlay'),
  csvInput: document.getElementById('csvInput'),
  jsonInput: document.getElementById('jsonInput'),
  roleOverlay: document.getElementById('roleOverlay'),
  roleForm: document.getElementById('roleForm'),
  roleSelect: document.getElementById('roleSelect'),
  roleStudentName: document.getElementById('roleStudentName'),
    exportFormat: document.getElementById('exportFormat'),
  btnAddPerson: document.getElementById('btnAddPerson'),
  btnImportModal: document.getElementById('btnImportModal'),
  btnExport: document.getElementById('btnExport'),
  rosterActions: document.querySelector('.roster-actions'),
  };
};

const showToast = (message, type = 'success', timeout = 4000) => {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), timeout);
};

const toggleOverlay = (overlay, open) => {
  if (!overlay) return;
  overlay.dataset.open = open ? 'true' : 'false';
};

const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    // For 404, return null instead of throwing (for active offering which might not exist)
    if (res.status === 404 && url.includes('/offerings/active')) {
      return null;
    }
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.message || body?.error || '';
    } catch {
      detail = res.statusText;
    }
    throw new Error(detail || 'Request failed');
  }
  return res.json();
};

const debounce = (fn, wait = 250) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

const estimateInstitution = (email) => {
  if (!email) return 'ucsd';
  return email.toLowerCase().endsWith('@ucsd.edu') ? 'ucsd' : 'extension';
};

const loadOfferings = async () => {
  try {
    // Ensure element exists
    if (!elements.activeOfferingName) {
      console.error('activeOfferingName element not found');
      return;
    }
    
    elements.activeOfferingName.textContent = 'Loading...';
    
    // Fetch active offering and all offerings
    let active = null;
    let offerings = [];
    
    try {
      active = await fetchJSON('/api/offerings/active');
      console.log('Active offering API response:', active);
    } catch (_err) {
      console.log('Active offering fetch failed (non-404):', _err);
      // Continue - we'll try to find active from the list
    }
    
    try {
      offerings = await fetchJSON('/api/offerings?limit=25') || [];
      console.log('Offerings list API response:', offerings);
    } catch (_err) {
      console.error('Offerings fetch failed:', _err);
      offerings = [];
    }
    
    // Find the active offering - prioritize API response, then search in list
    let activeOffering = active;
    
    // If no active offering from API, try to find one in the list
    if (!activeOffering && offerings && offerings.length > 0) {
      // Look for an active offering in the list (check is_active flag)
      activeOffering = offerings.find(o => o.is_active === true);
      
      // If still not found, use the first offering as fallback
      if (!activeOffering) {
        activeOffering = offerings[0];
        console.log('No active offering found, using first offering as fallback');
      }
    }
    
    // If we still don't have an offering, show error
    if (!activeOffering) {
      elements.activeOfferingName.textContent = 'No offerings available';
      showToast('No offerings available', 'error');
      return;
    }
    
    state.offerings = offerings || [];
    
    // Validate and set offering ID
    if (!activeOffering.id) {
      console.error('Active offering has no ID:', activeOffering);
      elements.activeOfferingName.textContent = 'Invalid offering data';
      return;
    }
    
    if (!isValidUUID(activeOffering.id)) {
      console.error('Invalid UUID format:', activeOffering.id);
      elements.activeOfferingName.textContent = 'Invalid offering ID';
      return;
    }
    
    // Set the offering ID
    state.offeringId = activeOffering.id;
    
    // Build display text - the database has: name, code, term, year
    const displayName = activeOffering.name || activeOffering.code || 'Software Engineering';
    const term = activeOffering.term || '';
    const year = activeOffering.year || '';
    
    // Format: "Software Engineering · Fall 2025" or "Software Engineering" if no term/year
    let displayText = displayName;
    if (term && year) {
      displayText = `${displayName} · ${term} ${year}`;
    } else if (term) {
      displayText = `${displayName} · ${term}`;
    } else if (year) {
      displayText = `${displayName} · ${year}`;
    }
    
    // Update the display
    elements.activeOfferingName.textContent = displayText;
    console.log('✅ Set active offering display to:', displayText);
    console.log('✅ Active offering ID:', state.offeringId);
    
  } catch (error) {
    console.error('Failed to load offerings:', error);
    if (elements.activeOfferingName) {
      elements.activeOfferingName.textContent = 'Error loading offering';
    }
    showToast('Unable to load offerings: ' + error.message, 'error');
  }
};

// Helper function to validate UUID format
// UUID validation - use shared utility if available, otherwise define locally
const isValidUUID = window.isValidUUID || ((str) => {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
});

const loadRoster = async () => {
  if (!state.offeringId) {
    console.error('No offeringId set, cannot load roster');
    return;
  }
  
  // Validate UUID before making API call
  if (!isValidUUID(state.offeringId)) {
    console.error('Invalid offeringId format (expected UUID):', state.offeringId);
    showToast('Invalid offering ID. Please refresh the page.', 'error');
    return;
  }
  
  // Fetch all results (with high limit) to enable proper client-side pagination after filtering
  const params = new URLSearchParams({
    limit: 10000, // Fetch all results for client-side pagination
    offset: 0,
  });
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.course_role) params.set('course_role', state.filters.course_role);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.sort) params.set('sort', state.filters.sort);
  
  // Note: Team filtering and pagination are done client-side after fetching

  try {
    // Show skeleton loader
    showSkeletonLoader();
    const data = await fetchJSON(`/api/enrollments/offering/${state.offeringId}/roster?${params.toString()}`);
    let allRoster = data.results || [];
    
    // Extract unique teams for filtering
    const teamsMap = new Map();
    allRoster.forEach(entry => {
      if (entry.user?.team_name && entry.user?.team_number) {
        const key = `${entry.user.team_number}:${entry.user.team_name}`;
        if (!teamsMap.has(key)) {
          teamsMap.set(key, {
            number: entry.user.team_number,
            name: entry.user.team_name,
            key: key
          });
        }
      }
    });
    // Sort teams by number
    state.teams = Array.from(teamsMap.values()).sort((a, b) => a.number - b.number);
    
    // Update team filter controls
    updateTeamFilterControls();
    
    // If filtering by team-lead role, exclude TAs and tutors (they cannot be team leads)
    if (state.filters.course_role === 'team-lead') {
      allRoster = allRoster.filter(entry => {
        // TAs and tutors cannot be team leads
        if (entry.course_role === 'ta' || entry.course_role === 'tutor') {
          return false;
        }
        // Only show entries with team-lead role or is_team_lead flag
        return entry.course_role === 'team-lead' || entry.user?.is_team_lead === true;
      });
    }
    
    // Apply team filter client-side
    if (state.filters.team === 'team-leads') {
      // Filter by team leads - check both is_team_lead flag and enrollment role
      // Exclude TAs and tutors from team leads filter
      allRoster = allRoster.filter(entry => {
        // TAs and tutors cannot be team leads
        if (entry.course_role === 'ta' || entry.course_role === 'tutor') {
          return false;
        }
        const isTeamLeadByFlag = entry.user?.is_team_lead === true;
        const isTeamLeadByRole = entry.course_role === 'team-lead';
        return isTeamLeadByFlag || isTeamLeadByRole;
      });
    } else if (state.filters.team && state.filters.team !== 'all') {
      // Filter by specific team (format: "number:name")
      const [teamNum, teamName] = state.filters.team.split(':');
      allRoster = allRoster.filter(entry => 
        entry.user?.team_number == teamNum && entry.user?.team_name === teamName
      );
    }
    
    // Calculate pagination based on filtered results
    state.pagination.total = allRoster.length;
    state.pagination.totalPages = Math.max(1, Math.ceil(allRoster.length / state.pagination.limit));
    state.pagination.page = Math.min(state.pagination.totalPages, state.pagination.page);
    
    // Apply pagination - slice the filtered results for current page
    const startIndex = (state.pagination.page - 1) * state.pagination.limit;
    const endIndex = startIndex + state.pagination.limit;
    state.roster = allRoster.slice(startIndex, endIndex);
    state.stats = data.stats || state.stats;
    state.instructor = data.instructor || null;

    // Clear selections when roster changes
    state.selectedItems.clear();
    
    renderRoster();
    renderStats();
    renderInstructor();
    renderPagination();
    updateFilterCount();
    
    // Only scroll to top when page changes or filters change, not on initial load
    if (state.pagination.page > 1 || state.filters.search || state.filters.course_role || state.filters.status || state.filters.team) {
      scrollToTop();
    }
  } catch (error) {
    console.error('Failed to load roster', error);
    const colspan = state.canSelect ? '7' : '6';
    elements.rosterTableBody.innerHTML = `<tr><td colspan="${colspan}" style="padding: 2rem; text-align:center; color: var(--rose-500);">Unable to load roster.</td></tr>`;
    showToast(error.message || 'Failed to load roster', 'error');
    updateFilterCount();
  }
};

const renderStats = () => {
  if (!elements.statTotal) return;
  
  // Display stats - just the numbers, no meta text
  elements.statTotal.textContent = state.stats.total ?? 0;
  elements.statTotalMeta.textContent = '';
  elements.statStudents.textContent = state.stats.roles?.student ?? 0;
  elements.statStudentsMeta.textContent = '';
  elements.statTAs.textContent = state.stats.roles?.ta ?? 0;
  elements.statTAsMeta.textContent = '';
  elements.statTutors.textContent = state.stats.roles?.tutor ?? 0;
  elements.statTutorsMeta.textContent = '';
};

const renderInstructor = () => {
  const instructorDisplay = document.getElementById('instructorDisplay');
  if (!instructorDisplay) return;
  
  if (state.instructor?.name) {
    instructorDisplay.textContent = `Instructor: ${state.instructor.name}`;
    instructorDisplay.style.display = 'inline';
  } else {
    instructorDisplay.textContent = '';
    instructorDisplay.style.display = 'none';
  }
};

const showSkeletonLoader = () => {
  // Show checkbox column in skeleton only if user can select (matches actual roster rows)
  const checkboxCol = state.canSelect ? '<td class="checkbox-cell"><div class="skeleton skeleton-cell" style="width: 24px;"></div></td>' : '';
  const skeletonRows = new Array(5).fill(0).map(() => `
    <tr>
      ${checkboxCol}
      <td><div class="skeleton skeleton-avatar"></div></td>
      <td><div class="skeleton skeleton-cell" style="width: 200px;"></div></td>
      <td><div class="skeleton skeleton-pill" style="width: 100px;"></div></td>
      <td><div class="skeleton skeleton-cell" style="width: 120px;"></div></td>
      <td><div class="skeleton skeleton-cell" style="width: 150px;"></div></td>
      <td><div class="skeleton skeleton-cell" style="width: 100px;"></div></td>
    </tr>
  `).join('');
  elements.rosterTableBody.innerHTML = skeletonRows;
};

const updateFilterCount = () => {
  let hasFilters = false;
  if (state.filters.search) hasFilters = true;
  if (state.filters.course_role) hasFilters = true;
  if (state.filters.status) hasFilters = true;
  if (state.filters.team) hasFilters = true;
  
  if (hasFilters && elements.clearFilters) {
    elements.clearFilters.style.display = 'inline-block';
  } else if (elements.clearFilters) {
    elements.clearFilters.style.display = 'none';
  }
};

const clearAllFilters = () => {
  state.filters.search = '';
  state.filters.course_role = null;
  state.filters.status = null;
  state.filters.team = null;
  state.pagination.page = 1;
  
  // Reset UI
  if (elements.searchInput) elements.searchInput.value = '';
  elements.roleFilters.forEach(btn => {
    btn.dataset.active = btn.dataset.roleFilter === 'all' ? 'true' : 'false';
  });
  elements.statusFilters.forEach(btn => {
    btn.dataset.active = btn.dataset.statusFilter === 'all' ? 'true' : 'false';
  });
  if (elements.teamFilterSelect) elements.teamFilterSelect.value = 'all';
  
  updateFilterCount();
  loadRoster();
};

const renderPagination = () => {
  elements.pageNumber.textContent = state.pagination.page;
  elements.totalPages.textContent = state.pagination.totalPages;
  elements.prevPage.disabled = state.pagination.page <= 1;
  elements.nextPage.disabled = state.pagination.page >= state.pagination.totalPages;
  
  // Update showing info
  const start = state.pagination.total === 0 ? 0 : (state.pagination.page - 1) * state.pagination.limit + 1;
  const end = Math.min(state.pagination.page * state.pagination.limit, state.pagination.total);
  if (elements.showingStart) elements.showingStart.textContent = start;
  if (elements.showingEnd) elements.showingEnd.textContent = end;
  if (elements.showingTotal) elements.showingTotal.textContent = state.pagination.total;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const scrollToTop = () => {
  // Scroll page to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const updateBulkActions = () => {
  const count = state.selectedItems.size;
  if (elements.selectedCount) {
    elements.selectedCount.textContent = count;
  }
  if (elements.bulkActions) {
    elements.bulkActions.style.display = (count > 0 && state.canSelect) ? 'flex' : 'none';
  }
  if (elements.selectAll && state.roster.length > 0 && state.canSelect) {
    const selectableEntries = state.roster.filter(entry => 
      entry.enrollment_status !== 'dropped' || state.canEdit
    );
    const selectedSelectable = selectableEntries.filter(entry => 
      state.selectedItems.has(entry.enrollment_id)
    );
    const allSelected = selectableEntries.length > 0 && 
      selectedSelectable.length === selectableEntries.length;
    const someSelected = selectedSelectable.length > 0 && !allSelected;
    elements.selectAll.checked = allSelected;
    elements.selectAll.indeterminate = someSelected;
  } else if (elements.selectAll) {
    elements.selectAll.checked = false;
    elements.selectAll.indeterminate = false;
  }
};

const handleSelectAll = (checked) => {
  if (checked) {
    // Select all non-dropped entries (or all if can edit)
    state.roster.forEach(entry => {
      if (entry.enrollment_status !== 'dropped' || state.canEdit) {
        state.selectedItems.add(entry.enrollment_id);
      }
    });
  } else {
    // Deselect all
    state.selectedItems.clear();
  }
  
  // Update checkboxes and row visual states without full re-render
  document.querySelectorAll('.row-checkbox').forEach(checkbox => {
    const enrollmentId = checkbox.dataset.enrollmentId;
    const isSelected = state.selectedItems.has(enrollmentId);
    checkbox.checked = isSelected;
    const row = checkbox.closest('tr');
    if (row) {
      if (isSelected) {
        row.classList.add('row-selected');
      } else {
        row.classList.remove('row-selected');
      }
    }
  });
  
  updateBulkActions();
};

const handleRowSelect = (enrollmentId, checked) => {
  if (checked) {
    state.selectedItems.add(enrollmentId);
  } else {
    state.selectedItems.delete(enrollmentId);
  }
  
  // Update row visual state
  const row = document.querySelector(`tr[data-enrollment-id="${enrollmentId}"]`);
  if (row) {
    if (checked) {
      row.classList.add('row-selected');
    } else {
      row.classList.remove('row-selected');
    }
  }
  
  updateBulkActions();
};

const renderRoster = () => {
  if (!state.roster.length) {
    elements.rosterTableBody.innerHTML = '';
    elements.emptyState.hidden = false;
    updateBulkActions();
    return;
  }

  elements.emptyState.hidden = true;
  elements.rosterTableBody.innerHTML = state.roster.map((entry) => {
    const initials = (entry.user?.name || entry.user?.email || '?')
      .split(' ')
      .map((token) => token[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const role = entry.course_role || 'student';
    const status = entry.enrollment_status || 'enrolled';
    const institution = entry.user?.institution_type === 'extension' ? 'Extension' : 'UCSD';
    const teamName = entry.user?.team_name || null;
    const teamNumber = entry.user?.team_number || null;
    const teamLead = entry.user?.team_lead_name || null;
    const isTeamLead = entry.user?.is_team_lead || false;
    
    // Format team display with badge
    let teamDisplay = '<span class="team-empty">No team</span>';
    if (teamName && teamNumber) {
      teamDisplay = `<span class="team-badge">Team ${teamNumber}: ${teamName}</span>`;
    } else if (teamName) {
      teamDisplay = `<span class="team-badge">${teamName}</span>`;
    } else if (teamNumber) {
      teamDisplay = `<span class="team-badge">Team ${teamNumber}</span>`;
    }
    
    // Format role display - show role with team lead indicator if applicable
    let roleClass = role;
    let roleDisplay;
    if (role === 'team-lead' || (isTeamLead && role === 'student')) {
      roleDisplay = 'Team Lead';
      roleClass = 'team-lead';
    } else if (role === 'ta') {
      roleDisplay = 'TA';
    } else {
      // Capitalize first letter for other roles (student, tutor)
      roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
    }
    
    // Show edit role button only if user can edit (Drop button is in actions column)
    const editRoleButton = state.canEdit ? `
      <button class="role-btn text-btn" data-action="edit-role" data-user-id="${entry.user_id}" data-name="${entry.user?.name || entry.user?.email || 'Unknown'}" data-role="${role}">
        Change role
      </button>
    ` : '';
    
    const isSelected = state.selectedItems.has(entry.enrollment_id);
    const canSelect = state.canSelect && (status !== 'dropped' || state.canEdit); // Can select only if user has permission AND (not dropped or can edit)
    
    return `
      <tr data-enrollment-id="${entry.enrollment_id}" ${isSelected ? 'class="row-selected"' : ''}>
        ${canSelect ? (() => {
          const checkedAttr = isSelected ? 'checked' : '';
          const userName = entry.user?.name || 'Unknown';
          const userEmail = entry.user?.email || '';
          return `<td class="checkbox-cell">
          <input type="checkbox" class="row-checkbox" data-enrollment-id="${entry.enrollment_id}" data-user-id="${entry.user_id}" data-email="${userEmail}" data-name="${userName}" ${checkedAttr} aria-label="Select ${userName}">
        </td>`;
        })() : ''}
        <td>
          <div class="name-cell">
            <div class="avatar" aria-hidden="true">${initials}</div>
            <div class="name-info">
              <div class="person-name">${entry.user?.name || 'Unknown'}</div>
              ${entry.user?.email ? `<div class="person-email"><a href="mailto:${entry.user.email}" class="clickable-link">${entry.user.email}</a></div>` : '<div class="person-email"></div>'}
            </div>
          </div>
        </td>
        <td>
          <div class="role-chip">
            <span class="role-pill ${roleClass}">${roleDisplay}</span>
            ${editRoleButton}
          </div>
        </td>
        <td>
          <div class="status-cell">
            <span class="status-pill ${status}">${status}</span>
            <div class="status-meta">Since ${formatDate(entry.enrolled_at)}</div>
          </div>
        </td>
        <td>
          <div class="institution-cell">
            <div class="institution-name">${institution}</div>
            <div class="institution-meta">${entry.user?.ucsd_pid || 'PID —'}</div>
          </div>
        </td>
        <td>
          <div class="team-cell">
            ${entry.user?.team_name ? (() => {
              const leadMeta = entry.user?.team_lead_name && !isTeamLead ? `<div class="team-lead-meta">Lead: ${teamLead}</div>` : '';
              return `
              <div class="team-name">${teamDisplay}</div>
              ${leadMeta}
            `;
            })() : teamDisplay}
          </div>
        </td>
        <td class="actions-cell">
          ${state.canSelect ? `<button class="icon-btn" title="Email ${entry.user?.name}" data-action="email" data-email="${entry.user?.email || ''}" aria-label="Email ${entry.user?.name}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </button>` : ''}
          ${state.canSelect && status !== 'dropped' ? `<button class="btn btn-danger btn-icon" title="Mark as dropped" data-action="drop" data-id="${entry.enrollment_id}" data-user-id="${entry.user_id}" aria-label="Mark ${entry.user?.name} as dropped">Drop</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
  
  updateBulkActions();
};

const handleBulkDrop = async () => {
  const selected = Array.from(state.selectedItems);
  if (selected.length === 0) return;
  
  const confirmMessage = `Mark ${selected.length} person${selected.length > 1 ? 's' : ''} as dropped? They will no longer be able to access the course.`;
  if (!confirm(confirmMessage)) return;
  
  const entries = state.roster.filter(entry => selected.includes(entry.enrollment_id));
  let successCount = 0;
  let failCount = 0;
  
  for (const entry of entries) {
    try {
      if (!isValidUUID(state.offeringId) || !isValidUUID(entry.user_id)) {
        failCount++;
        continue;
      }
      await fetchJSON(`/api/enrollments/offering/${state.offeringId}/user/${entry.user_id}/drop`, { 
        method: 'POST' 
      });
      successCount++;
    } catch (error) {
      console.error('Failed to drop person', entry.user?.name, error);
      failCount++;
    }
  }
  
  // Clear selections
  state.selectedItems.clear();
  updateBulkActions();
  
  if (successCount > 0) {
    showToast(`Marked ${successCount} person${successCount > 1 ? 's' : ''} as dropped${failCount > 0 ? `, ${failCount} failed` : ''}`);
    loadRoster();
  } else {
    showToast('Failed to drop selected people', 'error');
  }
};

const handleBulkEmail = () => {
  const selected = Array.from(state.selectedItems);
  if (selected.length === 0) return;
  
  const entries = state.roster.filter(entry => selected.includes(entry.enrollment_id));
  const emails = entries
    .map(entry => entry.user?.email)
    .filter(Boolean)
    .join(',');
  
  if (emails) {
    window.location.href = `mailto:${emails}`;
  } else {
    showToast('No valid email addresses found for selected people', 'error');
  }
};

const handleActionClick = async (event) => {
  // Handle checkbox clicks
  if (event.target.type === 'checkbox' && event.target.classList.contains('row-checkbox')) {
    const enrollmentId = event.target.dataset.enrollmentId;
    handleRowSelect(enrollmentId, event.target.checked);
    return;
  }
  
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'email') {
    const email = button.dataset.email;
    if (email) window.location.href = `mailto:${email}`;
  }
  if (action === 'drop') {
    const enrollmentId = button.dataset.id;
    const userId = button.dataset.userId;
    if (!enrollmentId || !userId) return;
    
    // Find the enrollment entry to get user name
    const entry = state.roster.find(e => e.enrollment_id === enrollmentId);
    const userName = entry?.user?.name || 'this person';
    
    const confirmDrop = confirm(`Mark ${userName} as dropped? They will no longer be able to access the course, but will remain visible in the roster.`);
    if (!confirmDrop) return;
    
    try {
      // Validate UUIDs before making API call
      if (!isValidUUID(state.offeringId)) {
        console.error('Invalid offeringId format (expected UUID):', state.offeringId);
        showToast('Invalid offering ID. Please refresh the page.', 'error');
        return;
      }
      if (!isValidUUID(userId)) {
        console.error('Invalid userId format (expected UUID):', userId);
        showToast('Invalid user ID', 'error');
        return;
      }
      
      // Use the drop endpoint which sets status to 'dropped' instead of deleting
      await fetchJSON(`/api/enrollments/offering/${state.offeringId}/user/${userId}/drop`, { 
        method: 'POST' 
      });
      showToast(`${userName} has been marked as dropped`);
      loadRoster();
    } catch (error) {
      console.error('Failed to drop person', error);
      showToast(error.message || 'Unable to drop person', 'error');
    }
  }
  if (action === 'edit-role') {
    const userId = button.dataset.userId;
    if (!userId) return;
    state.roleEditing = {
      userId,
      name: button.dataset.name || 'Unknown',
      courseRole: button.dataset.role || 'student',
    };
    elements.roleStudentName.value = state.roleEditing.name;
    elements.roleSelect.value = state.roleEditing.courseRole;
    toggleOverlay(elements.roleOverlay, true);
  }
};

const handleSaveRole = async (event) => {
  event.preventDefault();
  
  if (!state.roleEditing || !state.roleEditing.userId || !state.offeringId) {
    showToast('Invalid role update data', 'error');
    return;
  }
  
  // Validate UUID before making API call
  if (!isValidUUID(state.offeringId)) {
    console.error('Invalid offeringId format (expected UUID):', state.offeringId);
    showToast('Invalid offering ID. Please refresh the page.', 'error');
    return;
  }
  
  if (!isValidUUID(state.roleEditing.userId)) {
    console.error('Invalid userId format (expected UUID):', state.roleEditing.userId);
    showToast('Invalid user ID', 'error');
    return;
  }
  
  const formData = new FormData(elements.roleForm);
  const newRole = formData.get('course_role');
  
  if (!newRole || !['student', 'ta', 'tutor', 'team-lead'].includes(newRole)) {
    showToast('Invalid role selected', 'error');
    return;
  }
  
  // Don't update if role hasn't changed
  if (newRole === state.roleEditing.courseRole) {
    showToast('Role unchanged');
    toggleOverlay(elements.roleOverlay, false);
    return;
  }
  
  try {
    await fetchJSON(`/api/enrollments/offering/${state.offeringId}/user/${state.roleEditing.userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ course_role: newRole }),
    });
    
    showToast('Role updated successfully');
    toggleOverlay(elements.roleOverlay, false);
    loadRoster(); // Refresh the roster to show updated role
  } catch (error) {
    console.error('Failed to update role', error);
    showToast(error.message || 'Unable to update role', 'error');
  }
};

const handleAddPerson = async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.addPersonForm);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email')?.toLowerCase(),
    primary_role: 'student', // Always student for roster additions
    status: 'active',
    institution_type: formData.get('institution_type') || estimateInstitution(formData.get('email')),
  };
  const courseRole = formData.get('course_role') || 'student';

  if (!payload.name || !payload.email) {
    showToast('Name and email required', 'error');
    return;
  }

  if (!state.offeringId) {
    showToast('Please select an offering first', 'error');
    return;
  }

  // Validate UUID before making API call
  if (!isValidUUID(state.offeringId)) {
    console.error('Invalid offeringId format (expected UUID):', state.offeringId);
    showToast('Invalid offering ID. Please refresh the page.', 'error');
    return;
  }

  try {
    const result = await fetchJSON('/api/users/roster/import/json', {
      method: 'POST',
      body: JSON.stringify([payload]),
    });

    if (!result.imported?.length) {
      const errorMessage = result.failed?.[0]?.error || 'Import failed';
      throw new Error(errorMessage);
    }

    const newUser = result.imported[0];

    // Enroll the user with the selected course role
    try {
      await fetchJSON('/api/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          offering_id: state.offeringId,
          user_id: newUser.id,
          course_role: courseRole, // Use selected course role
          status: 'enrolled',
        }),
      });
    // eslint-disable-next-line no-unused-vars
    } catch (_err) {
      // Enrollment might already exist
      console.log('Enrollment may already exist for user:', newUser.id);
    }

    showToast('Student added to roster');
    toggleOverlay(elements.addPersonOverlay, false);
    elements.addPersonForm.reset();
    loadRoster();
  } catch (error) {
    console.error('Add person failed', error);
    showToast(error.message || 'Unable to add student', 'error');
  }
};

const handleImport = async () => {
  if (!state.offeringId) {
    showToast('Please select an offering first', 'error');
    return;
  }
  
  // Validate UUID before making API call
  if (!isValidUUID(state.offeringId)) {
    console.error('Invalid offeringId format (expected UUID):', state.offeringId);
    showToast('Invalid offering ID. Please refresh the page.', 'error');
    return;
  }
  
  const activeTab = document.querySelector('[data-import-tab][data-active="true"]')?.dataset.importTab || 'csv';
  try {
    if (activeTab === 'csv') {
      if (!elements.csvInput.files.length) {
        showToast('Select a CSV file first', 'error');
        return;
      }
      const formData = new FormData();
      formData.append('file', elements.csvInput.files[0]);
      const res = await fetch('/api/users/roster/import/csv', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.message || msg.error || 'CSV import failed');
      }
      const data = await res.json();
      state.lastImport = data;
      
      // After import, enroll users in the current offering
      if (data.imported && data.imported.length > 0 && state.offeringId) {
        for (const user of data.imported) {
          try {
            await fetchJSON('/api/enrollments', {
              method: 'POST',
              body: JSON.stringify({
                offering_id: state.offeringId,
                user_id: user.id,
                course_role: 'student',
                status: 'enrolled',
              }),
            });
          // eslint-disable-next-line no-unused-vars
          } catch (_err) {
            // Enrollment might already exist, which is fine
            console.log('Enrollment for user may already exist:', user.id);
          }
        }
      }
    } else {
      if (!elements.jsonInput.value.trim()) {
        showToast('Paste valid JSON', 'error');
        return;
      }
      const parsed = JSON.parse(elements.jsonInput.value);
      const data = await fetchJSON('/api/users/roster/import/json', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      state.lastImport = data;
      
      // After import, enroll users in the current offering
      if (data.imported && data.imported.length > 0 && state.offeringId) {
        for (const user of data.imported) {
          try {
            await fetchJSON('/api/enrollments', {
              method: 'POST',
              body: JSON.stringify({
                offering_id: state.offeringId,
                user_id: user.id,
                course_role: 'student',
                status: 'enrolled',
              }),
            });
          // eslint-disable-next-line no-unused-vars
          } catch (_err) {
            // Enrollment might already exist, which is fine
            console.log('Enrollment for user may already exist:', user.id);
          }
        }
      }
    }

    const importedCount = state.lastImport.imported_count ?? state.lastImport.imported?.length ?? 0;
    const failedCount = state.lastImport.failed_count ?? state.lastImport.failed?.length ?? 0;
    
    if (importedCount > 0 || failedCount > 0) {
      showToast(`Import completed: ${importedCount} imported, ${failedCount} failed`);
    } else {
    showToast('Import completed');
    }
    toggleOverlay(elements.importOverlay, false);
    elements.csvInput.value = '';
    elements.jsonInput.value = '';
    loadRoster();
  } catch (error) {
    console.error('Import failed', error);
    showToast(error.message || 'Import failed', 'error');
  }
};

const exportRoster = async () => {
  if (!state.offeringId) {
    showToast('Please select an offering first', 'error');
    return;
  }
  
  // Validate UUID before making API call
  if (!isValidUUID(state.offeringId)) {
    console.error('Invalid offeringId format (expected UUID):', state.offeringId);
    showToast('Invalid offering ID. Please refresh the page.', 'error');
    return;
  }
  
  const format = elements.exportFormat?.value || 'csv';
  
  try {
    // Use the API endpoint which checks permissions
    const endpoint = format === 'csv' 
      ? `/api/users/roster/export/csv`
      : `/api/users/roster/export/json`;
    
    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || 'Export failed - you may not have permission to export');
    }
    
    if (format === 'csv') {
      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `roster-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      const json = await response.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `roster-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    showToast(`Roster exported as ${format.toUpperCase()}`);
  } catch (error) {
    console.error('Export failed', error);
    showToast(error.message || 'Export failed', 'error');
  }
};

// Removed exportFiltered - using main export function with current filters

const allowTeamFilter = () => (
  state.filters.course_role === null || state.filters.course_role === 'student'
);

const updateTeamFilterControls = () => {
  if (!elements.teamFilterWrapper || !elements.teamFilterSelect) return;

  if (!allowTeamFilter()) {
    elements.teamFilterWrapper.hidden = true;
    state.filters.team = null;
    elements.teamFilterSelect.value = 'all';
    return;
  }

  elements.teamFilterWrapper.hidden = false;

  const prevValue = state.filters.team || 'all';
  const select = elements.teamFilterSelect;
  select.innerHTML = `
    <option value="all">All teams</option>
    <option value="team-leads">Team Leads</option>
  `;

  state.teams.forEach((team) => {
    const option = document.createElement('option');
    option.value = team.key;
    option.textContent = `Team ${team.number}`;
    select.appendChild(option);
  });

  if ([...select.options].some((opt) => opt.value === prevValue)) {
    select.value = prevValue;
  } else {
    state.filters.team = null;
    select.value = 'all';
  }
};

const checkEditPermissions = async () => {
  try {
    // Check if user can import roster (instructor/admin only)
    const response = await fetch('/api/users/roster/export/json', {
      credentials: 'include',
      method: 'HEAD' // Use HEAD to check permissions without downloading
    });
    
    // If we get 200 or 403, we know the permission status
    // 200 = has permission, 403 = no permission
    state.canEdit = response.ok || response.status === 200;
    
    // Check if user can select/email/drop (admin/instructor/TA only)
    try {
      const navContextResponse = await fetch('/api/users/navigation-context', {
        credentials: 'include'
      });
      if (navContextResponse.ok) {
        const navContext = await navContextResponse.json();
        const primaryRole = navContext.primary_role;
        const enrollmentRole = navContext.enrollment_role;
        // Allow admin, instructor, or TA (enrollment role)
        state.canSelect = primaryRole === 'admin' || 
                         primaryRole === 'instructor' || 
                         enrollmentRole === 'ta' || 
                         enrollmentRole === 'tutor';
      }
    } catch (error) {
      console.warn('Could not check select permissions:', error);
      state.canSelect = state.canEdit; // Fallback to canEdit
    }
    
    // Update UI to hide/show edit buttons
    if (elements.rosterActions) {
      if (!state.canEdit) {
        // Hide edit buttons for non-instructors/admins
        if (elements.btnAddPerson) elements.btnAddPerson.style.display = 'none';
        if (elements.btnImportModal) elements.btnImportModal.style.display = 'none';
        if (elements.btnExport) elements.btnExport.style.display = 'none';
        if (elements.exportFormat) elements.exportFormat.style.display = 'none';
      }
    }
    
    // Hide select/email/drop controls if user cannot select
    // Note: We update the UI after roster loads, so this is just initial setup
    if (!state.canSelect) {
      // Hide select-all checkbox header column
      if (elements.selectAll) {
        const selectAllTh = elements.selectAll.closest('th');
        if (selectAllTh) {
          selectAllTh.style.display = 'none';
        }
      }
      // Hide bulk actions bar (will be hidden by updateBulkActions anyway)
      if (elements.bulkActions) {
        elements.bulkActions.style.display = 'none';
      }
      // Hide all checkbox cells
      setTimeout(() => {
        document.querySelectorAll('.checkbox-cell').forEach(cell => {
          cell.style.display = 'none';
        });
      }, 0);
    } else {
      // Show checkbox column if user can select
      if (elements.selectAll) {
        const selectAllTh = elements.selectAll.closest('th');
        if (selectAllTh) {
          selectAllTh.style.display = '';
        }
      }
      setTimeout(() => {
        document.querySelectorAll('.checkbox-cell').forEach(cell => {
          cell.style.display = '';
        });
      }, 0);
    }
  } catch (error) {
    console.error('Error checking edit permissions:', error);
    state.canEdit = false;
    state.canSelect = false;
  }
};

// Keyboard navigation support
const handleKeyboardNavigation = (event) => {
  // Arrow keys for pagination
  if (event.key === 'ArrowLeft' && event.ctrlKey) {
    event.preventDefault();
    if (state.pagination.page > 1) {
      state.pagination.page -= 1;
      loadRoster();
    }
  } else if (event.key === 'ArrowRight' && event.ctrlKey) {
    event.preventDefault();
    if (state.pagination.page < state.pagination.totalPages) {
      state.pagination.page += 1;
      loadRoster();
    }
  }
  
  // Escape to clear search
  if (event.key === 'Escape' && document.activeElement === elements.searchInput) {
    elements.searchInput.value = '';
    state.filters.search = '';
    updateFilterCount();
    loadRoster();
  }
};

const bindEvents = () => {
  // Add keyboard navigation
  document.addEventListener('keydown', handleKeyboardNavigation);
  
  document.getElementById('btnRefresh').addEventListener('click', async () => {
    await loadOfferings();
    if (state.offeringId) {
      await loadRoster();
    }
  });
  
  if (elements.btnAddPerson) {
    elements.btnAddPerson.addEventListener('click', () => toggleOverlay(elements.addPersonOverlay, true));
  }
  if (elements.btnImportModal) {
    elements.btnImportModal.addEventListener('click', () => toggleOverlay(elements.importOverlay, true));
  }
  if (elements.btnExport) {
    elements.btnExport.addEventListener('click', exportRoster);
  }
  document.getElementById('btnRunImport').addEventListener('click', handleImport);
  elements.searchInput.addEventListener('input', debounce((event) => {
    state.filters.search = event.target.value.trim();
    state.pagination.page = 1;
    updateFilterCount();
    loadRoster();
  }, 300));
  elements.sortSelect.addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    loadRoster();
  });
  elements.roleFilters.forEach((button) => {
    button.addEventListener('click', () => {
      elements.roleFilters.forEach((btn) => { btn.dataset.active = 'false'; });
      button.dataset.active = 'true';
      state.filters.course_role = button.dataset.roleFilter === 'all' ? null : button.dataset.roleFilter;
      state.pagination.page = 1;
      updateTeamFilterControls();
      updateFilterCount();
      loadRoster();
    });
  });
  elements.statusFilters.forEach((button) => {
    button.addEventListener('click', () => {
      elements.statusFilters.forEach((btn) => { btn.dataset.active = 'false'; });
      button.dataset.active = 'true';
      state.filters.status = button.dataset.statusFilter === 'all' ? null : button.dataset.statusFilter;
      state.pagination.page = 1;
      updateFilterCount();
      loadRoster();
    });
  });
  
  if (elements.teamFilterSelect) {
    elements.teamFilterSelect.addEventListener('change', (event) => {
      const value = event.target.value;
      state.filters.team = value === 'all' ? null : value;
      state.pagination.page = 1;
      updateFilterCount();
      loadRoster();
    });
  }
  
  if (elements.clearFilters) {
    elements.clearFilters.addEventListener('click', clearAllFilters);
  }
  elements.prevPage.addEventListener('click', () => {
    if (state.pagination.page <= 1) return;
    state.pagination.page -= 1;
    loadRoster();
    scrollToTop();
  });
  elements.nextPage.addEventListener('click', () => {
    if (state.pagination.page >= state.pagination.totalPages) return;
    state.pagination.page += 1;
    loadRoster();
    scrollToTop();
  });
  elements.pageSize.addEventListener('change', (event) => {
    state.pagination.limit = Number(event.target.value);
    state.pagination.page = 1;
    loadRoster();
  });
  elements.rosterTableBody.addEventListener('click', handleActionClick);
  elements.rosterTableBody.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox' && event.target.classList.contains('row-checkbox')) {
      const enrollmentId = event.target.dataset.enrollmentId;
      handleRowSelect(enrollmentId, event.target.checked);
    }
  });
  
  if (elements.selectAll) {
    elements.selectAll.addEventListener('change', (event) => {
      handleSelectAll(event.target.checked);
    });
  }
  
  if (elements.bulkEmailBtn) {
    elements.bulkEmailBtn.addEventListener('click', handleBulkEmail);
  }
  
  if (elements.bulkDropBtn) {
    elements.bulkDropBtn.addEventListener('click', handleBulkDrop);
  }
  
  elements.addPersonForm.addEventListener('submit', handleAddPerson);
  elements.roleForm.addEventListener('submit', handleSaveRole);
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      const overlayId = button.dataset.closeModal;
      toggleOverlay(document.getElementById(overlayId), false);
    });
  });
  document.querySelectorAll('[data-import-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-import-tab]').forEach((btn) => { btn.dataset.active = 'false'; });
      document.querySelectorAll('[data-import-pane]').forEach((pane) => { pane.hidden = true; });
      button.dataset.active = 'true';
      const pane = document.querySelector(`[data-import-pane="${button.dataset.importTab}"]`);
      if (pane) pane.hidden = false;
    });
  });
  [elements.addPersonOverlay, elements.importOverlay].forEach((overlay) => {
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) toggleOverlay(overlay, false);
    });
  });
};

const init = async () => {
  // Initialize elements now that DOM is ready
  initializeElements();
  updateTeamFilterControls();
  
  // Ensure elements are found before proceeding
  if (!elements.activeOfferingName) {
    console.error('activeOfferingName element not found in DOM');
    const el = document.getElementById('activeOfferingName');
    if (el) {
      elements.activeOfferingName = el;
    } else {
      console.error('Could not find activeOfferingName element. Check HTML.');
      return;
    }
  }
  
  bindEvents();
  await checkEditPermissions();
  await loadOfferings();
  if (state.offeringId) {
  await loadRoster();
  }
};

// Wait for DOM to be ready
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM is already ready
  init();
}

