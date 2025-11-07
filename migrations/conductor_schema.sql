
-- Conductor App Schema (PostgreSQL)
-- Requires: uuid-ossp (for uuid_generate_v4) and citext

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ==============================
-- ENUM TYPES
-- ==============================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('admin','instructor','student');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_status_enum') THEN
        CREATE TYPE course_status_enum AS ENUM ('open','closed','completed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_role_enum') THEN
        CREATE TYPE enrollment_role_enum AS ENUM ('student','ta','tutor');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status_enum') THEN
        CREATE TYPE enrollment_status_enum AS ENUM ('enrolled','waitlisted','dropped','completed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_role_enum') THEN
        CREATE TYPE team_member_role_enum AS ENUM ('member','leader');
    END IF;
END $$;

-- ==============================
-- TRIGGER FOR updated_at
-- ==============================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================
-- USERS
-- ==============================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           CITEXT UNIQUE NOT NULL,
    ucsd_pid        TEXT UNIQUE,
    name            TEXT,
    preferred_name  TEXT,
    pronouns        TEXT,
    major           TEXT,
    degree_program  TEXT,
    academic_year   INTEGER,
    department      TEXT,
    access_level    INTEGER,
    role            user_role_enum DEFAULT 'student' NOT NULL,
    title           TEXT,
    office          TEXT,
    photo_url       TEXT,
    image_url       TEXT,
    github_username TEXT,
    linkedin_url    TEXT,
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- AUTH_SESSIONS
-- ==============================
CREATE TABLE IF NOT EXISTS auth_sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================
-- COURSE_TEMPLATE
-- ==============================
CREATE TABLE IF NOT EXISTS course_template (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code         TEXT,                     -- e.g., CSE210
    name         TEXT,
    department   TEXT,
    description  TEXT,
    credits      INTEGER,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_course_template_updated_at ON course_template;
CREATE TRIGGER trg_course_template_updated_at
BEFORE UPDATE ON course_template
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- COURSE_OFFERINGS
-- ==============================
CREATE TABLE IF NOT EXISTS course_offerings (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id    UUID NOT NULL REFERENCES course_template(id) ON DELETE CASCADE,
    term           TEXT NOT NULL,            -- e.g., Fall, Winter
    year           INTEGER NOT NULL,
    section        TEXT,                     -- e.g., A00
    instructor_id  UUID REFERENCES users(id),
    co_instructor_id UUID REFERENCES users(id),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    enrollment_cap INTEGER,
    location       TEXT,
    class_timings  JSONB,                    -- arbitrary schedule structure
    syllabus_url   TEXT,
    status         course_status_enum DEFAULT 'open' NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offering UNIQUE (template_id, term, year, section)
);

DROP TRIGGER IF EXISTS trg_course_offerings_updated_at ON course_offerings;
CREATE TRIGGER trg_course_offerings_updated_at
BEFORE UPDATE ON course_offerings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_offerings_template ON course_offerings(template_id);
CREATE INDEX IF NOT EXISTS idx_offerings_term_year ON course_offerings(term, year);

-- ==============================
-- ENROLLMENTS
-- ==============================
CREATE TABLE IF NOT EXISTS enrollments (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id   UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          enrollment_role_enum NOT NULL DEFAULT 'student',
    status        enrollment_status_enum NOT NULL DEFAULT 'enrolled',
    enrolled_at   DATE,
    dropped_at    DATE,
    final_grade   TEXT,
    grade_numeric DECIMAL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment UNIQUE (offering_id, user_id)
);

DROP TRIGGER IF EXISTS trg_enrollments_updated_at ON enrollments;
CREATE TRIGGER trg_enrollments_updated_at
BEFORE UPDATE ON enrollments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_enrollments_offering ON enrollments(offering_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);

-- ==============================
-- TEAM
-- ==============================
CREATE TABLE IF NOT EXISTS team (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id   UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    name          TEXT,
    team_number   INTEGER,
    leader_id     UUID REFERENCES users(id),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    formed_at     DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_team_updated_at ON team;
CREATE TRIGGER trg_team_updated_at
BEFORE UPDATE ON team
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_team_offering ON team(offering_id);

-- ==============================
-- TEAM_MEMBERS
-- ==============================
CREATE TABLE IF NOT EXISTS team_members (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id    UUID NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       team_member_role_enum NOT NULL DEFAULT 'member',
    joined_at  DATE,
    left_at    DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ==============================
-- ACTIVITY_LOGS
-- ==============================
CREATE TABLE IF NOT EXISTS activity_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    offering_id  UUID REFERENCES course_offerings(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,          -- short verb or message
    metadata     JSONB,                  -- any extra details (e.g., payloads, diffs)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_offering ON activity_logs(offering_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at);
