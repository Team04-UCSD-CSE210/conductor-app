-- 27-add-user-avatar.sql

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN users.avatar_url IS 'Profile photo URL for class directory and other views.';
