-- Update existing teams with sample data (don't create new table)
-- Add sample mantras and logos to existing teams

UPDATE team 
SET 
  logo_url = '/assets/leadership.png',
  mantra = 'Innovation through collaboration',
  links = '{"slack": "https://cse210-team.slack.com/channels/team-1", "repo": "https://github.com/team1/project"}'::jsonb
WHERE team_number = 1 AND (logo_url IS NULL OR mantra IS NULL);

UPDATE team 
SET 
  logo_url = '/assets/leadership.png', 
  mantra = 'Code with purpose',
  links = '{"slack": "https://cse210-team.slack.com/channels/team-2", "repo": "https://github.com/team2/project"}'::jsonb
WHERE team_number = 2 AND (logo_url IS NULL OR mantra IS NULL);

UPDATE team 
SET 
  logo_url = '/assets/leadership.png',
  mantra = 'Building the future together', 
  links = '{"slack": "https://cse210-team.slack.com/channels/team-3", "repo": "https://github.com/team3/project"}'::jsonb
WHERE team_number = 3 AND (logo_url IS NULL OR mantra IS NULL);

UPDATE team 
SET 
  logo_url = '/assets/leadership.png',
  mantra = 'Excellence in every line of code',
  links = '{"slack": "https://cse210-team.slack.com/channels/team-4", "repo": "https://github.com/team4/project"}'::jsonb  
WHERE team_number = 4 AND (logo_url IS NULL OR mantra IS NULL);
