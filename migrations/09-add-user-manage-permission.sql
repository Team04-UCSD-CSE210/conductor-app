-- ============================================================
-- 09-add-user-manage-permission.sql
-- Add user.manage permission for existing databases
-- Run this if you already ran 05-seed-permissions-and-roles.sql
-- ============================================================

-- Add the user.manage permission
INSERT INTO permissions (scope, resource, action, code, description) VALUES
  ('global', 'user', 'manage', 'user.manage', 'Create, update, delete users (global)')
ON CONFLICT (code) DO NOTHING;

-- Grant user.manage to admin role (admin already gets all permissions, but this ensures it)
INSERT INTO user_role_permissions (user_role, permission_id)
SELECT 'admin'::user_role_enum, p.id
FROM permissions p
WHERE p.code = 'user.manage'
ON CONFLICT (user_role, permission_id) DO NOTHING;

