-- ============================================================
-- 08-seed-attendance-permissions.sql
-- Attendance & Session Permissions
-- All permissions related to lecture attendance and sessions
-- ============================================================

DO $$
DECLARE
    scope_course CONSTANT TEXT := 'course';
    resource_session CONSTANT TEXT := 'session';
    resource_attendance CONSTANT TEXT := 'attendance';
    role_admin CONSTANT user_role_enum := 'admin'::user_role_enum;
    role_instructor CONSTANT user_role_enum := 'instructor'::user_role_enum;
    role_ta_enroll CONSTANT enrollment_role_enum := 'ta'::enrollment_role_enum;
    role_tutor_enroll CONSTANT enrollment_role_enum := 'tutor'::enrollment_role_enum;
    role_leader_team CONSTANT team_member_role_enum := 'leader'::team_member_role_enum;
BEGIN
-- 1) Insert attendance and session permissions
INSERT INTO permissions (scope, resource, action, code, description) VALUES
  (scope_course, resource_session,    'create',   'session.create',   'Create class sessions'),
  (scope_course, resource_session,    'manage',   'session.manage',   'Manage sessions (open/close/modify, questions)'),
  (scope_course, resource_attendance, 'view',     'attendance.view',  'View attendance and related responses'),
  (scope_course, resource_attendance, 'mark',     'attendance.mark',  'Mark, update, and delete attendance records')
ON CONFLICT (code) DO NOTHING;

-- 2) Admin: all attendance permissions (already covered by "all permissions" in 05, but explicit here)
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT role_admin, p.id
FROM permissions p
WHERE p.code IN ('session.create', 'session.manage', 'attendance.view', 'attendance.mark')
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- 3) Instructor: all attendance permissions
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT role_instructor, p.id
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
SELECT role_ta_enroll, p.id
FROM permissions p
WHERE p.code IN (
  'session.manage',
  'attendance.view',
  'attendance.mark'
)
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- 5) Tutor: view attendance only
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT role_tutor_enroll, p.id
FROM permissions p
WHERE p.code = 'attendance.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- 6) Team leader: can create and manage sessions
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT role_leader_team, p.id
FROM permissions p
WHERE p.code IN ('session.create', 'session.manage')
ON CONFLICT (team_role, permission_id) DO NOTHING;
END $$;

