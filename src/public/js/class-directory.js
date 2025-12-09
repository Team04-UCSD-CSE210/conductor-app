// Class Directory JavaScript

// ---------- State ----------

const state = {
  offeringId: null,
  professors: [],
  tutors: [],
  tas: [],
  students: [],
  teams: [],
  currentTab: 'professors',
  filters: {
    professors: { search: '' },
    tutors: { search: '', activity: 'all' },
    tas: { search: '', activity: 'all' },
    students: { search: '', team: 'all', activity: 'all' },
    teams: { search: '' }
  }
};

let elements = {};

// ---------- Utilities ----------

const safeJsonParse = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatShortAvailability = (text) => {
  if (!text) return 'Not specified';
  return text;
};

const computeActivityStatus = (lastActivity) => {
  if (!lastActivity) {
    return { label: 'No data', kind: 'unknown' };
  }
  const last = new Date(lastActivity);
  if (Number.isNaN(last.getTime())) {
    return { label: 'No data', kind: 'unknown' };
  }
  const now = new Date();
  const diffMs = now - last;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) {
    return { label: 'Active (7d)', kind: 'active' };
  }
  if (diffDays <= 30) {
    return { label: 'Seen (30d)', kind: 'recent' };
  }
  return { label: 'Inactive', kind: 'inactive' };
};

const matchesSearch = (item, search) => {
  if (!search) return true;
  const q = search.toLowerCase();
  const fields = [
    item.name,
    item.preferred_name,
    item.email,
    item.role,
    item.team_name,
    item.team
  ];
  return fields.some((f) => f && String(f).toLowerCase().includes(q));
};

// ---------- DOM Init ----------

const initializeElements = () => {
  elements = {
    activeOfferingName: document.getElementById('activeOfferingName'),

    tabBtns: document.querySelectorAll('.directory-tabs .tab-btn'),
    sections: document.querySelectorAll('.directory-section'),

    // grids
    professorsGrid: document.getElementById('professors-grid'),
    tutorsGrid: document.getElementById('tutors-grid'),
    tasGrid: document.getElementById('tas-grid'),
    studentsGrid: document.getElementById('students-grid'),
    teamsGrid: document.getElementById('teams-grid'),

    // filters / search
    profSearch: document.getElementById('prof-search'),
    tutorSearch: document.getElementById('tutor-search'),
    taSearch: document.getElementById('ta-search'),
    studentSearch: document.getElementById('student-search'),
    studentTeamFilter: document.getElementById('student-team'),
    studentActivityFilter: document.getElementById('student-activity'),
    tutorActivityFilter: document.getElementById('tutor-activity'),
    taActivityFilter: document.getElementById('ta-activity')
  };
};

// ---------- API ----------

