-- 36-update-team-leaders-enrollment-role.sql
-- Update enrollments for team leaders to have course_role = 'team-lead'
-- Create trigger to automatically update enrollment when someone becomes/stops being a team leader

-- Update existing team leaders' enrollments
UPDATE enrollments e
SET course_role = 'team-lead'::enrollment_role_enum
FROM team_members tm
WHERE tm.user_id = e.user_id
  AND tm.team_id IN (
    SELECT t.id 
    FROM team t 
    WHERE t.offering_id = e.offering_id
  )
  AND tm.role = 'leader'::team_member_role_enum
  AND tm.left_at IS NULL
  AND e.status = 'enrolled'::enrollment_status_enum
  AND e.course_role != 'team-lead'::enrollment_role_enum
  -- Don't override TAs, tutors, or instructors
  AND e.course_role NOT IN ('ta'::enrollment_role_enum, 'tutor'::enrollment_role_enum, 'instructor'::enrollment_role_enum);

-- Create trigger function to automatically update enrollments when team membership changes
CREATE OR REPLACE FUNCTION update_team_leader_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_offering_id UUID;
BEGIN
    -- Get the offering_id for the team
    SELECT offering_id INTO v_offering_id
    FROM team
    WHERE id = COALESCE(NEW.team_id, OLD.team_id);
    
    -- Handle INSERT or UPDATE to 'leader' role
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.role = 'leader'::team_member_role_enum AND NEW.left_at IS NULL THEN
        -- Update enrollment to team-lead (if not already TA/tutor/instructor)
        UPDATE enrollments
        SET course_role = 'team-lead'::enrollment_role_enum
        WHERE user_id = NEW.user_id
          AND offering_id = v_offering_id
          AND status = 'enrolled'::enrollment_status_enum
          AND course_role NOT IN ('ta'::enrollment_role_enum, 'tutor'::enrollment_role_enum, 'instructor'::enrollment_role_enum);
    END IF;
    
    -- Handle UPDATE when role changes from 'leader' to something else OR when leader leaves
    IF (TG_OP = 'UPDATE') AND 
       (OLD.role = 'leader'::team_member_role_enum AND 
        (NEW.role != 'leader'::team_member_role_enum OR NEW.left_at IS NOT NULL)) THEN
        -- Check if user is a leader of any other team in the same offering
        IF NOT EXISTS (
            SELECT 1
            FROM team_members tm2
            INNER JOIN team t2 ON tm2.team_id = t2.id
            WHERE tm2.user_id = NEW.user_id
              AND t2.offering_id = v_offering_id
              AND tm2.role = 'leader'::team_member_role_enum
              AND tm2.left_at IS NULL
              AND tm2.team_id != NEW.team_id
        ) THEN
            -- Revert enrollment to student (if it's currently team-lead)
            UPDATE enrollments
            SET course_role = 'student'::enrollment_role_enum
            WHERE user_id = NEW.user_id
              AND offering_id = v_offering_id
              AND course_role = 'team-lead'::enrollment_role_enum;
        END IF;
    END IF;
    
    -- Handle DELETE
    IF (TG_OP = 'DELETE') AND OLD.role = 'leader'::team_member_role_enum THEN
        -- Check if user is a leader of any other team in the same offering
        IF NOT EXISTS (
            SELECT 1
            FROM team_members tm2
            INNER JOIN team t2 ON tm2.team_id = t2.id
            WHERE tm2.user_id = OLD.user_id
              AND t2.offering_id = v_offering_id
              AND tm2.role = 'leader'::team_member_role_enum
              AND tm2.left_at IS NULL
              AND tm2.team_id != OLD.team_id
        ) THEN
            -- Revert enrollment to student (if it's currently team-lead)
            UPDATE enrollments
            SET course_role = 'student'::enrollment_role_enum
            WHERE user_id = OLD.user_id
              AND offering_id = v_offering_id
              AND course_role = 'team-lead'::enrollment_role_enum;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on team_members table
DROP TRIGGER IF EXISTS trg_update_team_leader_enrollment ON team_members;
CREATE TRIGGER trg_update_team_leader_enrollment
AFTER INSERT OR UPDATE OR DELETE ON team_members
FOR EACH ROW
EXECUTE FUNCTION update_team_leader_enrollment();
