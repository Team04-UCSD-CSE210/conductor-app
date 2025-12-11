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
    team_name_prefix CONSTANT TEXT := 'Team ';
    github_base CONSTANT TEXT := 'https://github.com/cse210/team-';
    slack_prefix CONSTANT TEXT := '#team-';
    mantra_team1 CONSTANT TEXT := 'Build together, ship often.';
    mantra_team2 CONSTANT TEXT := 'Code with purpose, deliver with pride.';
    mantra_team3 CONSTANT TEXT := 'Innovation through collaboration.';
    mantra_team4 CONSTANT TEXT := 'Quality code, quality results.';
    mantra_team5 CONSTANT TEXT := 'Excellence in every commit.';
    mantra_team6 CONSTANT TEXT := 'Stronger together.';
    mantra_team7 CONSTANT TEXT := 'Pushing boundaries, building futures.';
    mantra_default CONSTANT TEXT := 'Building great software together.';
BEGIN
    SELECT id INTO team1_id FROM team WHERE name = team_name_prefix || '1' LIMIT 1;
    SELECT id INTO team2_id FROM team WHERE name = team_name_prefix || '2' LIMIT 1;
    SELECT id INTO team3_id FROM team WHERE name = team_name_prefix || '3' LIMIT 1;
    SELECT id INTO team4_id FROM team WHERE name = team_name_prefix || '4' LIMIT 1;
    SELECT id INTO team5_id FROM team WHERE name = team_name_prefix || '5' LIMIT 1;
    SELECT id INTO team6_id FROM team WHERE name = team_name_prefix || '6' LIMIT 1;
    SELECT id INTO team7_id FROM team WHERE name = team_name_prefix || '7' LIMIT 1;

    -- Team 1
    IF team1_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = mantra_team1,
            links = jsonb_build_object(
                'slack', slack_prefix || '1',
                'repo', github_base || '1'
            )
        WHERE id = team1_id;
    END IF;

    -- Team 2
    IF team2_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = mantra_team2,
            links = jsonb_build_object(
                'slack', slack_prefix || '2',
                'repo', github_base || '2'
            )
        WHERE id = team2_id;
    END IF;

    -- Team 3
    IF team3_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = mantra_team3,
            links = jsonb_build_object(
                'slack', slack_prefix || '3',
                'repo', github_base || '3'
            )
        WHERE id = team3_id;
    END IF;

    -- Team 4
    IF team4_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = mantra_team4,
            links = jsonb_build_object(
                'slack', slack_prefix || '4',
                'repo', github_base || '4'
            )
        WHERE id = team4_id;
    END IF;

    -- Team 5
    IF team5_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = mantra_team5,
            links = jsonb_build_object(
                'slack', slack_prefix || '5',
                'repo', github_base || '5'
            )
        WHERE id = team5_id;
    END IF;

    -- Team 6
    IF team6_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = mantra_team6,
            links = jsonb_build_object(
                'slack', slack_prefix || '6',
                'repo', github_base || '6'
            )
        WHERE id = team6_id;
    END IF;

    -- Team 7
    IF team7_id IS NOT NULL THEN
        UPDATE team
        SET 
            mantra = mantra_team7,
            links = jsonb_build_object(
                'slack', slack_prefix || '7',
                'repo', github_base || '7'
            )
        WHERE id = team7_id;
    END IF;

    -- Update all teams with generic data if they don't have it
    UPDATE team
    SET 
        mantra = COALESCE(mantra, mantra_default),
        links = COALESCE(links, jsonb_build_object(
            'slack', slack_prefix || team_number,
            'repo', github_base || team_number
        ))
    WHERE mantra IS NULL OR links IS NULL OR links = '{}'::jsonb;

    RAISE NOTICE '✅ Updated team logos, mantras, and links';
END $$;

