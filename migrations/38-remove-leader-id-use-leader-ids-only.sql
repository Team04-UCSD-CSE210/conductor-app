-- 38-remove-leader-id-use-leader-ids-only.sql
-- Removes team.leader_id column and uses only team.leader_ids array
-- Simplifies multiple leader support by using only the array

-- Step 1: Update sync function to only update leader_ids (remove leader_id updates)
CREATE OR REPLACE FUNCTION sync_team_leader_ids()
RETURNS TRIGGER AS $$
DECLARE
    team_id_var UUID;
    leader_ids_array UUID[];
BEGIN
    -- Determine which team to update
    IF TG_OP = 'DELETE' THEN
        team_id_var := OLD.team_id;
    ELSE
        team_id_var := NEW.team_id;
    END IF;
    
    -- Get all current leaders for this team from team_members
    SELECT ARRAY_AGG(DISTINCT user_id ORDER BY user_id)
    INTO leader_ids_array
    FROM team_members
    WHERE team_id = team_id_var 
      AND role = 'leader'::team_member_role_enum 
      AND left_at IS NULL;
    
    -- Update team.leader_ids with the array (or empty array if no leaders)
    UPDATE team 
    SET leader_ids = COALESCE(leader_ids_array, ARRAY[]::UUID[])
    WHERE id = team_id_var;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 2: Ensure all teams have at least one leader in leader_ids (migrate from leader_id if needed)
-- Check if leader_id column exists before trying to migrate from it
DO $$
DECLARE
    team_rec RECORD;
    leader_ids_array UUID[];
    leader_id_exists BOOLEAN;
BEGIN
    -- Check if leader_id column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'team' 
          AND column_name = 'leader_id'
    ) INTO leader_id_exists;
    
    IF leader_id_exists THEN
        -- Migrate from leader_id if column exists
        FOR team_rec IN SELECT id, leader_id, leader_ids FROM team LOOP
            -- Get current leaders from team_members
            SELECT ARRAY_AGG(DISTINCT user_id ORDER BY user_id)
            INTO leader_ids_array
            FROM team_members
            WHERE team_id = team_rec.id 
              AND role = 'leader'::team_member_role_enum 
              AND left_at IS NULL;
            
            -- If no leaders in team_members but leader_id exists, add it to leader_ids
            IF (leader_ids_array IS NULL OR array_length(leader_ids_array, 1) IS NULL) AND team_rec.leader_id IS NOT NULL THEN
                leader_ids_array := ARRAY[team_rec.leader_id];
                
                -- Also ensure team_members record exists with role = 'leader'
                INSERT INTO team_members (team_id, user_id, role, joined_at)
                VALUES (team_rec.id, team_rec.leader_id, 'leader'::team_member_role_enum, CURRENT_DATE)
                ON CONFLICT (team_id, user_id) 
                DO UPDATE SET 
                    role = 'leader'::team_member_role_enum,
                    left_at = NULL;
            END IF;
            
            -- Update leader_ids
            UPDATE team 
            SET leader_ids = COALESCE(leader_ids_array, ARRAY[]::UUID[])
            WHERE id = team_rec.id;
        END LOOP;
        
        RAISE NOTICE '✅ Migrated all leader_id values to leader_ids array';
    ELSE
        -- Column doesn't exist, just ensure all teams have leader_ids synced from team_members
        FOR team_rec IN SELECT id, leader_ids FROM team LOOP
            -- Get current leaders from team_members
            SELECT ARRAY_AGG(DISTINCT user_id ORDER BY user_id)
            INTO leader_ids_array
            FROM team_members
            WHERE team_id = team_rec.id 
              AND role = 'leader'::team_member_role_enum 
              AND left_at IS NULL;
            
            -- Update leader_ids
            UPDATE team 
            SET leader_ids = COALESCE(leader_ids_array, ARRAY[]::UUID[])
            WHERE id = team_rec.id;
        END LOOP;
        
        RAISE NOTICE '✅ Synced all leader_ids from team_members (leader_id column already removed)';
    END IF;
END $$;

-- Step 3: Drop the leader_id column
ALTER TABLE team DROP COLUMN IF EXISTS leader_id;

-- Step 4: Drop the index on leader_id (if it exists)
DROP INDEX IF EXISTS idx_team_leader;

-- Step 5: Add comment
COMMENT ON COLUMN team.leader_ids IS 'Array of user IDs who are team leaders. Automatically synced from team_members.role = ''leader''. Teams must have at least one leader.';
