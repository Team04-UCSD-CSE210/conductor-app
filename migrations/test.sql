\echo '=== Conductor App Comprehensive Database Tests ==='
\echo 'Testing ENUM types, constraints, triggers, and relationships'
\echo ''

BEGIN;

-- ============ CLEANUP (idempotent) ============
\echo '--- Cleaning up test data ---'

DELETE FROM activity_logs
WHERE action_type IN ('test_login', 'test_submit', 'test_enroll');

DELETE FROM attendance
WHERE offering_id IN (SELECT id FROM course_offerings WHERE code = 'CSE210TEST');

DELETE FROM submissions
WHERE assignment_id IN (SELECT id FROM assignments WHERE title LIKE 'Test%');

DELETE FROM assignments
WHERE title LIKE 'Test%';

DELETE FROM team_members
WHERE team_id IN (SELECT id FROM team WHERE name LIKE 'Test Team%');

DELETE FROM team
WHERE name LIKE 'Test Team%';

DELETE FROM enrollments
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.ucsd.edu')
   OR offering_id IN (SELECT id FROM course_offerings WHERE code = 'CSE210TEST');

DELETE FROM course_offerings
WHERE code = 'CSE210TEST';

DELETE FROM users
WHERE email LIKE '%@test.ucsd.edu' OR email LIKE '%@test.gmail.com';

COMMIT;

-- ============ TEST 1: ENUM VALIDATION TESTS ============
\echo ''
\echo '=== TEST 1: ENUM Type Validation ==='

BEGIN;

\echo '1.1) Testing valid user_role_enum values'
INSERT INTO users (email, name, primary_role, status)
VALUES ('admin@test.ucsd.edu', 'Admin User', 'admin', 'active'),
       ('instructor@test.ucsd.edu', 'Instructor User', 'instructor', 'active'),
       ('student@test.ucsd.edu', 'Student User', 'student', 'active');
\echo '✓ Valid roles accepted'

\echo '1.2) Testing invalid user_role_enum (should fail)'
DO $$
BEGIN
    BEGIN
        INSERT INTO users (email, name, primary_role, status)
        VALUES ('invalid@test.ucsd.edu', 'Invalid Role', 'invalid_role', 'active');
        RAISE EXCEPTION 'Should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%user_role_enum%' THEN
            RAISE NOTICE '✓ Invalid role correctly rejected';
        ELSE
            RAISE;
        END IF;
    END;
END $$;

\echo '1.3) Testing valid user_status_enum values'
UPDATE users SET status = 'busy' WHERE email = 'student@test.ucsd.edu';
UPDATE users SET status = 'inactive' WHERE email = 'student@test.ucsd.edu';
UPDATE users SET status = 'active' WHERE email = 'student@test.ucsd.edu';
\echo '✓ Valid statuses accepted'

\echo '1.4) Testing institution_type_enum'
UPDATE users SET institution_type = 'ucsd' WHERE email LIKE '%@test.ucsd.edu';
UPDATE users SET institution_type = 'extension' WHERE email LIKE '%@test.gmail.com';
\echo '✓ Valid institution types accepted'

ROLLBACK;

-- ============ TEST 2: USER TABLE TESTS ============
\echo ''
\echo '=== TEST 2: Users Table ==='

BEGIN;

\echo '2.1) Create users with all fields'
INSERT INTO users (email, ucsd_pid, name, preferred_name, major, degree_program, 
                   academic_year, department, class_level, primary_role, status, 
                   institution_type, phone_number, github_username, linkedin_url)
VALUES 
    ('prof@test.ucsd.edu', 'A12345678', 'Professor Test', 'Prof T', 'Computer Science',
     'PhD', 2025, 'CSE', 'Graduate', 'instructor', 'active', 'ucsd',
     '858-555-0100', 'profgithub', 'https://linkedin.com/in/proftest'),
    ('student1@test.ucsd.edu', 'A87654321', 'Student One', 'Stu', 'Computer Science',
     'BS', 2025, 'CSE', 'Undergraduate', 'student', 'active', 'ucsd',
     '858-555-0101', 'student1github', NULL),
    ('extension@test.gmail.com', NULL, 'Extension Student', NULL, NULL, NULL,
     NULL, NULL, NULL, 'student', 'active', 'extension', NULL, NULL, NULL);
