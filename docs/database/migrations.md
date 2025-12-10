# Database Migrations Guide

Learn how to create, run, and manage database migrations in Conductor.

## Overview

Conductor uses **numbered SQL migration files** that run in sequence to build and update the database schema. The migration system is simple, predictable, and version-controlled.

## Migration System

### File Naming Convention

```
migrations/
├── 01-create-tables.sql          # Core schema
├── 02-seed-demo-users.sql        # Demo data
├── 03-seed-course-offerings-teams.sql
├── 04-create-permission-tables.sql
├── 05-seed-permissions-and-roles.sql
├── ...
└── 33-create-simple-team-table.sql
```

**Pattern**: `{number}-{description}.sql`

- **Number**: Zero-padded 2-digit sequence (01, 02, 03, ...)
- **Description**: Kebab-case description
- **Extension**: `.sql`

### Migration Discovery

The system automatically discovers and sorts migration files by number:

```javascript
// src/database/init.js
static discoverMigrations() {
  const files = fs.readdirSync('migrations');
  return files
    .filter(file => /^\d{2,}-.+\.sql$/.test(file))
    .sort((a, b) => a.number - b.number);
}
```

## Running Migrations

### Initialize Database

```bash
# Run all migrations (schema only)
npm run db:init

# Run all migrations including seed data
npm run db:seed

# Force re-run all migrations (even if schema exists)
npm run db:force

# Drop everything and start fresh
npm run db:reset
```

### What Each Command Does

| Command | Action |
|---------|--------|
| `db:init` | Runs schema migrations (skips "seed" files) |
| `db:seed` | Runs ALL migrations including seed data |
| `db:force` | Drops and recreates schema, then runs all migrations |
| `db:reset` | Complete reset (drop tables + re-run migrations) |

### Programmatic Usage

```javascript
import { DatabaseInitializer } from './src/database/init.js';

// Initialize with demo data
await DatabaseInitializer.initialize({ seed: true });

// Run only schema migrations
await DatabaseInitializer.runMigrations(false);

// Verify schema
const isValid = await DatabaseInitializer.verifySchema();
```

## Creating New Migrations

### Step 1: Determine Next Number

```bash
# List existing migrations
ls migrations/*.sql | tail -n 1
# Output: 33-create-simple-team-table.sql

# Next number: 34
```

### Step 2: Create Migration File

```bash
# Create new migration file
touch migrations/34-add-user-preferences.sql
```

### Step 3: Write Migration SQL

```sql
-- migrations/34-add-user-preferences.sql

-- Add new column
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Create index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);

-- Comment for documentation
COMMENT ON COLUMN users.preferences IS 'User preference settings (theme, notifications, etc.)';
```

### Step 4: Test Migration

```bash
# Test on clean database
npm run db:reset

# Verify it runs without errors
npm run db:seed
```

### Step 5: Commit

```bash
git add migrations/34-add-user-preferences.sql
git commit -m "feat(db): add user preferences column"
```

## Migration Best Practices

### 1. Idempotent Migrations

Always use `IF NOT EXISTS` / `IF EXISTS` for safe re-runs:

```sql
-- [OK] Good - Idempotent
CREATE TABLE IF NOT EXISTS my_table (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS my_column TEXT;
DROP TABLE IF EXISTS old_table CASCADE;

-- [X] Bad - Will fail on re-run
CREATE TABLE my_table (...);
ALTER TABLE users ADD COLUMN my_column TEXT;
```

### 2. Forward-Only Migrations

- **No rollback files** - migrations only move forward
- To "undo" a migration, create a new one that reverts changes
- Keep migrations focused and atomic

```sql
-- migrations/35-revert-user-preferences.sql
ALTER TABLE users DROP COLUMN IF EXISTS preferences CASCADE;
DROP INDEX IF EXISTS idx_users_preferences;
```

### 3. Safe ALTER TABLE Operations

```sql
-- Add column (safe - won't lock table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_field TEXT;

-- Add index concurrently (safe for production)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table(column);

-- Add constraint with validation (safe)
ALTER TABLE users ADD CONSTRAINT check_email 
  CHECK (email ~ '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$')
  NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT check_email;
```

### 4. Handle ENUMs Carefully

