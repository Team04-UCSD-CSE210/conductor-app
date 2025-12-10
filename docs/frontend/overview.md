# Frontend Overview

Comprehensive guide to Conductor's frontend architecture and implementation.

## Architecture Philosophy

Conductor uses a **vanilla JavaScript** approach with **no build tools or frameworks**:

- [OK] **Zero dependencies**: No React, Vue, or Angular
- [OK] **No build step**: Direct browser execution
- [OK] **Fast load times**: Minimal JavaScript payload
- [OK] **Simple debugging**: No source maps needed
- [OK] **Progressive enhancement**: Works without JavaScript for basic features

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Markup | HTML5 | Semantic structure |
| Styling | CSS3 | Visual presentation |
| Scripting | Vanilla ES6+ JavaScript | Interactivity |
| Modules | ES Modules (`import`/`export`) | Code organization |
| API Client | Fetch API | Backend communication |
| State | DOM-based | Component state |

## Project Structure

```
src/public/
├── index.html                    # Landing page
├── login.html                    # Login page
├── admin-dashboard.html          # Admin interface
├── instructor-dashboard.html     # Instructor interface
├── student-dashboard.html        # Student interface
├── ta-dashboard.html            # TA interface
├── tutor-dashboard.html         # Tutor interface
├── team-lead-dashboard.html     # Team leader interface
├── roster.html                  # Roster management
├── class-directory.html         # User directory
├── team-edit.html               # Team editing
├── meeting-attendance-*.html    # Attendance pages
├── css/                         # Stylesheets
│   ├── global.css              # Base styles
│   ├── palette-overrides.css   # Theme system
│   ├── student-dashboard.css   # Role-specific styles
│   ├── instructor-dashboard.css
│   └── ...
└── js/                          # JavaScript modules
    ├── dashboard.service.js    # Shared API service
    ├── student-dashboard.js    # Dashboard logic
    ├── instructor-dashboard.js
    ├── roster.js               # Roster management
    ├── class-directory.js      # Directory features
    ├── inactivity-timeout.js   # Session timeout
    ├── colorblind-mode.js      # Accessibility
    └── ...
```

## Core Patterns

### 1. Module Pattern

**Service Module** (`dashboard.service.js`):
```javascript
(function() {
  'use strict';
  
  const API_BASE = '/api';
  
  // Private function
  async function apiFetch(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  // Public API
  window.DashboardService = {
    async getActiveOffering() {
      return apiFetch('/offerings/active');
    },
    
    async getTeams(offeringId) {
      const response = await apiFetch(`/teams?offering_id=${offeringId}`);
      return response.teams || [];
    }
  };
})();
```

**Usage**:
```javascript
// In student-dashboard.js
const offering = await DashboardService.getActiveOffering();
const teams = await DashboardService.getTeams(offering.id);
```

### 2. Page Initialization