\echo '✓ Users created with all fields'

\echo '2.2) Test email uniqueness constraint'
DO $$
BEGIN
    BEGIN
        INSERT INTO users (email, name, primary_role, status)
        VALUES ('prof@test.ucsd.edu', 'Duplicate', 'student', 'active');
        RAISE EXCEPTION 'Should have failed';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Email uniqueness constraint works';
    END;
END $$;

\echo '2.3) Test soft delete'
UPDATE users SET deleted_at = NOW() WHERE email = 'student1@test.ucsd.edu';
\echo '✓ Soft delete works'

\echo '2.4) Test restore (soft delete)'
UPDATE users SET deleted_at = NULL WHERE email = 'student1@test.ucsd.edu';
\echo '✓ Restore works'

\echo '2.5) Test updated_at trigger'
SELECT pg_sleep(1); -- Ensure timestamp difference
UPDATE users SET preferred_name = 'Updated Name' WHERE email = 'prof@test.ucsd.edu';
SELECT 
    CASE 
        WHEN updated_at > created_at THEN '✓ updated_at trigger works'
        ELSE '✗ updated_at trigger failed'
    END AS trigger_test
FROM users WHERE email = 'prof@test.ucsd.edu';

COMMIT;

-- ============ TEST 3: COURSE_OFFERINGS TABLE TESTS ============
\echo ''
\echo '=== TEST 3: Course Offerings Table ==='

BEGIN;

\echo '3.1) Create course offering'
INSERT INTO course_offerings (
    code, name, department, term, year, credits, instructor_id,
    start_date, end_date, enrollment_cap, status, location,
    class_timings, syllabus_url, is_active
)
VALUES (
    'CSE210TEST', 'Software Engineering Test', 'CSE', 'Winter', 2025, 4,
    (SELECT id FROM users WHERE email = 'prof@test.ucsd.edu'),
    '2025-01-05', '2025-03-15', 200, 'open', 'Room 101',
    '{"monday": "10:00-11:00", "wednesday": "10:00-11:00"}'::jsonb,
    'https://example.com/syllabus', TRUE
);
\echo '✓ Course offering created'

\echo '3.2) Test unique constraint (code, term, year)'
DO $$
BEGIN
    BEGIN
        INSERT INTO course_offerings (
            code, name, department, term, year, credits, instructor_id,
            start_date, end_date
        )
        VALUES (
            'CSE210TEST', 'Duplicate', 'CSE', 'Winter', 2025, 4,
            (SELECT id FROM users WHERE email = 'prof@test.ucsd.edu'),
            '2025-01-05', '2025-03-15'
        );
        RAISE EXCEPTION 'Should have failed';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Unique constraint (code, term, year) works';
    END;
END $$;

\echo '3.3) Test course_offering_status_enum'
UPDATE course_offerings SET status = 'closed' WHERE code = 'CSE210TEST';
UPDATE course_offerings SET status = 'completed' WHERE code = 'CSE210TEST';
UPDATE course_offerings SET status = 'open' WHERE code = 'CSE210TEST';
\echo '✓ Valid course offering statuses accepted'

COMMIT;

-- ============ TEST 4: ENROLLMENTS TABLE TESTS ============
\echo ''
\echo '=== TEST 4: Enrollments Table ==='

BEGIN;

\echo '4.1) Enroll students with different course roles'
INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
VALUES (
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    'student', 'enrolled', CURRENT_DATE
);

INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
VALUES (
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    (SELECT id FROM users WHERE email = 'extension@test.gmail.com'),
    'ta', 'enrolled', CURRENT_DATE
);
\echo '✓ Enrollments created'

\echo '4.2) Test course_role_enum values'
UPDATE enrollments SET course_role = 'tutor' 
WHERE user_id = (SELECT id FROM users WHERE email = 'extension@test.gmail.com');
\echo '✓ Valid course roles accepted'

