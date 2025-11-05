INSERT INTO users (name, email, role, status) VALUES
  ('Prof X', 'prof@ucsd.edu', 'admin', 'active'),
  ('Alice Chen', 'alice@ucsd.edu', 'user', 'active'),
  ('Bob Lee', 'bob@ucsd.edu', 'user', 'active'),
  ('Cindy Park', 'cindy@ucsd.edu', 'moderator', 'disabled')
ON CONFLICT (email) DO UPDATE
  SET name = EXCLUDED.name,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      updated_at = now();