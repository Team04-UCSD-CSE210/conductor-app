-- 19-add-class-directory-fields.sql

-- 1) Extend users table with profile fields used by class directory
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS pronouns       text,
  ADD COLUMN IF NOT EXISTS availability   text,
  ADD COLUMN IF NOT EXISTS social_links   text,
  ADD COLUMN IF NOT EXISTS last_activity  timestamp with time zone;

-- 2) Extend team table with metadata used by groups tab
ALTER TABLE team
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS repository_url  text,
  ADD COLUMN IF NOT EXISTS slack_channel   text;
