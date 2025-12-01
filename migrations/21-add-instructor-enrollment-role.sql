-- 21-add-instructor-enrollment-role.sql
-- Add 'instructor' as a valid enrollment role
-- This allows instructors to be enrolled in course offerings like other roles

-- Add 'instructor' to enrollment_role_enum
-- Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction block in PostgreSQL
-- Check if value exists first, then add if it doesn't
DO $$ 
BEGIN
    -- Check if 'instructor' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'instructor' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enrollment_role_enum')
    ) THEN
        ALTER TYPE enrollment_role_enum ADD VALUE 'instructor';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs (e.g., value already exists), ignore it
        NULL;
END $$;

-- Auto-enroll existing instructors in active course offerings
-- This ensures all instructors with primary_role='instructor' are enrolled
DO $$
DECLARE
    offering_rec RECORD;
    instructor_rec RECORD;
BEGIN
    -- For each active course offering
    FOR offering_rec IN 
        SELECT id 
        FROM course_offerings 
        WHERE is_active = TRUE
    LOOP
        -- For each instructor user
        FOR instructor_rec IN
            SELECT id 
            FROM users 
            WHERE primary_role = 'instructor'::user_role_enum
            AND deleted_at IS NULL
        LOOP
            -- Check if enrollment already exists
            IF NOT EXISTS (
                SELECT 1 
                FROM enrollments 
                WHERE offering_id = offering_rec.id 
                AND user_id = instructor_rec.id
            ) THEN
                -- Insert enrollment for instructor
                INSERT INTO enrollments (
                    offering_id,
                    user_id,
                    course_role,
                    status,
                    enrolled_at
                )
                VALUES (
                    offering_rec.id,
                    instructor_rec.id,
                    'instructor'::enrollment_role_enum,
                    'enrolled'::enrollment_status_enum,
                    NOW()
                )
                ON CONFLICT (offering_id, user_id) DO NOTHING;
            ELSE
                -- Update existing enrollment to instructor role if needed
                UPDATE enrollments
                SET course_role = 'instructor'::enrollment_role_enum,
                    status = 'enrolled'::enrollment_status_enum
                WHERE offering_id = offering_rec.id
                AND user_id = instructor_rec.id
                AND course_role != 'instructor'::enrollment_role_enum;
            END IF;
        END LOOP;
    END LOOP;
END $$;

