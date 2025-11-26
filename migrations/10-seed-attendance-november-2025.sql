-- 10-seed-attendance-november-2025.sql
-- Populates attendance-related tables with November 2025 data
-- Creates 8 sessions, questions, attendance records, and responses
-- Every student has either present or absent status for each session
-- Run AFTER users, course_offerings, enrollments, and teams are seeded

-- Ensure session_id column exists in session_responses table (for existing databases)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'session_responses' 
        AND column_name = 'session_id'
    ) THEN
        -- Column doesn't exist, add it
        ALTER TABLE session_responses 
        ADD COLUMN session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;
        
        -- Update existing rows to have a session_id (get it from the question)
        UPDATE session_responses sr
        SET session_id = sq.session_id
        FROM session_questions sq
        WHERE sr.question_id = sq.id
        AND sr.session_id IS NULL;
        
        -- Now make it NOT NULL after populating existing rows
        ALTER TABLE session_responses 
        ALTER COLUMN session_id SET NOT NULL;
        
        -- Create index for the new column
        CREATE INDEX IF NOT EXISTS idx_session_responses_session ON session_responses(session_id);
        
        RAISE NOTICE 'Added session_id column to session_responses table';
    ELSE
        -- Column exists, but might be nullable - update NULL values and make it NOT NULL
        UPDATE session_responses sr
        SET session_id = sq.session_id
        FROM session_questions sq
        WHERE sr.question_id = sq.id
        AND sr.session_id IS NULL;
        
        -- Make it NOT NULL if it isn't already
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'session_responses' 
            AND column_name = 'session_id'
            AND is_nullable = 'YES'
        ) THEN
            ALTER TABLE session_responses 
            ALTER COLUMN session_id SET NOT NULL;
        END IF;
        
        -- Ensure index exists
        CREATE INDEX IF NOT EXISTS idx_session_responses_session ON session_responses(session_id);
    END IF;
    
    -- Ensure unique constraint exists (session_id, question_id, user_id)
    -- This allows the same user to answer the same question in different sessions
    -- Try to add it, ignore if it already exists
    BEGIN
        ALTER TABLE session_responses 
        ADD CONSTRAINT session_responses_session_question_user_unique 
        UNIQUE (session_id, question_id, user_id);
        
        RAISE NOTICE 'Added unique constraint (session_id, question_id, user_id) to session_responses table';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'Unique constraint (session_id, question_id, user_id) already exists on session_responses';
        WHEN OTHERS THEN
            -- If constraint exists with different name or structure, that's okay
            RAISE NOTICE 'Could not add unique constraint (may already exist): %', SQLERRM;
    END;
END $$;

DO $$
DECLARE
    offering_id_var UUID;
    instructor_id UUID;
    session_ids UUID[];
    student_ids UUID[];
    session_idx INTEGER;
    student_idx INTEGER;
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars (I, O, 0, 1)
    new_access_code TEXT;
    session_titles TEXT[] := ARRAY[
        'Lecture 1: Introduction to Software Engineering',
        'Lecture 2: Requirements and Design',
        'Lecture 3: Testing and Quality Assurance',
        'Lecture 4: Deployment and DevOps',
        'Lecture 5: Software Architecture Patterns',
        'Lecture 6: Agile Development Methodologies',
        'Lecture 7: Code Review and Collaboration',
        'Lecture 8: Project Management and Planning'
    ];
    session_dates DATE[] := ARRAY[
        '2025-11-03'::DATE,  -- Monday, Nov 3 (Lecture 1)
        '2025-11-05'::DATE,  -- Wednesday, Nov 5 (Lecture 2)
        '2025-11-10'::DATE,  -- Monday, Nov 10 (Lecture 3)
        '2025-11-12'::DATE,  -- Wednesday, Nov 12 (Lecture 4)
        '2025-11-13'::DATE,  -- Thursday, Nov 13 (Lecture 5)
        '2025-11-14'::DATE,  -- Friday, Nov 14 (Lecture 6)
        '2025-11-15'::DATE,  -- Saturday, Nov 15 (Lecture 7)
        '2025-11-17'::DATE   -- Monday, Nov 17 (Lecture 8 - Last class before Nov 18)
    ];
    session_times TIME[] := ARRAY[
        '14:00:00'::TIME,    -- 2:00 PM
        '14:00:00'::TIME,
        '14:00:00'::TIME,
        '14:00:00'::TIME,
        '16:00:00'::TIME,    -- 4:00 PM
        '16:00:00'::TIME,
        '16:00:00'::TIME,
        '16:00:00'::TIME
    ];
    attendance_percentages INTEGER[] := ARRAY[92, 88, 85, 90, 87, 91, 89, 86]; -- Different attendance rates
    code_char_idx INTEGER;