**Standard Pattern**:
```javascript
(function() {
  'use strict';
  
  let offeringId = null;
  let currentUser = null;
  
  async function init() {
    try {
      // Load user info
      currentUser = await loadCurrentUser();
      
      // Load offering
      offeringId = await DashboardService.getActiveOfferingId();
      
      // Render dashboard
      await renderDashboard();
      
      // Setup event listeners
      setupEventListeners();
    } catch (err) {
      console.error('Dashboard initialization failed:', err);
      showError('Failed to load dashboard');
    }
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

### 3. API Communication

**GET Request**:
```javascript
async function loadUsers() {
  try {
    const response = await fetch('/api/users', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.users;
  } catch (err) {
    console.error('Failed to load users:', err);
    showError('Could not load users');
    return [];
  }
}
```

**POST Request**:
```javascript
async function createTodo(title) {
  const response = await fetch('/api/dashboard-todos', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create todo');
  }
  
  return response.json();
}
```

### 4. DOM Manipulation

**Creating Elements**:
```javascript
function createTeamCard(team) {
  const card = document.createElement('div');
  card.className = 'team-card';
  card.innerHTML = `
    <div class="team-header">
      <h3>${escapeHtml(team.name)}</h3>
      <span class="team-number">#${team.team_number}</span>
    </div>
    <div class="team-members">
      ${team.members.map(m => `
        <div class="member">
          <img src="${m.avatar_url || '/images/default-avatar.png'}" alt="${m.name}">
          <span>${escapeHtml(m.name)}</span>
        </div>
      `).join('')}
    </div>
    <div class="team-stats">
      <span>${team.member_count} members</span>
    </div>
  `;
  
  return card;
}

// Render teams
function renderTeams(teams) {
  const container = document.getElementById('teams-container');
  container.innerHTML = ''; // Clear
  
  teams.forEach(team => {
    const card = createTeamCard(team);
    container.appendChild(card);
  });
}
```

**HTML Escaping** (XSS Prevention):
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### 5. Event Handling

**Event Delegation**:
```javascript
function setupEventListeners() {
  // Delegate to parent container
  document.getElementById('todo-list').addEventListener('click', (e) => {
    // Toggle completion
    if (e.target.classList.contains('todo-checkbox')) {
      const todoId = e.target.dataset.id;
      const completed = e.target.checked;
      handleTodoToggle(todoId, completed);
    }
    
    // Delete todo
    if (e.target.classList.contains('delete-btn')) {
      const todoId = e.target.dataset.id;
      handleTodoDelete(todoId);
    }
  });
  
  // Form submission
  document.getElementById('new-todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = e.target.elements.title.value.trim();
    if (title) {
      handleCreateTodo(title);
      e.target.reset();
    }
  });
}
```

## Styling System

### CSS Custom Properties (Theme)

`css/palette-overrides.css`:
```css
:root {
  /* Primary Colors */
  --palette-primary: #0F766E;
  --palette-secondary: #83D7CF;
  --palette-accent: #99F6E4;
  --palette-background: #F0FDFA;
  
  /* Hover States */
  --palette-hover-border: var(--palette-primary);
  --palette-hover-background: var(--palette-background);
  
  /* Gray Scale */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-900: #111827;
}

/* Colorblind Mode Override */
body.colorblind-mode {
  --palette-primary: #0066cc;
  --palette-secondary: #4da6ff;
  --palette-accent: #99ccff;
}
```

**Usage in CSS**:
```css
.btn-primary {
  background-color: var(--palette-primary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: var(--teal-700);
}
```

### Responsive Design

```css
/* Mobile First */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Component Styles

**Card Component**:
```css
.card {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--gray-200);
  padding-bottom: 0.5rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
}
```

## Common Features

### 1. Inactivity Timeout

`js/inactivity-timeout.js`:
```javascript
(function() {
  'use strict';
  
  const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  let timeoutId;
  
  function resetTimer() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(handleTimeout, TIMEOUT_MS);
  }
  
  function handleTimeout() {
    alert('Your session has expired due to inactivity');
    window.location.href = '/logout';
  }
  
  // Reset on user activity
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetTimer, true);
  });
  
  // Start timer
  resetTimer();
})();
```

**Include in HTML**:
```html
<script src="/js/inactivity-timeout.js"></script>
```

### 2. Colorblind Mode

`js/colorblind-mode.js`:
```javascript
(function() {
  'use strict';
  
  const STORAGE_KEY = 'colorblind-mode';
  
  function applyColorblindMode() {
    const enabled = localStorage.getItem(STORAGE_KEY) === 'true';
    document.body.classList.toggle('colorblind-mode', enabled);
  }
  
  function toggleColorblindMode() {
    const currentState = document.body.classList.contains('colorblind-mode');
    const newState = !currentState;
    
    localStorage.setItem(STORAGE_KEY, newState);
    document.body.classList.toggle('colorblind-mode', newState);
  }
  
  // Apply on page load
  applyColorblindMode();
  
  // Expose toggle function
  window.toggleColorblindMode = toggleColorblindMode;
})();
```

**Toggle Button**:
```html
<button onclick="toggleColorblindMode()">
  Toggle Colorblind Mode
</button>
```

### 3. Loading States

```javascript
function showLoadingState(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  `;
}

function hideLoadingState(containerId) {
  const container = document.getElementById(containerId);
  container.querySelector('.loading-spinner')?.remove();
}

