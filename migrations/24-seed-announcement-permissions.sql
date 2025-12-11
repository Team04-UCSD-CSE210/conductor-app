DO $$
DECLARE
    scope_course CONSTANT TEXT := 'course';
    resource_announcement CONSTANT TEXT := 'announcement';
    role_instructor CONSTANT user_role_enum := 'instructor'::user_role_enum;
    role_admin CONSTANT user_role_enum := 'admin'::user_role_enum;
    role_ta_enroll CONSTANT enrollment_role_enum := 'ta'::enrollment_role_enum;
    role_tutor_enroll CONSTANT enrollment_role_enum := 'tutor'::enrollment_role_enum;
    role_student_enroll CONSTANT enrollment_role_enum := 'student'::enrollment_role_enum;
    role_leader_team CONSTANT team_member_role_enum := 'leader'::team_member_role_enum;
BEGIN
WITH perms AS (
  SELECT * FROM (VALUES
    ('announcement.create', resource_announcement, 'create', scope_course, 'Create announcements'),
    ('announcement.manage', resource_announcement, 'manage', scope_course, 'Manage all announcements'),
    ('announcement.view', resource_announcement, 'view', scope_course, 'View announcements')
  ) AS v(code, resource, action, scope, description)
)
INSERT INTO permissions (code, resource, action, scope, description)
SELECT code, resource, action, scope, description
FROM perms
ON CONFLICT (code) DO NOTHING;

INSERT INTO user_role_permissions (user_role, permission_id)
SELECT role_instructor, p.id
FROM permissions p
WHERE p.code LIKE 'announcement.%'
ON CONFLICT (user_role, permission_id) DO NOTHING;

INSERT INTO user_role_permissions (user_role, permission_id)
SELECT role_admin, p.id
FROM permissions p
WHERE p.code LIKE 'announcement.%'
ON CONFLICT (user_role, permission_id) DO NOTHING;

INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT role_ta_enroll, p.id
FROM permissions p
WHERE p.code LIKE 'announcement.%'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT role_tutor_enroll, p.id
FROM permissions p
WHERE p.code = 'announcement.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
SELECT role_student_enroll, p.id
FROM permissions p
WHERE p.code = 'announcement.view'
ON CONFLICT (enrollment_role, permission_id) DO NOTHING;

INSERT INTO team_role_permissions (team_role, permission_id)
SELECT role_leader_team, p.id
FROM permissions p
WHERE p.code LIKE 'announcement.%'
ON CONFLICT (team_role, permission_id) DO NOTHING;
END $$;
