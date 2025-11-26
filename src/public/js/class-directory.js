// Class Directory JavaScript

const state = {
  offeringId: null,
  professors: [],
  tas: [],
  students: [],
  groups: [],
  currentTab: 'professors',
  filters: {
    professors: { search: '' },
    tas: { search: '', activity: 'all' },
    students: { search: '', group: 'all', activity: 'all' },
    groups: { search: '' }
  }
};

let elements = {};

const initializeElements = () => {
  elements = {
    activeOfferingName: document.getElementById('activeOfferingName'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    sections: document.querySelectorAll('.directory-section'),
    
    // Grids
    professorsGrid: document.getElementById('professors-grid'),
    tasGrid: document.getElementById('tas-grid'),
    studentsGrid: document.getElementById('students-grid'),
    groupsGrid: document.getElementById('groups-grid'),
    
    // Search inputs
    profSearch: document.getElementById('prof-search'),
    taSearch: document.getElementById('ta-search'),
    studentSearch: document.getElementById('student-search'),
    groupSearch: document.getElementById('group-search'),
    
    // Filters
    taActivity: document.getElementById('ta-activity'),
    studentGroup: document.getElementById('student-group'),
    studentActivity: document.getElementById('student-activity'),
    
    // Modals
    toastContainer: document.getElementById('toastContainer')
  };
};

// API Functions
const api = {
  async getActiveOffering() {
    const response = await fetch('/api/offerings/active');
    if (!response.ok) throw new Error('Failed to fetch active offering');
    return response.json();
  },

  async getClassDirectory(offeringId) {
    const response = await fetch(`/api/class-directory?offering_id=${offeringId}`);
    if (!response.ok) throw new Error('Failed to fetch class directory');
    return response.json();
  },

  async getUserActivity(userId, days = 30) {
    const response = await fetch(`/api/class-directory/users/${userId}/activity?days=${days}`);
    if (!response.ok) return { activity: [], attendance: {} };
    return response.json();
  }
};

// Utility Functions
const getInitials = (name) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const formatAvailability = (availability) => {
  if (!availability) return 'Not specified';
  if (typeof availability === 'string') return availability;
  return Object.entries(availability)
    .map(([day, hours]) => `${day}: ${hours}`)
    .join(', ');
};

const generateActivityChart = (activity) => {
  const days = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayActivity = activity.find(a => a.date === dateStr);
    const level = dayActivity ? Math.min(Math.floor(dayActivity.count / 5), 4) : 0;
    
    days.push(`<div class="activity-day level-${level}" title="${dateStr}: ${dayActivity?.count || 0} activities"></div>`);
  }
  
  return days.join('');
};

// Render Functions
const renderPersonCard = (person, type) => {
  const isActive = person.last_activity && 
    new Date(person.last_activity) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return `
    <div class="person-card" data-person-id="${person.id}" data-type="${type}">
      <div class="person-header">
        <div class="person-avatar">${getInitials(person.name)}</div>
        <div class="person-info">
          <h4>${person.name}</h4>
          <div class="person-role">${person.course_role || person.primary_role}</div>
          ${person.pronouns ? `<div class="person-pronouns">${person.pronouns}</div>` : ''}
        </div>
      </div>
      <div class="person-details">
        <div class="detail-item">
          <span class="detail-label">Email:</span>
          <span class="detail-value">${person.email}</span>
        </div>
        ${person.phone ? `
          <div class="detail-item">
            <span class="detail-label">Phone:</span>
            <span class="detail-value">${person.phone}</span>
          </div>
        ` : ''}
        <div class="detail-item">
          <span class="detail-label">Status:</span>
          <div class="activity-indicator">
            <div class="activity-dot ${isActive ? 'active' : 'inactive'}"></div>
            <span class="detail-value">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
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
  
  elements.studentSearch.addEventListener('input', (e) => {
    state.filters.students.search = e.target.value;
    renderStudentsGrid();
  });
  
  elements.groupSearch.addEventListener('input', (e) => {
    state.filters.groups.search = e.target.value;
    renderGroupsGrid();
  });
  
  // Filter dropdowns
  elements.taActivity.addEventListener('change', (e) => {
    state.filters.tas.activity = e.target.value;
    renderTAsGrid();
  });
  
  elements.studentGroup.addEventListener('change', (e) => {
    state.filters.students.group = e.target.value;
    renderStudentsGrid();
  });
  
  elements.studentActivity.addEventListener('change', (e) => {
    state.filters.students.activity = e.target.value;
    renderStudentsGrid();
  });
};

// Initialize
const loadData = async () => {
  try {
    // Get active offering
    const offering = await api.getActiveOffering();
    state.offeringId = offering.id;
    elements.activeOfferingName.textContent = `${offering.code} - ${offering.name}`;
    
    // Get class directory data
    const directoryData = await api.getClassDirectory(offering.id);
    
    state.professors = directoryData.professors || [];
    state.tas = directoryData.tas || [];
    state.students = directoryData.students || [];
    state.groups = directoryData.groups || [];
    
    // Populate group filter for students
    const groupOptions = state.groups.map(group => 
      `<option value="${group.id}">${group.name}</option>`
    ).join('');
    elements.studentGroup.innerHTML = '<option value="all">All Groups</option>' + groupOptions;
    
    // Render initial data
    renderProfessorsGrid();
    renderTAsGrid();
    renderStudentsGrid();
    renderGroupsGrid();
    
  } catch (error) {
    console.error('Failed to load class directory data:', error);
    elements.activeOfferingName.textContent = 'Error loading data';
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
  loadData();
});
