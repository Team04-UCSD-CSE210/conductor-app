-- =====================================================
-- COURSE CONDUCTOR DATABASE SCHEMA
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =====================================================
-- ENUM TYPES
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('admin', 'instructor', 'student', 'unregistered');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
        CREATE TYPE user_status_enum AS ENUM ('active', 'busy', 'inactive');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'institution_type_enum') THEN
        CREATE TYPE institution_type_enum AS ENUM ('ucsd', 'extension');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_role_enum') THEN
        CREATE TYPE enrollment_role_enum AS ENUM ('student', 'ta', 'tutor');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status_enum') THEN
        CREATE TYPE enrollment_status_enum AS ENUM ('enrolled', 'waitlisted', 'dropped', 'completed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_offering_status_enum') THEN
        CREATE TYPE course_offering_status_enum AS ENUM ('open', 'closed', 'completed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type_enum') THEN
        CREATE TYPE assignment_type_enum AS ENUM ('project', 'hw', 'exam', 'checkpoint');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_assigned_to_enum') THEN
        CREATE TYPE assignment_assigned_to_enum AS ENUM ('team', 'individual');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_status_enum') THEN
        CREATE TYPE team_status_enum AS ENUM ('forming', 'active', 'inactive');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_role_enum') THEN
        CREATE TYPE team_member_role_enum AS ENUM ('leader', 'member');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status_enum') THEN
        CREATE TYPE submission_status_enum AS ENUM ('draft', 'submitted', 'graded');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
        CREATE TYPE attendance_status_enum AS ENUM ('present', 'absent', 'late', 'excused');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_action_type_enum') THEN
        CREATE TYPE activity_action_type_enum AS ENUM (
            'login', 'logout',
            'submit_assignment', 'update_submission',
            'join_team', 'leave_team',
            'grade_submission',
            'create_assignment', 'update_assignment',
            'enroll', 'drop'
        );
    END IF;
END $$;

-- =====================================================
-- TRIGGER FUNCTION FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
    -- Preserve created_by and created_at
    IF TG_OP = 'UPDATE' THEN
        -- Only preserve created_by if the column exists (not on users, attendance, session_responses)
        IF TG_TABLE_NAME NOT IN ('users', 'attendance', 'session_responses') THEN
            NEW.created_by = OLD.created_by;
        END IF;
        -- Only preserve created_at if the column exists (not on session_responses)
        IF TG_TABLE_NAME != 'session_responses' THEN
            NEW.created_at = OLD.created_at;
        END IF;
    END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. USERS
-- Stores all people (admin, instructor, TA, student)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    ucsd_pid TEXT,
    name TEXT NOT NULL,
    preferred_name TEXT,
    major TEXT,
    degree_program TEXT,
    academic_year INTEGER,
    department TEXT,
    class_level TEXT,
    primary_role user_role_enum NOT NULL,
    status user_status_enum NOT NULL,
    institution_type institution_type_enum,
    profile_url TEXT,
    image_url TEXT,
    phone_number TEXT,
    github_username TEXT,
    linkedin_url TEXT,
    google_id TEXT UNIQUE,
    oauth_provider TEXT DEFAULT 'google',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_primary_role ON users(primary_role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Stores all people: admin, instructor, TA, and students';

-- =====================================================
-- 2. COURSE_OFFERINGS
-- Contains course information (typically one row for your app)
-- =====================================================
CREATE TABLE IF NOT EXISTS course_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    term TEXT,
    year INTEGER,
    credits INTEGER,
    instructor_id UUID NOT NULL REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    enrollment_cap INTEGER,
    status course_offering_status_enum,
    location TEXT,
    class_timings JSONB,
    syllabus_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    UNIQUE(code, term, year)
);

