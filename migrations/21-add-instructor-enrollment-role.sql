-- 21-add-instructor-enrollment-role.sql
-- Add 'instructor' as a valid enrollment role
-- Part 1: Add the enum value only

-- Add 'instructor' to enrollment_role_enum if it doesn't exist
DO $$ 
BEGIN
    -- Check if 'instructor' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'instructor' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enrollment_role_enum')
    ) THEN
        -- Add the enum value
        -- Note: This must be in its own transaction to be visible to subsequent operations
        ALTER TYPE enrollment_role_enum ADD VALUE IF NOT EXISTS 'instructor';
    END IF;
END $$;


