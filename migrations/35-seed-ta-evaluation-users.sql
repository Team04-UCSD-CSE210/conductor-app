-- seed-ta-evaluation-users.sql
-- Seed users for TA evaluation

DO $$
DECLARE
    role_instructor CONSTANT user_role_enum := 'instructor'::user_role_enum;
    role_student CONSTANT user_role_enum := 'student'::user_role_enum;
    status_active CONSTANT user_status_enum := 'active'::user_status_enum;
    inst_ucsd CONSTANT institution_type_enum := 'ucsd'::institution_type_enum;
    inst_extension CONSTANT institution_type_enum := 'extension'::institution_type_enum;
    role_instructor_enroll CONSTANT enrollment_role_enum := 'instructor'::enrollment_role_enum;
    role_student_enroll CONSTANT enrollment_role_enum := 'student'::enrollment_role_enum;
    status_enrolled CONSTANT enrollment_status_enum := 'enrolled'::enrollment_status_enum;
    
    offering_id_var UUID;
    instructor_user_id UUID;
    student_user_id UUID;
BEGIN
    -- Get active offering
    SELECT id INTO offering_id_var 
    FROM course_offerings 
    WHERE is_active = TRUE 
    LIMIT 1;
    
    IF offering_id_var IS NULL THEN
        RAISE EXCEPTION 'No active course offering found. Please create an active offering first.';
    END IF;
    
    -- Insert or update Sammed Kamate (Instructor)
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
    ) VALUES (
        'skamate@ucsd.edu', 
        'A99999999', 
        'Sammed Kamate', 
        'Sammed',
        NULL, 
        NULL, 
        NULL, 
        'Computer Science & Engineering', 
        NULL,
        role_instructor, 
        status_active, 
        inst_ucsd,
        NULL, 
        NULL, 
        NULL, 
        'sammedkamate', 
        NULL
    )
    ON CONFLICT (email) DO UPDATE
    SET
        name            = EXCLUDED.name,
        preferred_name  = EXCLUDED.preferred_name,
        department      = EXCLUDED.department,
        primary_role    = EXCLUDED.primary_role,
        status          = EXCLUDED.status,
        institution_type = EXCLUDED.institution_type,
        github_username = EXCLUDED.github_username,
        updated_at      = NOW()
    RETURNING id INTO instructor_user_id;
    
    -- Insert or update Sammed Kamate 2 (Student)
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
    ) VALUES (
        'sammedkamate@gmail.com', 
        NULL, 
        'Sammed Kamate 2', 
        'Sammed',
        'Computer Science', 
        'BS', 
        2025, 
        'Computer Science & Engineering', 
        'Undergraduate',
        role_student, 
        status_active, 
        inst_extension,
        NULL, 
        NULL, 
        NULL, 
        'sammedkamate2', 
        NULL
    )
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
        github_username = EXCLUDED.github_username,
        updated_at      = NOW()
    RETURNING id INTO student_user_id;
    
    -- Enroll instructor in active course
    IF instructor_user_id IS NOT NULL THEN
        INSERT INTO enrollments (
            offering_id,
            user_id,
            course_role,
            status,
            enrolled_at
        ) VALUES (
            offering_id_var,
            instructor_user_id,
            role_instructor_enroll,
            status_enrolled,
            CURRENT_DATE
        )
        ON CONFLICT (offering_id, user_id) DO UPDATE
        SET
            course_role = role_instructor_enroll,
            status = status_enrolled;
        
        RAISE NOTICE '✅ Enrolled skamate@ucsd.edu as instructor in active course';
    END IF;
    
    -- Enroll student in active course
    IF student_user_id IS NOT NULL THEN
        INSERT INTO enrollments (
            offering_id,
            user_id,
            course_role,
            status,
            enrolled_at
        ) VALUES (
            offering_id_var,
            student_user_id,
            role_student_enroll,
            status_enrolled,
            CURRENT_DATE
        )
        ON CONFLICT (offering_id, user_id) DO UPDATE
        SET
            course_role = role_student_enroll,
            status = status_enrolled;
        
        RAISE NOTICE '✅ Enrolled sammedkamate@gmail.com as student in active course';
    END IF;
    
    RAISE NOTICE '✅ TA evaluation users seeded successfully';
END $$;

SELECT 
    u.email,
    u.name,
    u.primary_role,
    u.institution_type,
    e.course_role AS enrollment_role,
    e.status AS enrollment_status,
    co.code AS course_code,
    co.name AS course_name
FROM users u
LEFT JOIN enrollments e ON u.id = e.user_id
LEFT JOIN course_offerings co ON e.offering_id = co.id AND co.is_active = TRUE
WHERE u.email IN ('skamate@ucsd.edu', 'sammedkamate@gmail.com')
ORDER BY u.email;
