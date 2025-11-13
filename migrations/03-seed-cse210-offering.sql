-- 03-seed-cse210-offering.sql
-- Create CSE 210 course offering for testing
-- Works even if users aren't seeded yet (creates instructor if needed)

-- Ensure we have an instructor (create one if instructor1@ucsd.edu doesn't exist)
DO $$
DECLARE
    instructor_uuid UUID;
BEGIN
    -- Try to get instructor1@ucsd.edu
    SELECT id INTO instructor_uuid FROM users WHERE email = 'instructor1@ucsd.edu' LIMIT 1;
    
    -- If not found, try any instructor
    IF instructor_uuid IS NULL THEN
        SELECT id INTO instructor_uuid FROM users WHERE primary_role = 'instructor' LIMIT 1;
    END IF;
    
    -- If still not found, create a default instructor
    IF instructor_uuid IS NULL THEN
        INSERT INTO users (email, name, primary_role, status, institution_type)
        VALUES ('instructor1@ucsd.edu', 'Dr. Alice Smith', 'instructor'::user_role_enum, 'active'::user_status_enum, 'ucsd'::institution_type_enum)
        ON CONFLICT (email) DO UPDATE SET primary_role = 'instructor'::user_role_enum
        RETURNING id INTO instructor_uuid;
    END IF;
    
    -- Now create/update the course offering
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
        enrollment_cap,
        status,
        location,
        class_timings,
        syllabus_url,
        is_active,
        created_by
    ) VALUES (
        'CSE210',
        'Software Engineering',
        'CSE',
        'Winter',
        2025,
        4,
        instructor_uuid,
        '2025-01-06',
        '2025-03-21',
        200,
        'open'::course_offering_status_enum,
        'Room 101, CSE Building',
        '{"monday": "10:00-11:00", "wednesday": "10:00-11:00"}'::jsonb,
        'https://example.com/cse210/syllabus',
        TRUE,
        instructor_uuid
    )
    ON CONFLICT (code, term, year) DO UPDATE
    SET
        name = EXCLUDED.name,
        department = EXCLUDED.department,
        credits = EXCLUDED.credits,
        instructor_id = EXCLUDED.instructor_id,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        enrollment_cap = EXCLUDED.enrollment_cap,
        status = EXCLUDED.status,
        location = EXCLUDED.location,
        class_timings = EXCLUDED.class_timings,
        syllabus_url = EXCLUDED.syllabus_url,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
END $$;

-- Display the offering ID for easy copy-paste into Postman
SELECT 
    id AS offering_id,
    code,
    name,
    term,
    year,
    instructor_id
FROM course_offerings 
WHERE code = 'CSE210' AND term = 'Winter' AND year = 2025;

