-- Fix work_journal_logs foreign key to ensure ON DELETE CASCADE works
-- This migration ensures the foreign key constraint has CASCADE delete behavior

DO $$
DECLARE
    constraint_name TEXT;
    constraint_record RECORD;
BEGIN
    -- Check if table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'work_journal_logs'
    ) THEN
        RAISE NOTICE '⚠️ work_journal_logs table does not exist yet, skipping constraint fix';
        RETURN;
    END IF;
    
    -- Find all foreign key constraints on work_journal_logs that reference users(id)
    FOR constraint_record IN
        SELECT 
            c.conname as constraint_name,
            c.confdeltype as delete_action
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class r ON c.confrelid = r.oid
        WHERE t.relname = 'work_journal_logs'
          AND r.relname = 'users'
          AND c.contype = 'f'
          AND c.conkey::smallint[] = ARRAY(
              SELECT attnum::smallint
              FROM pg_attribute 
              WHERE attrelid = t.oid 
                AND attname = 'user_id'
          )
    LOOP
        constraint_name := constraint_record.constraint_name;
        
        -- Check if CASCADE is already set (confdeltype = 'c' means CASCADE)
        IF constraint_record.delete_action = 'c' THEN
            RAISE NOTICE '✅ Foreign key constraint % already has ON DELETE CASCADE', constraint_name;
        ELSE
            -- Drop existing constraint and recreate with CASCADE
            EXECUTE format('ALTER TABLE work_journal_logs DROP CONSTRAINT %I', constraint_name);
            RAISE NOTICE '✅ Dropped existing foreign key constraint: %', constraint_name;
            
            -- Add the foreign key constraint with ON DELETE CASCADE
            ALTER TABLE work_journal_logs
            ADD CONSTRAINT work_journal_logs_user_id_fkey 
            FOREIGN KEY (user_id) 
            REFERENCES users(id) 
            ON DELETE CASCADE;
            
            RAISE NOTICE '✅ Created new foreign key constraint with ON DELETE CASCADE';
        END IF;
        
        EXIT; -- Only process the first matching constraint
    END LOOP;
    
    -- If no constraint was found, create one
    IF constraint_name IS NULL THEN
        ALTER TABLE work_journal_logs
        ADD CONSTRAINT work_journal_logs_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ Created foreign key constraint with ON DELETE CASCADE';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Error fixing journal cascade constraint: %', SQLERRM;
        -- Don't fail the migration if there's an issue
END $$;

