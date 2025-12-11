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
  pendingAvatars: {},
  editingUserId: null,
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

// Utility function to make links clickable
const makeLinkClickable = (text, type = 'auto') => {
  if (!text) return text;
  const str = String(text).trim();
  
  // If it's already a URL (starts with http:// or https://)
  if (/^https?:\/\//i.test(str)) {
    return `<a href="${str}" target="_blank" rel="noopener noreferrer" class="clickable-link">${str}</a>`;
  }
  
  // If it's an email address
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return `<a href="mailto:${str}" class="clickable-link">${str}</a>`;
  }
  
  // GitHub username (starts with @ or just username)
  if (type === 'github' || str.startsWith('@') || /^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/.test(str)) {
    const username = str.replaceAll(/^@/g, '');
    return `<a href="https://github.com/${username}" target="_blank" rel="noopener noreferrer" class="clickable-link">@${username}</a>`;
  }
  
  // LinkedIn URL (without http)
  if (type === 'linkedin' && str.includes('linkedin.com')) {
    return `<a href="https://${str.replaceAll(/^https?:\/\//g, '')}" target="_blank" rel="noopener noreferrer" class="clickable-link">${str}</a>`;
  }
  
  // Slack handle (starts with @)
  if (type === 'slack' && str.startsWith('@')) {
    return `<a href="slack://user?team=${encodeURIComponent(str)}" class="clickable-link">${str}</a>`;
  }
  
  // Class chat (might be a channel or handle)
  if (type === 'class_chat' && str.startsWith('#')) {
    return `<a href="slack://channel?team=${encodeURIComponent(str)}" class="clickable-link">${str}</a>`;
  }
  
  return str; // Return as-is if no pattern matches
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
      const timeHtml = timeStr ? `<span class="office-hour-time">${timeStr}</span>` : '';
      return `<div class="office-hour-item"><span class="office-hour-day">${day}</span>${timeHtml}</div>`;
    }).join('');
    const officeHoursHtml = `<div class="availability-item"><span class="availability-field-label">Office Hours</span><div class="office-hours-list">${hoursHtml}</div></div>`;
    parts.push(officeHoursHtml);
  }
  
  // Appointment required
  if (parsed.appointment_required !== undefined) {
    parts.push(`<div class="availability-item"><span class="availability-field-label">Appointment</span><span class="availability-field-value">${parsed.appointment_required ? 'Required' : 'Not required'}</span></div>`);
  }
  
  return parts.length > 0 ? parts.join('') : 'Not specified';
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll(/&/g, '&amp;')
    .replaceAll(/</g, '&lt;')
    .replaceAll(/>/g, '&gt;')
    .replaceAll(/"/g, '&quot;')
    .replaceAll(/'/g, '&#039;');
};

const isCurrentUser = (user) => {
  if (!user || !user.id || !state.currentUser || !state.currentUser.id) return false;
  return String(state.currentUser.id) === String(user.id);
};

const clearPendingAvatar = (userId) => {
  if (!state.pendingAvatars || !userId) return;
  const pending = state.pendingAvatars[userId];
  if (pending?.previewUrl) {
    URL.revokeObjectURL(pending.previewUrl);
  }
  delete state.pendingAvatars[userId];
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
    studentSearch: document.getElementById('student-search'),
    teamSearch: document.getElementById('team-search')
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
  },

  async updateUserCard(userId, payload) {
    const res = await fetch(
      `/api/class/user/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload || {})
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.error || `Update failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    return res.json();
  }
};

// ---------- State helpers ----------

const updateUserInCollections = (userId, updates = {}) => {
  const merge = (list) =>
    Array.isArray(list)
      ? list.map((u) => (u.id === userId ? { ...u, ...updates } : u))
      : list;

  state.professors = merge(state.professors);
  state.tutors = merge(state.tutors);
  state.tas = merge(state.tas);
  state.students = merge(state.students);

  if (state.currentUser && state.currentUser.id === userId) {
    state.currentUser = { ...state.currentUser, ...updates };
  }
};

const rerenderPeopleGrids = () => {
  renderProfessorsGrid();
  renderTutorsGrid();
  renderTasGrid();
  renderStudentsGrid();
};

// ---------- Rendering: common card ----------

const renderPersonCard = (user, options = {}) => { 
  const {
    roleLabel,
    showTeam = false,
    highlightTag = null,
    canUploadAvatar = false,
    showAvailability = true
  } = options;

  const isSelf = isCurrentUser(user);
  const isEditing = state.editingUserId === user.id;

  const cardClasses = ['person-card'];
  if (!showAvailability) {
    cardClasses.push('no-availability');
  }
  if (isEditing) {
    cardClasses.push('profile-open', 'editing');
  }

  const infoGridClasses = ['info-grid'];
  if (!showAvailability) {
    infoGridClasses.push('info-grid-compact');
  }

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
      `<span class="contact-item"><span class="contact-label">Email</span><span class="contact-value">${makeLinkClickable(user.email, 'email')}</span></span>`
    );
  }
  if (social.slack) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">Slack</span><span class="contact-value">${makeLinkClickable(social.slack, 'slack')}</span></span>`
    );
  }
  if (social.github) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">GitHub</span><span class="contact-value">${makeLinkClickable(social.github, 'github')}</span></span>`
    );
  }
  if (social.discord) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">Discord</span><span class="contact-value">${makeLinkClickable(social.discord)}</span></span>`
    );
  }
  if (social.class_chat) {
    contactLines.push(
      `<span class="contact-item"><span class="contact-label">Class chat</span><span class="contact-value">${makeLinkClickable(social.class_chat, 'class_chat')}</span></span>`
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

  let activityClass = null;
  if (activity?.kind === 'active') {
    activityClass = 'status-pill-active';
  } else if (activity?.kind === 'recent') {
    activityClass = 'status-pill-recent';
  } else if (activity?.kind === 'inactive') {
    activityClass = 'status-pill-inactive';
  } else if (activity) {
    activityClass = 'status-pill-unknown';
  }

  const fullName = user.name || 'Unnamed';
  const preferredName = user.preferred_name && user.preferred_name !== fullName ? user.preferred_name : null;
  const initials = getInitials(fullName || preferredName);
  const pendingAvatar = state.pendingAvatars?.[user.id];
  const avatarSrc = pendingAvatar?.previewUrl || user.avatar_url || user.image_url;
  const hasAvatar = !!avatarSrc;

  const avatarHtml = hasAvatar
    ? `<img class="person-avatar-img" src="${avatarSrc}" alt="${fullName || 'Avatar'}" />`
    : `<span>${initials}</span>`;

  const contactButtonHtml = user.email
    ? `<a
         class="btn btn-ghost person-contact-btn"
         href="mailto:${encodeURIComponent(user.email)}"
       >
         Contact
       </a>`
    : '';

  // Non-edit view detail rows (avoid nested ternaries in templates)
  const contactDetailRows = [];
  if (user.phone_number) {
    contactDetailRows.push(
      `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value"><a href="tel:${user.phone_number.replaceAll(/\D/g, '')}" class="clickable-link">${user.phone_number}</a></span></div>`
    );
  }
  if (user.github_username) {
    contactDetailRows.push(
      `<div class="detail-row"><span class="detail-label">GitHub</span><span class="detail-value">${makeLinkClickable(user.github_username, 'github')}</span></div>`
    );
  }
  if (user.linkedin_url) {
    contactDetailRows.push(
      `<div class="detail-row"><span class="detail-label">LinkedIn</span><span class="detail-value">${makeLinkClickable(user.linkedin_url, 'linkedin')}</span></div>`
    );
  }
  if (user.class_chat) {
    contactDetailRows.push(
      `<div class="detail-row"><span class="detail-label">Class Chat</span><span class="detail-value">${makeLinkClickable(user.class_chat, 'class_chat')}</span></div>`
    );
  }
  if (user.slack_handle) {
    contactDetailRows.push(
      `<div class="detail-row"><span class="detail-label">Slack</span><span class="detail-value">${makeLinkClickable(user.slack_handle, 'slack')}</span></div>`
    );
  }
  const contactDetailHtml = contactDetailRows.join('');

  const backgroundDetailRows = [];
  if (user.pronunciation) {
    backgroundDetailRows.push(`<div class="detail-row"><span class="detail-label">Pronunciation</span><span class="detail-value">${user.pronunciation}</span></div>`);
  }
  if (user.department) {
    backgroundDetailRows.push(`<div class="detail-row"><span class="detail-label">Department</span><span class="detail-value">${user.department}</span></div>`);
  }
  if (user.major) {
    backgroundDetailRows.push(`<div class="detail-row"><span class="detail-label">Major</span><span class="detail-value">${user.major}</span></div>`);
  }
  if (user.degree_program) {
    backgroundDetailRows.push(`<div class="detail-row"><span class="detail-label">Degree</span><span class="detail-value">${user.degree_program}</span></div>`);
  }
  if (user.academic_year) {
    backgroundDetailRows.push(`<div class="detail-row"><span class="detail-label">Year</span><span class="detail-value">${user.academic_year}</span></div>`);
  }
  const backgroundDetailHtml = backgroundDetailRows.join('');

  const renderFooterControls = () => {
    const activityHtml = activity
      ? `<span class="status-pill ${activityClass}">${activity.label}</span>`
      : '';

    if (isEditing) {
      return `
        ${activityHtml}
        ${contactButtonHtml}
        <button
          type="submit"
          class="btn btn-primary person-edit-save"
          data-user-id="${user.id || ''}"
          form="${formId}"
        >
          Save
        </button>
        <button
          type="button"
          class="btn btn-ghost person-edit-cancel"
          data-user-id="${user.id || ''}"
        >
          Cancel
        </button>
      `;
    }

    const selfEditButton = isSelf
      ? `<button
            type="button"
            class="btn btn-ghost person-edit-btn"
            data-user-id="${user.id || ''}"
          >
            Edit
          </button>`
      : '';

    return `
      ${activityHtml}
      ${contactButtonHtml}
      <button
        type="button"
        class="btn btn-ghost profile-toggle"
        data-profile-label="View details"
      >
        View details
      </button>
      ${selfEditButton}
    `;
  };

  const renderInput = (name, label, value = '', type = 'text', placeholder = '') => `
    <label class="edit-field">
      <span class="edit-label">${label}</span>
      <input type="${type}" name="${name}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;

  const renderTextarea = (name, label, value = '', placeholder = '') => `
    <label class="edit-field">
      <span class="edit-label">${label}</span>
      <textarea name="${name}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value ?? '')}</textarea>
    </label>
  `;

  const availabilityGeneralVal = availabilityGeneral || user.availability_general || '';
  const availabilitySpecificVal = availabilitySpecific || user.availability_specific || '';
  const generateSafeId = () => {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      }
    }
    // As a last resort, fall back to a timestamp string (avoids Math.random)
    return `ts-${Date.now().toString(36)}`;
  };

  const formId = user.id ? `edit-${user.id}` : `edit-${generateSafeId()}`;

  return `
    <article class="${cardClasses.join(' ')}" data-user-id="${user.id || ''}">
      <section class="person-identity">
        <div class="person-avatar ${isEditing && canUploadAvatar ? 'avatar-editable' : ''}">
          ${avatarHtml}
          ${
            isEditing && canUploadAvatar
              ? `
            <button
              type="button"
              class="avatar-edit-trigger"
              aria-label="Change photo"
              data-user-id="${user.id || ''}"
            >
              <span class="avatar-edit-icon" aria-hidden="true">✎</span>
            </button>
            <input
              type="file"
              accept="image/*"
              class="avatar-file-input"
              data-user-id="${user.id || ''}"
              hidden
            />
          `
              : ''
          }
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
          ${user.email ? `<p class="person-email">${makeLinkClickable(user.email, 'email')}</p>` : ''}
          ${isEditing ? `<p class="edit-hint">Editing your card</p>` : ''}
        </header>
      </section>

      <section class="person-info">
        ${
          isEditing
            ? `<form class="person-edit-form" data-user-id="${user.id || ''}" id="${formId}">
          <div class="${infoGridClasses.join(' ')}">
            <div class="info-section">
              <h4>Contact</h4>
              <div class="info-body edit-body">
                ${renderInput('preferred_name', 'Preferred name', user.preferred_name || '')}
                ${renderInput('phone_number', 'Phone', user.phone_number || '', 'text', '+1-555-555-5555')}
                ${renderInput('github_username', 'GitHub', user.github_username || '', 'text', '@username')}
                ${renderInput('linkedin_url', 'LinkedIn', user.linkedin_url || '', 'text', 'https://linkedin.com/in/...')}
                ${renderInput('class_chat', 'Class Chat', user.class_chat || '', 'text', '@handle or #channel')}
                ${renderInput('slack_handle', 'Slack', user.slack_handle || '', 'text', '@handle')}
              </div>
            </div>
            ${
              showAvailability
                ? `<div class="info-section">
              <h4>Availability</h4>
              <div class="info-body edit-body">
                ${renderTextarea('availability_general', 'General', availabilityGeneralVal, 'Office hours, time windows...')}
                ${renderTextarea('availability_specific', 'Specific (JSON or text)', availabilitySpecificVal, 'Structured availability or details')}
              </div>
            </div>`
                : ''
            }
            <div class="info-section">
              <h4>Background</h4>
              <div class="info-body edit-body">
                ${renderInput('pronunciation', 'Pronunciation', user.pronunciation || '')}
                ${renderInput('department', 'Department', user.department || '')}
                ${renderInput('major', 'Major', user.major || '')}
                ${renderInput('degree_program', 'Degree', user.degree_program || '')}
                ${renderInput('academic_year', 'Year', user.academic_year || '', 'number')}
              </div>
            </div>
          </div>
        </form>`
            : `<div class="${infoGridClasses.join(' ')}">
            <div class="info-section">
              <h4>Contact</h4>
              <div class="info-body contact-body">
                ${contactHtml}
                ${contactDetailHtml}
              </div>
            </div>
            ${
              showAvailability
                ? `<div class="info-section">
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
            </div>`
                : ''
            }
            <div class="info-section">
              <h4>Background</h4>
              <div class="info-body">
                ${backgroundDetailHtml}
              </div>
            </div>
          </div>`
        }
      </section>

      <section class="person-actions">
        <div class="person-tags">
          ${
            tags.length
              ? tags.join('')
              : '<span class="tag tag-faded">No extra tags</span>'
          }
        </div>
        <div class="person-footer">${renderFooterControls()}</div>
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

const initAvatarSelectionForGrid = (gridEl) => {
  if (!gridEl) return;

  const triggers = gridEl.querySelectorAll('.avatar-edit-trigger');
  triggers.forEach((btn) => {
    const userId = btn.dataset.userId;
    if (!userId) return;

    const input = gridEl.querySelector(
      `.avatar-file-input[data-user-id="${userId}"]`
    );
    if (!input) return;

    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      // Revoke previous preview for this user
      clearPendingAvatar(userId);

      const previewUrl = URL.createObjectURL(file);
      state.pendingAvatars[userId] = { file, previewUrl };
      rerenderPeopleGrids();
    });
  });
};