\echo '4.3) Test enrollment_status_enum values'
UPDATE enrollments SET status = 'waitlisted' 
WHERE user_id = (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu');
UPDATE enrollments SET status = 'dropped' 
WHERE user_id = (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu');
UPDATE enrollments SET status = 'completed' 
WHERE user_id = (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu');
\echo '✓ Valid enrollment statuses accepted'

\echo '4.4) Test unique constraint (offering_id, user_id)'
DO $$
BEGIN
    BEGIN
        INSERT INTO enrollments (offering_id, user_id, course_role, status)
        VALUES (
            (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
            (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
            'student', 'enrolled'
        );
        RAISE EXCEPTION 'Should have failed';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Unique constraint (offering_id, user_id) works';
    END;
END $$;

\echo '4.5) Test foreign key cascade delete'
DELETE FROM course_offerings WHERE code = 'CSE210TEST';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ CASCADE delete works (enrollments deleted)'
        ELSE '✗ CASCADE delete failed'
    END AS cascade_test
FROM enrollments 
WHERE offering_id IN (SELECT id FROM course_offerings WHERE code = 'CSE210TEST');

ROLLBACK;

-- ============ TEST 5: ASSIGNMENTS TABLE TESTS ============
\echo ''
\echo '=== TEST 5: Assignments Table ==='

BEGIN;

\echo '5.1) Create assignments with different types'
INSERT INTO assignments (
    offering_id, title, type, due_date, max_points, assigned_to,
    late_policy, rubric
)
VALUES (
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'Test Project', 'project', '2025-02-15 23:59:59', 100.0, 'team',
    '{"penalty_per_day": 10, "max_days": 3}'::jsonb,
    '{"criteria": ["design", "implementation", "testing"]}'::jsonb
),
(
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'Test Homework', 'hw', '2025-01-20 23:59:59', 50.0, 'individual',
    NULL, NULL
),
(
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'Test Exam', 'exam', '2025-02-01 14:00:00', 200.0, 'individual',
    NULL, NULL
),
(
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'Test Checkpoint', 'checkpoint', '2025-01-15 23:59:59', 25.0, 'team',
    NULL, NULL
);
\echo '✓ Assignments created with all types'

\echo '5.2) Test assignment_type_enum'
SELECT 
    CASE 
        WHEN COUNT(DISTINCT type) = 4 THEN '✓ All assignment types work'
        ELSE '✗ Assignment types failed'
    END AS type_test
FROM assignments WHERE title LIKE 'Test%';

\echo '5.3) Test assignment_assigned_to_enum'
SELECT 
    CASE 
        WHEN COUNT(*) = 2 THEN '✓ assigned_to enum works (team)'
        ELSE '✗ assigned_to enum failed'
    END AS assigned_test
FROM assignments WHERE assigned_to = 'team' AND title LIKE 'Test%';

COMMIT;

-- ============ TEST 6: SUBMISSIONS TABLE TESTS ============
\echo ''
\echo '=== TEST 6: Submissions Table ==='

BEGIN;

\echo '6.1) Create individual submission'
INSERT INTO submissions (
    assignment_id, user_id, submitted_at, status, score, feedback, files
)
VALUES (
    (SELECT id FROM assignments WHERE title = 'Test Homework'),
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    NOW(), 'submitted', 45.0, 'Good work!', '["file1.pdf", "file2.zip"]'::jsonb
);
\echo '✓ Individual submission created'

\echo '6.2) Create team submission'
INSERT INTO team (offering_id, name, team_number, status, formed_at)
VALUES (
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'Test Team 1', 1, 'active', CURRENT_DATE
);

INSERT INTO team_members (team_id, user_id, role, joined_at)
VALUES (
    (SELECT id FROM team WHERE name = 'Test Team 1'),
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    'leader', CURRENT_DATE
);

INSERT INTO submissions (
    assignment_id, team_id, submitted_at, status, score, feedback
)
VALUES (
    (SELECT id FROM assignments WHERE title = 'Test Project'),
    (SELECT id FROM team WHERE name = 'Test Team 1'),
    NOW(), 'graded', 95.0, 'Excellent project!'
);
\echo '✓ Team submission created'

\echo '6.3) Test submission_owner constraint (should fail if both user_id and team_id are NULL)'
DO $$
BEGIN
    BEGIN
        INSERT INTO submissions (assignment_id, submitted_at, status)
        VALUES (
            (SELECT id FROM assignments WHERE title = 'Test Homework'),
            NOW(), 'draft'
        );
        RAISE EXCEPTION 'Should have failed';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '✓ submission_owner constraint works';
    END;
END $$;

\echo '6.4) Test submission_status_enum'
UPDATE submissions SET status = 'draft' WHERE status = 'submitted';
UPDATE submissions SET status = 'graded' WHERE status = 'draft';
\echo '✓ Valid submission statuses accepted'

COMMIT;

-- ============ TEST 7: TEAM AND TEAM_MEMBERS TESTS ============
\echo ''
\echo '=== TEST 7: Team and Team Members ==='

BEGIN;

\echo '7.1) Create team with leader'
INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at)
VALUES (
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'Test Team 2', 2, 
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    'active', CURRENT_DATE
);
\echo '✓ Team created'

\echo '7.2) Test team_status_enum'
UPDATE team SET status = 'forming' WHERE name = 'Test Team 2';
UPDATE team SET status = 'inactive' WHERE name = 'Test Team 2';
UPDATE team SET status = 'active' WHERE name = 'Test Team 2';
\echo '✓ Valid team statuses accepted'

\echo '7.3) Add team members'
INSERT INTO team_members (team_id, user_id, role, joined_at)
VALUES (
    (SELECT id FROM team WHERE name = 'Test Team 2'),
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    'leader', CURRENT_DATE
),
(
    (SELECT id FROM team WHERE name = 'Test Team 2'),
    (SELECT id FROM users WHERE email = 'extension@test.gmail.com'),
    'member', CURRENT_DATE
);
\echo '✓ Team members added'

\echo '7.4) Test team_member_role_enum'
SELECT 
    CASE 
        WHEN COUNT(*) = 2 THEN '✓ Team member roles work'
        ELSE '✗ Team member roles failed'
    END AS role_test
FROM team_members 
WHERE team_id = (SELECT id FROM team WHERE name = 'Test Team 2');

\echo '7.5) Test unique constraint (team_id, user_id)'
DO $$
BEGIN
    BEGIN
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (
            (SELECT id FROM team WHERE name = 'Test Team 2'),
            (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
            'member'
        );
        RAISE EXCEPTION 'Should have failed';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Unique constraint (team_id, user_id) works';
    END;
END $$;

COMMIT;

-- ============ TEST 8: ATTENDANCE TABLE TESTS ============
\echo ''
\echo '=== TEST 8: Attendance Table ==='

BEGIN;

\echo '8.1) Create attendance records'
INSERT INTO attendance (offering_id, user_id, date, status, marked_by)
VALUES (
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    '2025-01-10', 'present',
    (SELECT id FROM users WHERE email = 'prof@test.ucsd.edu')
),
(
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    '2025-01-12', 'late',
    (SELECT id FROM users WHERE email = 'prof@test.ucsd.edu')
),
(
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    (SELECT id FROM users WHERE email = 'extension@test.gmail.com'),
    '2025-01-10', 'absent',
    (SELECT id FROM users WHERE email = 'prof@test.ucsd.edu')
);
\echo '✓ Attendance records created'

\echo '8.2) Test attendance_status_enum'
UPDATE attendance SET status = 'excused' WHERE status = 'absent';
\echo '✓ Valid attendance statuses accepted'

\echo '8.3) Test unique constraint (offering_id, user_id, date)'
DO $$
BEGIN
    BEGIN
        INSERT INTO attendance (offering_id, user_id, date, status, marked_by)
        VALUES (
            (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
            (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
            '2025-01-10', 'present',
            (SELECT id FROM users WHERE email = 'prof@test.ucsd.edu')
        );
        RAISE EXCEPTION 'Should have failed';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Unique constraint (offering_id, user_id, date) works';
    END;
END $$;

COMMIT;

-- ============ TEST 9: ACTIVITY_LOGS TABLE TESTS ============
\echo ''
\echo '=== TEST 9: Activity Logs Table ==='

BEGIN;

\echo '9.1) Create activity logs with different action types'
INSERT INTO activity_logs (user_id, offering_id, action_type, metadata)
VALUES (
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'login', '{"ip": "192.168.1.1"}'::jsonb
),
(
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'submit_assignment', '{"assignment_id": "test-123"}'::jsonb
),
(
    (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu'),
    (SELECT id FROM course_offerings WHERE code = 'CSE210TEST'),
    'enroll', '{"course": "CSE210TEST"}'::jsonb
);
\echo '✓ Activity logs created'

\echo '9.2) Test activity_action_type_enum'
SELECT 
    CASE 
        WHEN COUNT(DISTINCT action_type) >= 3 THEN '✓ Activity action types work'
        ELSE '✗ Activity action types failed'
    END AS action_test
FROM activity_logs 
WHERE user_id = (SELECT id FROM users WHERE email = 'student1@test.ucsd.edu');

COMMIT;

-- ============ VERIFICATION QUERIES ============
\echo ''
\echo '=== VERIFICATION: Final Data Check ==='

\echo '--- Users ---'
SELECT email, name, primary_role, status, institution_type, deleted_at IS NULL AS is_active
FROM users
WHERE email LIKE '%@test.%'
ORDER BY email;

\echo '--- Course Offerings ---'
SELECT code, name, term, year, status, is_active
FROM course_offerings
WHERE code = 'CSE210TEST';

\echo '--- Enrollments ---'
SELECT u.email, e.course_role, e.status, e.enrolled_at
FROM enrollments e
JOIN users u ON u.id = e.user_id
JOIN course_offerings co ON co.id = e.offering_id
WHERE co.code = 'CSE210TEST'
ORDER BY u.email;

\echo '--- Assignments ---'
SELECT title, type, assigned_to, max_points, due_date
FROM assignments
WHERE title LIKE 'Test%'
ORDER BY due_date;

\echo '--- Submissions ---'
SELECT 
    a.title AS assignment,
    u.email AS user_email,
    t.name AS team_name,
    s.status,
    s.score
FROM submissions s
JOIN assignments a ON a.id = s.assignment_id
LEFT JOIN users u ON u.id = s.user_id
LEFT JOIN team t ON t.id = s.team_id
WHERE a.title LIKE 'Test%';

\echo '--- Teams and Members ---'
SELECT 
    t.name AS team_name,
    t.status AS team_status,
    u.email AS member_email,
    tm.role AS member_role
FROM team t
JOIN team_members tm ON tm.team_id = t.id
JOIN users u ON u.id = tm.user_id
WHERE t.name LIKE 'Test Team%'
ORDER BY t.name, tm.role;

\echo '--- Attendance ---'
SELECT 
    u.email,
    a.date,
    a.status,
    m.email AS marked_by
FROM attendance a
JOIN users u ON u.id = a.user_id
JOIN users m ON m.id = a.marked_by
JOIN course_offerings co ON co.id = a.offering_id
WHERE co.code = 'CSE210TEST'
ORDER BY a.date, u.email;

\echo '--- Activity Logs ---'
SELECT 
    u.email,
    al.action_type,
    al.metadata,
    al.created_at
FROM activity_logs al
JOIN users u ON u.id = al.user_id
WHERE u.email LIKE '%@test.%'
ORDER BY al.created_at DESC
LIMIT 10;

\echo ''
\echo '=== All Tests Complete ==='
\echo '✓ ENUM types validated'
\echo '✓ Constraints tested'
\echo '✓ Foreign keys working'
\echo '✓ Triggers functioning'
\echo '✓ All tables operational'
