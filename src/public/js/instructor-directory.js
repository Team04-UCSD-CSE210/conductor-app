
const instructorDirectoryApi = {
  async getActiveOffering() {
    const res = await fetch('/api/offerings/active', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch active offering');
    return res.json();
  },

  async getClassDirectory(offeringId) {
    const res = await fetch(`/api/class-directory?offering_id=${offeringId}`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch class directory');
    return res.json();
  }
};

const getInitialsSafe = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const renderSimplePersonCard = (person, roleLabel) => {
  // Always prefer the full legal name for identification in rows
  const fullName = person.name || person.preferred_name;
  const preferredName = person.preferred_name && person.preferred_name !== fullName
    ? person.preferred_name
    : null;

  const initials = getInitialsSafe(fullName || preferredName);
  const email = person.email || '';
  const phone = person.phone_number || person.phone || '';
  const github = person.github_username;
  const linkedin = person.linkedin_url;
  const department = person.department;
  const major = person.major;
  const degree = person.degree_program;
  const year = person.academic_year;

  return `
    <article class="person-card">
      <section class="person-identity">
        <span class="person-avatar" aria-hidden="true">${initials}</span>
        <header>
          <h3 class="person-name">${fullName || 'Unnamed'}</h3>
          <p class="person-role">${roleLabel}</p>
          ${
            preferredName
              ? `<p class="person-preferred-name">(Preferred: ${preferredName})</p>`
              : ''
          }
          ${email ? `<p class="person-email">${email}</p>` : ''}
        </header>
      </section>

      <section class="person-info">
        ${email ? `<p><strong>Email:</strong> ${email}</p>` : ''}
        ${
          github || linkedin
            ? `<p><strong>Links:</strong> ${
                github ? `GitHub – <strong>@${github}</strong>` : ''
              }${
                github && linkedin ? ' · ' : ''
              }${
                linkedin ? `LinkedIn – <strong>${linkedin}</strong>` : ''
              }</p>`
            : ''
        }
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        ${
          department || major || degree || year
            ? `<p><strong>Background:</strong> ${
                department ? `${department}` : ''
              }${
                department && (major || degree || year) ? ' · ' : ''
              }${
                major ? `${major}` : ''
              }${
                major && degree ? ' – ' : ''
              }${
                degree ? `${degree}` : ''
              }${
                year ? ` · Year ${year}` : ''
              }</p>`
            : ''
        }
      </section>

      <section class="person-actions">
        <button type="button" class="btn btn-secondary">Contact</button>
        <button
          type="button"
          class="btn btn-primary profile-toggle"
          data-profile-label="View profile"
        >
          View profile
        </button>
      </section>
    </article>
  `;
};

const renderSimpleTeamCard = (team) => {
  const initials = getInitialsSafe(team.name);
  const memberCount = team.member_count || 0;
  const members = Array.isArray(team.members) ? team.members : [];

  const leaderId = team.leader_id;

  const membersHtml =
    members.length === 0
      ? '<p>No members assigned yet.</p>'
      : `<ul class="team-member-list">
          ${members
            .map((m) => {
              const isLeader =
                (m.role && String(m.role).toLowerCase().includes('leader')) ||
                (leaderId && m.id === leaderId);
              const name = m.name || 'Unnamed';
              const email = m.email || '';
              return `
                <li class="team-member">
                  <span class="team-member-name">
                    ${name}${isLeader ? ' <span class="team-member-leader">(Leader)</span>' : ''}
                  </span>
                  ${email ? `<span class="team-member-email">${email}</span>` : ''}
                </li>
              `;
            })
            .join('')}
        </ul>`;

  return `
    <article class="person-card">
      <section class="person-identity">
        <span class="person-avatar" aria-hidden="true">${initials}</span>
        <header>
          <h3 class="person-name">${team.name}</h3>
          <p class="person-role">Project team ${team.team_number ? `#${team.team_number}` : ''}</p>
        </header>
      </section>

      <section class="person-info">
        <p><strong>Status:</strong> ${team.status || 'active'}</p>
        <p><strong>Members:</strong> ${memberCount}</p>
        ${membersHtml}
      </section>

      <section class="person-actions">
        <button type="button" class="btn btn-secondary">Slack workspace</button>
        <button
          type="button"
          class="btn btn-primary profile-toggle"
          data-profile-label="View team"
        >
          View more
        </button>
      </section>
    </article>
  `;
};

const populateInstructorDirectoryFromApi = async () => {
  try {
    const headerTitle = document.querySelector('.page-header-title');
    const headerSubtitle = document.querySelector('.page-header-subtitle');
    const courseLabel = document.querySelector('.course-card-label');
    const courseName = document.querySelector('.course-card-name');

    const { id: offeringId, code, name } = await instructorDirectoryApi.getActiveOffering();
    const directory = await instructorDirectoryApi.getClassDirectory(offeringId);

    // Update header/course info
    if (headerTitle && name) headerTitle.textContent = name;
    if (courseName && name) courseName.textContent = name;
    if (courseLabel && code) courseLabel.textContent = code;
    if (headerSubtitle) {
      headerSubtitle.textContent =
        'Detailed contact and availability information for your teaching team and class.';
    }

    // Panels
    const profList = document.querySelector(
      '[data-panel="professors"] .card-list'
    );
    const taList = document.querySelector('[data-panel="tas"] .card-list');
    const tutorList = document.querySelector('[data-panel="tutors"] .card-list');
    const studentList = document.querySelector(
      '[data-panel="students"] .card-list'
    );
    const teamList = document.querySelector('[data-panel="teams"] .card-list');

    // Replace existing static cards with dynamic ones
    if (profList) {
      const profs = directory.professors || [];
      profList.innerHTML =
        profs.length === 0
          ? '<p>No professors found.</p>'
          : profs
              .map((p) => renderSimplePersonCard(p, 'Professor'))
              .join('');
    }

    if (taList) {
      const tas = directory.tas || [];
      taList.innerHTML =
        tas.length === 0
          ? '<p>No TAs found.</p>'
          : tas
              .map((p) => renderSimplePersonCard(p, 'Teaching Assistant'))
              .join('');
    }

    if (tutorList || studentList) {
      const students = directory.students || [];
      const tutors = students.filter(
        (s) => s.course_role === 'tutor'
      );
      const regularStudents = students.filter(
        (s) => s.course_role === 'student'
      );

      if (tutorList) {
        tutorList.innerHTML =
          tutors.length === 0
            ? '<p>No tutors found.</p>'
            : tutors
                .map((p) => renderSimplePersonCard(p, 'Tutor'))
                .join('');
      }

      if (studentList) {
        studentList.innerHTML =
          regularStudents.length === 0
            ? '<p>No students found.</p>'
            : regularStudents
                .map((p) =>
                  renderSimplePersonCard(
                    p,
                    p.team_name ? `Student – ${p.team_name}` : 'Student'
                  )
                )
                .join('');
      }
    }

    if (teamList) {
      const teams = directory.groups || [];
      teamList.innerHTML =
        teams.length === 0
          ? '<p>No project teams found.</p>'
          : teams.map((t) => renderSimpleTeamCard(t)).join('');
    }

    // Attach profile toggle behavior to any profile-toggle buttons
    attachProfileToggles();
  } catch (err) {
    console.error('Failed to populate instructor directory from API:', err);
  }
};

const attachProfileToggles = () => {
  const buttons = document.querySelectorAll('.profile-toggle');

  buttons.forEach((button) => {
    // Prevent double-binding if called multiple times
    if (button.dataset.profileInit === '1') return;
    button.dataset.profileInit = '1';

    const baseLabel = button.dataset.profileLabel || 'View profile';
    const card = button.closest('.person-card');
    if (!card) return;

    // Start collapsed
    card.classList.remove('profile-open');
    button.textContent = baseLabel;

    button.addEventListener('click', () => {
      const isOpen = card.classList.toggle('profile-open');
      button.textContent = isOpen ? 'Hide profile' : baseLabel;
    });
  });
};

const setupRoleTabs = () => {
  const tabs = document.querySelectorAll('.role-tab');
  const panels = document.querySelectorAll('.role-panel');

  if (!tabs.length || !panels.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const role = tab.dataset.role;

      tabs.forEach((t) => {
        t.classList.toggle('role-tab-active', t === tab);
      });

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.panel !== role;
      });
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  setupRoleTabs();
  populateInstructorDirectoryFromApi();
});


