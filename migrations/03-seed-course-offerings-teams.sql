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
    active_status CONSTANT team_status_enum := 'active'::team_status_enum;
    current_date_val DATE := CURRENT_DATE;
BEGIN
    -- Get instructor ID first (try multiple possible emails)
    SELECT id INTO instructor_id 
    FROM users 
    WHERE email = 'zhkan@ucsd.edu'
       OR email = 'bhchandna@ucsd.edu' 
       OR email = 'lhardy@ucsd.edu'
       OR email = 'instructor1@ucsd.edu'
    LIMIT 1;
    
    -- Fallback: get any instructor
    IF instructor_id IS NULL THEN
        SELECT id INTO instructor_id 
        FROM users 
        WHERE primary_role = 'instructor' 
        LIMIT 1;
    END IF;
    
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
    
    -- Get Tutor IDs (use students who are NOT in teams)
    -- Team leaders: student1, student4, student6, student8, ext5, bgyawali
    -- Students in teams: student3, student5, student7, ext2, ext3, ext4, bhavikgmail
    -- Available for tutors: student2 (Grace Chen) and other students not in teams
    SELECT id INTO tutor1_id FROM users WHERE email = 'student2@ucsd.edu' LIMIT 1;
    
    -- For tutor2, use a student that's not a leader and not in a team
    -- We'll use student7 who is in Team 3, but we'll remove them from the team later
    -- Actually, better to use a student not in any team - let's use student2 and find another
    -- Since student2 is the only one guaranteed not in a team, we'll use student2 for tutor1
    -- and for tutor2, we'll use a different approach - use student7 but remove from team
    SELECT id INTO tutor2_id FROM users WHERE email = 'student7@ucsd.edu' LIMIT 1;
    
    -- ============================================
    -- ENROLLMENTS
    -- ============================================
    -- Note: Instructor is NOT enrolled, only added as instructor_id to course_offering
    -- All students (UCSD and extension) are auto-enrolled below
    
    -- Enroll TAs
    IF ta1_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, ta1_id, 'ta'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, current_date_val)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'ta'::enrollment_role_enum;
    END IF;
    
    IF ta2_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, ta2_id, 'ta'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, current_date_val)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'ta'::enrollment_role_enum;
    END IF;
    
    IF ta3_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, ta3_id, 'ta'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, current_date_val)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'ta'::enrollment_role_enum;
    END IF;
    
    -- Enroll Tutors
    IF tutor1_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, tutor1_id, 'tutor'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, current_date_val)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'tutor'::enrollment_role_enum;
    END IF;
    
    IF tutor2_id IS NOT NULL THEN
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, tutor2_id, 'tutor'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, current_date_val)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET course_role = 'tutor'::enrollment_role_enum;
    END IF;
    
    -- Auto-enroll ALL students (primary_role = 'student') - both UCSD and extension
    -- This ensures every student is automatically enrolled when the course offering exists
    INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
    SELECT 
        offering_id_var,
        id,
        'student'::enrollment_role_enum,
        'enrolled'::enrollment_status_enum,
        current_date_val
    FROM users
    WHERE primary_role = 'student'::user_role_enum
        AND deleted_at IS NULL
        AND id NOT IN (SELECT user_id FROM enrollments WHERE offering_id = offering_id_var)
    ON CONFLICT (offering_id, user_id) DO NOTHING;
    
    RAISE NOTICE '✅ Auto-enrolled all students in CSE 210';
    
    -- ============================================
    -- TEAMS (1-10) with mock student assignments
    -- ============================================
    -- Create teams 1-10 with some mock students assigned (not tester emails)
    -- This leaves some students unassigned for manual team creation testing
    
    DECLARE
        team_id_var UUID;
        student1_id UUID;
        student3_id UUID;
        student4_id UUID;
        student5_id UUID;
        student6_id UUID;
        student7_id UUID;
        student8_id UUID;
        ext2_id UUID;
        ext3_id UUID;
        ext4_id UUID;
        ext5_id UUID;
        bhavikgmail_id UUID;
        bgyawali_id UUID;
    BEGIN
        -- Get mock student IDs (NOT tester emails like kanzhekanzhe1, jackkanzhe, liamhardy2004)
        SELECT id INTO student1_id FROM users WHERE email = 'student1@ucsd.edu';
        SELECT id INTO student3_id FROM users WHERE email = 'student3@ucsd.edu';
        SELECT id INTO student4_id FROM users WHERE email = 'student4@ucsd.edu';
        SELECT id INTO student5_id FROM users WHERE email = 'student5@ucsd.edu';
        SELECT id INTO student6_id FROM users WHERE email = 'student6@ucsd.edu';
        SELECT id INTO student7_id FROM users WHERE email = 'student7@ucsd.edu';
        SELECT id INTO student8_id FROM users WHERE email = 'student8@ucsd.edu';
        SELECT id INTO ext2_id FROM users WHERE email = 'extension2@gmail.com';
        SELECT id INTO ext3_id FROM users WHERE email = 'extension3@yahoo.com';
        SELECT id INTO ext4_id FROM users WHERE email = 'extension4@gmail.com';
        SELECT id INTO ext5_id FROM users WHERE email = 'extension5@outlook.com';
        SELECT id INTO bhavikgmail_id FROM users WHERE email = 'bhavikchandna@gmail.com';
        SELECT id INTO bgyawali_id FROM users WHERE email = 'bgyawali@ucsd.edu';
        
        -- Team 1: student1 (leader), student3, ext2
        IF student1_id IS NOT NULL THEN
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (offering_id_var, 'Team 1', 1, student1_id, active_status, current_date_val, instructor_id)
            RETURNING id INTO team_id_var;
            
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (team_id_var, student1_id, 'leader'::team_member_role_enum, current_date_val, instructor_id)
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            IF student3_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                VALUES (team_id_var, student3_id, 'member'::team_member_role_enum, current_date_val, instructor_id)
                ON CONFLICT (team_id, user_id) DO NOTHING;
            END IF;
            
            IF ext2_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                VALUES (team_id_var, ext2_id, 'member'::team_member_role_enum, current_date_val, instructor_id)
                ON CONFLICT (team_id, user_id) DO NOTHING;
            END IF;
            
            RAISE NOTICE '✅ Created Team 1 with 3 members';
        END IF;
        
        -- Team 2: student4 (leader), student5
        IF student4_id IS NOT NULL THEN
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (offering_id_var, 'Team 2', 2, student4_id, active_status, current_date_val, instructor_id)
            RETURNING id INTO team_id_var;
            
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (team_id_var, student4_id, 'leader'::team_member_role_enum, current_date_val, instructor_id)
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            IF student5_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                VALUES (team_id_var, student5_id, 'member'::team_member_role_enum, current_date_val, instructor_id)
                ON CONFLICT (team_id, user_id) DO NOTHING;
            END IF;
            
            RAISE NOTICE '✅ Created Team 2 with 2 members';
        END IF;
        
        -- Team 3: student6 (leader), student7, ext3
        IF student6_id IS NOT NULL THEN
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (offering_id_var, 'Team 3', 3, student6_id, active_status, current_date_val, instructor_id)
            RETURNING id INTO team_id_var;
            
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (team_id_var, student6_id, 'leader'::team_member_role_enum, current_date_val, instructor_id)
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            IF student7_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                VALUES (team_id_var, student7_id, 'member'::team_member_role_enum, current_date_val, instructor_id)
                ON CONFLICT (team_id, user_id) DO NOTHING;
            END IF;
            
            IF ext3_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                VALUES (team_id_var, ext3_id, 'member'::team_member_role_enum, current_date_val, instructor_id)
                ON CONFLICT (team_id, user_id) DO NOTHING;
            END IF;
            
            RAISE NOTICE '✅ Created Team 3 with 3 members';
        END IF;
        
        -- Team 4: student8 (leader), ext4
        IF student8_id IS NOT NULL THEN
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (offering_id_var, 'Team 4', 4, student8_id, active_status, current_date_val, instructor_id)
            RETURNING id INTO team_id_var;
            
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (team_id_var, student8_id, 'leader'::team_member_role_enum, current_date_val, instructor_id)
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            IF ext4_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                VALUES (team_id_var, ext4_id, 'member'::team_member_role_enum, current_date_val, instructor_id)
                ON CONFLICT (team_id, user_id) DO NOTHING;
            END IF;
            
            RAISE NOTICE '✅ Created Team 4 with 2 members';
        END IF;
        
        -- Team 5: ext5 (leader), bhavikgmail
        IF ext5_id IS NOT NULL THEN
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (offering_id_var, 'Team 5', 5, ext5_id, active_status, current_date_val, instructor_id)
            RETURNING id INTO team_id_var;
            
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (team_id_var, ext5_id, 'leader'::team_member_role_enum, current_date_val, instructor_id)
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            IF bhavikgmail_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
                VALUES (team_id_var, bhavikgmail_id, 'member'::team_member_role_enum, current_date_val, instructor_id)
                ON CONFLICT (team_id, user_id) DO NOTHING;
            END IF;
            
            RAISE NOTICE '✅ Created Team 5 with 2 members';
        END IF;
        
        -- Team 6: bgyawali (leader) - single member team
        IF bgyawali_id IS NOT NULL THEN
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (offering_id_var, 'Team 6', 6, bgyawali_id, active_status, current_date_val, instructor_id)
            RETURNING id INTO team_id_var;
            
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (team_id_var, bgyawali_id, 'leader'::team_member_role_enum, current_date_val, instructor_id)
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            RAISE NOTICE '✅ Created Team 6 with 1 member';
        END IF;
        
        -- Teams 7-10: Empty teams (no members assigned yet)
        FOR team_num IN 7..10 LOOP
            INSERT INTO team (offering_id, name, team_number, status, formed_at, created_by)
            VALUES (offering_id_var, 'Team ' || team_num, team_num, 'forming'::team_status_enum, current_date_val, instructor_id);
            
            RAISE NOTICE '✅ Created Team % (empty, forming)', team_num;
        END LOOP;
    END;
    
    -- Ensure TAs and Tutors are NOT in any teams (remove if accidentally added)
    -- This must happen AFTER teams are created
    DELETE FROM team_members 
    WHERE user_id IN (ta1_id, ta2_id, ta3_id, tutor1_id, tutor2_id)
       OR user_id IN (
           SELECT user_id FROM enrollments 
           WHERE offering_id = offering_id_var 
             AND course_role IN ('ta'::enrollment_role_enum, 'tutor'::enrollment_role_enum)
         );
    
    -- Also remove TAs/tutors from team leader_id and reassign if needed
    UPDATE team 
    SET leader_id = NULL 
    WHERE offering_id = offering_id_var 
      AND (leader_id IN (ta1_id, ta2_id, ta3_id, tutor1_id, tutor2_id)
           OR leader_id IN (
               SELECT user_id FROM enrollments 
               WHERE offering_id = offering_id_var 
                 AND course_role IN ('ta'::enrollment_role_enum, 'tutor'::enrollment_role_enum)
             ));
    
    -- For teams that lost their leader, assign a new leader from team members
    UPDATE team t
    SET leader_id = (
        SELECT tm.user_id 
        FROM team_members tm 
        WHERE tm.team_id = t.id 
          AND tm.left_at IS NULL 
          AND tm.user_id NOT IN (
              SELECT user_id FROM enrollments 
              WHERE offering_id = t.offering_id 
                AND course_role IN ('ta'::enrollment_role_enum, 'tutor'::enrollment_role_enum)
          )
        ORDER BY tm.role DESC, tm.joined_at ASC
        LIMIT 1
    )
    WHERE t.offering_id = offering_id_var 
      AND t.leader_id IS NULL
      AND EXISTS (SELECT 1 FROM team_members WHERE team_id = t.id AND left_at IS NULL);
    
    RAISE NOTICE '✅ Seed data complete: CSE 210 offering with enrollments and teams 1-10 (some students unassigned)';
    
    -- ============================================
    -- SPECIAL TEAM: Team 11 with kanzhekanzhe1@gmail.com as leader (for testing)
    -- ============================================
    DECLARE
        team11_id UUID;
        zhekan_id UUID;
        jack_id UUID;
    BEGIN
        -- Get user IDs
        SELECT id INTO zhekan_id FROM users WHERE email = 'kanzhekanzhe1@gmail.com';
        SELECT id INTO jack_id FROM users WHERE email = 'jackkanzhe@gmail.com';
        
        IF zhekan_id IS NOT NULL AND jack_id IS NOT NULL THEN
            -- Create Team 11
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (
                offering_id_var,
                'Team 11',
                11,
                zhekan_id,
                active_status,
                current_date_val,
                instructor_id
            )
            RETURNING id INTO team11_id;
            
            -- Add kanzhekanzhe1@gmail.com as leader
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (
                team11_id,
                zhekan_id,
                'leader'::team_member_role_enum,
                current_date_val,
                instructor_id
            )
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            -- Add jackkanzhe@gmail.com as member
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (
                team11_id,
                jack_id,
                'member'::team_member_role_enum,
                current_date_val,
                instructor_id
            )
            ON CONFLICT (team_id, user_id) DO NOTHING;
            
            RAISE NOTICE '✅ Created Team 11 with kanzhekanzhe1@gmail.com (leader) and jackkanzhe@gmail.com (member)';
        ELSE
            RAISE NOTICE '⚠️ Could not create Team 11: kanzhekanzhe1@gmail.com or jackkanzhe@gmail.com not found';
        END IF;
    END;
    
    -- ============================================
    -- SPECIAL TEAM: Team 12 with liamhardy2004@gmail.com as leader
    -- ============================================
    DECLARE
        team12_id UUID;
        liam_id UUID;
    BEGIN
        -- Get user ID for liam hardy
        SELECT id INTO liam_id FROM users WHERE email = 'liamhardy2004@gmail.com' LIMIT 1;

        IF liam_id IS NOT NULL THEN
            -- Create Team 12
            INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
            VALUES (
                offering_id_var,
                'Team 12',
                12,
                liam_id,
                active_status,
                current_date_val,
                instructor_id
            )
            RETURNING id INTO team12_id;

            -- Add liamhardy2004@gmail.com as leader member record
            INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
            VALUES (
                team12_id,
                liam_id,
                'leader'::team_member_role_enum,
                current_date_val,
                instructor_id
            )
            ON CONFLICT (team_id, user_id) DO NOTHING;

            RAISE NOTICE '✅ Created Team 12 with liamhardy2004@gmail.com as leader';
        ELSE
            RAISE NOTICE '⚠️ Could not create Team 12: liamhardy2004@gmail.com not found';
        END IF;
    END;
END $$;