const api = {
  async getActiveOffering() {
    const res = await fetch('/api/offerings/active', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch active offering');
    return res.json();
  },

  async getClassDirectory(offeringId) {
    const res = await fetch(
      `/api/class-directory?offering_id=${encodeURIComponent(offeringId)}`,
      { credentials: 'include' }
    );
    if (!res.ok) throw new Error('Failed to fetch class directory');
    return res.json();
  }
};

// ---------- Rendering: common card ----------

const renderPersonCard = (user, options = {}) => {
  const {
    roleLabel,
    showTeam = false,
    highlightTag = null
  } = options;

  const social = safeJsonParse(user.social_links);
  const activity = computeActivityStatus(user.last_activity);

  const pronouns = user.pronouns || '';
  const availabilityGeneral =
    user.availability || social.availability || social.availability_general;
  const availabilitySpecific =
    social.availability_specific || social.availability_details;

  const contactLines = [];
  if (user.email) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">Email</span><span class="contact-value">${user.email}</span></span>`
    );
  }
  if (social.slack) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">Slack</span><span class="contact-value">${social.slack}</span></span>`
    );
  }
  if (social.github) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">GitHub</span><span class="contact-value">${social.github}</span></span>`
    );
  }
  if (social.discord) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">Discord</span><span class="contact-value">${social.discord}</span></span>`
    );
  }
  if (social.class_chat) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">Class chat</span><span class="contact-value">${social.class_chat}</span></span>`
    );
  }
  const contactHtml = contactLines.length
    ? contactLines.join('<span class="contact-dot">·</span>')
    : '<span class="contact-empty">No contact info</span>';

  const tags = [];
  if (highlightTag) {
    tags.push(
      `<span class="tag tag-accent">${highlightTag}</span>`
    );
  }
  if (showTeam && (user.team_name || user.team)) {
    tags.push(
      `<span class="tag">Team ${user.team_name || user.team}</span>`
    );
  }

  const activityClass =
    activity.kind === 'active'
      ? 'status-pill-active'
      : activity.kind === 'recent'
      ? 'status-pill-recent'
      : activity.kind === 'inactive'
      ? 'status-pill-inactive'
      : 'status-pill-unknown';

  return `
    <article class="person-card" data-user-id="${user.id || ''}">
      <section class="person-identity">
        <div class="person-avatar">
          <span>${getInitials(user.preferred_name || user.name)}</span>
        </div>
        <header class="person-heading">
          <h3 class="person-name">${user.preferred_name || user.name}</h3>
          <p class="person-role-line">
            <span class="person-role">${roleLabel || user.role || ''}</span>
            ${
              pronouns
                ? `<span class="person-pronouns">· ${pronouns}</span>`
                : ''
            }
          </p>
        </header>
      </section>

      <section class="person-info">
        <div class="info-grid">
          <div class="info-section">
            <h4>Contact</h4>
            <div class="info-body contact-body">
              ${contactHtml}
            </div>
          </div>
          <div class="info-section">
            <h4>Availability</h4>
            <div class="info-body">
              <div class="detail-row">
                <span class="detail-label">General</span>
                <span class="detail-value">${formatShortAvailability(
                  availabilityGeneral
                )}</span>
              </div>
              ${
                availabilitySpecific
                  ? `
              <div class="detail-row">
                <span class="detail-label">Specific</span>
                <span class="detail-value">${availabilitySpecific}</span>
              </div>`
                  : ''
              }
            </div>
          </div>
        </div>
      </section>

      <section class="person-actions">
        <div class="person-tags">
          ${
            tags.length
              ? tags.join('')
              : '<span class="tag tag-faded">No extra tags</span>'
          }
        </div>
        <div class="person-footer">
          <span class="status-pill ${activityClass}">
            ${activity.label}
          </span>
          ${
            user.email
              ? `<a class="btn btn-ghost" href="mailto:${user.email}">Email</a>`
              : ''
          }
          <button
            type="button"
            class="btn btn-ghost profile-toggle"
            data-profile-label="View details"
          >
            View details
          </button>
        </div>
      </section>
    </article>
  `;
};
// ---------- Profile expand / collapse ----------

const initProfileTogglesForGrid = (gridEl) => {
  if (!gridEl) return;

  const cards = gridEl.querySelectorAll('.person-card');

  cards.forEach((card) => {
    const btn = card.querySelector('.profile-toggle');
    if (!btn) return;

    const baseLabel = btn.dataset.profileLabel || 'View details';

    // start collapsed
    card.classList.remove('profile-open');
    btn.textContent = baseLabel;

    btn.addEventListener('click', () => {
      const isOpen = card.classList.toggle('profile-open');
      btn.textContent = isOpen ? 'Hide details' : baseLabel;
    });
  });
};

// ---------- Rendering: Teams / Groups ----------

const renderTeamCard = (team) => {
  const members = Array.isArray(team.members)
    ? team.members.filter((m) => m && m.name)
    : [];

  const memberCount = team.member_count || members.length || 0;

  const memberListHtml = members.length
    ? `
      <ul class="group-members-list">
        ${members
          .map(
            (m) => `
          <li>
            <span class="member-name">${m.name}</span>
            ${
              m.role
                ? `<span class="member-role"> – ${m.role}</span>`
                : ''
            }
          </li>`
          )
          .join('')}
      </ul>
    `
    : `<p class="group-members-empty">No members assigned yet.</p>`;

  return `
    <article class="group-card" data-team-id="${team.id}">
      <header class="group-header">
        <div class="group-logo">${getInitials(team.name)}</div>
        <div class="group-header-text">
          <h4 class="group-name">${team.name}</h4>
          <p class="group-subtitle">${
            team.mantra || 'Project team'
          }</p>
        </div>
      </header>

      <section class="group-stats">
        <div class="stat-item">
          <div class="stat-value">${memberCount}</div>
          <div class="stat-label">Members</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${team.status || 'Active'}</div>
          <div class="stat-label">Status</div>
        </div>
      </section>

      <section class="group-members">
        <h4 class="group-members-title">Members</h4>
        ${memberListHtml}
      </section>
    </article>
  `;
};

