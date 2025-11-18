-- ============================================================
-- 08-seed-attendance-permissions.sql
-- Attendance & Session Permissions
-- All permissions related to lecture attendance and sessions
-- ============================================================

-- 1) Insert attendance and session permissions
INSERT INTO permissions (scope, resource, action, code, description) VALUES
  ('course', 'session',    'create',   'session.create',   'Create class sessions'),
  ('course', 'session',    'manage',   'session.manage',   'Manage sessions (open/close/modify, questions)'),
  ('course', 'attendance', 'view',     'attendance.view',  'View attendance and related responses'),
  ('course', 'attendance', 'mark',     'attendance.mark',  'Mark, update, and delete attendance records')
ON CONFLICT (code) DO NOTHING;

-- 2) Admin: all attendance permissions (already covered by "all permissions" in 05, but explicit here)
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'admin'::user_role_enum, p.id
FROM permissions p
WHERE p.code IN ('session.create', 'session.manage', 'attendance.view', 'attendance.mark')
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- 3) Instructor: all attendance permissions
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'instructor'::user_role_enum, p.id
FROM permissions p
WHERE p.code IN (
  'session.create',
  'session.manage',
  'attendance.view',
  'attendance.mark'
)
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- 4) TA: view and mark attendance, manage sessions
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'ta'::course_role_enum, p.id
FROM permissions p
WHERE p.code IN (
  'session.manage',
  'attendance.view',
  'attendance.mark'
)
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- 5) Tutor: view attendance only
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'tutor'::course_role_enum, p.id
FROM permissions p
WHERE p.code = 'attendance.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- 6) Team leader: can create and manage sessions
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT 'leader'::team_member_role_enum, p.id
FROM permissions p
WHERE p.code IN ('session.create', 'session.manage')
ON CONFLICT (team_role, permission_id) DO NOTHING;

