-- 15-add-team-lead-enrollment-role.sql
-- Add 'team-lead' as a valid enrollment role
-- Add team_id column to enrollments table for easier team lookups

-- Add 'team-lead' to enrollment_role_enum
-- Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction block in PostgreSQL
-- Check if value exists first, then add if it doesn't
DO $$ 
BEGIN
    -- Check if 'team-lead' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'team-lead' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enrollment_role_enum')
    ) THEN
        ALTER TYPE enrollment_role_enum ADD VALUE 'team-lead';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs (e.g., value already exists), ignore it
        NULL;
END $$;

-- Add team_id column to enrollments table (nullable - empty if no team)
-- This allows direct team lookup from enrollment without joining team_members
DO $$
BEGIN
    -- Check if column already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'enrollments' 
        AND column_name = 'team_id'
    ) THEN
        ALTER TABLE enrollments 
        ADD COLUMN team_id UUID REFERENCES team(id) ON DELETE SET NULL;
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_enrollments_team_id ON enrollments(team_id);
        
        -- Populate existing enrollments with team_id from team_members
        -- This backfills the data for existing enrollments
        UPDATE enrollments e
        SET team_id = (
            SELECT tm.team_id
            FROM team_members tm
            INNER JOIN team t ON tm.team_id = t.id
            WHERE tm.user_id = e.user_id
                AND t.offering_id = e.offering_id
                AND tm.left_at IS NULL
            ORDER BY t.created_at DESC
            LIMIT 1
        )
        WHERE team_id IS NULL;
    END IF;
END $$;

