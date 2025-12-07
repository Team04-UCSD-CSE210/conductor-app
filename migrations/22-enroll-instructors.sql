-- 22-enroll-instructors.sql
-- Auto-enroll existing instructors in active course offerings
-- This runs after the instructor enum value has been committed in migration 21

-- Insert instructor enrollments
INSERT INTO enrollments (
    offering_id,
    user_id,
    course_role,
    status,
    enrolled_at
)
SELECT 
    co.id,
    u.id,
    'instructor'::enrollment_role_enum,
    'enrolled'::enrollment_status_enum,
    NOW()
FROM course_offerings co
CROSS JOIN users u
WHERE co.is_active = TRUE
  AND u.primary_role = 'instructor'::user_role_enum
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM enrollments e 
      WHERE e.offering_id = co.id 
      AND e.user_id = u.id
  )
ON CONFLICT (offering_id, user_id) DO NOTHING;
