-- Role-based Access Control System (SQLite version)

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  semester TEXT NOT NULL,
  year INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Role assignments table (many-to-many: users can have different roles in different courses)
CREATE TABLE IF NOT EXISTS user_course_roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'team_leader', 'tutor', 'ta', 'professor')),
  assigned_by TEXT REFERENCES users(id),
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  role TEXT NOT NULL CHECK (role IN ('student', 'team_leader', 'tutor', 'ta', 'professor')),
  permission TEXT NOT NULL CHECK (permission IN (
    'view_course', 'edit_course', 'delete_course',
    'view_students', 'edit_students', 'assign_roles',
    'view_queue', 'manage_queue', 'help_students',
    'view_teams', 'manage_teams', 'assign_team_leaders',
    'view_assignments', 'create_assignments', 'grade_assignments',
    'view_analytics', 'system_admin'
  )),
  course_specific BOOLEAN NOT NULL DEFAULT 1,
  UNIQUE(role, permission)
);

-- Audit log for role changes
CREATE TABLE IF NOT EXISTS role_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT REFERENCES courses(id),
  old_role TEXT,
  new_role TEXT,
  changed_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_course_roles_user ON user_course_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_roles_course ON user_course_roles(course_id);
CREATE INDEX IF NOT EXISTS idx_user_course_roles_role ON user_course_roles(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_user ON role_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_course ON role_audit_log(course_id);
