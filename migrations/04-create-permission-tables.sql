-- ============================================================
-- RBAC Migration: Permission System for Conductor
-- ------------------------------------------------------------
-- Sets up only the tables required for role-based access control:
--
--   - Enums for global, course, and team roles
--   - permissions               (catalog of all actions)
--   - user_role_permissions     (global roles → permissions)
--   - enrollment_role_permissions (course roles → permissions)
--   - team_role_permissions     (team roles → permissions)
-- ============================================================


-- ------------------------------------------------------------
-- Global Role Enum (users.primary_role)
-- Note: user_role_enum should already exist from 01-create-tables.sql
-- This ensures 'unregistered' is included if enum was created without it
-- ------------------------------------------------------------
DO $$ BEGIN
    -- Check if enum exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('admin', 'instructor', 'student', 'unregistered');
    ELSE
        -- If enum exists, add 'unregistered' if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'unregistered' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role_enum')
        ) THEN
            ALTER TYPE user_role_enum ADD VALUE 'unregistered';
        END IF;
    END IF;
END $$;


-- ------------------------------------------------------------
-- Course Role Enum (enrollments.course_role)
-- ------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_role_enum') THEN
        CREATE TYPE enrollment_role_enum AS ENUM ('student', 'ta', 'tutor', 'grader');
    END IF;
END $$;


-- ------------------------------------------------------------
-- Team Role Enum (team_members.role)
-- ------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_role_enum') THEN
        CREATE TYPE team_member_role_enum AS ENUM ('leader', 'member');
    END IF;
END $$;


-- ------------------------------------------------------------
-- permissions: catalog of all permission codes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope       TEXT NOT NULL CHECK (scope IN ('global', 'course', 'team')),
    resource    TEXT NOT NULL,   -- e.g. 'roster', 'user', 'assignment'
    action      TEXT NOT NULL,   -- e.g. 'import', 'view', 'update'
    code        TEXT UNIQUE NOT NULL,  -- e.g. 'roster.import'
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_code  ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_scope ON permissions(scope);


-- ------------------------------------------------------------
-- user_role_permissions: global role → permission
-- ------------------------------------------------------------
DO $$ 
BEGIN
    -- Drop table if it exists with wrong structure
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_role_permissions'
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_role_permissions' 
            AND column_name = 'user_role'
        )
    ) THEN
        DROP TABLE IF EXISTS user_role_permissions CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_role_permissions (
    user_role     user_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_role_permissions UNIQUE (user_role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_permissions_role
    ON user_role_permissions(user_role);

CREATE INDEX IF NOT EXISTS idx_user_role_permissions_permission
    ON user_role_permissions(permission_id);


-- ------------------------------------------------------------
-- enrollment_role_permissions: course role → permission
-- Uses enrollment_role_enum to match the enrollments table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollment_role_permissions (
    enrollment_role enrollment_role_enum NOT NULL,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_enrollment_role_permissions UNIQUE (enrollment_role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_role_permissions_role
    ON enrollment_role_permissions(enrollment_role);

CREATE INDEX IF NOT EXISTS idx_enrollment_role_permissions_permission
    ON enrollment_role_permissions(permission_id);


-- ------------------------------------------------------------
-- team_role_permissions: team role → permission
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_role_permissions (
    team_role     team_member_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_team_role_permissions UNIQUE (team_role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_team_role_permissions_role
    ON team_role_permissions(team_role);

CREATE INDEX IF NOT EXISTS idx_team_role_permissions_permission
    ON team_role_permissions(permission_id);
