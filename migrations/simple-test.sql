-- =====================================================
-- SIMPLE TEST WITH PERSISTENT DATA
-- =====================================================
\echo '=== Creating Test Data (No Rollback) ==='
\echo ''

-- Create test users
\echo '1. Creating users...'
INSERT INTO users (email, name, primary_role, status, institution_type, ucsd_pid, major, department)
VALUES 
    ('prof.smith@ucsd.edu', 'Professor Smith', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum, 'A12345678', 'Computer Science', 'CSE'),
    ('alice@ucsd.edu', 'Alice Johnson', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum, 'A11111111', 'Computer Science', 'CSE'),
    ('bob@ucsd.edu', 'Bob Chen', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum, 'A22222222', 'Computer Science', 'CSE'),
    ('charlie@ucsd.edu', 'Charlie Davis', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum, 'A33333333', 'Computer Engineering', 'ECE'),
    ('ta.emily@ucsd.edu', 'Emily Rodriguez', 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum, 'A44444444', 'Computer Science', 'CSE');

\echo '   Created 5 users'
\echo ''

-- Create course offering
\echo '2. Creating course offering...'
INSERT INTO course_offerings (
    code, name, department, term, year, credits,
    instructor_id, start_date, end_date, enrollment_cap, status
)
VALUES (
    'CSE210', 'Software Engineering', 'CSE', 'Fall', 2025, 4,
    (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu'),
    '2025-09-25', '2025-12-15', 150, 'open'::course_offering_status_enum
);

\echo '   Created course: CSE210 - Software Engineering'
\echo ''

-- Create enrollments
\echo '3. Creating enrollments...'
INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
VALUES 
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'alice@ucsd.edu'),
        'student'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, '2025-09-25'
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'bob@ucsd.edu'),
        'student'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, '2025-09-25'
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'charlie@ucsd.edu'),
        'student'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, '2025-09-26'
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'ta.emily@ucsd.edu'),
        'ta'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, '2025-09-24'
    );

\echo '   Created 4 enrollments (3 students, 1 TA)'
\echo ''

-- Create assignments
\echo '4. Creating assignments...'
INSERT INTO assignments (offering_id, title, type, due_date, max_points, assigned_to)
VALUES 
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        'Team Project Phase 1', 'project'::assignment_type_enum, '2025-10-30 23:59:59', 100.0, 'team'::assignment_assigned_to_enum
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        'Homework 1: Design Patterns', 'hw'::assignment_type_enum, '2025-10-15 23:59:59', 50.0, 'individual'::assignment_assigned_to_enum
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        'Midterm Exam', 'exam'::assignment_type_enum, '2025-11-05 14:00:00', 150.0, 'individual'::assignment_assigned_to_enum
    );

\echo '   Created 3 assignments'
\echo ''

-- Create teams
\echo '5. Creating teams...'
INSERT INTO team (offering_id, name, team_number, status, formed_at, leader_id)
VALUES 
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        'Team Alpha', 1, 'active'::team_status_enum, '2025-10-01',
        (SELECT id FROM users WHERE email = 'alice@ucsd.edu')
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        'Team Beta', 2, 'active'::team_status_enum, '2025-10-01',
        (SELECT id FROM users WHERE email = 'charlie@ucsd.edu')
    );

\echo '   Created 2 teams'
\echo ''

