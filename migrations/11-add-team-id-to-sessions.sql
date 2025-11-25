-- ============================================================
-- 11-add-team-id-to-sessions.sql
-- Add team_id column to sessions table for team-specific meetings
-- NULL team_id = course-wide lecture (visible to all)
-- Non-NULL team_id = team meeting (visible only to team members)
-- ============================================================

-- Add team_id column (nullable)
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES team(id) ON DELETE CASCADE;

-- Add index for team_id queries
CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id);

-- Add comment
COMMENT ON COLUMN sessions.team_id IS 'NULL for course-wide lectures, set to team ID for team meetings';
