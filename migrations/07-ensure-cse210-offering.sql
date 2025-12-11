-- 07-ensure-cse210-offering.sql
-- Ensures CSE 210 offering exists and is active
-- This migration guarantees the CSE 210 offering exists for the application
-- Uses a fixed UUID to maintain consistency across database resets
-- Skips if already created by seed data (migration 03)

DO $$
DECLARE
    instructor_id UUID;
    offering_id_var UUID;
    fixed_offering_id UUID := 'a0000000-0000-4000-8000-000000000001'::UUID; -- Fixed UUID for CSE 210 Fall 2025
BEGIN
    -- Check if offering already exists
    SELECT id INTO offering_id_var
    FROM course_offerings
    WHERE id = fixed_offering_id;
    
    IF offering_id_var IS NOT NULL THEN
        RAISE NOTICE 'CSE 210 offering already exists. ID: %', offering_id_var;
        RETURN;
    END IF;
    
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
    
    -- Create the CSE 210 offering with fixed UUID
    INSERT INTO course_offerings (
        id,
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
        fixed_offering_id,
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
    );
    
    RAISE NOTICE 'CSE 210 offering created. ID: %', fixed_offering_id;
END $$;

COMMENT ON TABLE course_offerings IS 'Course offerings. CSE 210 should always exist and be active.';

