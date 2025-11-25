-- 07-ensure-cse210-offering.sql
-- Ensures CSE 210 offering exists and is active
-- This migration guarantees the CSE 210 offering exists for the application

DO $$
DECLARE
    instructor_id UUID;
    offering_id_var UUID;
BEGIN
    -- Get instructor ID (use first instructor if available)
    SELECT id INTO instructor_id 
    FROM users 
    WHERE primary_role = 'instructor' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- If no instructor exists, we can't create the offering
    IF instructor_id IS NULL THEN
        RAISE NOTICE 'No instructor found. Please create an instructor first.';
        RETURN;
    END IF;
    
    -- Create or update the CSE 210 offering
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
        TRUE,
        instructor_id
    )
    ON CONFLICT (code, term, year) 
    DO UPDATE SET
        name = EXCLUDED.name,
        is_active = TRUE,
        updated_at = NOW()
    RETURNING id INTO offering_id_var;
    
    -- If conflict resolution didn't return ID, fetch it
    IF offering_id_var IS NULL THEN
        SELECT id INTO offering_id_var 
        FROM course_offerings 
        WHERE code = 'CSE 210' 
          AND term = 'Fall' 
          AND year = 2025 
        LIMIT 1;
    END IF;
    
    IF offering_id_var IS NOT NULL THEN
        RAISE NOTICE 'CSE 210 offering ensured. ID: %', offering_id_var;
    ELSE
        RAISE WARNING 'Failed to create or find CSE 210 offering.';
    END IF;
END $$;

COMMENT ON TABLE course_offerings IS 'Course offerings. CSE 210 should always exist and be active.';

