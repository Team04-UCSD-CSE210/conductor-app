
const studentDirectoryApi = {
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

const studentGetInitialsSafe = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const renderStudentViewPersonCard = (person, roleLabel) => {
  const fullName = person.name || person.preferred_name;
  const initials = studentGetInitialsSafe(fullName);
  const email = person.email || '';

  return `
    <article class="person-card">
      <section class="person-identity">
        <span class="person-avatar" aria-hidden="true">${initials}</span>
        <header>
          <h3 class="person-name">${fullName || 'Unnamed'}</h3>
          <p class="person-role">${roleLabel}</p>
        </header>
      </section>

      <section class="person-info">
        ${email ? `<p>Email: ${email}</p>` : ''}
      </section>
    </article>
  `;
};

const renderStudentViewTeamCard = (team) => {
  const initials = studentGetInitialsSafe(team.name);
  const memberCount = team.member_count || 0;

  return `
    <article class="person-card">
      <section class="person-identity">
        <span class="person-avatar" aria-hidden="true">${initials}</span>
        <header>
          <h3 class="person-name">${team.name}</h3>
          <p class="person-role">Project team</p>
        </header>
      </section>

      <section class="person-info">
        <p>Members: ${memberCount} students</p>
      </section>
    </article>
  `;
};

const populateStudentDirectoryFromApi = async () => {
  try {
    const headerTitle = document.querySelector('.page-header-title');
    const courseLabel = document.querySelector('.course-card-label');
    const courseName = document.querySelector('.course-card-name');

    const { id: offeringId, code, name } = await studentDirectoryApi.getActiveOffering();
    const directory = await studentDirectoryApi.getClassDirectory(offeringId);

    // Update header/course display
    if (headerTitle && name) headerTitle.textContent = name;
    if (courseName && name) courseName.textContent = name;
    if (courseLabel && code) courseLabel.textContent = code;

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

    if (profList) {
      const profs = directory.professors || [];
      profList.innerHTML =
        profs.length === 0
          ? '<p>No professors found.</p>'
          : profs
              .map((p) => renderStudentViewPersonCard(p, 'Professor · Lecture lead'))
              .join('');
    }

    if (taList) {
      const tas = directory.tas || [];
      taList.innerHTML =
        tas.length === 0
          ? '<p>No TAs found.</p>'
          : tas
              .map((p) => renderStudentViewPersonCard(p, 'Teaching Assistant'))
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
                .map((p) => renderStudentViewPersonCard(p, 'Tutor'))
                .join('');
      }

      if (studentList) {
        studentList.innerHTML =
          regularStudents.length === 0
            ? '<p>No students found.</p>'
            : regularStudents
                .map((p) =>
                  renderStudentViewPersonCard(
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
          : teams.map((t) => renderStudentViewTeamCard(t)).join('');
    }
  } catch (err) {
    console.error('Failed to populate student directory from API:', err);
  }
};

const setupStudentRoleTabs = () => {
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
  setupStudentRoleTabs();
  populateStudentDirectoryFromApi();
});


