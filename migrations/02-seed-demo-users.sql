-- 02-seed-demo-users.sql
-- Populate demo users for development/testing
-- Run AFTER the users table and ENUM types are created.

INSERT INTO users (
    email,
    ucsd_pid,
    name,
    preferred_name,
    major,
    degree_program,
    academic_year,
    department,
    class_level,
    primary_role,
    status,
    institution_type,
    profile_url,
    image_url,
    phone_number,
    github_username,
    linkedin_url
) VALUES
-- === Admin user (UCSD) ===
('admin@ucsd.edu', 'A00000001', 'System Admin', 'Admin',
 NULL, NULL, NULL, 'IT Services', NULL,
 'admin'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, NULL, 'sysadmin', 'https://linkedin.com/in/sysadmin'),

-- === Instructors (UCSD) ===
('instructor1@ucsd.edu', 'A00001234', 'Dr. Alice Smith', 'Alice',
 NULL, NULL, NULL, 'Computer Science & Engineering', NULL,
 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0101', 'alicesmith', 'https://linkedin.com/in/alicesmith'),

('instructor2@ucsd.edu', 'A00004567', 'Dr. Bob Lee', 'Bob',
 NULL, NULL, NULL, 'Electrical & Computer Engineering', NULL,
 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0102', 'boblee', 'https://linkedin.com/in/boblee'),

-- === UCSD Students ===
('student1@ucsd.edu', 'A00009999', 'Charlie Green', 'Charlie',
 'Computer Science', 'MS', 2025, 'Computer Science & Engineering', 'Graduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0201', 'charliegreen', 'https://linkedin.com/in/charliegreen'),

('student2@ucsd.edu', 'A00007890', 'Dana Lopez', 'Dana',
 'Data Science', 'BS', 2026, 'Data Science', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0202', 'danalopez', 'https://linkedin.com/in/danalopez'),

('student3@ucsd.edu', 'A00005678', 'Evan Jones', 'Evan',
 'Computer Engineering', 'BS', 2025, 'ECE', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0203', 'evanjones', 'https://linkedin.com/in/evanjones'),

-- === Extension Students (non-UCSD emails) ===
('student.extension1@gmail.com', NULL, 'Frank Miller', 'Frank',
 'Software Engineering', NULL, 2025, 'Extension', 'Professional',
 'student'::user_role_enum, 'active'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0301', 'frankmiller', 'https://linkedin.com/in/frankmiller'),

('student.extension2@gmail.com', NULL, 'Grace Chen', 'Grace',
 'Computer Science', NULL, 2026, 'Extension', 'Professional',
 'student'::user_role_enum, 'active'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0302', 'gracechen', 'https://linkedin.com/in/gracechen'),

('student.extension3@yahoo.com', NULL, 'Henry Wilson', 'Henry',
 'Data Analytics', NULL, 2025, 'Extension', 'Professional',
 'student'::user_role_enum, 'busy'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0303', 'henrywilson', NULL)
ON CONFLICT (email) DO UPDATE
SET
    name            = EXCLUDED.name,
    preferred_name  = EXCLUDED.preferred_name,
    major           = EXCLUDED.major,
    degree_program  = EXCLUDED.degree_program,
    academic_year   = EXCLUDED.academic_year,
    department      = EXCLUDED.department,
    class_level     = EXCLUDED.class_level,
    primary_role    = EXCLUDED.primary_role,
    status          = EXCLUDED.status,
    institution_type = EXCLUDED.institution_type,
    profile_url     = EXCLUDED.profile_url,
    image_url       = EXCLUDED.image_url,
    phone_number    = EXCLUDED.phone_number,
    github_username = EXCLUDED.github_username,
    linkedin_url    = EXCLUDED.linkedin_url,
    updated_at      = NOW();

-- Optional: confirm number of users
SELECT COUNT(*) AS demo_user_count FROM users;
