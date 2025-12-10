# Component Library

Reusable UI components and patterns used across Conductor dashboards.

## Overview

Conductor uses a **component-based architecture** with vanilla JavaScript and CSS. Components are designed to be:

- **Reusable** - Used across multiple pages
- **Accessible** - ARIA attributes, keyboard navigation
- **Responsive** - Mobile-first design
- **Themeable** - CSS custom properties

## Core Components

### 1. Cards

Flexible container component used throughout the application.

**HTML Structure**:
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Team 1</h3>
    <span class="badge badge-success">Active</span>
  </div>
  <div class="card-body">
    <p>Team information and details go here</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">View Details</button>
  </div>
</div>
```

**CSS**:
```css
.card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
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
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--gray-200);
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.card-body {
  color: var(--gray-700);
}

.card-footer {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--gray-200);
  display: flex;
  gap: 0.5rem;
}
```

**JavaScript Helper**:
```javascript
function createCard({ title, badge, content, actions = [] }) {
  const card = document.createElement('div');
  card.className = 'card';
  
  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${escapeHtml(title)}</h3>
      ${badge ? `<span class="badge badge-${badge.type}">${escapeHtml(badge.text)}</span>` : ''}
    </div>
    <div class="card-body">
      ${content}
    </div>
    ${actions.length ? `
      <div class="card-footer">
        ${actions.map(a => `
          <button class="btn btn-${a.type}" data-action="${a.action}">
            ${escapeHtml(a.label)}
          </button>
        `).join('')}
      </div>
    ` : ''}
  `;
  
  return card;
}
```

### 2. Buttons

Consistent button styles with multiple variants.

**HTML**:
```html
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-danger">Delete</button>
<button class="btn btn-sm btn-primary">Small Button</button>
<button class="btn btn-lg btn-primary">Large Button</button>
```

**CSS**:
```css
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--palette-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--teal-700);
}

.btn-secondary {
  background-color: var(--gray-200);
  color: var(--gray-900);
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}
```

### 3. Badges

Status indicators and labels.

**HTML**:
```html
<span class="badge badge-success">Active</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-danger">Dropped</span>
<span class="badge badge-info">Enrolled</span>
```

**CSS**:
```css
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.badge-success {
  background-color: #d1fae5;
  color: #065f46;
}

.badge-warning {
  background-color: #fed7aa;
  color: #92400e;
}

.badge-danger {
  background-color: #fecaca;
  color: #991b1b;
}

.badge-info {
  background-color: #dbeafe;
  color: #1e40af;
}
```

### 4. Modals

Dialog overlays for forms and confirmations.

**HTML**:
```html
<div id="example-modal" class="modal">
  <div class="modal-overlay" onclick="closeModal('example-modal')"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Modal Title</h2>
      <button class="modal-close" onclick="closeModal('example-modal')" aria-label="Close">
        ×
      </button>
    </div>
    <div class="modal-body">
      <p>Modal content goes here</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('example-modal')">Cancel</button>
      <button class="btn btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

**CSS**:
```css
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  align-items: center;
  justify-content: center;
}

.modal.open {
  display: flex;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 0.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: var(--gray-500);
}

.modal-close:hover {
  color: var(--gray-900);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid var(--gray-200);
}
```

**JavaScript**:
```javascript
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('open');
  document.body.style.overflow = 'hidden'; // Prevent background scroll
  
  // Focus first input
  const firstInput = modal.querySelector('input, button');
  firstInput?.focus();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal.open');
    if (openModal) {
      closeModal(openModal.id);
    }
  }
});
```

### 5. Forms

Form components with validation.

**HTML**:
```html
<form id="user-form" class="form">
  <div class="form-group">
    <label for="email" class="form-label">
      Email <span class="text-danger">*</span>
    </label>
    <input
      type="email"
      id="email"
      name="email"
      class="form-input"
      required
      placeholder="user@ucsd.edu"
    >
    <span class="form-error" id="email-error"></span>
  </div>
  
  <div class="form-group">
    <label for="role" class="form-label">Role</label>
    <select id="role" name="role" class="form-select">
      <option value="">Select role</option>
      <option value="student">Student</option>
      <option value="ta">TA</option>
      <option value="tutor">Tutor</option>
    </select>
  </div>
  
  <div class="form-group">
    <label class="form-checkbox">
      <input type="checkbox" name="active">
      <span>Active user</span>
    </label>
  </div>
  
  <div class="form-actions">
    <button type="submit" class="btn btn-primary">Save</button>
    <button type="button" class="btn btn-secondary">Cancel</button>
  </div>