// ---------- Rendering helpers for each tab ----------

const renderEmptyState = (grid, message) => {
  grid.innerHTML = `<div class="empty-state">${message}</div>`;
};

const renderProfessorsGrid = () => {
  const grid = elements.professorsGrid;
  const items = getFilteredProfessors();

  if (!items.length) {
    renderEmptyState(grid, 'No professors found.');
    return;
  }

  grid.innerHTML = items
    .map((prof) =>
      renderPersonCard(prof, {
        roleLabel: prof.role || 'Professor',
        highlightTag: 'Instructor'
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
};


const renderTutorsGrid = () => {
  const grid = elements.tutorsGrid;
  const items = getFilteredTutors();

  if (!items.length) {
    renderEmptyState(grid, 'No tutors found.');
    return;
  }

  grid.innerHTML = items
    .map((tutor) =>
      renderPersonCard(tutor, {
        roleLabel: tutor.role || 'Tutor',
        highlightTag: 'Tutor'
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
};


const renderTasGrid = () => {
  const grid = elements.tasGrid;
  const items = getFilteredTas();

  if (!items.length) {
    renderEmptyState(grid, 'No TAs found.');
    return;
  }

  grid.innerHTML = items
    .map((ta) =>
      renderPersonCard(ta, {
        roleLabel: ta.role || 'Teaching Assistant',
        highlightTag: 'TA'
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
};


const renderStudentsGrid = () => {
  const grid = elements.studentsGrid;
  const items = getFilteredStudents();

  if (!items.length) {
    renderEmptyState(grid, 'No students found.');
    return;
  }

  grid.innerHTML = items
    .map((student) =>
      renderPersonCard(student, {
        roleLabel: student.role || 'Student',
        showTeam: true
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
};


const renderTeamsGrid = () => {
  const grid = elements.teamsGrid;
  const items = getFilteredTeams();

  if (!items.length) {
    renderEmptyState(grid, 'No teams found.');
    return;
  }

  grid.innerHTML = items.map((team) => renderTeamCard(team)).join('');
};

// ---------- Filtering ----------

const isActiveByFilter = (lastActivity, filterValue) => {
  if (filterValue === 'all') return true;
  const status = computeActivityStatus(lastActivity);
  if (filterValue === 'active') return status.kind === 'active';
  if (filterValue === 'inactive')
    return status.kind === 'inactive';
  return true;
};

const getFilteredProfessors = () => {
  const { search } = state.filters.professors;
  return state.professors.filter((p) => matchesSearch(p, search));
};

const getFilteredTutors = () => {
  const { search, activity } = state.filters.tutors;
  return state.tutors.filter(
    (t) =>
      matchesSearch(t, search) &&
      isActiveByFilter(t.last_activity, activity)
  );
};

const getFilteredTas = () => {
  const { search, activity } = state.filters.tas;
  return state.tas.filter(
    (t) =>
      matchesSearch(t, search) &&
      isActiveByFilter(t.last_activity, activity)
  );
};

const getFilteredStudents = () => {
  const { search, team, activity } = state.filters.students;
  return state.students.filter((s) => {
    if (!matchesSearch(s, search)) return false;

    const teamName = s.team_name || s.team || null;
    if (team !== 'all' && teamName !== team) return false;

    if (!isActiveByFilter(s.last_activity, activity)) return false;

    return true;
  });
};

const getFilteredTeams = () => {
  const { search } = state.filters.teams;
  return state.teams.filter((g) => matchesSearch(g, search));
};

const populateStudentTeamFilter = () => {
  const select = elements.studentTeamFilter;
  if (!select) return;

  const teams = new Set();
  state.students.forEach((s) => {
    const teamName = s.team_name || s.team;
    if (teamName) teams.add(teamName);
  });

  const current = select.value || 'all';

  select.innerHTML = `
    <option value="all">All Teams</option>
    ${Array.from(teams)
      .sort()
      .map(
        (t) => `<option value="${t}">${t}</option>`
      )
      .join('')}
  `;

  if ([...teams, 'all'].includes(current)) {
    select.value = current;
  }
};

// ---------- Tab switching ----------

const setActiveTab = (tab) => {
  state.currentTab = tab;

  elements.tabBtns.forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  elements.sections.forEach((section) => {
    const id = section.id.replace('-section', '');
    const isActive = id === tab;
    section.hidden = !isActive;
    section.classList.toggle('active', isActive);
  });

  // 避免切 tab 時 grid 還沒更新
  switch (tab) {
    case 'professors':
      renderProfessorsGrid();
      break;
    case 'tutors':
      renderTutorsGrid();
      break;
    case 'tas':
      renderTasGrid();
      break;
    case 'students':
      renderStudentsGrid();
      break;
    case 'teams':
      renderTeamsGrid();
      break;
    default:
      break;
  }
};

// ---------- Event listeners ----------

const setupEventListeners = () => {
  // Tabs
  elements.tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab && tab !== state.currentTab) {
        setActiveTab(tab);
      }
    });
  });

  // Search + filters
  if (elements.profSearch) {
    elements.profSearch.addEventListener('input', (e) => {
      state.filters.professors.search = e.target.value || '';
      renderProfessorsGrid();
    });
  }

  if (elements.tutorSearch) {
    elements.tutorSearch.addEventListener('input', (e) => {
      state.filters.tutors.search = e.target.value || '';
      renderTutorsGrid();
    });
  }

  if (elements.taSearch) {
    elements.taSearch.addEventListener('input', (e) => {
      state.filters.tas.search = e.target.value || '';
      renderTasGrid();
    });
  }

  if (elements.studentSearch) {
    elements.studentSearch.addEventListener('input', (e) => {
      state.filters.students.search = e.target.value || '';
      renderStudentsGrid();
    });
  }

  if (elements.tutorActivityFilter) {
    elements.tutorActivityFilter.addEventListener('change', (e) => {
      state.filters.tutors.activity = e.target.value || 'all';
      renderTutorsGrid();
    });
  }

  if (elements.taActivityFilter) {
    elements.taActivityFilter.addEventListener('change', (e) => {
      state.filters.tas.activity = e.target.value || 'all';
      renderTasGrid();
    });
  }

  if (elements.studentActivityFilter) {
    elements.studentActivityFilter.addEventListener('change', (e) => {
      state.filters.students.activity = e.target.value || 'all';
      renderStudentsGrid();
    });
  }

  if (elements.studentTeamFilter) {
    elements.studentTeamFilter.addEventListener('change', (e) => {
      state.filters.students.team = e.target.value || 'all';
      renderStudentsGrid();
    });
  }
};

// ---------- Data load ----------

const loadData = async () => {
  try {
    // 1) active offering
    const offering = await api.getActiveOffering();
    state.offeringId = offering.id;
    if (elements.activeOfferingName && offering.name && offering.code) {
      elements.activeOfferingName.textContent = `${offering.code} – ${offering.name}`;
    } else if (elements.activeOfferingName && offering.name) {
      elements.activeOfferingName.textContent = offering.name;
    }

    // 2) directory
    const data = await api.getClassDirectory(state.offeringId);

    state.professors = data.professors || [];
    state.tutors = data.tutors || [];
    state.tas = data.tas || [];
    state.students = data.students || [];
    state.teams = data.teams || data.groups || [];

    populateStudentTeamFilter();

    // 首次渲染：保持預設 tab（professors）
    renderProfessorsGrid();
    renderTutorsGrid();
    renderTasGrid();
    renderStudentsGrid();
    renderTeamsGrid();
  } catch (err) {
    console.error('Failed to load class directory data:', err);
    if (elements.activeOfferingName) {
      elements.activeOfferingName.textContent = 'Error loading data';
    }
  }
};

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
  setActiveTab('professors');
  loadData();
});