CREATE INDEX IF NOT EXISTS idx_course_offerings_instructor ON course_offerings(instructor_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_active ON course_offerings(is_active);
CREATE INDEX IF NOT EXISTS idx_course_offerings_created_by ON course_offerings(created_by);

DROP TRIGGER IF EXISTS update_course_offerings_updated_at ON course_offerings;
CREATE TRIGGER update_course_offerings_updated_at BEFORE UPDATE ON course_offerings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE course_offerings IS 'Course information - typically one row for single-course app';

-- =====================================================
-- 3. ENROLLMENTS
-- Links students/TA/tutors to the course offering
-- =====================================================
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_role enrollment_role_enum NOT NULL,
    status enrollment_status_enum NOT NULL,
    enrolled_at DATE,
    dropped_at DATE,
    final_grade TEXT,
    grade_marks DECIMAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    UNIQUE(offering_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_offering ON enrollments(offering_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_role ON enrollments(course_role);
CREATE INDEX IF NOT EXISTS idx_enrollments_created_by ON enrollments(created_by);

DROP TRIGGER IF EXISTS update_enrollments_updated_at ON enrollments;
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE enrollments IS 'Links users to courses with their role and status';

-- =====================================================
-- 4. ASSIGNMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type assignment_type_enum NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    late_policy JSONB,
    max_points DECIMAL,
    rubric JSONB,
    assigned_to assignment_assigned_to_enum,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_offering ON assignments(offering_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_created_by ON assignments(created_by);

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE assignments IS 'Course assignments (projects, homework, exams, checkpoints)';

-- =====================================================
-- 5. TEAM
-- =====================================================
CREATE TABLE IF NOT EXISTS team (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    team_number INTEGER,
    leader_id UUID REFERENCES users(id),
    status team_status_enum,
    formed_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_team_offering ON team(offering_id);
CREATE INDEX IF NOT EXISTS idx_team_leader ON team(leader_id);
CREATE INDEX IF NOT EXISTS idx_team_created_by ON team(created_by);

DROP TRIGGER IF EXISTS update_team_updated_at ON team;
CREATE TRIGGER update_team_updated_at BEFORE UPDATE ON team
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE team IS 'Student teams within the course';

-- =====================================================
-- 6. TEAM_MEMBERS
-- =====================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_member_role_enum,
    joined_at DATE,
    left_at DATE,
    added_by UUID REFERENCES users(id),
    removed_by UUID REFERENCES users(id),
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_added_by ON team_members(added_by);

COMMENT ON TABLE team_members IS 'Team membership records';

-- =====================================================
-- 7. SUBMISSIONS
-- Tracks assignment submissions and grades
-- =====================================================
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES team(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ,
    status submission_status_enum NOT NULL,
    score DECIMAL,
    feedback TEXT,
    files JSONB,
    graded_by UUID REFERENCES users(id),
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    CONSTRAINT submission_owner CHECK (
        (team_id IS NULL AND user_id IS NOT NULL) OR
        (team_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_graded_by ON submissions(graded_by);

DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE submissions IS 'Tracks student/team submissions and grades';

-- =====================================================
-- 8. ACTIVITY_LOGS
-- Tracks everything users do
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offering_id UUID REFERENCES course_offerings(id) ON DELETE CASCADE,
    action_type activity_action_type_enum NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_offering ON activity_logs(offering_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

COMMENT ON TABLE activity_logs IS 'Audit trail of all user actions';

-- =====================================================
-- 9. SESSIONS
-- Specific class sessions with dates and access codes
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    session_date DATE NOT NULL,
    session_time TIME,
    access_code TEXT NOT NULL UNIQUE,
    code_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    attendance_opened_at TIMESTAMPTZ,
    attendance_closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_offering ON sessions(offering_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_access_code ON sessions(access_code);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE sessions IS 'Class sessions with unique access codes for student attendance';

-- =====================================================
-- 10. SESSION_QUESTIONS
-- Questions/prompts for sessions (text entry, multiple choice, pulse check)
-- =====================================================
CREATE TABLE IF NOT EXISTS session_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'text', 'multiple_choice', 'pulse_check'
    question_order INTEGER,
    options JSONB, -- For multiple choice options
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_session_questions_session ON session_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_session_questions_type ON session_questions(question_type);

DROP TRIGGER IF EXISTS update_session_questions_updated_at ON session_questions;
CREATE TRIGGER update_session_questions_updated_at BEFORE UPDATE ON session_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE session_questions IS 'Questions and prompts for class sessions';

-- =====================================================
-- 11. SESSION_RESPONSES
-- Student responses to session questions
-- =====================================================
CREATE TABLE IF NOT EXISTS session_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES session_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response_text TEXT,
    response_option TEXT, -- For multiple choice
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT session_responses_session_question_user_unique UNIQUE(session_id, question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_responses_session ON session_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_session_responses_question ON session_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_session_responses_user ON session_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_session_responses_submitted ON session_responses(submitted_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'session_responses'::regclass
          AND conname = 'session_responses_session_question_user_unique'
    ) THEN
        ALTER TABLE session_responses
        ADD CONSTRAINT session_responses_session_question_user_unique
        UNIQUE (session_id, question_id, user_id);
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS update_session_responses_updated_at ON session_responses;
CREATE TRIGGER update_session_responses_updated_at BEFORE UPDATE ON session_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE session_responses IS 'Student responses to session questions';

-- =====================================================
-- 12. ATTENDANCE
-- Tracks student attendance for each class session
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status attendance_status_enum NOT NULL,
    checked_in_at TIMESTAMPTZ,
    access_code_used TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_checked_in ON attendance(checked_in_at);

DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE attendance IS 'Tracks student attendance for each class session';

-- =====================================================
-- 13. AUTH_LOGS
-- Tracks authentication events (login, logout, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS auth_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    message TEXT,
    user_email CITEXT,
    ip_address TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    path TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_email ON auth_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at);

COMMENT ON TABLE auth_logs IS 'Audit trail of all authentication events';

-- =====================================================
-- 14. WHITELIST
-- Approved extension students who can access the system
-- =====================================================
CREATE TABLE IF NOT EXISTS whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    approved_by TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whitelist_email ON whitelist(email);

COMMENT ON TABLE whitelist IS 'Approved extension students who can access the system';

-- =====================================================
-- 15. ACCESS_REQUESTS
-- Pending access requests from non-UCSD users
-- =====================================================
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_requested_at ON access_requests(requested_at);

COMMENT ON TABLE access_requests IS 'Pending access requests from non-UCSD users';
