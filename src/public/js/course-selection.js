// Course Selection JavaScript

const state = {
  courses: []
};

let elements = {};

const initializeElements = () => {
  elements = {
    coursesGrid: document.getElementById('coursesGrid')
  };
};

// API Functions
const api = {
  async getMyCourses() {
    const response = await fetch('/api/my-courses');
    if (!response.ok) throw new Error('Failed to fetch courses');
    return response.json();
  },

  async selectCourse(offeringId) {
    const response = await fetch('/api/select-course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offering_id: offeringId })
    });
    if (!response.ok) throw new Error('Failed to select course');
    return response.json();
  }
};

// Render Functions
const renderCourseCard = (course) => {
  const offering = course.offering;
  const isActive = course.status === 'enrolled';
  
  return `
    <div class="course-card ${isActive ? 'active' : ''}" data-offering-id="${offering.id}" data-role="${course.course_role}">
      <div class="course-header">
        <div class="course-code">${offering.code}</div>
        <h3 class="course-name">${offering.name}</h3>
      </div>
      <div class="course-details">
        <div class="detail-row">
          <span class="detail-label">Term:</span>
          <span class="detail-value">${offering.term} ${offering.year}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Role:</span>
          <span class="role-badge role-${course.course_role}">${course.course_role}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="status-badge status-${course.status}">${course.status}</span>
        </div>
        ${offering.department ? `
          <div class="detail-row">
            <span class="detail-label">Department:</span>
            <span class="detail-value">${offering.department}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

const renderCourses = () => {
  if (state.courses.length === 0) {
    elements.coursesGrid.innerHTML = '<div class="empty-state">No courses found</div>';
    return;
  }

  elements.coursesGrid.innerHTML = state.courses.map(course => renderCourseCard(course)).join('');
};

// Event Handlers
const handleCourseClick = async (offeringId, role) => {
  try {
    await api.selectCourse(offeringId);
    
    // Redirect based on role
    const dashboardMap = {
      'instructor': '/instructor-dashboard',
      'ta': '/ta-dashboard',
      'student': '/student-dashboard',
      'tutor': '/tutor-dashboard'
    };
    
    window.location.href = dashboardMap[role] || '/dashboard';
  } catch (error) {
    console.error('Failed to select course:', error);
    alert('Failed to select course. Please try again.');
  }
};

const setupEventListeners = () => {
  // Course card clicks
  document.addEventListener('click', (e) => {
    const courseCard = e.target.closest('.course-card');
    if (courseCard) {
      const offeringId = courseCard.dataset.offeringId;
      const role = courseCard.dataset.role;
      handleCourseClick(offeringId, role);
    }
  });
};

// Initialize
const loadData = async () => {
  try {
    const data = await api.getMyCourses();
    state.courses = data.courses || [];
    renderCourses();
  } catch (error) {
    console.error('Failed to load courses:', error);
    elements.coursesGrid.innerHTML = '<div class="empty-state">Failed to load courses</div>';
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
  loadData();
});
