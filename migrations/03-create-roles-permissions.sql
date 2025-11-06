-- Role-based Access Control System
-- Extensions (already created in 01-create-users.sql)

-- New role types for the application
DO $$ BEGIN
  DROP TYPE IF EXISTS app_role CASCADE;
  CREATE TYPE app_role AS ENUM ('student', 'team_leader', 'tutor', 'ta', 'professor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Permissions enum
DO $$ BEGIN
  CREATE TYPE permission_type AS ENUM (
    'view_course', 'edit_course', 'delete_course',
    'view_students', 'edit_students', 'assign_roles',
    'view_queue', 'manage_queue', 'help_students',
    'view_teams', 'manage_teams', 'assign_team_leaders',
    'view_assignments', 'create_assignments', 'grade_assignments',
    'view_analytics', 'system_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  semester TEXT NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role assignments table (many-to-many: users can have different roles in different courses)
CREATE TABLE IF NOT EXISTS user_course_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role app_role NOT NULL,
  permission permission_type NOT NULL,
  course_specific BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(role, permission)
);

-- Audit log for role changes
CREATE TABLE IF NOT EXISTS role_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  old_role app_role,
  new_role app_role,
  changed_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update triggers
DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_course_roles_user ON user_course_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_roles_course ON user_course_roles(course_id);
CREATE INDEX IF NOT EXISTS idx_user_course_roles_role ON user_course_roles(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_user ON role_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_course ON role_audit_log(course_id);

-- Insert default role permissions
INSERT INTO role_permissions (role, permission, course_specific) VALUES
-- Student permissions
('student', 'view_course', true),
('student', 'view_queue', true),
('student', 'view_teams', true),
('student', 'view_assignments', true),

-- Team Leader permissions (inherits student + team management)
('team_leader', 'view_course', true),
('team_leader', 'view_queue', true),
('team_leader', 'view_teams', true),
('team_leader', 'manage_teams', true),
('team_leader', 'view_assignments', true),

-- Tutor permissions
('tutor', 'view_course', true),
('tutor', 'view_students', true),
('tutor', 'view_queue', true),
('tutor', 'manage_queue', true),
('tutor', 'help_students', true),
('tutor', 'view_teams', true),
('tutor', 'view_assignments', true),

-- TA permissions (inherits tutor + grading)
('ta', 'view_course', true),
('ta', 'view_students', true),
('ta', 'view_queue', true),
('ta', 'manage_queue', true),
('ta', 'help_students', true),
('ta', 'view_teams', true),
('ta', 'manage_teams', true),
('ta', 'view_assignments', true),
('ta', 'grade_assignments', true),
('ta', 'view_analytics', true),

-- Professor permissions (full access)
('professor', 'view_course', true),
('professor', 'edit_course', true),
('professor', 'delete_course', true),
('professor', 'view_students', true),
('professor', 'edit_students', true),
('professor', 'assign_roles', true),
('professor', 'view_queue', true),
('professor', 'manage_queue', true),
('professor', 'help_students', true),
('professor', 'view_teams', true),
('professor', 'manage_teams', true),
('professor', 'assign_team_leaders', true),
('professor', 'view_assignments', true),
('professor', 'create_assignments', true),
('professor', 'grade_assignments', true),
('professor', 'view_analytics', true)
ON CONFLICT (role, permission) DO NOTHING;

-- Update users table to remove old role system and add system-level role
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role user_role DEFAULT 'user';
