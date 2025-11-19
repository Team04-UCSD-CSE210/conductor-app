-- 02-seed-demo-users.sql
-- Enhanced demo users for development/testing
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
-- ============================================
-- ADMINISTRATORS (UCSD)
-- ============================================
('admin@ucsd.edu', 'A00000001', 'System Administrator', 'Admin',
 NULL, NULL, NULL, 'IT Services', NULL,
 'admin'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-534-0001', 'sysadmin', 'https://linkedin.com/in/sysadmin'),

('admin2@ucsd.edu', 'A00000002', 'Jane Administrator', 'Jane',
 NULL, NULL, NULL, 'Academic Affairs', NULL,
 'admin'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-534-0002', 'janeadmin', 'https://linkedin.com/in/janeadmin'),

('bchandna@ucsd.edu', 'A00000003', 'Micheal Administrator', 'Micheal',
 NULL, NULL, NULL, 'Academic Affairs', NULL,
 'admin'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-534-0003', 'Micheal', 'https://linkedin.com/in/janeadmin'),


-- ============================================
-- INSTRUCTORS/PROFESSORS (UCSD)
-- ============================================
('bhchandna@ucsd.edu', 'A00001234', 'Dr. Alice Smith', 'Alice',
 NULL, NULL, NULL, 'Computer Science & Engineering', NULL,
 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 'https://cse.ucsd.edu/people/faculty/alice-smith', NULL, '+1-858-534-1234', 'alicesmith', 'https://linkedin.com/in/alicesmith'),

('instructor2@ucsd.edu', 'A00004567', 'Dr. Bob Lee', 'Bob',
 NULL, NULL, NULL, 'Electrical & Computer Engineering', NULL,
 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 'https://ece.ucsd.edu/people/faculty/bob-lee', NULL, '+1-858-534-4567', 'boblee', 'https://linkedin.com/in/boblee'),

('instructor3@ucsd.edu', 'A00007890', 'Dr. Carol Chen', 'Carol',
 NULL, NULL, NULL, 'Computer Science & Engineering', NULL,
 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 'https://cse.ucsd.edu/people/faculty/carol-chen', NULL, '+1-858-534-7890', 'carolchen', 'https://linkedin.com/in/carolchen'),

('instructor4@ucsd.edu', 'A00001111', 'Dr. David Kim', 'David',
 NULL, NULL, NULL, 'Data Science', NULL,
 'instructor'::user_role_enum, 'busy'::user_status_enum, 'ucsd'::institution_type_enum,
 'https://datascience.ucsd.edu/people/faculty/david-kim', NULL, '+1-858-534-1111', 'davidkim', 'https://linkedin.com/in/davidkim'),

('zhkan@ucsd.edu', 'A10331111', 'Dr. G', 'Gad',
 NULL, NULL, NULL, 'Data Science', NULL,
 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 'https://datascience.ucsd.edu/people/faculty/G-Gad', NULL, '+1-858-534-1331', 'ggag', 'https://linkedin.com/in/ggag'),

-- ============================================
-- GRADUATE STUDENTS (UCSD) - Potential TAs
-- ============================================
('grad1@ucsd.edu', 'A00009999', 'Charlie Green', 'Charlie',
 'Computer Science', 'MS', 2025, 'Computer Science & Engineering', 'Graduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0201', 'charliegreen', 'https://linkedin.com/in/charliegreen'),

('grad2@ucsd.edu', 'A00008888', 'Diana Martinez', 'Diana',
 'Computer Science', 'PhD', 2024, 'Computer Science & Engineering', 'Graduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0202', 'dianamartinez', 'https://linkedin.com/in/dianamartinez'),

('grad3@ucsd.edu', 'A00007777', 'Ethan Wong', 'Ethan',
 'Data Science', 'MS', 2025, 'Data Science', 'Graduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0203', 'ethanwong', 'https://linkedin.com/in/ethanwong'),

-- ============================================
-- UNDERGRADUATE STUDENTS (UCSD)
-- ============================================
('student1@ucsd.edu', 'A00006666', 'Frank Miller', 'Frank',
 'Computer Science', 'BS', 2026, 'Computer Science & Engineering', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0301', 'frankmiller', 'https://linkedin.com/in/frankmiller'),

('student2@ucsd.edu', 'A00005555', 'Grace Chen', 'Grace',
 'Data Science', 'BS', 2026, 'Data Science', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0302', 'gracechen', 'https://linkedin.com/in/gracechen'),

('student3@ucsd.edu', 'A00004444', 'Henry Wilson', 'Henry',
 'Computer Engineering', 'BS', 2025, 'ECE', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0303', 'henrywilson', 'https://linkedin.com/in/henrywilson'),

('student4@ucsd.edu', 'A00003333', 'Isabella Garcia', 'Isabella',
 'Computer Science', 'BS', 2027, 'Computer Science & Engineering', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0304', 'isabellagarcia', 'https://linkedin.com/in/isabellagarcia'),

('student5@ucsd.edu', 'A00002222', 'Jack Thompson', 'Jack',
 'Data Science', 'BS', 2025, 'Data Science', 'Undergraduate',
 'student'::user_role_enum, 'busy'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0305', 'jackthompson', 'https://linkedin.com/in/jackthompson'),

('student6@ucsd.edu', 'A00001111', 'Katherine Lee', 'Katie',
 'Computer Science', 'BS', 2026, 'Computer Science & Engineering', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0306', 'katherinelee', 'https://linkedin.com/in/katherinelee'),

('student7@ucsd.edu', 'A00001010', 'Liam Brown', 'Liam',
 'Computer Engineering', 'BS', 2025, 'ECE', 'Undergraduate',
 'student'::user_role_enum, 'inactive'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0307', 'liambrown', 'https://linkedin.com/in/liambrown'),

('student8@ucsd.edu', 'A00001011', 'Mia Davis', 'Mia',
 'Data Science', 'BS', 2027, 'Data Science', 'Undergraduate',
 'student'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, '+1-858-555-0308', 'miadavis', 'https://linkedin.com/in/miadavis'),

-- ============================================
-- EXTENSION STUDENTS (Non-UCSD emails)
-- ============================================
('bhavikchandna@gmail.com', NULL, 'Noah Anderson', 'Noah',
 'Software Engineering', NULL, 2025, 'Extension', 'Professional',
 'student'::user_role_enum, 'active'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0401', 'noahanderson', 'https://linkedin.com/in/noahanderson'),

('extension2@gmail.com', NULL, 'Olivia Taylor', 'Olivia',
 'Computer Science', NULL, 2026, 'Extension', 'Professional',
 'student'::user_role_enum, 'active'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0402', 'oliviataylor', 'https://linkedin.com/in/oliviataylor'),

('extension3@yahoo.com', NULL, 'Paul White', 'Paul',
 'Data Analytics', NULL, 2025, 'Extension', 'Professional',
 'student'::user_role_enum, 'busy'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0403', 'paulwhite', 'https://linkedin.com/in/paulwhite'),

('extension4@gmail.com', NULL, 'Quinn Harris', 'Quinn',
 'Web Development', NULL, 2026, 'Extension', 'Professional',
 'student'::user_role_enum, 'active'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0404', 'quinnharris', 'https://linkedin.com/in/quinnharris'),

('extension5@outlook.com', NULL, 'Rachel Moore', 'Rachel',
 'Cybersecurity', NULL, 2025, 'Extension', 'Professional',
 'student'::user_role_enum, 'active'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, '+1-619-555-0405', 'rachelmoore', 'https://linkedin.com/in/rachelmoore'),

-- ============================================
-- UNREGISTERED USERS (for testing OAuth flow)
-- ============================================
('unregistered1@ucsd.edu', 'A00009999', 'Unregistered User 1', NULL,
 NULL, NULL, NULL, NULL, NULL,
 'unregistered'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum,
 NULL, NULL, NULL, NULL, NULL),

('unregistered2@gmail.com', NULL, 'Unregistered User 2', NULL,
 NULL, NULL, NULL, NULL, NULL,
 'unregistered'::user_role_enum, 'active'::user_status_enum, 'extension'::institution_type_enum,
 NULL, NULL, NULL, NULL, NULL)

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

-- Summary query
SELECT 
    primary_role,
    status,
    institution_type,
    COUNT(*) as count
FROM users
GROUP BY primary_role, status, institution_type
ORDER BY primary_role, status, institution_type;
