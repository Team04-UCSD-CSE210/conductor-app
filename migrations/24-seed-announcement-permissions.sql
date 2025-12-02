-- Add announcement permissions
INSERT INTO permissions (code, resource, action, scope, description) VALUES
  ('announcement.create', 'announcement', 'create', 'course', 'Create announcements'),
  ('announcement.manage', 'announcement', 'manage', 'course', 'Manage all announcements'),
  ('announcement.view', 'announcement', 'view', 'course', 'View announcements')
ON CONFLICT (code) DO NOTHING;

-- Grant announcement permissions to user roles
-- Instructor can create, manage, and view announcements
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'instructor'::user_role_enum, p.id
FROM permissions p
WHERE p.code IN ('announcement.create', 'announcement.manage', 'announcement.view')
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- Admin can create, manage, and view announcements
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'admin'::user_role_enum, p.id
FROM permissions p
WHERE p.code IN ('announcement.create', 'announcement.manage', 'announcement.view')
ON CONFLICT (user_role, permission_id) DO NOTHING;

-- Grant announcement permissions to enrollment roles
-- TA can create, manage, and view announcements
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'ta'::enrollment_role_enum, p.id
FROM permissions p
WHERE p.code IN ('announcement.create', 'announcement.manage', 'announcement.view')
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- Tutor can view announcements
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'tutor'::enrollment_role_enum, p.id
FROM permissions p
WHERE p.code = 'announcement.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

-- Student can view announcements
INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT 'student'::enrollment_role_enum, p.id
FROM permissions p
WHERE p.code = 'announcement.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;
