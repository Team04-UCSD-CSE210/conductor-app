-- Migration: Update users table to match new schema requirements
-- Adds: auth_source, deleted_at, status, password_hash, user_id, class_level, profile_url, phone_url, openai_url
-- Updates: Removes fields not in new schema, adds missing fields

-- Add auth_source enum type for tracking authentication source
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_source_enum') THEN
        CREATE TYPE auth_source_enum AS ENUM ('ucsd', 'extension');
    END IF;
END $$;

-- Add user_status enum type
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
        CREATE TYPE user_status_enum AS ENUM ('active', 'suspended', 'inactive');
    END IF;
END $$;

-- Add staff_role enum for course_staff table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role_enum') THEN
        CREATE TYPE staff_role_enum AS ENUM ('ta', 'tutor', 'grader');
    END IF;
END $$;

-- Add enrollment_role enum (update if needed)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_role_enum') THEN
        CREATE TYPE enrollment_role_enum AS ENUM ('student', 'ta', 'tutor', 'grader');
    END IF;
END $$;

-- Add new columns to users table
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS auth_source auth_source_enum,
    ADD COLUMN IF NOT EXISTS status user_status_enum DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS class_level TEXT,
    ADD COLUMN IF NOT EXISTS profile_url TEXT,
    ADD COLUMN IF NOT EXISTS phone_url TEXT,
    ADD COLUMN IF NOT EXISTS openai_url TEXT;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_users_auth_source ON users(auth_source);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Create course_staff table if it doesn't exist
CREATE TABLE IF NOT EXISTS course_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staff_role staff_role_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_staff UNIQUE (offering_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_staff_offering ON course_staff(offering_id);
CREATE INDEX IF NOT EXISTS idx_course_staff_user ON course_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_course_staff_role ON course_staff(staff_role);

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope TEXT NOT NULL CHECK (scope IN ('global', 'course', 'team')),
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_scope ON permissions(scope);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- Create user_role_permissions table
CREATE TABLE IF NOT EXISTS user_role_permissions (
    user_role user_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role_permissions UNIQUE (user_role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_permissions_role ON user_role_permissions(user_role);
CREATE INDEX IF NOT EXISTS idx_user_role_permissions_permission ON user_role_permissions(permission_id);

-- Create enrollment_role_permissions table
CREATE TABLE IF NOT EXISTS enrollment_role_permissions (
    enrollment_role enrollment_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment_role_permissions UNIQUE (enrollment_role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_role_permissions_role ON enrollment_role_permissions(enrollment_role);
CREATE INDEX IF NOT EXISTS idx_enrollment_role_permissions_permission ON enrollment_role_permissions(permission_id);

-- Create team_role_permissions table
CREATE TABLE IF NOT EXISTS team_role_permissions (
    team_role team_member_role_enum NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_role_permissions UNIQUE (team_role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_team_role_permissions_role ON team_role_permissions(team_role);
CREATE INDEX IF NOT EXISTS idx_team_role_permissions_permission ON team_role_permissions(permission_id);

-- Update enrollments table to use course_role TEXT instead of role enum (if needed)
-- Note: Keeping enrollment_role_enum for backward compatibility, but course_role is TEXT in new schema
ALTER TABLE enrollments 
    ADD COLUMN IF NOT EXISTS course_role TEXT;

-- Update activity_logs to use JSON instead of JSONB (matching new schema)
-- Note: JSONB is better, but matching provided schema
-- ALTER TABLE activity_logs ALTER COLUMN metadata TYPE JSON USING metadata::json;

