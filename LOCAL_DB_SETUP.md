# 🐘 Local Database Setup Guide

Complete guide for setting up and managing the PostgreSQL database for the Conductor application.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Setup Methods](#setup-methods)
- [Docker (Recommended)](#docker-recommended)
- [Local PostgreSQL](#local-postgresql)
- [Database Initialization](#database-initialization)
- [Migration Management](#migration-management)
- [Verification & Testing](#verification--testing)
- [Troubleshooting](#troubleshooting)
- [Backup & Restore](#backup--restore)
- [Performance Tuning](#performance-tuning)
- [Security Best Practices](#security-best-practices)

---

## Prerequisites

Before setting up the database, ensure you have:

- **Node.js** 18+ (ESM modules support)
- **Docker Desktop** (for Docker setup) OR **PostgreSQL 15+** (for local setup)
- **npm** or **yarn** package manager
- **Git** (for cloning the repository)

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check Docker (if using Docker)
docker --version
docker compose version

# Check PostgreSQL (if using local)
psql --version  # Should be >= 15.0
```

---

## Quick Start

For the fastest setup, use Docker:

```bash
# 1. Clone repository and install dependencies
git clone <repository-url>
cd conductor-app
npm install

# 2. Copy environment file
cp env.example .env

# 3. Start database container
docker compose up -d db

# 4. Initialize database schema and seed data
npm run db:init
npm run db:seed

# 5. Verify setup
npm run local:test
```

✅ **Done!** Your database is ready.

---

## Setup Methods

### Docker (Recommended)

Docker provides an isolated, consistent database environment that matches production.

#### Step 1: Configure Environment

Create `.env` file from template:

```bash
cp env.example .env
```

Edit `.env` to use Docker database URL:

```env
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor
PORT=3000
```

**Note:** When running inside Docker network, use `db:5432` instead of `localhost:5432`.

#### Step 2: Start Database Container

```bash
# Start PostgreSQL container in detached mode
docker compose up -d db

# Verify container is running
docker compose ps

# Check logs
docker compose logs db
```

Expected output:

```text
NAME            IMAGE         STATUS         PORTS
conductor-db    postgres:15   Up 2 minutes   0.0.0.0:5432->5432/tcp
```

#### Step 3: Verify Connection

```bash
# Test connection from host
docker compose exec db psql -U app -d conductor -c "SELECT version();"

# Or connect interactively
docker compose exec db psql -U app -d conductor
```

#### Step 4: Initialize Schema

The database will be automatically initialized via migration scripts. However, you can manually trigger initialization:

```bash
# Initialize schema only
npm run db:init

# Initialize with demo seed data
npm run db:seed

# Force re-initialization (drops existing schema)
npm run db:reset
```

#### Docker Commands Reference

```bash
# Start database
docker compose up -d db

# Stop database (keeps data)
docker compose stop db

# Stop and remove containers (keeps volumes)
docker compose down

# Stop and remove everything including volumes (⚠️ deletes data)
docker compose down -v

# View logs
docker compose logs -f db

# Execute SQL commands
docker compose exec db psql -U app -d conductor -c "SELECT COUNT(*) FROM users;"

# Access PostgreSQL shell
docker compose exec db psql -U app -d conductor
```

---

### Local PostgreSQL

For development without Docker, install PostgreSQL locally.

#### Step 1: Install PostgreSQL

**macOS (Homebrew):**

```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**

Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

#### Step 2: Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE conductor;
CREATE USER app WITH PASSWORD 'app_pw';
GRANT ALL PRIVILEGES ON DATABASE conductor TO app;
\q
```

#### Step 3: Configure Environment

Update `.env`:

```env
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor
PORT=3000
```

#### Initialize Schema

```bash
npm run db:init
npm run db:seed
```

---

## Database Initialization

The application uses a migration-based initialization system located in `src/database/init.js`.

### Available Commands

```bash
# Initialize schema (idempotent - safe to run multiple times)
npm run db:init

# Initialize with demo seed data
npm run db:seed

# Reset database (⚠️ drops all data)
npm run db:reset

# Force re-run migrations (useful after schema changes)
npm run db:force
```

### Migration Files

Migrations are stored in `migrations/` directory:

- `01-create-users.sql` - Creates users table, enums, indexes, and triggers
- `02-seed-demo-users.sql` - Inserts demo users for testing

### Migration Process

1. **Connection Verification**: Tests database connectivity
2. **Schema Check**: Verifies if schema already exists
3. **Migration Execution**: Runs SQL files in order
4. **Schema Verification**: Validates table structure and columns
5. **Seed Data** (optional): Inserts demo data

### Manual Migration Execution

If needed, you can run migrations manually:

```bash
# Using Docker
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/01-create-users.sql
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/02-seed-demo-users.sql

# Using local PostgreSQL
psql -U app -d conductor -f migrations/01-create-users.sql
psql -U app -d conductor -f migrations/02-seed-demo-users.sql
```

---

## Migration Management

### Creating New Migrations

1. Create a new SQL file in `migrations/` directory:

```bash
# Format: NN-description.sql (e.g., 03-create-teams.sql)
touch migrations/03-create-teams.sql
```

1. Write idempotent SQL (safe to run multiple times):

```sql
-- Use IF NOT EXISTS for tables
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Use DO blocks for enums
DO $$ BEGIN
  CREATE TYPE team_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

1. Update `src/database/init.js` to include the new migration:

```javascript
const schemaMigrations = [
  { file: '01-create-users.sql', description: 'Create users table and schema' },
  { file: '03-create-teams.sql', description: 'Create teams table' },
];
```

### Migration Best Practices

- ✅ **Always use IF NOT EXISTS** for tables, indexes, and constraints
- ✅ **Use DO blocks** for enums and functions to handle duplicates
- ✅ **Include rollback logic** in comments for complex migrations
- ✅ **Test migrations** on a copy of production data
- ✅ **Version control** all migration files
- ❌ **Never modify** existing migration files (create new ones instead)
- ❌ **Never drop** production tables without backup

---

## Verification & Testing

### Schema Verification

```bash
# Check if users table exists
docker compose exec db psql -U app -d conductor -c "\dt"

# Verify table structure
docker compose exec db psql -U app -d conductor -c "\d users"

# Check indexes
docker compose exec db psql -U app -d conductor -c "\di"

# Verify constraints
docker compose exec db psql -U app -d conductor -c "\d+ users"
```

### Data Verification

```bash
# Count records
docker compose exec db psql -U app -d conductor -c "SELECT COUNT(*) FROM users;"

# View sample data
docker compose exec db psql -U app -d conductor -c "SELECT * FROM users LIMIT 5;"

# Check for duplicates
docker compose exec db psql -U app -d conductor -c "SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;"
```

### Run Test Suite

```bash
# Run all tests
npm run local:test

# Run specific test file
npx vitest run src/tests/user-model.test.js
npx vitest run src/tests/user-service.test.js
npx vitest run src/tests/roster-service.test.js

# Run tests in watch mode
npx vitest watch
```

### Expected Test Coverage

- ✅ User CRUD operations
- ✅ Email uniqueness constraints
- ✅ Role and status validation
- ✅ Pagination and filtering
- ✅ Bulk import/export operations
- ✅ Error handling and edge cases

---

## Troubleshooting

### Connection Issues

**Error: `connection refused`**

```bash
# Check if container is running
docker compose ps

# Check container logs
docker compose logs db

# Restart container
docker compose restart db

# Verify port is not in use
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows
```

**Error: `password authentication failed`**

- Verify `.env` file has correct `DATABASE_URL`
- Check Docker Compose environment variables
- Reset password: `docker compose exec db psql -U postgres -c "ALTER USER app PASSWORD 'app_pw';"`

**Error: `database "conductor" does not exist`**

```bash
# Create database
docker compose exec db psql -U postgres -c "CREATE DATABASE conductor;"
```

### Migration Issues

**Error: `relation already exists`**

- Migration is idempotent, but if you see this error:
- Use `npm run db:force` to force re-run
- Or manually drop and recreate: `npm run db:reset`

**Error: `extension "uuid-ossp" does not exist`**

```bash
docker compose exec db psql -U app -d conductor -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker compose exec db psql -U app -d conductor -c "CREATE EXTENSION IF NOT EXISTS citext;"
```

**Error: `type "user_role" already exists`**

- This is expected for idempotent migrations
- The migration handles this gracefully
- If blocking, drop type: `DROP TYPE IF EXISTS user_role CASCADE;`

### Performance Issues

**Slow queries:**

```bash
# Enable query logging
docker compose exec db psql -U app -d conductor -c "SET log_statement = 'all';"

# Check active connections
docker compose exec db psql -U app -d conductor -c "SELECT count(*) FROM pg_stat_activity;"

# Analyze table statistics
docker compose exec db psql -U app -d conductor -c "ANALYZE users;"
```

**Connection pool exhaustion:**

- Check `src/db.js` pool configuration
- Increase `max` connections if needed
- Monitor connection usage

### Data Issues

**Missing seed data:**

```bash
# Re-seed database
npm run db:seed

# Or manually insert
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/02-seed-demo-users.sql
```

**Corrupted data:**

```bash
# Reset database (⚠️ deletes all data)
npm run db:reset

# Or restore from backup (see Backup & Restore section)
```

---

## Backup & Restore

### Creating Backups

**Full database backup:**

```bash
# Using pg_dump (Docker)
docker compose exec db pg_dump -U app conductor > backup_$(date +%Y%m%d_%H%M%S).sql

# Using pg_dump (Local)
pg_dump -U app conductor > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker compose exec db pg_dump -U app conductor | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Table-specific backup:**

```bash
docker compose exec db pg_dump -U app -t users conductor > users_backup.sql
```

### Restoring Backups

```bash
# Restore full database
docker compose exec -T db psql -U app conductor < backup_20240101_120000.sql

# Restore from compressed backup
gunzip < backup_20240101_120000.sql.gz | docker compose exec -T db psql -U app conductor

# Restore specific table
docker compose exec -T db psql -U app conductor < users_backup.sql
```

### Automated Backups

Create a cron job for regular backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/conductor-app && docker compose exec -T db pg_dump -U app conductor | gzip > backups/backup_$(date +\%Y\%m\%d).sql.gz
```

---

## Performance Tuning

### Index Optimization

The schema includes indexes on frequently queried columns:

- `idx_users_email` - Fast email lookups
- `idx_users_created_at` - Efficient date-based queries
- `idx_users_role` - Role-based filtering
- `idx_users_status` - Status filtering

### Query Optimization

```bash
# Analyze query plans
docker compose exec db psql -U app -d conductor -c "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@ucsd.edu';"

# Update table statistics
docker compose exec db psql -U app -d conductor -c "ANALYZE users;"

# Vacuum database
docker compose exec db psql -U app -d conductor -c "VACUUM ANALYZE users;"
```

### Connection Pool Tuning

Edit `src/db.js` to adjust pool settings:

```javascript
export const pool = new pg.Pool({
  connectionString: url,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
});
```

### PostgreSQL Configuration

For production, tune PostgreSQL settings in `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:15
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=4MB
      -c min_wal_size=1GB
      -c max_wal_size=4GB
```

---

## Security Best Practices

### Environment Variables

- ✅ **Never commit** `.env` files to version control
- ✅ **Use strong passwords** in production
- ✅ **Rotate credentials** regularly
- ✅ **Use secrets management** (AWS Secrets Manager, HashiCorp Vault)

### Database Security

```bash
# Create read-only user for reporting
CREATE USER readonly WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE conductor TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

# Revoke unnecessary privileges
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

### Network Security

- ✅ **Use SSL connections** in production
- ✅ **Restrict database access** to application servers only
- ✅ **Use firewall rules** to limit access
- ✅ **Enable connection encryption** (`sslmode=require`)

### Audit Logging

Enable PostgreSQL logging:

```bash
# In postgresql.conf or docker-compose.yml
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'mod'  # Log all modifications
```

---

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js pg Library](https://node-postgres.com/)
- [Database Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review application logs: `docker compose logs db`
3. Check GitHub Issues
4. Contact the development team

---

**Last Updated:** 2025-01-XX  
**Maintained by:** Conductor Development Team
