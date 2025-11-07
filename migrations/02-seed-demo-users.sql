-- 02-seed-demo-users.sql
-- Populate demo users for development/testing
-- Run AFTER the users table and user_role_enum type are created.

INSERT INTO users (
    email,
    ucsd_pid,
    name,
    preferred_name,
    pronouns,
    major,
    degree_program,
    academic_year,
    department,
    access_level,
    role,
    title,
    office,
    photo_url,
    image_url,
    github_username,
    linkedin_url,
    bio
) VALUES
-- === Admin user ===
('admin@example.edu', 'A00000001', 'System Admin', 'Admin', 'they/them',
 NULL, NULL, NULL, 'IT Services', 10, 'admin', 'System Administrator', 'HQ 101',
 NULL, NULL, NULL, NULL, 'Manages overall platform configuration'),

-- === Instructors ===
('instructor1@example.edu', 'A00001234', 'Dr. Alice Smith', 'Alice', 'she/her',
 NULL, NULL, NULL, 'Computer Science & Engineering', 8, 'instructor',
 'Professor', 'ENG 2254', NULL, NULL, 'alicesmith', 'https://linkedin.com/in/alicesmith',
 'Teaches distributed systems and software architecture'),

('instructor2@example.edu', 'A00004567', 'Dr. Bob Lee', 'Bob', 'he/him',
 NULL, NULL, NULL, 'Electrical & Computer Engineering', 7, 'instructor',
 'Associate Professor', 'ENG 132', NULL, NULL, 'boblee',
 'https://linkedin.com/in/boblee', 'Researcher in embedded systems and AI hardware'),

-- === Students ===
('student1@example.edu', 'A00009999', 'Charlie Green', 'Charlie', 'he/him',
 'Computer Science', 'MS', 2025, 'Computer Science & Engineering', 1, 'student',
 NULL, NULL, NULL, NULL, 'charliegreen', 'https://linkedin.com/in/charliegreen',
 'Graduate student interested in distributed systems and machine learning'),

('student2@example.edu', 'A00007890', 'Dana Lopez', 'Dana', 'she/her',
 'Data Science', 'BS', 2026, 'Data Science', 1, 'student',
 NULL, NULL, NULL, NULL, 'danalopez', NULL,
 'Undergraduate student working on data visualization projects'),

('student3@example.edu', 'A00005678', 'Evan Jones', 'Evan', 'he/him',
 'Computer Engineering', 'BS', 2025, 'ECE', 1, 'student',
 NULL, NULL, NULL, NULL, 'evanjones', 'https://linkedin.com/in/evanjones',
 'Enjoys full-stack development and embedded systems')
ON CONFLICT (email) DO UPDATE
SET
    name            = EXCLUDED.name,
    preferred_name  = EXCLUDED.preferred_name,
    pronouns        = EXCLUDED.pronouns,
    major           = EXCLUDED.major,
    degree_program  = EXCLUDED.degree_program,
    academic_year   = EXCLUDED.academic_year,
    department      = EXCLUDED.department,
    access_level    = EXCLUDED.access_level,
    role            = EXCLUDED.role,
    title           = EXCLUDED.title,
    office          = EXCLUDED.office,
    photo_url       = EXCLUDED.photo_url,
    image_url       = EXCLUDED.image_url,
    github_username = EXCLUDED.github_username,
    linkedin_url    = EXCLUDED.linkedin_url,
    bio             = EXCLUDED.bio,
    updated_at      = NOW();

-- Optional: confirm number of users
SELECT COUNT(*) AS demo_user_count FROM users;
