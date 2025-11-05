/**
 * Migration: Create users table
 * Supports scalable user management with proper indexing
 */
export const up = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

  CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
`;

export const down = `
  DROP TRIGGER IF EXISTS update_users_updated_at;
  DROP INDEX IF EXISTS idx_users_created_at;
  DROP INDEX IF EXISTS idx_users_status;
  DROP INDEX IF EXISTS idx_users_role;
  DROP INDEX IF EXISTS idx_users_email;
  DROP TABLE IF EXISTS users;
`;
