-- 20-add-color-palette.sql
-- Add color_palette column to course_offerings table to store global color palette preference

ALTER TABLE course_offerings
ADD COLUMN IF NOT EXISTS color_palette TEXT DEFAULT 'default' CHECK (color_palette IN ('default', 'blue', 'purple', 'green', 'orange', 'red'));

COMMENT ON COLUMN course_offerings.color_palette IS 'Global color palette for the course website. Applies to all users.';

