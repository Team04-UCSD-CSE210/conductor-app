-- ============================================================
-- Permissions + Role Mappings for Conductor (minimal set)
-- ============================================================

-- 1) Insert permissions
INSERT INTO permissions (scope, resource, action, code, description) VALUES
  ('global', 'user',       'manage',   'user.manage',      'Create, update, delete users (global)'),
  ('course', 'roster',     'view',     'roster.view',      'View roster and enrollment lists'),
  ('course', 'roster',     'import',   'roster.import',    'Import roster from JSON/CSV'),
  ('global', 'roster',     'export',   'roster.export',    'Export roster as JSON/CSV'),
  ('course', 'enrollment', 'manage',   'enrollment.manage','Create/update/delete/drop enrollments, change course roles'),
  ('course', 'course',     'manage',   'course.manage',    'Course-level admin & stats'),
  ('course', 'interaction','view',     'interaction.view', 'View interaction reports'),
  ('course', 'interaction','create',   'interaction.create','Create interaction reports'),
  ('course', 'team',       'view_all', 'team.view_all',    'View all teams and members in a course'),
  ('course', 'team',       'manage',   'team.manage',      'Create, update, delete teams and team members')
ON CONFLICT (code) DO NOTHING;


-- 2) Admin: all permissions
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'admin'::user_role_enum, p.id
FROM permissions p
ON CONFLICT (user_role, permission_id) DO NOTHING;


-- 3) Instructor: specific permissions
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'instructor'::user_role_enum, p.id
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
SELECT 'student'::course_role_enum, p.id
FROM permissions p
WHERE p.code = 'roster.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- TA
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'ta'::course_role_enum, p.id
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
SELECT 'tutor'::course_role_enum, p.id
FROM permissions p
WHERE p.code IN ('roster.view', 'team.view_all')
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- Team leader
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT 'leader'::team_member_role_enum, p.id
FROM permissions p
WHERE p.code = 'team.manage'
ON CONFLICT (team_role, permission_id) DO NOTHING;

-- Team member: no special permissions
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT 'member'::team_member_role_enum, p.id
FROM permissions p
WHERE 1 = 0
ON CONFLICT (team_role, permission_id) DO NOTHING;