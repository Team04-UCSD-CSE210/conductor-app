// Class Directory JavaScript

const state = {
  offeringId: null,
  currentUserId: null,
  professors: [],
  tas: [],
  tutors: [],
  students: [],
  groups: [],
  currentTab: 'professors',
  currentUserRole: 'student',
  filters: {
    professors: { search: '' },
    tas: { search: '' },
    tutors: { search: '' },
    students: { search: '', group: 'all' },
    groups: { search: '' }
  }
};

let elements = {};

const initializeElements = () => {
  elements = {
    tabBtns: document.querySelectorAll('.tab-btn'),
    sections: document.querySelectorAll('.directory-section'),
    
    // Grids
    professorsGrid: document.getElementById('professors-grid'),
    tasGrid: document.getElementById('tas-grid'),
    tutorsGrid: document.getElementById('tutors-grid'),
    studentsGrid: document.getElementById('students-grid'),
    groupsGrid: document.getElementById('groups-grid'),
    
    // Search inputs
    profSearch: document.getElementById('prof-search'),
    taSearch: document.getElementById('ta-search'),
    tutorSearch: document.getElementById('tutor-search'),
    studentSearch: document.getElementById('student-search'),
    groupSearch: document.getElementById('group-search'),
    
    // Filters
    studentGroup: document.getElementById('student-group'),
    
    // Modals
    toastContainer: document.getElementById('toastContainer')
  };
};