</form>
```

**CSS**:
```css
.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--gray-900);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--palette-primary);
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
}

.form-input.error {
  border-color: #ef4444;
}

.form-error {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #ef4444;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-checkbox input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 2rem;
}
```

**JavaScript Validation**:
```javascript
function validateForm(formId) {
  const form = document.getElementById(formId);
  let isValid = true;
  
  // Email validation
  const emailInput = form.querySelector('#email');
  const emailError = form.querySelector('#email-error');
  
  if (!emailInput.value || !emailInput.value.includes('@')) {
    emailError.textContent = 'Valid email is required';
    emailInput.classList.add('error');
    isValid = false;
  } else {
    emailError.textContent = '';
    emailInput.classList.remove('error');
  }
  
  return isValid;
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!validateForm('user-form')) {
    return;
  }
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  try {
    await saveUser(data);
    showToast('User saved successfully', 'success');
    closeModal('user-modal');
  } catch (err) {
    showToast('Failed to save user', 'error');
  }
});
```

### 6. Tables

Data tables with sorting and filtering.

**HTML**:
```html
<div class="table-container">
  <table class="table">
    <thead>
      <tr>
        <th>
          <button class="table-sort" data-column="name">
            Name <span class="sort-icon">↕</span>
          </button>
        </th>
        <th>Email</th>
        <th>Role</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="users-table-body">
      <!-- Rows populated by JavaScript -->
    </tbody>
  </table>
</div>
```

**CSS**:
```css
.table-container {
  overflow-x: auto;
  border: 1px solid var(--gray-200);
  border-radius: 0.5rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table thead {
  background-color: var(--gray-50);
}

.table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--gray-900);
  border-bottom: 2px solid var(--gray-200);
}

.table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--gray-200);
}

.table tbody tr:hover {
  background-color: var(--gray-50);
}

.table-sort {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.sort-icon {
  color: var(--gray-400);
}

.table-sort.active .sort-icon {
  color: var(--palette-primary);
}
```

**JavaScript**:
```javascript
function renderTable(users) {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';
  
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td><span class="badge badge-info">${escapeHtml(user.role)}</span></td>
      <td><span class="badge badge-${user.status === 'active' ? 'success' : 'warning'}">${escapeHtml(user.status)}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Sorting
let sortColumn = 'name';
let sortDirection = 'asc';

function sortTable(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  users.sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];
    const modifier = sortDirection === 'asc' ? 1 : -1;
    return aVal > bVal ? modifier : -modifier;
  });
  
  renderTable(users);
}
```

### 7. Tabs

Tab navigation for content organization.

**HTML**:
```html
<div class="tabs">
  <div class="tab-list" role="tablist">
    <button class="tab-button active" data-tab="overview" role="tab" aria-selected="true">
      Overview
    </button>
    <button class="tab-button" data-tab="members" role="tab" aria-selected="false">
      Members
    </button>
    <button class="tab-button" data-tab="settings" role="tab" aria-selected="false">
      Settings
    </button>
  </div>
  
  <div class="tab-panels">
    <div class="tab-panel active" id="overview" role="tabpanel">
      <h3>Overview Content</h3>
    </div>
    <div class="tab-panel" id="members" role="tabpanel" hidden>
      <h3>Members Content</h3>
    </div>
    <div class="tab-panel" id="settings" role="tabpanel" hidden>
      <h3>Settings Content</h3>
    </div>
  </div>
</div>
```

**CSS**:
```css
.tab-list {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid var(--gray-200);
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  font-weight: 500;
  color: var(--gray-600);
  transition: all 0.2s;
}

.tab-button:hover {
  color: var(--gray-900);
}

.tab-button.active {
  color: var(--palette-primary);
  border-bottom-color: var(--palette-primary);
}

