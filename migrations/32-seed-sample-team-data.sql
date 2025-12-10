-- 32-seed-sample-team-data.sql
-- Add sample team data for testing team editing functionality

-- Update existing teams with sample data
UPDATE team 
SET 
  logo_url = '/assets/leadership.png',
  mantra = 'Innovation through collaboration',
  links = '{"slack": "https://cse210-team.slack.com/channels/team-1", "repo": "https://github.com/team1/project", "mattermost": ""}'::jsonb
WHERE team_number = 1;

UPDATE team 
SET 
  logo_url = '/assets/leadership.png', 
  mantra = 'Code with purpose',
  links = '{"slack": "https://cse210-team.slack.com/channels/team-2", "repo": "https://github.com/team2/project", "mattermost": ""}'::jsonb
WHERE team_number = 2;

UPDATE team 
SET 
  logo_url = '/assets/leadership.png',
  mantra = 'Building the future together', 
  links = '{"slack": "https://cse210-team.slack.com/channels/team-3", "repo": "https://github.com/team3/project", "mattermost": ""}'::jsonb
WHERE team_number = 3;

UPDATE team 
SET 
  logo_url = '/assets/leadership.png',
  mantra = 'Excellence in every line of code',
  links = '{"slack": "https://cse210-team.slack.com/channels/team-4", "repo": "https://github.com/team4/project", "mattermost": ""}'::jsonb  
WHERE team_number = 4;
