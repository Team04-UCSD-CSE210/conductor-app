-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries by offering
CREATE INDEX IF NOT EXISTS idx_announcements_offering_id ON announcements(offering_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS announcements_updated_at ON announcements;
CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();
