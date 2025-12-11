-- 37-make-team-leader-id-array-and-sync.sql
-- Changes team.leader_id to support multiple leaders (UUID array)
-- and creates a trigger to automatically sync team_members.role = 'leader' to team.leader_ids
-- 
-- This allows teams to have multiple leaders, and team.leader_ids will automatically
-- contain all user IDs from team_members where role = 'leader'

-- Step 1: Add a new column for leader_ids (array)
ALTER TABLE team ADD COLUMN IF NOT EXISTS leader_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Step 2: Migrate existing leader_id values to leader_ids array (if leader_id column exists)
DO $$
DECLARE
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
        UPDATE team 
        SET leader_ids = CASE 
            WHEN leader_id IS NOT NULL THEN ARRAY[leader_id]
            ELSE ARRAY[]::UUID[]
        END
        WHERE leader_ids IS NULL OR array_length(leader_ids, 1) IS NULL;
    ELSE
        -- Column doesn't exist, just ensure leader_ids is initialized
        UPDATE team 
        SET leader_ids = ARRAY[]::UUID[]
        WHERE leader_ids IS NULL;
    END IF;
END $$;

-- Step 3: Create function to sync leader_ids from team_members
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

-- Step 4: Create triggers to sync leader_ids whenever team_members changes
-- This trigger fires whenever a leader is added, removed, or their status changes
DROP TRIGGER IF EXISTS trg_sync_team_leader_ids_insert ON team_members;
DROP TRIGGER IF EXISTS trg_sync_team_leader_ids_update ON team_members;
DROP TRIGGER IF EXISTS trg_sync_team_leader_ids_delete ON team_members;

-- Trigger for INSERT: sync if new member is a leader
CREATE TRIGGER trg_sync_team_leader_ids_insert
    AFTER INSERT ON team_members
    FOR EACH ROW
    WHEN (NEW.role = 'leader'::team_member_role_enum AND NEW.left_at IS NULL)
    EXECUTE FUNCTION sync_team_leader_ids();

-- Trigger for UPDATE: sync if role changes to/from leader or left_at changes
CREATE TRIGGER trg_sync_team_leader_ids_update
    AFTER UPDATE OF role, left_at ON team_members
    FOR EACH ROW
    WHEN (
        (OLD.role != NEW.role AND (OLD.role = 'leader'::team_member_role_enum OR NEW.role = 'leader'::team_member_role_enum))
        OR (OLD.left_at IS DISTINCT FROM NEW.left_at AND (OLD.role = 'leader'::team_member_role_enum OR NEW.role = 'leader'::team_member_role_enum))
    )
    EXECUTE FUNCTION sync_team_leader_ids();

-- Trigger for DELETE: sync if deleted member was a leader
CREATE TRIGGER trg_sync_team_leader_ids_delete
    AFTER DELETE ON team_members
    FOR EACH ROW
    WHEN (OLD.role = 'leader'::team_member_role_enum)
    EXECUTE FUNCTION sync_team_leader_ids();

-- Step 5: Initial sync for all existing teams
DO $$
DECLARE
    team_rec RECORD;
    leader_ids_array UUID[];
BEGIN
    FOR team_rec IN SELECT id FROM team LOOP
        SELECT ARRAY_AGG(DISTINCT user_id ORDER BY user_id)
        INTO leader_ids_array
        FROM team_members
        WHERE team_id = team_rec.id 
          AND role = 'leader'::team_member_role_enum 
          AND left_at IS NULL;
        
        UPDATE team 
        SET leader_ids = COALESCE(leader_ids_array, ARRAY[]::UUID[])
        WHERE id = team_rec.id;
    END LOOP;
    
    RAISE NOTICE '✅ Successfully migrated team.leader_id to leader_ids array and created sync triggers';
END $$;

COMMENT ON COLUMN team.leader_ids IS 'Array of user IDs who are team leaders. Automatically synced from team_members.role = ''leader''';