const initEditHandlersForGrid = (gridEl) => {
  if (!gridEl) return;

  gridEl.querySelectorAll('.person-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      if (!userId) return;
      state.editingUserId = userId;
      rerenderPeopleGrids();
    });
  });

  gridEl.querySelectorAll('.person-edit-cancel').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      if (userId) {
        clearPendingAvatar(userId);
      }
      state.editingUserId = null;
      rerenderPeopleGrids();
    });
  });

  gridEl.querySelectorAll('.person-edit-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const userId = form.dataset.userId;
      if (!userId) return;

      const formData = new FormData(form);
      const payload = {};
      const setField = (name, transform) => {
        if (!formData.has(name)) return;
        const raw = formData.get(name);
        if (raw === null) return;
        const val = typeof raw === 'string' ? raw.trim() : raw;
        if (val === '') {
          payload[name] = null;
          return;
        }
        payload[name] = transform ? transform(val) : val;
      };

      try {
        setField('preferred_name');
        setField('phone_number');
        setField('github_username');
        setField('linkedin_url');
        setField('class_chat');
        setField('slack_handle');
        setField('availability_general');
        setField('availability_specific');
        setField('pronunciation');
        setField('department');
        setField('major');
        setField('degree_program');
        setField('academic_year', (v) => {
          const num = Number(v);
          if (!Number.isInteger(num)) {
            throw new TypeError('Academic year must be an integer');
          }
          return num;
        });
      } catch (err) {
        alert(err.message || 'Invalid input');
        return;
      }

      const pendingAvatar = state.pendingAvatars?.[userId];
      const needsAvatarUpload = !!pendingAvatar?.file;

      if (Object.keys(payload).length === 0 && !needsAvatarUpload) {
        alert('No changes to save');
        return;
      }

      try {
        let avatarUrl = null;
        if (needsAvatarUpload) {
          const result = await api.uploadAvatar(userId, pendingAvatar.file);
          avatarUrl = result.avatar_url;
        }

        let updated = null;
        if (Object.keys(payload).length > 0) {
          updated = await api.updateUserCard(userId, payload);
        }

        const updates = {};
        if (avatarUrl) {
          updates.avatar_url = avatarUrl;
          updates.image_url = avatarUrl;
        }
        if (updated) {
          Object.assign(updates, updated);
        }
        if (Object.keys(updates).length > 0) {
          updateUserInCollections(userId, updates);
        }
        clearPendingAvatar(userId);
        state.editingUserId = null;
        rerenderPeopleGrids();
      } catch (err) {
        console.error('Failed to update user card:', err);
        alert(err.message || 'Failed to update your card');
      }
    });
  });
};