```sql
-- Adding ENUM value (PostgreSQL 12+)
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'moderator';

-- For older PostgreSQL, recreate the type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'new_role_enum') THEN
    CREATE TYPE new_role_enum AS ENUM ('admin', 'instructor', 'student', 'moderator');
    ALTER TABLE users ALTER COLUMN primary_role TYPE new_role_enum 
      USING primary_role::text::new_role_enum;
    DROP TYPE user_role_enum;
    ALTER TYPE new_role_enum RENAME TO user_role_enum;
  END IF;
END $$;
```

### 5. Data Migrations

For data transformations, keep them in separate migration files:

```sql
-- migrations/36-migrate-user-data.sql

-- Update existing data
UPDATE users 
SET preferences = '{"theme": "light", "notifications": true}'::jsonb
WHERE preferences IS NULL OR preferences = '{}'::jsonb;

-- Log migration
INSERT INTO activity_logs (user_id, action_type, metadata)
SELECT id, 'data_migration', '{"migration": "36-migrate-user-data"}'::jsonb
FROM users
WHERE updated_at < NOW() - INTERVAL '1 day';
```

## Migration File Types

### Schema Migrations

Create or alter database structure:

```sql
-- 01-create-tables.sql
CREATE TABLE IF NOT EXISTS users (...);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Seed Migrations

Insert demo or reference data (include "seed" in filename):

```sql
-- 02-seed-demo-users.sql
INSERT INTO users (email, name, primary_role, status) VALUES
  ('admin@ucsd.edu', 'Admin User', 'admin', 'active'),
  ('student@ucsd.edu', 'Student User', 'student', 'active')
ON CONFLICT (email) DO NOTHING;
```

### Permission Migrations

Set up RBAC permissions:

```sql
-- 05-seed-permissions-and-roles.sql
INSERT INTO permissions (scope, resource, action, code) VALUES
  ('global', 'user', 'manage', 'user.manage'),
  ('course', 'roster', 'view', 'roster.view')
ON CONFLICT (code) DO NOTHING;
```

## Troubleshooting

### Migration Failed

```bash
# Check error message
npm run db:init 2>&1 | tee migration-error.log

# Common issues:
# 1. Syntax error in SQL
# 2. Missing IF NOT EXISTS
# 3. Foreign key constraint violation
# 4. Type mismatch
```

### Reset and Retry

```bash
# Nuclear option - start over
npm run db:reset
```

### Verify Schema

```javascript
// Check if schema is valid
const { DatabaseInitializer } = require('./src/database/init.js');
const isValid = await DatabaseInitializer.verifySchema();
console.log('Schema valid:', isValid);
```

### Check Migration Order

```bash
# List all migrations in order
ls -1 migrations/*.sql | sort -V
```

## Advanced Usage

### Conditional Migrations

```sql
-- Run only in development
DO $$
BEGIN
  IF current_setting('server_environment', true) = 'development' THEN
    -- Development-only changes
    INSERT INTO users VALUES (...);
  END IF;
END $$;
```

### Transaction Control

```sql
-- Most migrations run in a transaction automatically
BEGIN;

CREATE TABLE temp_table (...);
INSERT INTO temp_table SELECT * FROM old_table;
DROP TABLE old_table;
ALTER TABLE temp_table RENAME TO old_table;

COMMIT;
```

### Performance Considerations

```sql
-- Use CONCURRENTLY for indexes (doesn't lock table)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Batch large updates
DO $$
DECLARE
  batch_size INT := 1000;
BEGIN
  LOOP
    UPDATE users SET updated_at = NOW()
    WHERE id IN (
      SELECT id FROM users WHERE updated_at IS NULL LIMIT batch_size
    );
    EXIT WHEN NOT FOUND;
    COMMIT;
  END LOOP;
END $$;
```

## Migration Checklist

Before creating a migration:

- [ ] Determine correct sequence number
- [ ] Use descriptive filename
- [ ] Make migration idempotent (IF NOT EXISTS)
- [ ] Test on clean database (`npm run db:reset`)
- [ ] Test on existing database (`npm run db:init`)
- [ ] Add comments for complex operations
- [ ] Check for syntax errors
- [ ] Consider performance impact
- [ ] Document breaking changes

After creating a migration:

- [ ] Run linter on SQL file
- [ ] Commit with conventional commit message
- [ ] Update schema documentation if needed
- [ ] Notify team of schema changes

---

**See Also:**
- [Database Schema](schema.md) - Complete schema reference
- [Database Overview](overview.md) - Architecture and design
- [ER Diagram](er-diagram.md) - Visual database structure