BEGIN
    -- Get CSE 210 offering
    SELECT id INTO offering_id_var 
    FROM course_offerings 
    WHERE code = 'CSE 210' 
      AND term = 'Fall' 
      AND year = 2025 
    LIMIT 1;
    
    IF offering_id_var IS NULL THEN
        RAISE EXCEPTION 'CSE 210 offering not found. Run course offering seed data first.';
    END IF;
    
    -- Get instructor ID
    SELECT id INTO instructor_id 
    FROM users 
    WHERE email = 'bhchandna@ucsd.edu' 
       OR email = 'lhardy@ucsd.edu'
       OR email = 'instructor1@ucsd.edu'
    LIMIT 1;
    
    IF instructor_id IS NULL THEN
        SELECT id INTO instructor_id 
        FROM users 
        WHERE primary_role = 'instructor' 
        LIMIT 1;
    END IF;
    
    IF instructor_id IS NULL THEN
        RAISE EXCEPTION 'Instructor not found. Run user seed data first.';
    END IF;
    
    -- Get all enrolled student IDs
    SELECT ARRAY_AGG(user_id ORDER BY user_id) INTO student_ids
    FROM (
        SELECT DISTINCT user_id
        FROM enrollments
        WHERE offering_id = offering_id_var
          AND course_role = 'student'::enrollment_role_enum
          AND status = 'enrolled'::enrollment_status_enum
    ) sub;
    
    IF student_ids IS NULL OR array_length(student_ids, 1) < 10 THEN
        RAISE WARNING 'Not enough students enrolled. Need at least 10 students.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creating 8 sessions for November 2025 with % students...', array_length(student_ids, 1);
    
    -- Create 8 sessions for November 2025
    FOR session_idx IN 1..8 LOOP
        DECLARE
            session_id_var UUID;
            opened_at TIMESTAMPTZ;
            closed_at TIMESTAMPTZ;
            code_expires_at TIMESTAMPTZ;
            num_attendees INTEGER;
            present_students UUID[];
            absent_students UUID[];
            question_id_var UUID;
            question_ids UUID[];
            response_text TEXT;
            response_option TEXT;
            student_id_var UUID;
            check_in_time TIMESTAMPTZ;
            code_used TEXT;
            attempts INTEGER := 0;
            unique_code BOOLEAN := FALSE;
            code_result TEXT;
            loop_i INTEGER;
        BEGIN
            -- Generate unique access code (inline logic)
            WHILE NOT unique_code AND attempts < 20 LOOP
                -- Generate random 6-character code
                code_result := '';
                FOR loop_i IN 1..6 LOOP
                    code_char_idx := floor(random() * length(chars) + 1)::INTEGER;
                    code_result := code_result || substr(chars, code_char_idx, 1);
                END LOOP;
                new_access_code := code_result;
                
                -- Check if code is unique (qualify column name to avoid ambiguity)
                SELECT NOT EXISTS(SELECT 1 FROM sessions s WHERE s.access_code = new_access_code) INTO unique_code;
                attempts := attempts + 1;
            END LOOP;
            
            IF NOT unique_code THEN
                -- Fallback: use timestamp-based code
                new_access_code := 'S' || substr(to_char(EXTRACT(EPOCH FROM NOW())::BIGINT, '9999999999'), -5) || chr(65 + session_idx);
            END IF;
            
            -- Calculate timestamps
            opened_at := (session_dates[session_idx] || ' ' || session_times[session_idx])::TIMESTAMPTZ;
            closed_at := opened_at + INTERVAL '90 minutes';
            -- Set code_expires_at to the actual end time (start time + 30 minutes default, or use closed_at if available)
            -- This represents when the lecture ends, not when the code expires
            code_expires_at := opened_at + INTERVAL '30 minutes';
            
            -- Create session
            INSERT INTO sessions (
                offering_id,
                title,
                description,
                session_date,
                session_time,
                access_code,
                code_expires_at,
                is_active,
                attendance_opened_at,
                attendance_closed_at,
                created_by,
                updated_by
            ) VALUES (
                offering_id_var,
                session_titles[session_idx],
                'Weekly lecture session for CSE 210',
                session_dates[session_idx],
                session_times[session_idx],
                new_access_code,
                code_expires_at,
                TRUE,
                opened_at,
                closed_at,
                instructor_id,
                instructor_id
            )
            RETURNING id INTO session_id_var;
            
            session_ids[session_idx] := session_id_var;
            
            -- Calculate attendance (varying percentages)
            num_attendees := GREATEST(1, FLOOR(array_length(student_ids, 1) * attendance_percentages[session_idx] / 100.0)::INTEGER);
            num_attendees := LEAST(num_attendees, array_length(student_ids, 1)); -- Ensure not more than total students
            
            -- Randomly select present students (ensure at least 1, not more than total)
            WITH shuffled_students AS (
                SELECT user_id, RANDOM() as rand_val
                FROM unnest(student_ids) as user_id
                ORDER BY rand_val
                LIMIT num_attendees
            )
            SELECT ARRAY_AGG(user_id) INTO present_students
            FROM shuffled_students;
            
            -- Ensure we have present students
            IF present_students IS NULL OR array_length(present_students, 1) = 0 THEN
                -- Fallback: at least first student is present
                present_students := ARRAY[student_ids[1]];
            END IF;
            
            -- Get absent students (all students not in present list)
            SELECT ARRAY_AGG(user_id) INTO absent_students
            FROM unnest(student_ids) as user_id
            WHERE user_id != ALL(COALESCE(present_students, ARRAY[]::UUID[]));
            
            -- Create attendance records for EVERY student
            FOR student_idx IN 1..array_length(student_ids, 1) LOOP
                student_id_var := student_ids[student_idx];
                
                -- Check if student is present
                IF student_id_var = ANY(COALESCE(present_students, ARRAY[]::UUID[])) THEN
                    -- Present student: fill all fields
                    check_in_time := opened_at + (RANDOM() * INTERVAL '30 minutes');
                    code_used := new_access_code;
                    
                    -- Insert or update attendance record (using existence check)
                    IF EXISTS (SELECT 1 FROM attendance WHERE session_id = session_id_var AND user_id = student_id_var) THEN
                        UPDATE attendance SET
                            status = 'present'::attendance_status_enum,
                            checked_in_at = check_in_time,
                            access_code_used = code_used,
                            updated_at = NOW()
                        WHERE session_id = session_id_var AND user_id = student_id_var;
                    ELSE
                        INSERT INTO attendance (
                            session_id,
                            user_id,
                            status,
                            checked_in_at,
                            access_code_used,
                            created_at,
                            updated_at
                        ) VALUES (
                            session_id_var,
                            student_id_var,
                            'present'::attendance_status_enum,
                            check_in_time,
                            code_used,
                            check_in_time,
                            check_in_time
                        );
                    END IF;
                ELSE
                    -- Absent student: fill status and timestamps, but leave checked_in_at and access_code_used as NULL
                    IF EXISTS (SELECT 1 FROM attendance WHERE session_id = session_id_var AND user_id = student_id_var) THEN
                        UPDATE attendance SET
                            status = 'absent'::attendance_status_enum,
                            checked_in_at = NULL,
                            access_code_used = NULL,
                            updated_at = NOW()
                        WHERE session_id = session_id_var AND user_id = student_id_var;
                    ELSE
                        INSERT INTO attendance (
                            session_id,
                            user_id,
                            status,
                            checked_in_at,
                            access_code_used,
                            created_at,
                            updated_at
                        ) VALUES (
                            session_id_var,
                            student_id_var,
                            'absent'::attendance_status_enum,
                            NULL,
                            NULL,
                            opened_at, -- created_at when session was opened
                            opened_at  -- updated_at when session was opened
                        );
                    END IF;
                END IF;
            END LOOP;
            
            -- Create questions for this session
            -- Question 1: Text response
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
                session_id_var,
                'Summarize your thoughts on today''s lecture in 2-3 sentences.',
                'text',
                1,
                NULL,
                TRUE,
                instructor_id,
                instructor_id
            )
            RETURNING id INTO question_id_var;
            
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
                session_id_var,
                'How well did you understand today''s material?',
                'multiple_choice',
                2,
                '["Very well", "Well", "Somewhat", "Not well"]'::JSONB,
                TRUE,
                instructor_id,
                instructor_id
            )
            RETURNING id INTO question_id_var;
            
            -- Question 3: Pulse check
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
                session_id_var,
                'Did you complete the assigned reading?',
                'pulse_check',
                3,
                '["Yes", "Partially", "No"]'::JSONB,
                FALSE,
                instructor_id,
                instructor_id
            )
            RETURNING id INTO question_id_var;
            
            -- Get all question IDs for this session (after all inserts) - reset array
            question_ids := NULL;
            SELECT ARRAY_AGG(id ORDER BY question_order) INTO question_ids
            FROM session_questions
            WHERE session_id = session_id_var;
            
            -- Validate question IDs were retrieved
            IF question_ids IS NULL OR array_length(question_ids, 1) < 3 THEN
                RAISE WARNING 'Failed to retrieve question IDs for session %', session_id_var;
                CONTINUE; -- Skip response creation for this session
            END IF;
            
            -- Create responses from present students only
            IF present_students IS NOT NULL AND question_ids IS NOT NULL AND array_length(question_ids, 1) >= 3 THEN
                FOR student_idx IN 1..array_length(present_students, 1) LOOP
                    DECLARE
                        student_response_time TIMESTAMPTZ;
                        text_response_val TEXT;
                        option_response_val TEXT;
                        q1_id UUID;
                        q2_id UUID;
                        q3_id UUID;
                    BEGIN
                        -- Store question IDs in local variables to avoid array indexing issues
                        q1_id := question_ids[1];
                        q2_id := question_ids[2];
                        q3_id := question_ids[3];
                        
                        -- Validate question IDs
                        IF q1_id IS NULL OR q2_id IS NULL THEN
                            RAISE WARNING 'Invalid question IDs for session %, skipping responses', session_id_var;
                            CONTINUE;
                        END IF;
                        
                        student_response_time := opened_at + (RANDOM() * INTERVAL '45 minutes');
                        
                        -- Response to question 1 (text) - from all present students
                        IF q1_id IS NOT NULL THEN
                            SELECT CASE (RANDOM() * 3)::INTEGER
                                WHEN 0 THEN 'Today''s lecture provided a great overview of software engineering principles. I particularly enjoyed the discussion on requirements gathering.'
                                WHEN 1 THEN 'The material was clear and well-presented. I found the examples helpful for understanding the concepts.'
                                ELSE 'Very informative session. I have a few questions that I''ll follow up on during office hours.'
                            END INTO text_response_val;
                            
                            -- Insert or update response
                            IF EXISTS (SELECT 1 FROM session_responses WHERE question_id = q1_id AND user_id = present_students[student_idx]) THEN
                                UPDATE session_responses SET
                                    response_text = text_response_val,
                                    submitted_at = student_response_time
                                WHERE question_id = q1_id AND user_id = present_students[student_idx];
                            ELSE
                                INSERT INTO session_responses (
                                    session_id,
                                    question_id,
                                    user_id,
                                    response_text,
                                    response_option,
                                    submitted_at
                                ) VALUES (
                                    session_id_var,
                                    q1_id,
                                    present_students[student_idx],
                                    text_response_val,
                                    NULL,
                                    student_response_time
                                );
                            END IF;
                        END IF;
                        
                        -- Response to question 2 (multiple choice) - from all present students
                        IF q2_id IS NOT NULL THEN
                            SELECT (ARRAY['Very well', 'Well', 'Somewhat', 'Not well'])[
                                (RANDOM() * 4)::INTEGER + 1
                            ] INTO option_response_val;
                            
                            -- Insert or update response
                            IF EXISTS (SELECT 1 FROM session_responses WHERE question_id = q2_id AND user_id = present_students[student_idx]) THEN
                                UPDATE session_responses SET
                                    response_option = option_response_val,
                                    submitted_at = student_response_time + INTERVAL '60 seconds'
                                WHERE question_id = q2_id AND user_id = present_students[student_idx];
                            ELSE
                                INSERT INTO session_responses (
                                    session_id,
                                    question_id,
                                    user_id,
                                    response_text,
                                    response_option,
                                    submitted_at
                                ) VALUES (
                                    session_id_var,
                                    q2_id,
                                    present_students[student_idx],
                                    NULL,
                                    option_response_val,
                                    student_response_time + INTERVAL '30 seconds'
                                );
                            END IF;
                        END IF;
                        
                        -- Response to question 3 (pulse check) - only for 70% of students
                        IF q3_id IS NOT NULL AND RANDOM() < 0.7 THEN
                            SELECT (ARRAY['Yes', 'Partially', 'No'])[
                                (RANDOM() * 3)::INTEGER + 1
                            ] INTO option_response_val;
                            
                            -- Insert or update response
                            IF EXISTS (SELECT 1 FROM session_responses WHERE question_id = q3_id AND user_id = present_students[student_idx]) THEN
                                UPDATE session_responses SET
                                    response_option = option_response_val,
                                    submitted_at = student_response_time + INTERVAL '1 minute'
                                WHERE question_id = q3_id AND user_id = present_students[student_idx];
                            ELSE
                                INSERT INTO session_responses (
                                    session_id,
                                    question_id,
                                    user_id,
                                    response_text,
                                    response_option,
                                    submitted_at
                                ) VALUES (
                                    session_id_var,
                                    q3_id,
                                    present_students[student_idx],
                                    NULL,
                                    option_response_val,
                                    student_response_time + INTERVAL '1 minute'
                                );
                            END IF;
                        END IF;
                    END;
                END LOOP;
            END IF;
            
            RAISE NOTICE 'Created session "%" (code: %) - % present, % absent on %', 
                session_titles[session_idx],
                new_access_code,
                array_length(present_students, 1),
                array_length(absent_students, 1),
                session_dates[session_idx];
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Successfully created 8 sessions for November 2025 with attendance and responses';
    RAISE NOTICE '   Total sessions: 8';
    RAISE NOTICE '   Total attendance records: %', 
        (SELECT COUNT(*) FROM attendance WHERE session_id = ANY(session_ids));
    RAISE NOTICE '   Total students: %', array_length(student_ids, 1);
    RAISE NOTICE '   Total responses: %', 
        (SELECT COUNT(*) FROM session_responses 
         WHERE question_id IN (SELECT id FROM session_questions WHERE session_id = ANY(session_ids)));
END $$;

COMMENT ON TABLE sessions IS 'November 2025 sessions seeded with attendance and responses - 8 sessions with randomized access codes';
