const state = {
  offeringId: null,
  offerings: [],
  roster: [],
  stats: {
    total: 0,
    roles: { student: 0, ta: 0, tutor: 0 },
    statuses: { enrolled: 0, waitlisted: 0, dropped: 0, completed: 0 },
  },
  pagination: { limit: 100, page: 1, totalPages: 1, total: 0 },
  filters: { course_role: null, status: null, team: null, search: '', sort: 'name' },
  teams: [], // Available teams for filtering
  lastImport: null,
  roleEditing: null,
  canEdit: false, // Whether user can edit roster (instructor/admin only)
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
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  roleFilters: document.querySelectorAll('[data-role-filter]'),
  statusFilters: document.querySelectorAll('[data-status-filter]'),
  teamFilterWrapper: document.getElementById('teamFilterWrapper'),
  teamFilterSelect: document.getElementById('teamFilterSelect'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageNumber: document.getElementById('pageNumber'),
  totalPages: document.getElementById('totalPages'),
  pageSize: document.getElementById('pageSize'),
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
    timeout = setTimeout(() => fn.apply(null, args), wait);
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
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

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
  
  const params = new URLSearchParams({
    limit: state.pagination.limit,
    offset: (state.pagination.page - 1) * state.pagination.limit,
  });
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.course_role) params.set('course_role', state.filters.course_role);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.sort) params.set('sort', state.filters.sort);
  
  // Note: Team filtering is done client-side after fetching

  try {
    elements.rosterTableBody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align:center;">Loading roster…</td></tr>';
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
    
    // Apply team filter client-side
    if (state.filters.team === 'team-leads') {
      allRoster = allRoster.filter(entry => entry.user?.is_team_lead === true);
    } else if (state.filters.team && state.filters.team !== 'all') {
      // Filter by specific team (format: "number:name")
      const [teamNum, teamName] = state.filters.team.split(':');
      allRoster = allRoster.filter(entry => 
        entry.user?.team_number == teamNum && entry.user?.team_name === teamName
      );
    }
    
    state.roster = allRoster;
    state.stats = data.stats || state.stats;
    state.pagination.total = allRoster.length;
    state.pagination.totalPages = Math.max(1, Math.ceil(allRoster.length / state.pagination.limit));
    state.pagination.page = Math.min(state.pagination.totalPages, state.pagination.page);

    renderRoster();
    renderStats();
    renderPagination();
  } catch (error) {
    console.error('Failed to load roster', error);
    elements.rosterTableBody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align:center; color: var(--rose-500);">Unable to load roster.</td></tr>';
    showToast(error.message || 'Failed to load roster', 'error');
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

const renderPagination = () => {
  elements.pageNumber.textContent = state.pagination.page;
  elements.totalPages.textContent = state.pagination.totalPages;
  elements.prevPage.disabled = state.pagination.page <= 1;
  elements.nextPage.disabled = state.pagination.page >= state.pagination.totalPages;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const renderRoster = () => {
  if (!state.roster.length) {
    elements.rosterTableBody.innerHTML = '';
    elements.emptyState.hidden = false;
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
    
    // Format team display
    let teamDisplay = 'No team';
    if (teamName && teamNumber) {
      teamDisplay = `Team ${teamNumber}: ${teamName}`;
    } else if (teamName) {
      teamDisplay = teamName;
    } else if (teamNumber) {
      teamDisplay = `Team ${teamNumber}`;
    }
    
    // Format role display - show role with team lead indicator if applicable
    let roleDisplay = role;
    let roleClass = role;
    if (isTeamLead && role === 'student') {
      roleDisplay = 'Team Lead';
      roleClass = 'team-lead';
    }
    
    // Show edit role button only if user can edit (Drop button is in actions column)
    const editRoleButton = state.canEdit ? `
      <button class="role-btn text-btn" data-action="edit-role" data-user-id="${entry.user_id}" data-name="${entry.user?.name || entry.user?.email || 'Unknown'}" data-role="${role}">
        Change role
      </button>
    ` : '';
    
    return `
      <tr>
        <td>
          <div class="name-cell">
            <div class="avatar" aria-hidden="true">${initials}</div>
            <div class="name-info">
              <div class="person-name">${entry.user?.name || 'Unknown'}</div>
              <div class="person-email">${entry.user?.email || ''}</div>
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
            ${entry.user?.team_name ? `
              <div class="team-name">${teamDisplay}</div>
              ${entry.user?.team_lead_name && !isTeamLead ? `<div class="team-lead-meta">Lead: ${teamLead}</div>` : ''}
            ` : '<div class="team-empty">No team</div>'}
          </div>
        </td>
        <td class="actions-cell">
          <button class="icon-btn" title="Email ${entry.user?.name}" data-action="email" data-email="${entry.user?.email || ''}">✉️</button>
          ${state.canEdit ? `<button class="btn btn-danger btn-icon" title="Drop from roster" data-action="drop" data-id="${entry.enrollment_id}">Drop</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
};

const handleActionClick = async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'email') {
    const email = button.dataset.email;
    if (email) window.location.href = `mailto:${email}`;
  }
  if (action === 'drop') {
    const enrollmentId = button.dataset.id;
    if (!enrollmentId) return;
    const confirmDrop = confirm('Drop this person from the roster? This will delete all enrollment and attendance records for this person.');
    if (!confirmDrop) return;
    try {
      // Validate UUID before making API call
      if (!isValidUUID(enrollmentId)) {
        console.error('Invalid enrollmentId format (expected UUID):', enrollmentId);
        showToast('Invalid enrollment ID', 'error');
        return;
      }
      await fetchJSON(`/api/enrollments/${enrollmentId}`, { method: 'DELETE' });
      showToast('Person dropped and all records deleted');
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
  
  if (!newRole || !['student', 'ta', 'tutor'].includes(newRole)) {
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
      document.body.removeChild(link);
    } else {
      const json = await response.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `roster-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
  } catch (error) {
    console.error('Error checking edit permissions:', error);
    state.canEdit = false;
  }
};

const bindEvents = () => {
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
      loadRoster();
    });
  });
  elements.statusFilters.forEach((button) => {
    button.addEventListener('click', () => {
      elements.statusFilters.forEach((btn) => { btn.dataset.active = 'false'; });
      button.dataset.active = 'true';
      state.filters.status = button.dataset.statusFilter === 'all' ? null : button.dataset.statusFilter;
      state.pagination.page = 1;
      loadRoster();
    });
  });
  
  if (elements.teamFilterSelect) {
    elements.teamFilterSelect.addEventListener('change', (event) => {
      const value = event.target.value;
      state.filters.team = value === 'all' ? null : value;
      state.pagination.page = 1;
      loadRoster();
    });
  }
  elements.prevPage.addEventListener('click', () => {
    if (state.pagination.page <= 1) return;
    state.pagination.page -= 1;
    loadRoster();
  });
  elements.nextPage.addEventListener('click', () => {
    if (state.pagination.page >= state.pagination.totalPages) return;
    state.pagination.page += 1;
    loadRoster();
  });
  elements.pageSize.addEventListener('change', (event) => {
    state.pagination.limit = Number(event.target.value);
    state.pagination.page = 1;
    loadRoster();
  });
  elements.rosterTableBody.addEventListener('click', handleActionClick);
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
  
  // Hamburger menu toggle
  const hamburger = document.querySelector('.hamburger-menu');
  const sidebar = document.querySelector('.sidebar');
  const body = document.body;
  
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isExpanded));
      sidebar.classList.toggle('open');
      body.classList.toggle('menu-open');
    });
    
    // Close menu when clicking outside on mobile
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