// API Functions
const api = {
  async getActiveOffering() {
    const response = await fetch('/api/offerings/active', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch active offering');
    return response.json();
  },

  async getClassDirectory(offeringId) {
    const response = await fetch(`/api/class-directory?offering_id=${offeringId}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch class directory');
    return response.json();
  },

  async getUserActivity(userId, days = 30) {
    const response = await fetch(`/api/class-directory/users/${userId}/activity?days=${days}`, { credentials: 'include' });
    if (!response.ok) return { activity: [], attendance: {} };
    return response.json();
  },

  async getMyProfile() {
    const response = await fetch('/api/class-directory/my-profile', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
  },

  async updateProfile(profileData) {
    const response = await fetch('/api/class-directory/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profileData)
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
  }
};

// Utility Functions
const getInitials = (name) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Render Functions
const renderPersonCard = (person, type) => {
  const isActive = person.last_activity && 
    new Date(person.last_activity) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const displayName = person.preferred_name || person.name;
  const profileImage = person.profile_picture ? 
    `<img src="${person.profile_picture}" alt="${displayName}" class="person-photo">` :
    `<div class="person-avatar">${getInitials(displayName)}</div>`;
  
  // Check if this is current user's card
  const isCurrentUser = state.currentUserId === person.id;
  
  return `
    <div class="person-card" data-person-id="${person.id}" data-type="${type}">
      <div class="person-header">
        ${profileImage}
        <div class="person-info">
          <h4 class="person-name">${displayName}</h4>
          ${person.pronouns ? `<div class="person-pronouns">(${person.pronouns})</div>` : ''}
          <div class="person-status">
            <div class="status-indicator ${isActive ? 'active' : 'inactive'}"></div>
            <span>${isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        ${isCurrentUser ? '<button class="edit-profile-btn" onclick="openProfileModal()">Edit</button>' : ''}
      </div>
      <div class="person-contact">
        <div class="contact-item">
          <span class="contact-label">Email:</span>
          <a href="mailto:${person.email}" class="contact-value">${person.email}</a>
        </div>
        ${person.phone ? `
          <div class="contact-item">
            <span class="contact-label">Phone:</span>
            <a href="tel:${person.phone}" class="contact-value">${person.phone}</a>
          </div>
        ` : ''}
        ${person.availability ? `
          <div class="contact-item">
            <span class="contact-label">Available:</span>
            <span class="contact-value">${person.availability}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

const renderGroupCard = (group) => {
  return `
    <div class="group-card" data-group-id="${group.id}">
      <div class="group-header">
        <div class="group-logo">${getInitials(group.name)}</div>
        <div class="group-info">
          <h4>${group.name}</h4>
          ${group.mantra ? `<div class="group-mantra">"${group.mantra}"</div>` : ''}
        </div>
      </div>
      <div class="group-stats">
        <div class="stat-item">
          <div class="stat-value">${group.member_count || 0}</div>
          <div class="stat-label">Members</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${group.links?.length || 0}</div>
          <div class="stat-label">Links</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${group.status || 'Active'}</div>
          <div class="stat-label">Status</div>
        </div>
      </div>
    </div>
  `;
};

// Filter Functions
const filterPeople = (people, filters) => {
  return people.filter(person => {
    const matchesSearch = !filters.search || 
      person.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      person.email.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesActivity = !filters.activity || filters.activity === 'all' ||
      (filters.activity === 'active' && person.last_activity && 
       new Date(person.last_activity) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filters.activity === 'inactive' && (!person.last_activity || 
       new Date(person.last_activity) <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    
    const matchesGroup = !filters.group || filters.group === 'all' ||
      person.team_id === filters.group;
    
    return matchesSearch && matchesActivity && matchesGroup;
  });
};

const filterGroups = (groups, filters) => {
  return groups.filter(group => {
    return !filters.search || 
      group.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      (group.mantra && group.mantra.toLowerCase().includes(filters.search.toLowerCase()));
  });
};

// Render Grid Functions
const renderProfessorsGrid = () => {
  const filtered = filterPeople(state.professors, state.filters.professors);
  
  if (filtered.length === 0) {
    elements.professorsGrid.innerHTML = '<div class="empty-state">No professors found</div>';
    return;
  }
  
  elements.professorsGrid.innerHTML = filtered.map(prof => renderPersonCard(prof, 'professor')).join('');
};

const renderTAsGrid = () => {
  const filtered = filterPeople(state.tas, state.filters.tas);
  
  if (filtered.length === 0) {
    elements.tasGrid.innerHTML = '<div class="empty-state">No TAs found</div>';
    return;
  }
  
  elements.tasGrid.innerHTML = filtered.map(ta => renderPersonCard(ta, 'ta')).join('');
};

const renderTutorsGrid = () => {
  const filtered = filterPeople(state.tutors, state.filters.tutors);
  
  if (filtered.length === 0) {
    elements.tutorsGrid.innerHTML = '<div class="empty-state">No tutors found</div>';
    return;
  }
  
  elements.tutorsGrid.innerHTML = filtered.map(tutor => renderPersonCard(tutor, 'tutor')).join('');
};

const renderStudentsGrid = () => {
  const filtered = filterPeople(state.students, state.filters.students);
  
  if (filtered.length === 0) {
    elements.studentsGrid.innerHTML = '<div class="empty-state">No students found</div>';
    return;
  }
  
  elements.studentsGrid.innerHTML = filtered.map(student => renderPersonCard(student, 'student')).join('');
};

const renderGroupsGrid = () => {
  const filtered = filterGroups(state.groups, state.filters.groups);
  
  if (filtered.length === 0) {
    elements.groupsGrid.innerHTML = '<div class="empty-state">No groups found</div>';
    return;
  }
  
  elements.groupsGrid.innerHTML = filtered.map(group => renderGroupCard(group)).join('');
};

// Event Handlers
const handleTabClick = (tabName) => {
  state.currentTab = tabName;
  
  // Update tab buttons
  elements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update sections
  elements.sections.forEach(section => {
    section.classList.toggle('active', section.id === `${tabName}-section`);
  });
};

const setupEventListeners = () => {
  // Tab navigation
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => handleTabClick(btn.dataset.tab));
  });
  
  // Search inputs
  elements.profSearch.addEventListener('input', (e) => {
    state.filters.professors.search = e.target.value;
    renderProfessorsGrid();
  });
  
  elements.taSearch.addEventListener('input', (e) => {
    state.filters.tas.search = e.target.value;
    renderTAsGrid();
  });
  
  if (elements.tutorSearch) {
    elements.tutorSearch.addEventListener('input', (e) => {
      state.filters.tutors.search = e.target.value;
      renderTutorsGrid();
    });
  }
  
  elements.studentSearch.addEventListener('input', (e) => {
    state.filters.students.search = e.target.value;
    renderStudentsGrid();
  });
  
  elements.groupSearch.addEventListener('input', (e) => {
    state.filters.groups.search = e.target.value;
    renderGroupsGrid();
  });
  
  // Filter dropdowns
  if (elements.studentGroup) {
    elements.studentGroup.addEventListener('change', (e) => {
      state.filters.students.group = e.target.value;
      renderStudentsGrid();
    });
  }
};

// Initialize
const loadData = async () => {
  try {
    // Get active offering
    const offering = await api.getActiveOffering();
    state.offeringId = offering.id;
    
    // Get class directory data
    const directoryData = await api.getClassDirectory(offering.id);
    
    console.log('Directory data received:', directoryData); // Debug log
    console.log('Current user role:', directoryData.current_user_role); // Debug log
    
    state.professors = directoryData.professors || [];
    state.tas = directoryData.tas || [];
    state.tutors = directoryData.tutors || [];
    state.students = directoryData.students || [];
    state.groups = directoryData.groups || [];
    state.currentUserRole = directoryData.current_user_role || 'student';

    console.log('Professors:', state.professors.length); // Debug log
    console.log('TAs:', state.tas.length); // Debug log
    console.log('Tutors:', state.tutors.length); // Debug log

    // Hide students tab for students
    console.log('Hiding students tab for role:', state.currentUserRole); // Debug log
    if (state.currentUserRole === 'student') {
      const studentsTab = document.querySelector('[data-tab="students"]');
      const studentsSection = document.getElementById('students-section');
      console.log('Students tab element:', studentsTab); // Debug log
      console.log('Students section element:', studentsSection); // Debug log
      if (studentsTab) {
        studentsTab.style.display = 'none';
        console.log('Hidden students tab'); // Debug log
      }
      if (studentsSection) {
        studentsSection.style.display = 'none';
        console.log('Hidden students section'); // Debug log
      }
    }
    
    // Populate group filter for students
    const groupOptions = state.groups.map(group => 
      `<option value="${group.id}">${group.name}</option>`
    ).join('');
    elements.studentGroup.innerHTML = '<option value="all">All Groups</option>' + groupOptions;
    
    // Render initial data
    renderProfessorsGrid();
    renderTAsGrid();
    renderTutorsGrid();
    if (state.currentUserRole !== 'student') {
      renderStudentsGrid();
    }
    renderGroupsGrid();
    
  } catch (error) {
    console.error('Failed to load class directory data:', error);
    // Show error in professors grid since that's the default tab
    if (elements.professorsGrid) {
      elements.professorsGrid.innerHTML = '<div class="empty-state">Error loading data</div>';
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
  loadData();
});

// Profile Modal Functions
window.openProfileModal = async () => {
  try {
    const profile = await api.getMyProfile();
    state.currentUserId = profile.id;
    
    document.getElementById('preferredName').value = profile.preferred_name || '';
    document.getElementById('phone').value = profile.phone || '';
    document.getElementById('pronouns').value = profile.pronouns || '';
    document.getElementById('availability').value = profile.availability || '';
    document.getElementById('profilePicture').value = profile.profile_picture || '';
    
    document.getElementById('profileModal').style.display = 'block';
  } catch (error) {
    showToast('Failed to load profile', 'error');
  }
};

window.closeProfileModal = () => {
  document.getElementById('profileModal').style.display = 'none';
};

// Profile form submission
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const profileData = {
    preferred_name: formData.get('preferred_name'),
    phone: formData.get('phone'),
    pronouns: formData.get('pronouns'),
    availability: formData.get('availability'),
    profile_picture: formData.get('profile_picture'),
    social_links: {}
  };
  
  try {
    await api.updateProfile(profileData);
    showToast('Profile updated successfully!', 'success');
    closeProfileModal();
    loadData(); // Reload to show changes
  } catch (error) {
    showToast('Failed to update profile', 'error');
  }
});