.tab-panel {
  padding: 1.5rem 0;
}

.tab-panel[hidden] {
  display: none;
}
```

**JavaScript**:
```javascript
function setupTabs() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      
      // Deactivate all tabs
      document.querySelectorAll('.tab-button').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.remove('active');
        p.hidden = true;
      });
      
      // Activate clicked tab
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
      
      const panel = document.getElementById(tabId);
      panel.classList.add('active');
      panel.hidden = false;
    });
  });
}
```

### 8. Dropdowns

Contextual menus and select components.

**HTML**:
```html
<div class="dropdown">
  <button class="btn btn-secondary dropdown-toggle" onclick="toggleDropdown('actions-dropdown')">
    Actions ▼
  </button>
  <div class="dropdown-menu" id="actions-dropdown">
    <button class="dropdown-item" onclick="editItem()">
      <span class="icon">✎</span> Edit
    </button>
    <button class="dropdown-item" onclick="duplicateItem()">
      <span class="icon">⎘</span> Duplicate
    </button>
    <div class="dropdown-divider"></div>
    <button class="dropdown-item text-danger" onclick="deleteItem()">
      <span class="icon">🗑</span> Delete
    </button>
  </div>
</div>
```

**CSS**:
```css
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  min-width: 200px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 0.375rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: none;
  z-index: 100;
}

.dropdown-menu.open {
  display: block;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background-color: var(--gray-50);
}

.dropdown-divider {
  height: 1px;
  background-color: var(--gray-200);
  margin: 0.5rem 0;
}

.text-danger {
  color: #ef4444;
}
```

**JavaScript**:
```javascript
function toggleDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  const isOpen = dropdown.classList.contains('open');
  
  // Close all dropdowns
  document.querySelectorAll('.dropdown-menu').forEach(d => {
    d.classList.remove('open');
  });
  
  // Toggle current dropdown
  if (!isOpen) {
    dropdown.classList.add('open');
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu').forEach(d => {
      d.classList.remove('open');
    });
  }
});
```

### 9. Progress Bars

Visual progress indicators.

**HTML**:
```html
<div class="progress">
  <div class="progress-bar" style="width: 75%;" role="progressbar" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">
    75%
  </div>
</div>
```

**CSS**:
```css
.progress {
  width: 100%;
  height: 1.5rem;
  background-color: var(--gray-200);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--palette-primary), var(--palette-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  transition: width 0.3s ease;
}
```

### 10. Pagination

Navigation for paginated content.

**HTML**:
```html
<nav class="pagination" aria-label="Pagination">
  <button class="pagination-btn" onclick="goToPage(1)" aria-label="First page">
    «
  </button>
  <button class="pagination-btn" onclick="goToPage(currentPage - 1)" aria-label="Previous page">
    ‹
  </button>
  <span class="pagination-info">Page 2 of 10</span>
  <button class="pagination-btn" onclick="goToPage(currentPage + 1)" aria-label="Next page">
    ›
  </button>
  <button class="pagination-btn" onclick="goToPage(totalPages)" aria-label="Last page">
    »
  </button>
</nav>
```

**CSS**:
```css
.pagination {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 2rem;
}

.pagination-btn {
  padding: 0.5rem 0.75rem;
  background-color: white;
  border: 1px solid var(--gray-300);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background-color: var(--palette-background);
  border-color: var(--palette-primary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  padding: 0.5rem 1rem;
  color: var(--gray-700);
}
```

## Accessibility Guidelines

### ARIA Attributes

- Use `role` attributes for semantic meaning
- Add `aria-label` for icon-only buttons
- Include `aria-expanded` for collapsible content
- Use `aria-live` regions for dynamic updates

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Use `tabindex="0"` for focusable custom elements
- Implement keyboard shortcuts (Escape, Enter, Tab)
- Ensure logical tab order

### Color Contrast

- Minimum 4.5:1 contrast for text
- 3:1 contrast for UI components
- Don't rely on color alone for information
- Support colorblind mode

---

**See Also:**
- [Frontend Overview](overview.md)
- [User Flows](user-flows.md)
- [Styling Guide](styling.md)
