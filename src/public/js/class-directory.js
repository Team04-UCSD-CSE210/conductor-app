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
  currentUser: null, 
  filters: {
    professors: { search: '' },
    tutors: { search: '' },
    tas: { search: '' },
    students: { search: '' },
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

const formatAvailabilitySpecific = (data) => {
  if (!data) return 'Not specified';
  
  // Handle string JSON
  let parsed;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return data; // Return as-is if not valid JSON
    }
  } else if (typeof data === 'object') {
    parsed = data;
  } else {
    return String(data);
  }

  const parts = [];
  
  // Location
  if (parsed.location) {
    parts.push(`<div class="availability-item"><span class="availability-field-label">Location</span><span class="availability-field-value">${parsed.location}</span></div>`);
  }
  
  // Office hours
  if (parsed.office_hours && Array.isArray(parsed.office_hours) && parsed.office_hours.length > 0) {
    const hoursHtml = parsed.office_hours.map(oh => {
      const day = oh.day || '';
      const start = oh.start || '';
      const end = oh.end || '';
      const timeStr = start && end ? `${start}–${end}` : start || end || '';
      return `<div class="office-hour-item"><span class="office-hour-day">${day}</span>${timeStr ? `<span class="office-hour-time">${timeStr}</span>` : ''}</div>`;
    }).join('');
    parts.push(`<div class="availability-item"><span class="availability-field-label">Office Hours</span><div class="office-hours-list">${hoursHtml}</div></div>`);
  }
  
  // Appointment required
  if (parsed.appointment_required !== undefined) {
    parts.push(`<div class="availability-item"><span class="availability-field-label">Appointment</span><span class="availability-field-value">${parsed.appointment_required ? 'Required' : 'Not required'}</span></div>`);
  }
  
  return parts.length > 0 ? parts.join('') : 'Not specified';
};

