-- 03-seed-course-offerings-teams.sql
-- Comprehensive seed data for CSE 210 course offering, enrollments, and teams
-- Run AFTER users table is populated

-- Get the offering ID for enrollments and teams
DO $$
DECLARE
    offering_id_var UUID;
    instructor_id UUID;
    ta1_id UUID;
    ta2_id UUID;
    ta3_id UUID;
    tutor1_id UUID;
    tutor2_id UUID;
    student_ids UUID[];
    team_ids UUID[];
    i INTEGER;
    j INTEGER;
    team_num INTEGER;
BEGIN
    -- Get instructor ID first
    SELECT id INTO instructor_id FROM users WHERE email = 'instructor1@ucsd.edu' LIMIT 1;
    
    IF instructor_id IS NULL THEN
        RAISE EXCEPTION 'Instructor not found. Run user seed data first.';
    END IF;
    
    -- Create or get the CSE 210 offering
    INSERT INTO course_offerings (
        code,
        name,
        department,
        term,
        year,
        credits,
        instructor_id,
        start_date,
        end_date,
        status,
        location,
        syllabus_url,
        is_active,
        created_by
    ) VALUES (
        'CSE 210',
        'Software Engineering',
        'Computer Science & Engineering',
        'Fall',
        2025,
        4,
        instructor_id,
        '2025-09-23',
        '2025-12-12',
        'open'::course_offering_status_enum,
        'CSE Building, Room 1202',
        'https://cse.ucsd.edu/courses/cse210',
        TRUE,
        instructor_id
    )
    ON CONFLICT (code, term, year) DO UPDATE SET
        name = EXCLUDED.name,
        is_active = EXCLUDED.is_active
    RETURNING id INTO offering_id_var;
    
    IF offering_id_var IS NULL THEN
        SELECT id INTO offering_id_var FROM course_offerings WHERE code = 'CSE 210' AND year = 2025 LIMIT 1;
    END IF;
    
    -- Get TA IDs (graduate students)
    SELECT id INTO ta1_id FROM users WHERE email = 'grad1@ucsd.edu' LIMIT 1;
    SELECT id INTO ta2_id FROM users WHERE email = 'grad2@ucsd.edu' LIMIT 1;
    SELECT id INTO ta3_id FROM users WHERE email = 'grad3@ucsd.edu' LIMIT 1;
    
    -- Get Tutor IDs (use some students as tutors)
    SELECT id INTO tutor1_id FROM users WHERE email = 'student1@ucsd.edu' LIMIT 1;
    SELECT id INTO tutor2_id FROM users WHERE email = 'student2@ucsd.edu' LIMIT 1;
    
    -- ============================================
    -- ENROLLMENTS
    -- ============================================
    
    -- Enroll instructor
    IF instructor_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, instructor_id, 'student'::course_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
        ON CONFLICT (offering_id, user_id) DO NOTHING;
    END IF;
    
    -- Enroll TAs
    IF ta1_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, ta1_id, 'ta'::course_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'ta'::course_role_enum;
    END IF;
    
    IF ta2_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, ta2_id, 'ta'::course_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'ta'::course_role_enum;
    END IF;
    
    IF ta3_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, ta3_id, 'ta'::course_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'ta'::course_role_enum;
    END IF;
    
    -- Enroll Tutors
    IF tutor1_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, tutor1_id, 'tutor'::course_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'tutor'::course_role_enum;
    END IF;
    
    IF tutor2_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, tutor2_id, 'tutor'::course_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'tutor'::course_role_enum;
    END IF;
    
    -- Enroll all students (primary_role = 'student')
    INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
    SELECT 
        offering_id_var,
        id,
        'student'::course_role_enum,
        'enrolled'::enrollment_status_enum,
        CURRENT_DATE
    FROM users
    WHERE primary_role = 'student'::user_role_enum
        AND id NOT IN (SELECT user_id FROM enrollments WHERE offering_id = offering_id_var)
    ON CONFLICT (offering_id, user_id) DO NOTHING;
    
    -- ============================================
    -- TEAMS (10 teams with 7-8 members each)
    -- ============================================
    
    -- Get all enrolled student IDs
    SELECT ARRAY_AGG(user_id) INTO student_ids
    FROM enrollments
    WHERE offering_id = offering_id_var
        AND course_role = 'student'::course_role_enum
        AND status = 'enrolled'::enrollment_status_enum;
    
    IF student_ids IS NULL OR array_length(student_ids, 1) < 10 THEN
        RAISE NOTICE 'Not enough students enrolled. Need at least 10 students for teams.';
        RETURN;
    END IF;
    
    -- Create 10 teams
    FOR team_num IN 1..10 LOOP
        DECLARE
            team_id_var UUID;
            leader_id_var UUID;
            team_size INTEGER;
            member_count INTEGER := 0;
        BEGIN
            -- Determine team size (7 or 8 members)
            team_size := CASE WHEN team_num <= 3 THEN 8 ELSE 7 END;
            
            -- Get leader (first student in this team's range)
            leader_id_var := student_ids[((team_num - 1) * 8) + 1];
            
            -- Create team
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (
                offering_id_var,
                'Team ' || team_num,
                team_num,
                leader_id_var,
                'active'::team_status_enum,
                CURRENT_DATE,
                instructor_id
            )
            RETURNING id INTO team_id_var;
            
            -- Add team members
            FOR i IN 1..team_size LOOP
                DECLARE
                    student_idx INTEGER;
                    student_id_var UUID;
                BEGIN
                    student_idx := ((team_num - 1) * 8) + i;
                    
                    IF student_idx <= array_length(student_ids, 1) THEN
                        student_id_var := student_ids[student_idx];
                        
                        -- Add member to team
                        INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                        VALUES (
                            team_id_var,
                            student_id_var,
                            CASE WHEN student_id_var = leader_id_var THEN 'leader'::team_member_role_enum ELSE 'member'::team_member_role_enum END,
                            CURRENT_DATE,
                            instructor_id
                        )
                        ON CONFLICT (team_id, user_id) DO NOTHING;
                        
                        member_count := member_count + 1;
                    END IF;
                END;
            END LOOP;
            
            RAISE NOTICE 'Created Team % with % members', team_num, member_count;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Seed data complete: CSE 210 offering with enrollments and 10 teams';
END $$;

