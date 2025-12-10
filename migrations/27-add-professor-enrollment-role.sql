-- 27-add-professor-enrollment-role.sql

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'professor' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enrollment_role_enum')
    ) THEN
        ALTER TYPE enrollment_role_enum ADD VALUE 'professor';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;