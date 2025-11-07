\echo '=== Conductor App Quick Tests ==='


BEGIN;



-- ============ CLEANUP (idempotent) ============
DELETE FROM activity_logs
WHERE action = 'submit_assignment_test';

DELETE FROM team_members
WHERE team_id IN (SELECT id FROM team WHERE name = 'Team Alpha Test');

DELETE FROM team
WHERE name = 'Team Alpha Test';

DELETE FROM enrollments
WHERE user_id IN (SELECT id FROM users WHERE email IN ('student1@ucsd.edu'))
  OR offering_id IN (
      SELECT id FROM course_offerings WHERE term='Winter' AND year=2025 AND section='T01'
  );

DELETE FROM course_offerings
WHERE term='Winter' AND year=2025 AND section='T01';

DELETE FROM course_template
WHERE code='CSE210TEST';

DELETE FROM users WHERE email IN ('student1@ucsd.edu','prof@ucsd.edu');

COMMIT;

-- ============ TEST DATA CREATION ============
BEGIN;

\echo '1) Insert test users'
INSERT INTO users (email, name, role)
VALUES ('student1@ucsd.edu', 'Test Student', 'student');

INSERT INTO users (email, name, role)
VALUES ('prof@ucsd.edu', 'Professor X', 'instructor');

\echo '2) Create course template'
INSERT INTO course_template (code, name, department, description, credits)
VALUES ('CSE210TEST', 'Software Engineering (Test)', 'CSE', 'Test template', 4);

\echo '3) Create course offering'
INSERT INTO course_offerings (
    template_id, term, year, section, instructor_id, start_date, end_date, enrollment_cap
) VALUES (
    (SELECT id FROM course_template WHERE code='CSE210TEST'),
    'Winter', 2025, 'T01',
    (SELECT id FROM users WHERE email='prof@ucsd.edu'),
    '2025-01-05', '2025-03-15', 200
);

\echo '4) Enroll student in offering'
INSERT INTO enrollments (offering_id, user_id, role, status, enrolled_at)
VALUES (
    (SELECT id FROM course_offerings WHERE term='Winter' AND year=2025 AND section='T01'),
    (SELECT id FROM users WHERE email='student1@ucsd.edu'),
    'student', 'enrolled', CURRENT_DATE
);

\echo '5) Update user to test updated_at trigger'
UPDATE users
SET preferred_name = 'TS'
WHERE email = 'student1@ucsd.edu';

\echo '6) Create a team'
INSERT INTO team (offering_id, name, team_number, leader_id, formed_at)
VALUES (
    (SELECT id FROM course_offerings WHERE term='Winter' AND year=2025 AND section='T01'),
    'Team Alpha Test', 1,
    (SELECT id FROM users WHERE email='student1@ucsd.edu'),
    CURRENT_DATE
);

\echo '7) Add team member (leader)'
INSERT INTO team_members (team_id, user_id, role, joined_at)
VALUES (
    (SELECT id FROM team WHERE name='Team Alpha Test'),
    (SELECT id FROM users WHERE email='student1@ucsd.edu'),
    'leader', CURRENT_DATE
);

\echo '7b) Attempt duplicate team member (should NOT abort)'
DO $$
BEGIN
    BEGIN
        INSERT INTO team_members (team_id, user_id, role, joined_at)
        VALUES (
            (SELECT id FROM team WHERE name='Team Alpha Test'),
            (SELECT id FROM users WHERE email='student1@ucsd.edu'),
            'member', CURRENT_DATE
        );
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate member prevented as expected.';
    END;
END $$;

\echo '8) Insert activity log'
INSERT INTO activity_logs (user_id, offering_id, action, metadata)
VALUES (
    (SELECT id FROM users WHERE email='student1@ucsd.edu'),
    (SELECT id FROM course_offerings WHERE term='Winter' AND year=2025 AND section='T01'),
    'submit_assignment_test',
    '{"assignment":"HW1","status":"submitted"}'
);

COMMIT;

-- ============ VERIFICATION QUERIES ============
\echo '--- Users ---'
SELECT id, email, name, preferred_name, created_at, updated_at
FROM users
WHERE email IN ('student1@ucsd.edu','prof@ucsd.edu')
ORDER BY email;

\echo '--- Course Template & Offering ---'
SELECT ct.code, ct.name, co.term, co.year, co.section, co.instructor_id
FROM course_template ct
JOIN course_offerings co ON co.template_id = ct.id
WHERE ct.code='CSE210TEST';

\echo '--- Enrollments ---'
SELECT e.id, u.email, e.role, e.status, e.enrolled_at
FROM enrollments e
JOIN users u ON u.id = e.user_id
JOIN course_offerings co ON co.id = e.offering_id
WHERE co.term='Winter' AND co.year=2025 AND co.section='T01';

\echo '--- Team & Members ---'
SELECT t.name AS team, tm.role, u.email
FROM team t
JOIN team_members tm ON tm.team_id = t.id
JOIN users u ON u.id = tm.user_id
WHERE t.name='Team Alpha Test';

\echo '--- Activity Logs ---'
SELECT action, metadata, created_at
FROM activity_logs
WHERE action='submit_assignment_test';

\echo '--- End-to-end join (student + team) ---'
SELECT
    u.name AS student,
    co.term, co.year, co.section,
    e.role AS enrollment_role,
    t.name AS team_name
FROM enrollments e
JOIN users u ON u.id = e.user_id
JOIN course_offerings co ON co.id = e.offering_id
LEFT JOIN team_members tm ON tm.user_id = u.id
LEFT JOIN team t ON t.id = tm.team_id
WHERE u.email='student1@ucsd.edu'
  AND co.term='Winter' AND co.year=2025 AND co.section='T01';

\echo '=== Tests complete ==='
