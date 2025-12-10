-- 35-make-hhundhausen-team-lead.sql
-- Make hhundhausen@ucsd.edu a team leader

DO $$
DECLARE
    offering_id_var UUID;
    user_id_var UUID;
    team_id_var UUID;
    instructor_id_var UUID;
BEGIN
    -- Get active offering
    SELECT id INTO offering_id_var FROM course_offerings WHERE is_active = TRUE LIMIT 1;
    
    -- Get user ID
    SELECT id INTO user_id_var FROM users WHERE email = 'hhundhausen@ucsd.edu';
    
    -- Get instructor for created_by
    SELECT id INTO instructor_id_var FROM users WHERE primary_role = 'instructor' LIMIT 1;
    
    IF offering_id_var IS NOT NULL AND user_id_var IS NOT NULL THEN
        -- Ensure user is enrolled as student
        INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
        VALUES (offering_id_var, user_id_var, 'student'::enrollment_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
        ON CONFLICT (offering_id, user_id) DO UPDATE SET 
            course_role = 'student'::enrollment_role_enum,
            status = 'enrolled'::enrollment_status_enum;
        
        -- Create Team 13 with hhundhausen as leader
        INSERT INTO team (offering_id, name, team_number, leader_id, status, formed_at, created_by)
        VALUES (offering_id_var, 'Team 13', 13, user_id_var, 'active'::team_status_enum, CURRENT_DATE, instructor_id_var)
        RETURNING id INTO team_id_var;
        
        -- Add as team member with leader role
        INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
        VALUES (team_id_var, user_id_var, 'leader'::team_member_role_enum, CURRENT_DATE, instructor_id_var)
        ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'leader'::team_member_role_enum;
        
        RAISE NOTICE '✅ Made hhundhausen@ucsd.edu leader of Team 13';
    ELSE
        RAISE NOTICE '⚠️ Could not find active offering or user hhundhausen@ucsd.edu';
    END IF;
END $$;
