-- =====================================================================
-- RBAC & Permissions Layer for Conductor
-- =====================================================================

-- 0. Extensions --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- =====================================================================
-- 1. Core Types
-- =====================================================================

-- Unified course-level role type:
-- Represents "who am I in THIS course offering?"
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_role_enum') THEN
        CREATE TYPE course_role_enum AS ENUM ('instructor', 'ta', 'tutor', 'student');
    END IF;
END $$;

-- =====================================================================
-- 2. Permissions Catalog
-- =====================================================================

-- One row = one action that can potentially be granted.
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope       TEXT NOT NULL CHECK (scope IN ('global','course','team')),
    resource    TEXT NOT NULL,        -- 'roster','assignment','submission','team','announcement', etc.
    action      TEXT NOT NULL,        -- 'view','manage','create','update','delete','grade','all','manage_own',...
    code        TEXT UNIQUE,          -- e.g. 'course.roster.view' (optional but handy)
    description TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_permissions_sra
    ON permissions(scope, resource, action);

-- =====================================================================
-- 3. Role → Permission Mapping Tables 
-- =====================================================================

-- Global/platform roles (user_role_enum) → permissions
CREATE TABLE IF NOT EXISTS global_role_permissions (
    user_role     user_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (user_role, permission_id)
);

-- Course-level roles (course_role_enum) → permissions
CREATE TABLE IF NOT EXISTS course_role_permissions (
    course_role   course_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (course_role, permission_id)
);

-- Team-level roles (team_member_role_enum) → permissions
CREATE TABLE IF NOT EXISTS team_role_permissions (
    team_role     team_member_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (team_role, permission_id)
);

-- =====================================================================
-- 4. Unified Membership View: course_member_roles
-- =====================================================================

-- This view answers:
--   "For this (user_id, offering_id), what is their course_role_enum?"
-- It merges:
--   - course_offerings.instructor_id / co_instructor_id
--   - enrollments(role)
CREATE OR REPLACE VIEW course_member_roles AS
    -- Primary instructor
    SELECT
        co.instructor_id AS user_id,
        co.id            AS offering_id,
        'instructor'::course_role_enum AS role
    FROM course_offerings co
    WHERE co.instructor_id IS NOT NULL

    UNION

    -- Co-instructor (same permissions as instructor)
    SELECT
        co.co_instructor_id AS user_id,
        co.id               AS offering_id,
        'instructor'::course_role_enum AS role
    FROM course_offerings co
    WHERE co.co_instructor_id IS NOT NULL

    UNION

    -- Enrolled users (student / ta / tutor)
    SELECT
        e.user_id,
        e.offering_id,
        CASE e.role
            WHEN 'ta'     THEN 'ta'::course_role_enum
            WHEN 'tutor'  THEN 'tutor'::course_role_enum
            ELSE 'student'::course_role_enum
        END AS role
    FROM enrollments e
    WHERE e.status IN ('enrolled','completed');

-- =====================================================================
-- 5. Seed Default Permissions & Role Mappings
-- =====================================================================

-- 5.1 Insert permissions if they don't already exist
-- Helper: upsert-style using code as unique key.

-- Course-level permissions
INSERT INTO permissions (scope, resource, action, code, description)
VALUES
 ('course','roster','view',    'course.roster.view',    'View course roster'),
 ('course','roster','manage',  'course.roster.manage',  'Manage roster & roles'),
 ('course','assignment','manage', 'course.assignment.manage', 'Create/update assignments'),
 ('course','submission','grade',  'course.submission.grade',  'Grade submissions'),
 ('course','announcement','create', 'course.announcement.create','Create announcements'),
 ('course','announcement','view',   'course.announcement.view',  'View announcements')
ON CONFLICT (code) DO NOTHING;

-- Team-level permissions
INSERT INTO permissions (scope, resource, action, code, description)
VALUES
 ('team','team','view',        'team.view',         'View team details'),
 ('team','team','manage_own',  'team.manage_own',   'Manage own team as leader'),
 ('team','team','invite',      'team.invite',       'Invite members to team')
ON CONFLICT (code) DO NOTHING;

-- Global-level permissions
INSERT INTO permissions (scope, resource, action, code, description)
VALUES
 ('global','admin','all',      'global.admin.all',  'Full platform admin access')
ON CONFLICT (code) DO NOTHING;

-- 5.2 Map global roles → global permissions

-- Admins get all global-level permissions (here: global.admin.all).
INSERT INTO global_role_permissions (user_role, permission_id)
SELECT 'admin', p.id
FROM permissions p
WHERE p.scope = 'global'
ON CONFLICT DO NOTHING;

-- 5.3 Map course roles → course permissions

-- Students
INSERT INTO course_role_permissions (course_role, permission_id)
SELECT 'student', p.id
FROM permissions p
WHERE (p.scope, p.resource, p.action) IN (
    ('course','announcement','view')
)
ON CONFLICT DO NOTHING;