-- Add team members
\echo '6. Adding team members...'
INSERT INTO team_members (team_id, user_id, role, joined_at, created_by)
VALUES 
    (
        (SELECT id FROM team WHERE name = 'Team Alpha'),
        (SELECT id FROM users WHERE email = 'alice@ucsd.edu'),
        'leader'::team_member_role_enum, '2025-10-01',
        (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu')
    ),
    (
        (SELECT id FROM team WHERE name = 'Team Alpha'),
        (SELECT id FROM users WHERE email = 'bob@ucsd.edu'),
        'member'::team_member_role_enum, '2025-10-01',
        (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu')
    ),
    (
        (SELECT id FROM team WHERE name = 'Team Beta'),
        (SELECT id FROM users WHERE email = 'charlie@ucsd.edu'),
        'leader'::team_member_role_enum, '2025-10-01',
        (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu')
    );

\echo '   Added 3 team members'
\echo ''

-- Create individual submissions
\echo '7. Creating individual submissions...'
INSERT INTO submissions (assignment_id, user_id, team_id, submitted_at, status, score, feedback)
VALUES 
    (
        (SELECT id FROM assignments WHERE title = 'Homework 1: Design Patterns'),
        (SELECT id FROM users WHERE email = 'alice@ucsd.edu'),
        NULL,
        '2025-10-15 20:30:00', 'graded'::submission_status_enum, 48.0, 'Great work on the singleton pattern!'
    ),
    (
        (SELECT id FROM assignments WHERE title = 'Homework 1: Design Patterns'),
        (SELECT id FROM users WHERE email = 'bob@ucsd.edu'),
        NULL,
        '2025-10-15 22:15:00', 'graded'::submission_status_enum, 45.0, 'Good understanding of factory pattern'
    ),
    (
        (SELECT id FROM assignments WHERE title = 'Homework 1: Design Patterns'),
        (SELECT id FROM users WHERE email = 'charlie@ucsd.edu'),
        NULL,
        '2025-10-16 01:30:00', 'graded'::submission_status_enum, 42.0, 'Late submission, otherwise good'
    );

\echo '   Created 3 individual submissions'
\echo ''

-- Create team submissions
\echo '8. Creating team submissions...'
INSERT INTO submissions (assignment_id, user_id, team_id, submitted_at, status, score, feedback)
VALUES 
    (
        (SELECT id FROM assignments WHERE title = 'Team Project Phase 1'),
        NULL,
        (SELECT id FROM team WHERE name = 'Team Alpha'),
        '2025-10-29 18:00:00', 'graded'::submission_status_enum, 92.0, 'Excellent architecture design and implementation'
    ),
    (
        (SELECT id FROM assignments WHERE title = 'Team Project Phase 1'),
        NULL,
        (SELECT id FROM team WHERE name = 'Team Beta'),
        '2025-10-30 23:45:00', 'submitted'::submission_status_enum, NULL, NULL
    );

\echo '   Created 2 team submissions'
\echo ''

-- Update final grades in enrollments
\echo '9. Setting final course grades...'
UPDATE enrollments SET final_grade = 'A', grade_marks = 94.5
WHERE user_id = (SELECT id FROM users WHERE email = 'alice@ucsd.edu');

UPDATE enrollments SET final_grade = 'A-', grade_marks = 90.0
WHERE user_id = (SELECT id FROM users WHERE email = 'bob@ucsd.edu');

UPDATE enrollments SET final_grade = 'B+', grade_marks = 88.0
WHERE user_id = (SELECT id FROM users WHERE email = 'charlie@ucsd.edu');

\echo '   Set final grades for 3 students'
\echo ''

-- Create attendance records
\echo '10. Creating attendance records...'
INSERT INTO attendance (offering_id, user_id, date, status, marked_by)
VALUES 
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'alice@ucsd.edu'),
        '2025-10-01', 'present'::attendance_status_enum,
        (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu')
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'bob@ucsd.edu'),
        '2025-10-01', 'present'::attendance_status_enum,
        (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu')
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'charlie@ucsd.edu'),
        '2025-10-01', 'late'::attendance_status_enum,
        (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu')
    ),
    (
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        (SELECT id FROM users WHERE email = 'alice@ucsd.edu'),
        '2025-10-03', 'present'::attendance_status_enum,
        (SELECT id FROM users WHERE email = 'prof.smith@ucsd.edu')
    );

\echo '   Created 4 attendance records'
\echo ''

-- Create activity logs
\echo '11. Creating activity logs...'
INSERT INTO activity_logs (user_id, offering_id, action_type, metadata)
VALUES 
    (
        (SELECT id FROM users WHERE email = 'alice@ucsd.edu'),
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        'submit_assignment'::activity_action_type_enum,
        '{"assignment": "Homework 1", "timestamp": "2025-10-15T20:30:00"}'::jsonb
    ),
    (
        (SELECT id FROM users WHERE email = 'bob@ucsd.edu'),
        (SELECT id FROM course_offerings WHERE code = 'CSE210'),
        'join_team'::activity_action_type_enum,
        '{"team": "Team Alpha", "timestamp": "2025-10-01T10:00:00"}'::jsonb
    );

\echo '   Created 2 activity logs'
\echo ''

-- Display summary
\echo '=== DATA SUMMARY ==='
\echo ''

\echo '--- USERS ---'
SELECT email, name, primary_role, status FROM users ORDER BY primary_role, email;

\echo ''
\echo '--- COURSE OFFERING ---'
SELECT code, name, term, year, status, enrollment_cap FROM course_offerings;

\echo ''
\echo '--- ENROLLMENTS WITH FINAL GRADES ---'
SELECT 
    u.name, 
    e.course_role, 
    e.status, 
    e.final_grade, 
    e.grade_marks
FROM enrollments e
JOIN users u ON u.id = e.user_id
ORDER BY e.course_role, u.name;

\echo ''
\echo '--- ASSIGNMENTS ---'
SELECT title, type, assigned_to, max_points, due_date FROM assignments ORDER BY due_date;

\echo ''
\echo '--- TEAMS AND MEMBERS ---'
SELECT 
    t.name AS team_name,
    u.name AS member_name,
    tm.role
FROM team t
JOIN team_members tm ON tm.team_id = t.id
JOIN users u ON u.id = tm.user_id
ORDER BY t.name, tm.role DESC;

\echo ''
\echo '--- SUBMISSIONS (Individual vs Team) ---'
SELECT 
    a.title AS assignment,
    COALESCE(u.name, t.name) AS submitted_by,
    CASE WHEN s.user_id IS NOT NULL THEN 'Individual' ELSE 'Team' END AS type,
    s.status,
    s.score
FROM submissions s
JOIN assignments a ON a.id = s.assignment_id
LEFT JOIN users u ON u.id = s.user_id
LEFT JOIN team t ON t.id = s.team_id
ORDER BY a.title, type;

\echo ''
\echo '--- ATTENDANCE ---'
SELECT 
    u.name,
    a.date,
    a.status
FROM attendance a
JOIN users u ON u.id = a.user_id
ORDER BY a.date, u.name;

\echo ''
\echo '=== TEST COMPLETE ==='
\echo 'All data has been created and is ready to query!'
\echo ''
\echo 'Key validations:'
\echo '  - Individual submissions have user_id only (team_id is NULL)'
\echo '  - Team submissions have team_id only (user_id is NULL)'
\echo '  - Final grades stored in enrollments (overall course grade)'
\echo '  - Assignment grades stored in submissions (per-assignment)'
\echo '  - Team_members has full audit trail with created_by'