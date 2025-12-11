-- 32-seed-sample-team-data.sql
-- Add sample team data for testing team editing functionality

DO $$
DECLARE
    logo_path CONSTANT TEXT := '/assets/leadership.png';
    mantra_team1 CONSTANT TEXT := 'Innovation through collaboration';
    mantra_team2 CONSTANT TEXT := 'Code with purpose';
    mantra_team3 CONSTANT TEXT := 'Building the future together';
    mantra_team4 CONSTANT TEXT := 'Excellence in every line of code';
BEGIN
UPDATE team 
SET 
  logo_url = logo_path,
  mantra = mantra_team1,
  links = '{"slack": "https://cse210-team.slack.com/channels/team-1", "repo": "https://github.com/team1/project", "mattermost": ""}'::jsonb
WHERE team_number = 1;

UPDATE team 
SET 
  logo_url = logo_path, 
  mantra = mantra_team2,
  links = '{"slack": "https://cse210-team.slack.com/channels/team-2", "repo": "https://github.com/team2/project", "mattermost": ""}'::jsonb
WHERE team_number = 2;

UPDATE team 
SET 
  logo_url = logo_path,
  mantra = mantra_team3, 
  links = '{"slack": "https://cse210-team.slack.com/channels/team-3", "repo": "https://github.com/team3/project", "mattermost": ""}'::jsonb
WHERE team_number = 3;

UPDATE team 
SET 
  logo_url = logo_path,
  mantra = mantra_team4,
  links = '{"slack": "https://cse210-team.slack.com/channels/team-4", "repo": "https://github.com/team4/project", "mattermost": ""}'::jsonb  
WHERE team_number = 4;
END $$;
