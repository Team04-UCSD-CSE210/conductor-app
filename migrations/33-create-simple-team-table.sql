-- Update existing teams with sample data (don't create new table)
-- Add sample mantras and logos to existing teams

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
  links = '{"slack": "https://cse210-team.slack.com/channels/team-1", "repo": "https://github.com/team1/project"}'::jsonb
WHERE team_number = 1 AND (logo_url IS NULL OR mantra IS NULL);

UPDATE team 
SET 
  logo_url = logo_path, 
  mantra = mantra_team2,
  links = '{"slack": "https://cse210-team.slack.com/channels/team-2", "repo": "https://github.com/team2/project"}'::jsonb
WHERE team_number = 2 AND (logo_url IS NULL OR mantra IS NULL);

UPDATE team 
SET 
  logo_url = logo_path,
  mantra = mantra_team3, 
  links = '{"slack": "https://cse210-team.slack.com/channels/team-3", "repo": "https://github.com/team3/project"}'::jsonb
WHERE team_number = 3 AND (logo_url IS NULL OR mantra IS NULL);

UPDATE team 
SET 
  logo_url = logo_path,
  mantra = mantra_team4,
  links = '{"slack": "https://cse210-team.slack.com/channels/team-4", "repo": "https://github.com/team4/project"}'::jsonb  
WHERE team_number = 4 AND (logo_url IS NULL OR mantra IS NULL);
END $$;
