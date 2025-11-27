-- Fix work_journal_logs foreign key to ensure ON DELETE CASCADE works
-- This migration ensures the foreign key constraint has CASCADE delete behavior

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Check if table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'work_journal_logs'
    ) THEN
        RAISE NOTICE '⚠️ work_journal_logs table does not exist yet, skipping constraint fix';
        RETURN;
    END IF;
    
    -- Find the foreign key constraint on user_id column
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'work_journal_logs'::regclass
      AND contype = 'f'
      AND conkey::int[] = ARRAY(
          SELECT attnum 
          FROM pg_attribute 
          WHERE attrelid = 'work_journal_logs'::regclass 
            AND attname = 'user_id'
      );
    
    -- Drop existing foreign key constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE work_journal_logs DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE '✅ Dropped existing foreign key constraint: %', constraint_name;
    END IF;
    
    -- Add the foreign key constraint with ON DELETE CASCADE
    ALTER TABLE work_journal_logs
    ADD CONSTRAINT work_journal_logs_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Fixed work_journal_logs foreign key constraint with ON DELETE CASCADE';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Error fixing journal cascade constraint: %', SQLERRM;
        -- Don't fail the migration if there's an issue
END $$;

