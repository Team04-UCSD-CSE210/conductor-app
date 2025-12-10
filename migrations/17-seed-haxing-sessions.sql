-- 16-seed-haxing-sessions.sql
-- Add test sessions with multiple choice and pulse check questions for haxing@ucsd.edu

DO $$
DECLARE
    instructor_id UUID;
    offering_id_var UUID;
    session1_id UUID;
    session2_id UUID;
    q1_id UUID;
    q2_id UUID;
    q3_id UUID;
    student_ids UUID[];
    access_code1 TEXT := 'HAIYI1';
    access_code2 TEXT := 'HAIYI2';
BEGIN
    -- Get instructor ID
    SELECT id INTO instructor_id FROM users WHERE email = 'haxing@ucsd.edu';
    
    IF instructor_id IS NULL THEN
        RAISE NOTICE 'Instructor haxing@ucsd.edu not found, skipping session creation';
        RETURN;
    END IF;
    
    -- Get CSE210 offering
    SELECT id INTO offering_id_var 
    FROM course_offerings
    WHERE code LIKE 'CSE%210%'
    LIMIT 1;
    
    IF offering_id_var IS NULL THEN
        RAISE NOTICE 'CSE210 offering not found, skipping session creation';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found offering_id: %', offering_id_var;
    
    -- Get enrolled students
    SELECT ARRAY_AGG(e.user_id) INTO student_ids
    FROM enrollments e
    WHERE e.offering_id = offering_id_var 
    AND e.status = 'enrolled'
    AND e.course_role = 'student';
    
    RAISE NOTICE 'Creating sessions for instructor haxing@ucsd.edu';
    
    -- =============================================
    -- Session 1: Multiple Choice Questions Demo
    -- =============================================
    INSERT INTO sessions (
        offering_id,
        title,
        description,
        session_date,
        session_time,
        access_code,
        code_expires_at,
        attendance_opened_at,
        is_active,
        created_by,
        updated_by
    ) VALUES (
        offering_id_var,
        'Demo Session: Multiple Choice',
        'Test session with multiple choice questions',
        CURRENT_DATE,
        '14:00:00',
        access_code1,
        NOW() + INTERVAL '7 days',
        NOW(),
        true,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO session1_id;
    
    -- Question 1: Text question
    INSERT INTO session_questions (
        session_id,
        question_text,
        question_type,
        question_order,
        is_required,
        created_by,
        updated_by
    ) VALUES (
        session1_id,
        'What did you learn from today''s lecture?',
        'text',
        1,
        true,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO q1_id;
    
    -- Question 2: Multiple choice
    INSERT INTO session_questions (
        session_id,
        question_text,
        question_type,
        question_order,
        options,
        is_required,
        created_by,
        updated_by
    ) VALUES (
        session1_id,
        'How well did you understand the material?',
        'multiple_choice',
        2,
        '["Very well - I can explain it to others", "Well - I understand the main concepts", "Somewhat - I need more examples", "Not well - I am confused"]'::jsonb,
        true,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO q2_id;
    
    -- Question 3: Another multiple choice
    INSERT INTO session_questions (
        session_id,
        question_text,
        question_type,
        question_order,
        options,
        is_required,
        created_by,
        updated_by
    ) VALUES (
        session1_id,
        'Which topic would you like to explore more?',
        'multiple_choice',
        3,
        '["Software Architecture", "Testing Strategies", "Deployment Practices", "Team Collaboration"]'::jsonb,
        false,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO q3_id;
    
    RAISE NOTICE 'Created session 1 (%) with 3 questions', session1_id;
    
    -- =============================================
    -- Session 2: Pulse Check Questions Demo
    -- =============================================
    INSERT INTO sessions (
        offering_id,
        title,
        description,
        session_date,
        session_time,
        access_code,
        code_expires_at,
        attendance_opened_at,
        is_active,
        created_by,
        updated_by
    ) VALUES (
        offering_id_var,
        'Demo Session: Pulse Check',
        'Test session with pulse check questions',
        CURRENT_DATE + INTERVAL '1 day',
        '14:00:00',
        access_code2,
        NOW() + INTERVAL '7 days',
        NOW(),
        true,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO session2_id;
    
    -- Question 1: Pulse check
    INSERT INTO session_questions (
        session_id,
        question_text,
        question_type,
        question_order,
        options,
        is_required,
        created_by,
        updated_by
    ) VALUES (
        session2_id,
        'How confident do you feel about the upcoming project?',
        'pulse_check',
        1,
        '["Very Confident", "Confident", "Neutral", "Not Confident", "Very Worried"]'::jsonb,
        true,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO q1_id;
    
    -- Question 2: Another pulse check
    INSERT INTO session_questions (
        session_id,
        question_text,
        question_type,
        question_order,
        options,
        is_required,
        created_by,
        updated_by
    ) VALUES (
        session2_id,
        'How is your workload this week?',
        'pulse_check',
        2,
        '["Very Light", "Manageable", "Moderate", "Heavy", "Overwhelming"]'::jsonb,
        true,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO q2_id;
    
    -- Question 3: Mixed - text question
    INSERT INTO session_questions (
        session_id,
        question_text,
        question_type,
        question_order,
        is_required,
        created_by,
        updated_by
    ) VALUES (
        session2_id,
        'Any questions or concerns you''d like to share?',
        'text',
        3,
        false,
        instructor_id,
        instructor_id
    )
    RETURNING id INTO q3_id;
    
    RAISE NOTICE 'Created session 2 (%) with 3 questions', session2_id;
    
    -- Note: Attendance seed data removed - sessions are created without attendance records
    
    RAISE NOTICE '✅ Successfully created 2 demo sessions for haxing@ucsd.edu';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error creating sessions: %', SQLERRM;
END $$;