-- TAs
INSERT INTO course_role_permissions (course_role, permission_id)
SELECT 'ta', p.id
FROM permissions p
WHERE (p.scope, p.resource, p.action) IN (
    ('course','roster','view'),
    ('course','submission','grade'),
    ('course','announcement','create'),
    ('course','announcement','view')
)
ON CONFLICT DO NOTHING;

-- Tutors (example: limited TA-like role)
INSERT INTO course_role_permissions (course_role, permission_id)
SELECT 'tutor', p.id
FROM permissions p
WHERE (p.scope, p.resource, p.action) IN (
    ('course','roster','view'),
    ('course','announcement','view')
)
ON CONFLICT DO NOTHING;

-- Instructors (instructor_id / co_instructor_id in course_offerings)
-- Get all course-level permissions by default.
INSERT INTO course_role_permissions (course_role, permission_id)
SELECT 'instructor', p.id
FROM permissions p
WHERE p.scope = 'course'
ON CONFLICT DO NOTHING;

-- 5.4 Map team roles → team permissions

-- Team leaders
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT 'leader', p.id
FROM permissions p
WHERE (p.scope, p.resource, p.action) IN (
    ('team','team','view'),
    ('team','team','manage_own'),
    ('team','team','invite')
)
ON CONFLICT DO NOTHING;

-- Team members
INSERT INTO team_role_permissions (team_role, permission_id)
SELECT 'member', p.id
FROM permissions p
WHERE (p.scope, p.resource, p.action) IN (
    ('team','team','view')
)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. Permission Check Functions (optional but recommended)
-- =====================================================================

-- 6.1 Course-level permission check
-- Usage:
--   SELECT can_user_do_course_action(user_id, offering_id, 'roster', 'manage');
--
-- True if:
--   - user has a global role mapped to a matching permission, OR
--   - via course_member_roles they have course_role with matching permission.
CREATE OR REPLACE FUNCTION can_user_do_course_action(
    _user_id      UUID,
    _offering_id  UUID,
    _resource     TEXT,
    _action       TEXT
) RETURNS BOOLEAN
LANGUAGE sql
AS $func$
    SELECT EXISTS (

        -- (A) Global role-based permissions (e.g. admin)
        SELECT 1
        FROM users u
        JOIN global_role_permissions grp
          ON grp.user_role = u.role
        JOIN permissions p
          ON p.id = grp.permission_id
        WHERE u.id = _user_id
          AND p.scope    = 'global'
          AND p.resource = _resource
          AND p.action   = _action

        UNION

        -- (B) Course role-based permissions via course_member_roles
        SELECT 1
        FROM course_member_roles cmr
        JOIN course_role_permissions crp
          ON crp.course_role = cmr.role
        JOIN permissions p
          ON p.id = crp.permission_id
        WHERE cmr.user_id     = _user_id
          AND cmr.offering_id = _offering_id
          AND p.scope         = 'course'
          AND p.resource      = _resource
          AND p.action        = _action
    );
$func$;


-- 6.2 Team-level permission check
-- Assumes `team` table has (id, offering_id).
-- Usage:
--   SELECT can_user_do_team_action(user_id, team_id, 'team', 'manage_own');
--
-- True if:
--   - user has global admin perm, OR
--   - user has team_role with mapped perm, OR
--   - ser is instructor/TA in parent course_offering (override).
CREATE OR REPLACE FUNCTION can_user_do_team_action(
    _user_id  UUID,
    _team_id  UUID,
    _resource TEXT,
    _action   TEXT
) RETURNS BOOLEAN
LANGUAGE sql
AS $func$
    WITH team_ctx AS (
        SELECT t.id AS team_id, t.offering_id
        FROM team t
        WHERE t.id = _team_id
    )
    SELECT EXISTS (

        -- (A) Global admin-style permissions
        SELECT 1
        FROM users u
        JOIN global_role_permissions grp
          ON grp.user_role = u.role
        JOIN permissions p
          ON p.id = grp.permission_id
        WHERE u.id = _user_id
          AND p.scope    = 'global'
          AND p.resource = _resource
          AND p.action   = _action

        UNION

        -- (B) Team role-based permissions
        SELECT 1
        FROM team_ctx tc
        JOIN team_members tm
          ON tm.team_id = tc.team_id
        JOIN team_role_permissions trp
          ON trp.team_role = tm.role
        JOIN permissions p
          ON p.id = trp.permission_id
        WHERE tm.user_id  = _user_id
          AND p.scope     = 'team'
          AND p.resource  = _resource
          AND p.action    = _action

        UNION

        -- (C) course-level override
        -- e.g. instructor/TA of the parent offering can always manage team.
        SELECT 1
        FROM team_ctx tc
        JOIN course_member_roles cmr
          ON cmr.offering_id = tc.offering_id
         AND cmr.user_id     = _user_id
        JOIN course_role_permissions crp
          ON crp.course_role = cmr.role
        JOIN permissions p
          ON p.id = crp.permission_id
        WHERE p.scope    = 'course'
          AND p.resource = _resource
          AND p.action   = _action
    );
$func$;
