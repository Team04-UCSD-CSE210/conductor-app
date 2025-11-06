// Role Management JavaScript
class RoleManager {
    constructor() {
        this.apiBase = '/api';
        this.currentUser = null;
        this.courses = [];
        this.roles = [];
        this.permissions = [];
        this.init();
    }

    async init() {
        try {
            await this.loadInitialData();
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize role manager:', error);
            this.showError('Failed to load initial data');
        }
    }

    async loadInitialData() {
        // Load courses, roles, and permissions
        const [coursesRes, permissionsRes] = await Promise.all([
            this.apiCall('/courses/my'),
            this.apiCall('/roles/permissions')
        ]);

        this.courses = coursesRes.courses || [];
        this.roles = permissionsRes.roles || [];
        this.permissions = permissionsRes.permissions || [];
        this.rolePermissions = permissionsRes.rolePermissions || [];

        this.populateCourseSelects();
        this.populateRoleSelects();
        this.loadPermissionsMatrix();
        this.loadAuditLog();
    }

    setupEventListeners() {
        // Modal close on outside click
        window.onclick = (event) => {
            const modal = document.getElementById('assignModal');
            if (event.target === modal) {
                this.closeAssignModal();
            }
        };
    }

    async apiCall(endpoint, options = {}) {
        const response = await fetch(`${this.apiBase}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': this.getCurrentUserId(),
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    }

    getCurrentUserId() {
        // Mock user ID - in production, get from auth token/session
        return localStorage.getItem('userId') || 'demo-user-id';
    }

    populateCourseSelects() {
        const selects = ['courseSelect', 'bulkCourseSelect', 'assignCourse'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Select course...</option>';
            
            this.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = `${course.code} - ${course.name}`;
                select.appendChild(option);
            });
        });
    }

    populateRoleSelects() {
        const selects = ['bulkRole', 'assignRole'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Select role...</option>';
            
            this.roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role.replace('_', ' ').toUpperCase();
                select.appendChild(option);
            });
        });
    }

    async loadCourseRoles() {
        const courseId = document.getElementById('courseSelect').value;
        const container = document.getElementById('courseRolesTable');
        
        if (!courseId) {
            container.innerHTML = '<div class="loading">Select a course to view role assignments</div>';
            return;
        }

        container.innerHTML = '<div class="loading">Loading roles...</div>';

        try {
            const response = await this.apiCall(`/roles/course/${courseId}`);
            this.renderCourseRolesTable(response.roles);
        } catch (error) {
            container.innerHTML = `<div class="error">Failed to load roles: ${error.message}</div>`;
        }
    }

    renderCourseRolesTable(roles) {
        const container = document.getElementById('courseRolesTable');
        
        if (roles.length === 0) {
            container.innerHTML = '<div class="loading">No role assignments found for this course</div>';
            return;
        }

        const table = `
            <table class="table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Assigned By</th>
                        <th>Assigned At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${roles.map(role => `
                        <tr>
                            <td>${role.name}</td>
                            <td>${role.email}</td>
                            <td><span class="role-badge role-${role.role}">${role.role.replace('_', ' ')}</span></td>
                            <td>${role.assigned_by_name || 'System'}</td>
                            <td>${new Date(role.assigned_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-danger btn-sm" 
                                        onclick="roleManager.removeRole('${role.user_id}', '${role.course_id}')">
                                    Remove
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }

    async loadPermissionsMatrix() {
        const container = document.getElementById('permissionsMatrix');
        
        try {
            const matrix = this.createPermissionsMatrix();
            container.innerHTML = matrix;
        } catch (error) {
            container.innerHTML = `<div class="error">Failed to load permissions: ${error.message}</div>`;
        }
    }

    createPermissionsMatrix() {
        const table = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Permission</th>
                        ${this.roles.map(role => `<th>${role.replace('_', ' ')}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${this.permissions.map(permission => `
                        <tr>
                            <td>${permission.replace('_', ' ')}</td>
                            ${this.roles.map(role => {
                                const hasPermission = this.rolePermissions.some(rp => 
                                    rp.role === role && rp.permissions.includes(permission)
                                );
                                return `<td>${hasPermission ? '✓' : '✗'}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        return table;
    }

    async loadAuditLog() {
        const container = document.getElementById('auditLogTable');
        container.innerHTML = '<div class="loading">Loading audit log...</div>';

        try {
            const response = await this.apiCall('/roles/audit?limit=50');
            this.renderAuditLog(response.auditLog);
        } catch (error) {
            container.innerHTML = `<div class="error">Failed to load audit log: ${error.message}</div>`;
        }
    }

    renderAuditLog(auditLog) {
        const container = document.getElementById('auditLogTable');
        
        if (auditLog.length === 0) {
            container.innerHTML = '<div class="loading">No audit log entries found</div>';
            return;
        }

        const table = `
            <table class="table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Course</th>
                        <th>Old Role</th>
                        <th>New Role</th>
                        <th>Changed By</th>
                        <th>Reason</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${auditLog.map(entry => `
                        <tr>
                            <td>${entry.user_name}</td>
                            <td>${entry.course_name || 'N/A'}</td>
                            <td>${entry.old_role ? `<span class="role-badge role-${entry.old_role}">${entry.old_role}</span>` : 'None'}</td>
                            <td>${entry.new_role ? `<span class="role-badge role-${entry.new_role}">${entry.new_role}</span>` : 'Removed'}</td>
                            <td>${entry.changed_by_name}</td>
                            <td>${entry.reason || 'N/A'}</td>
                            <td>${new Date(entry.created_at).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }

    openAssignModal() {
        document.getElementById('assignModal').style.display = 'block';
        this.clearAssignForm();
    }

    closeAssignModal() {
        document.getElementById('assignModal').style.display = 'none';
    }

    clearAssignForm() {
        document.getElementById('assignUserEmail').value = '';
        document.getElementById('assignCourse').value = '';
        document.getElementById('assignRole').value = '';
        document.getElementById('assignReason').value = '';
        document.getElementById('assignError').style.display = 'none';
    }

    async assignRole() {
        const email = document.getElementById('assignUserEmail').value;
        const courseId = document.getElementById('assignCourse').value;
        const role = document.getElementById('assignRole').value;
        const reason = document.getElementById('assignReason').value;

        if (!email || !courseId || !role) {
            this.showAssignError('Please fill in all required fields');
            return;
        }

        try {
            // First, find user by email
            const userResponse = await this.apiCall(`/users?email=${encodeURIComponent(email)}`);
            const user = userResponse.users?.[0];
            
            if (!user) {
                this.showAssignError('User not found with that email');
                return;
            }

            // Assign role
            await this.apiCall('/roles/assign', {
                method: 'POST',
                body: JSON.stringify({
                    userId: user.id,
                    courseId,
                    role,
                    reason
                })
            });

            this.showSuccess('Role assigned successfully');
            this.closeAssignModal();
            this.loadCourseRoles();
            this.loadAuditLog();
        } catch (error) {
            this.showAssignError(error.message);
        }
    }

    async removeRole(userId, courseId) {
        if (!confirm('Are you sure you want to remove this role assignment?')) {
            return;
        }

        try {
            await this.apiCall('/roles/remove', {
                method: 'DELETE',
                body: JSON.stringify({
                    userId,
                    courseId,
                    reason: 'Removed via role manager'
                })
            });

            this.showSuccess('Role removed successfully');
            this.loadCourseRoles();
            this.loadAuditLog();
        } catch (error) {
            this.showError(`Failed to remove role: ${error.message}`);
        }
    }

    async bulkAssignRoles() {
        const courseId = document.getElementById('bulkCourseSelect').value;
        const role = document.getElementById('bulkRole').value;
        const emails = document.getElementById('userEmails').value
            .split('\n')
            .map(email => email.trim())
            .filter(email => email);

        if (!courseId || !role || emails.length === 0) {
            this.showError('Please fill in all fields and provide at least one email');
            return;
        }

        try {
            // Find users by emails
            const userPromises = emails.map(email => 
                this.apiCall(`/users?email=${encodeURIComponent(email)}`)
            );
            const userResponses = await Promise.all(userPromises);
            
            const assignments = [];
            const notFound = [];

            userResponses.forEach((response, index) => {
                const user = response.users?.[0];
                if (user) {
                    assignments.push({
                        userId: user.id,
                        courseId,
                        role,
                        reason: 'Bulk assignment via role manager'
                    });
                } else {
                    notFound.push(emails[index]);
                }
            });

            if (assignments.length === 0) {
                this.showError('No valid users found');
                return;
            }

            // Bulk assign
            await this.apiCall('/roles/bulk-assign', {
                method: 'POST',
                body: JSON.stringify({ assignments })
            });

            let message = `Successfully assigned ${assignments.length} roles`;
            if (notFound.length > 0) {
                message += `. Users not found: ${notFound.join(', ')}`;
            }

            this.showSuccess(message);
            document.getElementById('userEmails').value = '';
            this.loadCourseRoles();
            this.loadAuditLog();
        } catch (error) {
            this.showError(`Bulk assignment failed: ${error.message}`);
        }
    }

    showError(message) {
        // Create or update error message
        let errorDiv = document.querySelector('.error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.tabs'));
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => errorDiv.style.display = 'none', 5000);
    }

    showSuccess(message) {
        // Create or update success message
        let successDiv = document.querySelector('.success');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.className = 'success';
            document.querySelector('.container').insertBefore(successDiv, document.querySelector('.tabs'));
        }
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => successDiv.style.display = 'none', 5000);
    }

    showAssignError(message) {
        const errorDiv = document.getElementById('assignError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Tab switching function
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked tab
    event.target.classList.add('active');
}

// Global functions for HTML onclick handlers
function openAssignModal() {
    roleManager.openAssignModal();
}

function closeAssignModal() {
    roleManager.closeAssignModal();
}

function assignRole() {
    roleManager.assignRole();
}

function loadCourseRoles() {
    roleManager.loadCourseRoles();
}

function bulkAssignRoles() {
    roleManager.bulkAssignRoles();
}

// Initialize role manager when page loads
const roleManager = new RoleManager();
