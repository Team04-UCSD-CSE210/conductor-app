-- Migration: Remove 'grader' role from staff_role_enum and enrollment_role_enum
-- This migration removes the grader role from both enum types

-- Note: PostgreSQL doesn't support removing enum values directly
-- We need to recreate the enum types without 'grader'

-- Step 1: Remove grader from staff_role_enum
-- First, update any existing grader records to 'ta' (or handle as needed)
UPDATE course_staff 
SET staff_role = 'ta'::staff_role_enum 
WHERE staff_role = 'grader'::staff_role_enum;

-- Step 2: Recreate staff_role_enum without grader
-- Drop the old enum and create a new one
DO $$ 
BEGIN
    -- Create new enum without grader
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role_enum') THEN
        -- Alter the column to use text temporarily
        ALTER TABLE course_staff ALTER COLUMN staff_role TYPE TEXT;
        
        -- Drop the old enum
        DROP TYPE IF EXISTS staff_role_enum CASCADE;
        
        -- Create new enum without grader
        CREATE TYPE staff_role_enum AS ENUM ('ta', 'tutor');
        
        -- Alter column back to enum
        ALTER TABLE course_staff ALTER COLUMN staff_role TYPE staff_role_enum USING staff_role::staff_role_enum;
    END IF;
END $$;

-- Step 3: Remove grader from enrollment_role_permissions first
-- Delete any grader permission assignments before dropping the enum
DELETE FROM enrollment_role_permissions 
WHERE enrollment_role::text = 'grader';

-- Step 4: Remove grader from enrollment_role_enum
-- First, update any existing grader enrollments to 'student'
UPDATE enrollments 
SET role = 'student'::enrollment_role_enum 
WHERE role = 'grader'::enrollment_role_enum;

-- Recreate enrollment_role_enum without grader
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_role_enum') THEN
        -- Alter enrollment_role_permissions column to use text temporarily
        ALTER TABLE enrollment_role_permissions ALTER COLUMN enrollment_role TYPE TEXT;
        
        -- Alter the enrollments column to use text temporarily
        ALTER TABLE enrollments ALTER COLUMN role TYPE TEXT;
        
        -- Drop the old enum
        DROP TYPE IF EXISTS enrollment_role_enum CASCADE;
        
        -- Create new enum without grader
        CREATE TYPE enrollment_role_enum AS ENUM ('student', 'ta', 'tutor');
        
        -- Alter enrollment_role_permissions column back to enum
        ALTER TABLE enrollment_role_permissions ALTER COLUMN enrollment_role TYPE enrollment_role_enum USING enrollment_role::enrollment_role_enum;
        
        -- Alter enrollments column back to enum
        ALTER TABLE enrollments ALTER COLUMN role TYPE enrollment_role_enum USING role::enrollment_role_enum;
    END IF;
END $$;

