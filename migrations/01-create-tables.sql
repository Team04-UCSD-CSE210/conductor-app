-- =====================================================
-- COURSE CONDUCTOR DATABASE SCHEMA
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =====================================================
-- ENUM TYPES
-- =====================================================
CREATE TYPE user_role_enum AS ENUM ('admin', 'instructor', 'student', 'unregistered');
CREATE TYPE user_status_enum AS ENUM ('active', 'busy', 'inactive');
CREATE TYPE institution_type_enum AS ENUM ('ucsd', 'extension');
CREATE TYPE course_role_enum AS ENUM ('student', 'ta', 'tutor');
CREATE TYPE enrollment_status_enum AS ENUM ('enrolled', 'waitlisted', 'dropped', 'completed');
CREATE TYPE course_offering_status_enum AS ENUM ('open', 'closed', 'completed');
CREATE TYPE assignment_type_enum AS ENUM ('project', 'hw', 'exam', 'checkpoint');
CREATE TYPE assignment_assigned_to_enum AS ENUM ('team', 'individual');
CREATE TYPE team_status_enum AS ENUM ('forming', 'active', 'inactive');
CREATE TYPE team_member_role_enum AS ENUM ('leader', 'member');
CREATE TYPE submission_status_enum AS ENUM ('draft', 'submitted', 'graded');
CREATE TYPE attendance_status_enum AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE activity_action_type_enum AS ENUM (
    'login', 'logout',
    'submit_assignment', 'update_submission',
    'join_team', 'leave_team',
    'grade_submission',
    'create_assignment', 'update_assignment',
    'enroll', 'drop'
);

-- =====================================================
-- TRIGGER FUNCTION FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
    -- Preserve created_by and created_at
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME != 'users' THEN
            NEW.created_by = OLD.created_by;
        END IF;
        NEW.created_at = OLD.created_at;
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
    course_role course_role_enum NOT NULL,
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
-- 9. ATTENDANCE
-- Tracks student attendance for each class date
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status_enum NOT NULL,
    marked_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(offering_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_offering ON attendance(offering_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE attendance IS 'Tracks student attendance for each class date';

-- =====================================================
-- 10. AUTH_LOGS
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
-- 11. WHITELIST
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
-- 12. ACCESS_REQUESTS
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
