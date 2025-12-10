-- 31-seed-team-logo-mantra-links.sql

DO $$
DECLARE
    team1_id UUID;
    team2_id UUID;
    team3_id UUID;
    team4_id UUID;
    team5_id UUID;
    team6_id UUID;
    team7_id UUID;
BEGIN
    -- Get team IDs by name
    SELECT id INTO team1_id FROM team WHERE name = 'Team 1' LIMIT 1;
    SELECT id INTO team2_id FROM team WHERE name = 'Team 2' LIMIT 1;
    SELECT id INTO team3_id FROM team WHERE name = 'Team 3' LIMIT 1;
    SELECT id INTO team4_id FROM team WHERE name = 'Team 4' LIMIT 1;
    SELECT id INTO team5_id FROM team WHERE name = 'Team 5' LIMIT 1;
    SELECT id INTO team6_id FROM team WHERE name = 'Team 6' LIMIT 1;
    SELECT id INTO team7_id FROM team WHERE name = 'Team 7' LIMIT 1;

    -- Team 1
    IF team1_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = 'Build together, ship often.',
            links = jsonb_build_object(
                'slack', '#team-1',
                'repo', 'https://github.com/cse210/team-1'
            )
        WHERE id = team1_id;
    END IF;

    -- Team 2
    IF team2_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = 'Code with purpose, deliver with pride.',
            links = jsonb_build_object(
                'slack', '#team-2',
                'repo', 'https://github.com/cse210/team-2'
            )
        WHERE id = team2_id;
    END IF;

    -- Team 3
    IF team3_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = 'Innovation through collaboration.',
            links = jsonb_build_object(
                'slack', '#team-3',
                'repo', 'https://github.com/cse210/team-3'
            )
        WHERE id = team3_id;
    END IF;

    -- Team 4
    IF team4_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = 'Quality code, quality results.',
            links = jsonb_build_object(
                'slack', '#team-4',
                'repo', 'https://github.com/cse210/team-4'
            )
        WHERE id = team4_id;
    END IF;

    -- Team 5
    IF team5_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = 'Excellence in every commit.',
            links = jsonb_build_object(
                'slack', '#team-5',
                'repo', 'https://github.com/cse210/team-5'
            )
        WHERE id = team5_id;
    END IF;

    -- Team 6
    IF team6_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = 'Stronger together.',
            links = jsonb_build_object(
                'slack', '#team-6',
                'repo', 'https://github.com/cse210/team-6'
            )
        WHERE id = team6_id;
    END IF;

    -- Team 7
    IF team7_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = 'Pushing boundaries, building futures.',
            links = jsonb_build_object(
                'slack', '#team-7',
                'repo', 'https://github.com/cse210/team-7'
            )
        WHERE id = team7_id;
    END IF;

    -- Update all teams with generic data if they don't have it
    UPDATE team
    SET 
        mantra = COALESCE(mantra, 'Building great software together.'),
        links = COALESCE(links, jsonb_build_object(
            'slack', '#team-' || team_number,
            'repo', 'https://github.com/cse210/team-' || team_number
        ))
    WHERE mantra IS NULL OR links IS NULL OR links = '{}'::jsonb;

    RAISE NOTICE '✅ Updated team logos, mantras, and links';
END $$;