const computeActivityStatus = (lastActivity) => {
  if (!lastActivity) {
    return null; // Return null instead of "No data"
  }
  const last = new Date(lastActivity);
  if (Number.isNaN(last.getTime())) {
    return null; // Return null instead of "No data"
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


const canCurrentUserEditAvatar = (user) => {
  const ctx = state.currentUser;
  if (!ctx) return false;

  // Only allow users to upload their own avatar
  if (ctx.id && user.id && ctx.id === user.id) return true;

  return false;
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
    studentSearch: document.getElementById('student-search')
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
  },

  async getNavigationContext() {
    const res = await fetch('/api/users/navigation-context', {
      credentials: 'include'
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch navigation context: ${res.status}`);
    }
    return res.json();
  },

  async uploadAvatar(userId, file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(
      `/api/class-directory/user/${encodeURIComponent(userId)}/avatar`,
      {
        method: 'POST',
        credentials: 'include',
        body: formData
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.error || `Upload failed with status ${res.status}`;
      throw new Error(message);
    }

    return res.json();
  }
};

// ---------- Rendering: common card ----------

const renderPersonCard = (user, options = {}) => { 
  const {
    roleLabel,
    showTeam = false,
    highlightTag = null,
    canUploadAvatar = false
  } = options;

  const social = safeJsonParse(user.social_links);
  const activity = computeActivityStatus(user.last_activity);

  const pronouns = user.pronouns || '';
  const availabilityGeneral =
    user.availability_general ||
    user.availability ||
    social.availability ||
    social.availability_general;
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
    tags.push(`<span class="tag tag-accent">${highlightTag}</span>`);
  }
  if (showTeam && (user.team_name || user.team)) {
    tags.push(`<span class="tag">Team ${user.team_name || user.team}</span>`);
  }

  const activityClass = activity
    ? activity.kind === 'active'
      ? 'status-pill-active'
      : activity.kind === 'recent'
      ? 'status-pill-recent'
      : activity.kind === 'inactive'
      ? 'status-pill-inactive'
      : 'status-pill-unknown'
    : null;

  const fullName = user.name || 'Unnamed';
  const preferredName = user.preferred_name && user.preferred_name !== fullName ? user.preferred_name : null;
  const initials = getInitials(fullName || preferredName);
  const hasAvatar = !!(user.avatar_url || user.image_url);

  const avatarHtml = hasAvatar
    ? `<img class="person-avatar-img" src="${user.avatar_url || user.image_url}" alt="${fullName || 'Avatar'}" />`
    : `<span>${initials}</span>`;

  const uploadControls =
    canUploadAvatar && user.id
      ? `
      <button
        type="button"
        class="btn btn-ghost avatar-upload-btn"
        data-user-id="${user.id}"
      >
        Upload photo
      </button>
      <input
        type="file"
        accept="image/*"
        class="avatar-file-input"
        data-user-id="${user.id}"
        hidden
      />
    `
      : '';

  const contactButtonHtml = user.email
    ? `<a
         class="btn btn-ghost person-contact-btn"
         href="mailto:${encodeURIComponent(user.email)}"
       >
         Contact
       </a>`
    : '';

  return `
    <article class="person-card" data-user-id="${user.id || ''}">
      <section class="person-identity">
        <div class="person-avatar">
          ${avatarHtml}
        </div>
        <header class="person-heading">
          <h3 class="person-name">${fullName}</h3>
          ${
            preferredName
              ? `<p class="person-preferred-name">Preferred: ${preferredName}</p>`
              : ''
          }
          <p class="person-role-line">
            <span class="person-role">${roleLabel || user.role || ''}</span>
            ${
              pronouns
                ? `<span class="person-pronouns">· ${pronouns}</span>`
                : ''
            }
          </p>
          ${user.email ? `<p class="person-email">${user.email}</p>` : ''}
        </header>
      </section>

      <section class="person-info">
        <div class="info-grid">
          <div class="info-section">
            <h4>Contact</h4>
            <div class="info-body contact-body">
              ${contactHtml}
              ${user.phone_number ? `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${user.phone_number}</span></div>` : ''}
              ${user.github_username ? `<div class="detail-row"><span class="detail-label">GitHub</span><span class="detail-value">@${user.github_username}</span></div>` : ''}
              ${user.linkedin_url ? `<div class="detail-row"><span class="detail-label">LinkedIn</span><span class="detail-value">${user.linkedin_url}</span></div>` : ''}
              ${user.class_chat ? `<div class="detail-row"><span class="detail-label">Class Chat</span><span class="detail-value">${user.class_chat}</span></div>` : ''}
              ${user.slack_handle ? `<div class="detail-row"><span class="detail-label">Slack</span><span class="detail-value">${user.slack_handle}</span></div>` : ''}
            </div>
          </div>
          <div class="info-section">
            <h4>Availability</h4>
            <div class="info-body availability-body">
              ${
                availabilityGeneral || user.availability_general
                  ? `
              <div class="availability-section">
                <div class="availability-label">General</div>
                <div class="availability-value">${formatShortAvailability(
                  availabilityGeneral || user.availability_general
                )}</div>
              </div>`
                  : ''
              }
              ${
                availabilitySpecific || user.availability_specific
                  ? `
              <div class="availability-section">
                <div class="availability-label">Specific</div>
                <div class="availability-value availability-specific">${formatAvailabilitySpecific(
                  availabilitySpecific || user.availability_specific
                )}</div>
              </div>`
                  : ''
              }
            </div>
          </div>
          <div class="info-section">
            <h4>Background</h4>
            <div class="info-body">
              ${user.pronunciation ? `<div class="detail-row"><span class="detail-label">Pronunciation</span><span class="detail-value">${user.pronunciation}</span></div>` : ''}
              ${user.department ? `<div class="detail-row"><span class="detail-label">Department</span><span class="detail-value">${user.department}</span></div>` : ''}
              ${user.major ? `<div class="detail-row"><span class="detail-label">Major</span><span class="detail-value">${user.major}</span></div>` : ''}
              ${user.degree_program ? `<div class="detail-row"><span class="detail-label">Degree</span><span class="detail-value">${user.degree_program}</span></div>` : ''}
              ${user.academic_year ? `<div class="detail-row"><span class="detail-label">Year</span><span class="detail-value">${user.academic_year}</span></div>` : ''}
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
          ${
            activity
              ? `<span class="status-pill ${activityClass}">
                  ${activity.label}
                </span>`
              : ''
          }
          ${contactButtonHtml}
          <button
            type="button"
            class="btn btn-ghost profile-toggle"
            data-profile-label="View details"
          >
            View details
          </button>
          ${uploadControls}
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

// ---------- Avatar upload init ----------

const initAvatarUploadForGrid = (gridEl) => {
  if (!gridEl) return;

  const buttons = gridEl.querySelectorAll('.avatar-upload-btn');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    const userId = btn.dataset.userId;
    if (!userId) return;

    const input = gridEl.querySelector(
      `.avatar-file-input[data-user-id="${userId}"]`
    );
    if (!input) return;

    btn.addEventListener('click', () => {
      input.click();
    });

    input.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Uploading...';

      try {
        const result = await api.uploadAvatar(userId, file);

        const card = gridEl.querySelector(
          `.person-card[data-user-id="${userId}"]`
        );
        if (card) {
          const avatarEl = card.querySelector('.person-avatar');
          if (avatarEl && result.avatar_url) {
            avatarEl.innerHTML = `<img src="${result.avatar_url}" alt="Profile photo" />`;
          }
        }
      } catch (err) {
        console.error('Avatar upload failed:', err);
        alert(err.message || 'Failed to upload avatar.');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
        input.value = '';
      }
    });
  });
};

// ---------- Rendering: Teams / Groups ----------

const renderTeamCard = (team) => {
  const members = Array.isArray(team.members)
    ? team.members.filter((m) => m && m.name)
    : [];

  const memberCount = team.member_count || members.length || 0;
  const leaderId = team.leader_id || (team.leader && team.leader.id);

  // Identify leaders - check both leader_id and role='leader'
  const memberListHtml = members.length
    ? `
      <ul class="group-members-list">
        ${members
          .map(
            (m) => {
              const isLeader = m.id === leaderId || m.role === 'leader';
              return `
          <li>
            <span class="member-name">${m.name}</span>
            ${isLeader ? '<span class="member-role member-lead">(lead)</span>' : ''}
            ${
              m.role && m.role !== 'leader'
                ? `<span class="member-role"> – ${m.role}</span>`
                : ''
            }
          </li>`;
            }
          )
          .join('')}
      </ul>
    `
    : `<p class="group-members-empty">No members assigned yet.</p>`;

  // Build team info section
  const teamInfo = [];
  if (team.team_number) {
    teamInfo.push(`Team #${team.team_number}`);
  }
  const teamInfoText = teamInfo.length > 0 ? teamInfo.join(' • ') : 'Project team';

  return `
    <article class="group-card" data-team-id="${team.id}">
      <header class="group-header">
        <div class="group-logo">${getInitials(team.name)}</div>
        <div class="group-header-text">
          <h4 class="group-name">${team.name}</h4>
          <p class="group-subtitle">${teamInfoText}</p>
        </div>
      </header>

      <section class="group-stats">
        <div class="stat-item">
          <div class="stat-value">${memberCount}</div>
          <div class="stat-label">Members</div>
        </div>
        ${team.team_number ? `
        <div class="stat-item">
          <div class="stat-value">#${team.team_number}</div>
          <div class="stat-label">Team Number</div>
        </div>
        ` : ''}
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
        highlightTag: 'Instructor',
        canUploadAvatar: canCurrentUserEditAvatar(prof)
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
  initAvatarUploadForGrid(grid);
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
        highlightTag: 'Tutor',
        canUploadAvatar: canCurrentUserEditAvatar(tutor)
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
  initAvatarUploadForGrid(grid);
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
        highlightTag: 'TA',
        canUploadAvatar: canCurrentUserEditAvatar(ta)
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
  initAvatarUploadForGrid(grid);
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
        showTeam: true,
        canUploadAvatar: canCurrentUserEditAvatar(student)
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
  initAvatarUploadForGrid(grid);
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
  const { search } = state.filters.tutors;
  return state.tutors.filter((t) => matchesSearch(t, search));
};

const getFilteredTas = () => {
  const { search } = state.filters.tas;
  return state.tas.filter((t) => matchesSearch(t, search));
};

const getFilteredStudents = () => {
  const { search } = state.filters.students;
  return state.students.filter((s) => matchesSearch(s, search));
};

const getFilteredTeams = () => {
  const { search } = state.filters.teams;
  return state.teams.filter((g) => matchesSearch(g, search));
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


};

// ---------- Data load ----------

const loadData = async () => {
  try {
    // 0) 当前用户（用于权限 / 按钮显示）
    try {
      const context = await api.getNavigationContext();
      state.currentUser = context;
    } catch (err) {
      console.warn('Failed to load navigation context:', err.message);
    }

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
