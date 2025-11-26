-- 14-seed-team-meetings.sql
-- Create sample team meeting sessions for existing teams
-- This is separate from lecture sessions which have team_id = NULL
-- Team meetings are visible only to team members

DO $$
DECLARE
    offering_id_var UUID;
    team_cursor CURSOR FOR 
        SELECT id, team_number, leader_id 
        FROM team 
        WHERE offering_id = offering_id_var
        ORDER BY team_number;
    team_record RECORD;
    meeting_dates DATE[] := ARRAY[
        '2025-11-06'::DATE,  -- Week 1 meeting
        '2025-11-13'::DATE,  -- Week 2 meeting
        '2025-11-20'::DATE,  -- Week 3 meeting
        '2025-11-26'::DATE   -- Week 4 meeting (changed to today for testing)
    ];
    meeting_idx INTEGER;
    session_count INTEGER := 0;
BEGIN
    -- Get CSE 210 offering
    SELECT id INTO offering_id_var 
    FROM course_offerings 
    WHERE code = 'CSE 210' 
      AND term = 'Fall' 
      AND year = 2025 
    LIMIT 1;
    
    IF offering_id_var IS NULL THEN
        RAISE NOTICE 'CSE 210 offering not found. Skipping team meeting seed.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creating team meeting sessions for CSE 210...';
    
    -- Loop through each team and create meetings
    OPEN team_cursor;
    LOOP
        FETCH team_cursor INTO team_record;
        EXIT WHEN NOT FOUND;
        
        -- Create 4 weekly team meetings for each team
        FOR meeting_idx IN 1..4 LOOP
            DECLARE
                access_code_var TEXT;
                code_unique BOOLEAN := FALSE;
                attempts INTEGER := 0;
            BEGIN
                -- Generate unique access code
                WHILE NOT code_unique AND attempts < 10 LOOP
                    access_code_var := 'TM' || team_record.team_number::TEXT || 'W' || meeting_idx::TEXT || 
                                     chr(65 + (RANDOM() * 26)::INTEGER);
                    
                    SELECT NOT EXISTS(
                        SELECT 1 FROM sessions WHERE access_code = access_code_var
                    ) INTO code_unique;
                    
                    attempts := attempts + 1;
                END LOOP;
                
                -- Insert team meeting session
                -- Set attendance_opened_at and attendance_closed_at based on meeting date
                -- Past meetings (before today): both opened and closed
                -- Future meetings: neither opened nor closed (pending)
                INSERT INTO sessions (
                    offering_id,
                    team_id,
                    title,
                    description,
                    session_date,
                    session_time,
                    access_code,
                    code_expires_at,
                    is_active,
                    attendance_opened_at,
                    attendance_closed_at,
                    created_by,
                    updated_by
                ) VALUES (
                    offering_id_var,
                    team_record.id,
                    'Team ' || team_record.team_number::TEXT || ' - Week ' || meeting_idx::TEXT || ' Meeting',
                    'Weekly team meeting for Team ' || team_record.team_number::TEXT,
                    meeting_dates[meeting_idx],
                    '15:00:00'::TIME, -- 3:00 PM
                    access_code_var,
                    (meeting_dates[meeting_idx] || ' 17:00:00')::TIMESTAMPTZ, -- 5:00 PM same day
                    TRUE, -- Active (visible to students)
                    CASE 
                        WHEN meeting_dates[meeting_idx] < CURRENT_DATE THEN 
                            (meeting_dates[meeting_idx] || ' 15:00:00')::TIMESTAMPTZ
                        WHEN meeting_dates[meeting_idx] = CURRENT_DATE THEN
                            -- Open attendance for today's meetings
                            (meeting_dates[meeting_idx] || ' 15:00:00')::TIMESTAMPTZ
                        ELSE NULL 
                    END, -- Open if in the past or today
                    CASE 
                        WHEN meeting_dates[meeting_idx] < CURRENT_DATE THEN 
                            (meeting_dates[meeting_idx] || ' 17:00:00')::TIMESTAMPTZ
                        ELSE NULL 
                    END, -- Close only if in the past
                    team_record.leader_id,
                    team_record.leader_id
                )
                ON CONFLICT DO NOTHING;
                
                session_count := session_count + 1;
            END;
        END LOOP;
        
        RAISE NOTICE '  Created 4 meetings for Team %', team_record.team_number;
    END LOOP;
    CLOSE team_cursor;
    
    RAISE NOTICE '✅ Created % team meeting sessions', session_count;
END $$;

COMMENT ON TABLE sessions IS 'Sessions include both lectures (team_id = NULL) and team meetings (team_id = team UUID)';
