-- Add team_id to announcements table to support team-specific announcements
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'announcements' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE announcements 
    ADD COLUMN team_id UUID REFERENCES team(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for team announcements
CREATE INDEX IF NOT EXISTS idx_announcements_team_id ON announcements(team_id);

COMMENT ON COLUMN announcements.team_id IS 'Optional team ID for team-specific announcements. NULL means course-wide announcement.';
