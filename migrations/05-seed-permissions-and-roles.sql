-- ============================================================
-- Permissions + Role Mappings for Conductor (minimal set)
-- ============================================================

DO $$
DECLARE
    scope_global CONSTANT TEXT := 'global';
    scope_course CONSTANT TEXT := 'course';
    resource_user CONSTANT TEXT := 'user';
    resource_roster CONSTANT TEXT := 'roster';
    resource_enrollment CONSTANT TEXT := 'enrollment';
    resource_course CONSTANT TEXT := 'course';
    resource_interaction CONSTANT TEXT := 'interaction';
    resource_team CONSTANT TEXT := 'team';
    role_admin CONSTANT user_role_enum := 'admin'::user_role_enum;
    role_instructor CONSTANT user_role_enum := 'instructor'::user_role_enum;
    role_student_enroll CONSTANT enrollment_role_enum := 'student'::enrollment_role_enum;
    role_ta_enroll CONSTANT enrollment_role_enum := 'ta'::enrollment_role_enum;
    role_tutor_enroll CONSTANT enrollment_role_enum := 'tutor'::enrollment_role_enum;
    role_leader_team CONSTANT team_member_role_enum := 'leader'::team_member_role_enum;
    role_member_team CONSTANT team_member_role_enum := 'member'::team_member_role_enum;
BEGIN
-- 1) Insert permissions
INSERT INTO permissions (scope, resource, action, code, description) VALUES
  (scope_global, resource_user,       'manage',   'user.manage',      'Create, update, delete users (global)'),
  (scope_course, resource_roster,     'view',     'roster.view',      'View roster and enrollment lists'),
  (scope_course, resource_roster,     'import',   'roster.import',    'Import roster from JSON/CSV'),
  (scope_global, resource_roster,     'export',   'roster.export',    'Export roster as JSON/CSV'),
  (scope_course, resource_enrollment, 'manage',   'enrollment.manage','Create/update/delete/drop enrollments, change course roles'),
  (scope_course, resource_course,     'manage',   'course.manage',    'Course-level admin & stats'),
  (scope_course, resource_interaction,'view',     'interaction.view', 'View interaction reports'),
  (scope_course, resource_interaction,'create',   'interaction.create','Create interaction reports'),
  (scope_course, resource_team,       'view_all', 'team.view_all',    'View all teams and members in a course'),
  (scope_course, resource_team,       'manage',   'team.manage',      'Create, update, delete teams and team members')
ON CONFLICT (code) DO NOTHING;


-- 2) Admin: all permissions
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT role_admin, p.id
FROM permissions p
ON CONFLICT (user_role, permission_id) DO NOTHING;


-- 3) Instructor: specific permissions
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT role_instructor, p.id
FROM permissions p
WHERE p.code IN (
  'roster.view',
  'roster.import',
  'roster.export',
  'enrollment.manage',
  'course.manage',
  'interaction.view',
  'interaction.create',
  'team.view_all',
  'team.manage'
)
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- Student: roster.view only
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT role_student_enroll, p.id
FROM permissions p
WHERE p.code = 'roster.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- TA
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT role_ta_enroll, p.id
FROM permissions p
WHERE p.code IN (
  'roster.view',
  'roster.import', 
  'roster.export',
  'enrollment.manage',
  'course.manage',
  'interaction.view',
  'interaction.create',
  'team.view_all',
  'team.manage'
)
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- Tutor: roster.view only
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT role_tutor_enroll, p.id
FROM permissions p
WHERE p.code IN ('roster.view', 'team.view_all')
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- Team leader
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT role_leader_team, p.id
FROM permissions p
WHERE p.code = 'team.manage'
ON CONFLICT (team_role, permission_id) DO NOTHING;

-- Team member: no special permissions
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT role_member_team, p.id
FROM permissions p
WHERE 1 = 0
ON CONFLICT (team_role, permission_id) DO NOTHING;
END $$;