// ---------- Rendering: Teams / Groups ----------

const renderTeamCard = (team) => {
  const members = Array.isArray(team.members)
    ? team.members.filter((m) => m && m.name)
    : [];

  const leaderId = (team.leader_ids && team.leader_ids.length > 0) ? team.leader_ids[0] : (team.leaders && team.leaders.length > 0 ? team.leaders[0]?.id : null);
  const leaders = team.leaders || (team.leader_ids && team.leader_ids.length > 0 ? [{ id: team.leader_ids[0] }] : []);
  const leader = leaders.length > 0 ? leaders[0] : null;

  // Format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return null;
    }
  };

  // Member list without emails (exclude leader since they're shown separately)
  const membersExcludingLeader = members.filter(m => {
    const isLeader = m.id === leaderId || m.role === 'leader';
    return !isLeader;
  });

  const memberListHtml = membersExcludingLeader.length
    ? `
      <div class="team-members-list">
        <div class="team-members-bubbles">
          ${membersExcludingLeader
            .map(m => `<span class="member-bubble">${m.name}</span>`)
            .join('')}
        </div>
      </div>
    `
    : `<p class="group-members-empty">No other members assigned yet.</p>`;


  const formedDate = formatDate(team.formed_at);

  // Parse links JSON if it's a string
  let links = team.links;
  if (typeof links === 'string') {
    try {
      links = JSON.parse(links);
    } catch {
      links = {};
    }
  }
  if (!links || typeof links !== 'object') {
    links = {};
  }

  // Logo display
  const logoHtml = team.logo_url
    ? `<img src="${team.logo_url}" alt="${team.name} logo" class="team-logo-img" />`
    : `<span>${getInitials(team.name)}</span>`;

  // Links HTML (only Slack and Repo) - make them actually clickable
  const linksHtml = [];
  if (links.slack) {
    const slackUrl = links.slack.startsWith('http') ? links.slack : `https://${links.slack}`;
    linksHtml.push(`<a href="${slackUrl}" class="team-link team-link-slack" target="_blank" rel="noopener noreferrer">Slack</a>`);
  }
  if (links.repo) {
    const repoUrl = links.repo.startsWith('http') ? links.repo : `https://${links.repo}`;
    linksHtml.push(`<a href="${repoUrl}" class="team-link team-link-repo" target="_blank" rel="noopener noreferrer">GitHub</a>`);
  }

  return `
    <article class="group-card team-card" data-team-id="${team.id}">
      <header class="group-header">
        <div class="group-logo">${logoHtml}</div>
        <div class="group-header-text">
          <h4 class="group-name">${team.name || 'Unnamed Team'}</h4>
          ${team.mantra ? `<p class="team-mantra">"${team.mantra}"</p>` : ''}
        </div>
      </header>

      ${team.mantra ? `
      <section class="team-mantra-section">
        <p class="team-mantra-text">"${team.mantra}"</p>
      </section>
      ` : ''}

      ${leader?.name ? `
      <section class="team-info-section">
        <h5 class="team-section-label">Team Leader</h5>
        <div class="team-leader-info">
          <div class="team-leader-name">${leader.name}</div>
        </div>
      </section>
      ` : ''}

      <section class="team-info-section">
        <h5 class="team-section-label">Members</h5>
        ${memberListHtml}
      </section>

      ${linksHtml.length > 0 ? `
      <section class="team-info-section">
        <h5 class="team-section-label">Links</h5>
        <div class="team-links">
          ${linksHtml.join('')}
        </div>
      </section>
      ` : ''}

      ${formedDate ? `
      <section class="team-info-section">
        <div class="team-date-info">
          <span class="team-date-label">Formed:</span>
          <span class="team-date-value">${formedDate}</span>
        </div>
      </section>
      ` : ''}
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
  initAvatarSelectionForGrid(grid);
  initEditHandlersForGrid(grid);
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
  initAvatarSelectionForGrid(grid);
  initEditHandlersForGrid(grid);
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
  initAvatarSelectionForGrid(grid);
  initEditHandlersForGrid(grid);
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
        canUploadAvatar: canCurrentUserEditAvatar(student),
        showAvailability: false
      })
    )
    .join('');

  initProfileTogglesForGrid(grid);
  initAvatarSelectionForGrid(grid);
  initEditHandlersForGrid(grid);
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
    const id = section.id.replaceAll('-section', '');
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

  if (elements.teamSearch) {
    elements.teamSearch.addEventListener('input', (e) => {
      state.filters.teams.search = e.target.value || '';
      renderTeamsGrid();
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