async function loadData() {
  showLoadingState('content');
  
  try {
    const data = await fetchData();
    renderData(data);
  } catch (err) {
    showError('Failed to load data');
  } finally {
    hideLoadingState('content');
  }
}
```

**CSS**:
```css
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid var(--gray-200);
  border-top-color: var(--palette-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 4. Toast Notifications

```javascript
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Usage
showToast('User created successfully', 'success');
showToast('Failed to save changes', 'error');
```

**CSS**:
```css
.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(100px);
  opacity: 0;
  transition: all 0.3s;
  z-index: 1000;
}

.toast.show {
  transform: translateY(0);
  opacity: 1;
}

.toast-success { background-color: #10b981; }
.toast-error { background-color: #ef4444; }
.toast-warning { background-color: #f59e0b; }
```

## Dashboard-Specific Features

### Student Dashboard

**Key Features**:
- View team information
- Check in to lectures/meetings
- Submit journal entries
- View course announcements
- Track personal progress

**Main JavaScript**:
```javascript
async function renderStudentDashboard() {
  // Load user's team
  const team = await DashboardService.getMyTeam();
  renderTeamCard(team);
  
  // Load upcoming sessions
  const sessions = await DashboardService.getUpcomingSessions();
  renderSessions(sessions);
  
  // Load announcements
  const announcements = await DashboardService.getAnnouncements(offeringId);
  renderAnnouncements(announcements);
}
```

### Instructor Dashboard

**Key Features**:
- View all teams and students
- Create attendance sessions
- Manage roster
- Submit interaction reports
- View course statistics

**Main JavaScript**:
```javascript
async function renderInstructorDashboard() {
  // Load offering stats
  const offering = await DashboardService.getOfferingWithStats(offeringId);
  renderOfferingStats(offering);
  
  // Load all teams
  const teams = await DashboardService.getTeams(offeringId);
  renderTeamsGrid(teams);
  
  // Load recent interactions
  const interactions = await DashboardService.getInteractions(offeringId);
  renderInteractions(interactions);
}
```

## Performance Optimization

### 1. Lazy Loading

```javascript
// Load images lazily
function setupLazyLoading() {
  const images = document.querySelectorAll('img[data-src]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });
  
  images.forEach(img => observer.observe(img));
}
```

### 2. Debouncing

```javascript
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Usage: Search input
const searchInput = document.getElementById('search');
const debouncedSearch = debounce(async (query) => {
  const results = await searchUsers(query);
  renderSearchResults(results);
}, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

### 3. Virtual Scrolling

For large lists (100+ items):
```javascript
// Only render visible items
function renderVirtualList(items, containerHeight = 600, itemHeight = 80) {
  const container = document.getElementById('list-container');
  const scrollContainer = document.createElement('div');
  scrollContainer.style.height = `${items.length * itemHeight}px`;
  scrollContainer.style.position = 'relative';
  
  let startIndex = 0;
  let endIndex = Math.ceil(containerHeight / itemHeight);
  
  function render() {
    const visibleItems = items.slice(startIndex, endIndex);
    const fragment = document.createDocumentFragment();
    
    visibleItems.forEach((item, i) => {
      const el = createItemElement(item);
      el.style.position = 'absolute';
      el.style.top = `${(startIndex + i) * itemHeight}px`;
      fragment.appendChild(el);
    });
    
    scrollContainer.innerHTML = '';
    scrollContainer.appendChild(fragment);
  }
  
  container.addEventListener('scroll', () => {
    startIndex = Math.floor(container.scrollTop / itemHeight);
    endIndex = startIndex + Math.ceil(containerHeight / itemHeight);
    render();
  });
  
  container.appendChild(scrollContainer);
  render();
}
```

## Accessibility

### ARIA Attributes

```html
<button
  aria-label="Close modal"
  aria-expanded="false"
  aria-controls="modal-content"
>
  <span aria-hidden="true">×</span>
</button>

<div
  role="alert"
  aria-live="polite"
  aria-atomic="true"
>
  New announcement posted
</div>
```

### Keyboard Navigation

```javascript
function setupKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    // Close modal on Escape
    if (e.key === 'Escape') {
      closeModal();
    }
    
    // Submit form on Ctrl+Enter
    if (e.ctrlKey && e.key === 'Enter') {
      document.getElementById('submit-btn').click();
    }
  });
}
```

### Focus Management

```javascript
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('open');
  
  // Store last focused element
  modal.dataset.lastFocus = document.activeElement.id;
  
  // Focus first input
  const firstInput = modal.querySelector('input, button');
  firstInput?.focus();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('open');
  
  // Restore focus
  const lastFocus = document.getElementById(modal.dataset.lastFocus);
  lastFocus?.focus();
}
```

---

**See Also:**
- [Component Library](components.md)
- [User Flows](user-flows.md)
- [Styling Guide](styling.md)
- [API Reference](../backend/api-reference.md)
