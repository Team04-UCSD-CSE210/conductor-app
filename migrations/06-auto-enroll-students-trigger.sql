-- 06-auto-enroll-students-trigger.sql
-- Auto-enroll students in active course offering when they're created
-- Auto-whitelist extension students
-- Run AFTER course offerings and permissions are set up

-- ============================================
-- FUNCTION: Auto-enroll students in active course offering
-- ============================================
CREATE OR REPLACE FUNCTION auto_enroll_student()
RETURNS TRIGGER AS $$
DECLARE
    active_offering_id UUID;
BEGIN
    -- Only auto-enroll if user is a student
    IF NEW.primary_role = 'student'::user_role_enum AND NEW.deleted_at IS NULL THEN
        -- Get the active course offering
        SELECT id INTO active_offering_id
        FROM course_offerings
        WHERE is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- If there's an active offering, enroll the student
        IF active_offering_id IS NOT NULL THEN
            INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
            VALUES (
                active_offering_id,
                NEW.id,
                'student'::course_role_enum,
                'enrolled'::enrollment_status_enum,
                CURRENT_DATE
            )
            ON CONFLICT (offering_id, user_id) DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-enroll on user creation/update
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_enroll_student ON users;
CREATE TRIGGER trigger_auto_enroll_student
    AFTER INSERT OR UPDATE OF primary_role ON users
    FOR EACH ROW
    WHEN (NEW.primary_role = 'student'::user_role_enum AND NEW.deleted_at IS NULL)
    EXECUTE FUNCTION auto_enroll_student();

-- ============================================
-- FUNCTION: Auto-whitelist extension students
-- ============================================
CREATE OR REPLACE FUNCTION auto_whitelist_extension_student()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-whitelist extension students (non-UCSD emails)
    IF NEW.institution_type = 'extension'::institution_type_enum 
       AND NEW.primary_role = 'student'::user_role_enum 
       AND NEW.deleted_at IS NULL THEN
        INSERT INTO whitelist (email, approved_by, approved_at)
        VALUES (NEW.email, 'system', NOW())
        ON CONFLICT (email) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-whitelist extension students
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_whitelist_extension ON users;
CREATE TRIGGER trigger_auto_whitelist_extension
    AFTER INSERT OR UPDATE OF institution_type, primary_role ON users
    FOR EACH ROW
    WHEN (NEW.institution_type = 'extension'::institution_type_enum 
          AND NEW.primary_role = 'student'::user_role_enum 
          AND NEW.deleted_at IS NULL)
    EXECUTE FUNCTION auto_whitelist_extension_student();

-- ============================================
-- Backfill: Whitelist existing extension students
-- ============================================
INSERT INTO whitelist (email, approved_by, approved_at)
SELECT 
    email,
    'system' as approved_by,
    NOW() as approved_at
FROM users
WHERE institution_type = 'extension'::institution_type_enum
    AND primary_role = 'student'::user_role_enum
    AND deleted_at IS NULL
ON CONFLICT (email) DO NOTHING;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Created auto-enroll and auto-whitelist triggers for students';
END $$;

