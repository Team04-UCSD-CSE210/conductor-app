-- ============================================================
-- Permissions + Role Mappings for Conductor (minimal set)
-- ============================================================

-- 1) Insert permissions
INSERT INTO permissions (scope, resource, action, code, description) VALUES
  -- Global
  ('global', 'user',   'view',    'user.view',    'View users (list & details)'),
  ('global', 'user',   'manage',  'user.manage',  'Create, update, delete, restore users'),
  ('global', 'roster', 'export',  'roster.export','Export roster as JSON/CSV'),

  -- Course
  ('course', 'roster',     'view',    'roster.view',     'View roster and enrollment lists'),
  ('course', 'roster',     'import',  'roster.import',   'Import roster from JSON/CSV'),
  ('course', 'enrollment', 'manage',  'enrollment.manage','Create/update/delete/drop enrollments'),
  ('course', 'course',     'manage',  'course.manage',   'Course-level admin & stats')
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
  'user.view',
  'user.manage',
  'roster.view',
  'roster.import',
  'roster.export',
  'enrollment.manage',
  'course.manage'
)
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- 4) Student: basic permissions (roster.view)
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'student'::user_role_enum, p.id
FROM permissions p
WHERE p.code = 'roster.view'
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- 5) Unregistered: same permissions as student
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'unregistered'::user_role_enum, p.id
FROM permissions p
WHERE p.code = 'roster.view'
ON CONFLICT (user_role, permission_id) DO NOTHING;


-- 6) Course roles → permissions

-- Student: roster.view (optional)
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'student'::course_role_enum, p.id
FROM permissions p
WHERE p.code = 'roster.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- TA: roster.view + roster.import + enrollment.manage + course.manage
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'ta'::course_role_enum, p.id
FROM permissions p
WHERE p.code IN ('roster.view', 'roster.import', 'enrollment.manage', 'course.manage')
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- Tutor: roster.view only
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'tutor'::course_role_enum, p.id
FROM permissions p
WHERE p.code = 'roster.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;