-- 30-add-team-logo-mantra-links.sql
-- Add logo, mantra, and links fields to team table

ALTER TABLE team
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS mantra TEXT,
ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN team.logo_url IS 'URL or path to team logo image';
COMMENT ON COLUMN team.mantra IS 'Team motto or slogan';
COMMENT ON COLUMN team.links IS 'JSON object containing team links (slack, mm, repo, etc.)';

