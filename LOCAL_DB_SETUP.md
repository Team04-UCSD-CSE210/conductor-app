# 🐘 Local Database Setup Guide

To deploy and test the PostgreSQL database locally, follow these steps.

---

## 1️⃣ Copy the environment file

Create a local `.env` from the example template:

```bash
cp .env.example .env
```

Then edit `.env` if needed:

```env
DATABASE_URL=postgresql://app:password@db:5432/conductor
PORT=3000
```

---

## 2️⃣ Start the database container

Use Docker Compose to start the PostgreSQL service:

```bash
docker compose up -d db
```

This will start a local Postgres instance named **db** with the configured username and password.

---

## 3️⃣ Initialize the tables

You can initialize the database using npm scripts (recommended) or manually:

### Using npm scripts (recommended)

```bash
# Initialize schema only
npm run db:init

# Initialize with demo data
npm run db:seed
```

### Manual initialization

Run the migration SQL script inside the container:

```bash
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/01-create-users.sql
```

This creates the `users` table and related triggers and indexes.

---

## 4️⃣ Seed demo users

Once the schema is created, populate the database with demo data:

```bash
# Using npm script (recommended)
npm run db:seed

# Or manually
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/02-seed-demo-users.sql
```

This will insert several demo users into the `users` table for testing the API and frontend.

---

## 5️⃣ Verify the database

Check that the `users` table exists and data is inserted:

```bash
docker compose exec db psql -U app -d conductor -c "\dt"
docker compose exec db psql -U app -d conductor -c "SELECT * FROM users LIMIT 5;"
```

Expected output should list demo users like:

```text
 id | name     | email             | role  | status 
----+----------+-------------------+-------+---------
 1  | Alice    | alice@example.com | user  | active
 2  | Bob      | bob@example.com   | admin | active
```

---

## 6️⃣ (Optional) Reset or rebuild the database

If you need to recreate the DB from scratch:

### Using npm scripts (recommended)

```bash
# Reset database (drop and recreate)
npm run db:reset

# Reset with seed data
npm run db:reset -- --seed

# Force re-run migrations (if schema already exists)
npm run db:force
```

### Manual reset

```bash
docker compose down -v
docker compose up -d db
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/01-create-users.sql
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/02-seed-demo-users.sql
```

---

## 7️⃣ Run tests

After confirming your DB works, run the backend test suite to verify integration.

### Run all tests

```bash
npm run local:test
```

### Or run specific files

```bash
npx vitest run src/tests/user-model.test.js
npx vitest run src/tests/user-service.test.js
```

✅ The tests cover:

- Table creation and inserts
- Duplicate email protection
- Listing with limit/offset
- Update and delete behavior
- Integration with DB connection pool

---

## ✅ Done

Your local PostgreSQL database and backend tests are now fully configured.

Backend will connect via:

```env
DATABASE_URL=postgresql://app:password@localhost:5432/conductor
```

---

## 8️⃣ Database Commands Reference

### Initialize Schema

Creates all tables, indexes, triggers, and functions:

```bash
npm run db:init
```

### Initialize with Seed Data

Creates schema and populates with demo users:

```bash
npm run db:seed
```

### Reset Database

Drops all tables and recreates from scratch:

```bash
npm run db:reset
npm run db:reset -- --seed  # With seed data
```

### Force Re-run Migrations

Forces migration execution even if schema exists:

```bash
npm run db:force
```

### Connect to Database

```bash
# Using Docker
docker compose exec db psql -U app -d conductor

# Using local PostgreSQL
psql $DATABASE_URL
```

### Verify Schema

```sql
-- List all tables
\dt

-- Describe users table
\d users

-- Check indexes
\di

-- View all users
SELECT * FROM users;
```

## 9️⃣ Troubleshooting

### Connection Errors

If you see "DATABASE_URL not defined":
1. Check that `.env` file exists
2. Verify `DATABASE_URL` is set correctly
3. Ensure database is running (`docker compose ps db`)

### Migration Errors

If migrations fail:
1. Check database connection: `npm run db:init`
2. Verify PostgreSQL is running
3. Check migration files exist in `migrations/` directory
4. Use `--force` flag to re-run: `npm run db:force`

### Schema Already Exists

If you see "Schema already initialized":
- Use `--force` to re-run: `npm run db:force`
- Or reset completely: `npm run db:reset`

## 🔟 Database Schema

The database consists of:

- **Extensions**: uuid-ossp, citext
- **Types**: user_role, user_status
- **Tables**: users
- **Indexes**: email, created_at, role, status
- **Triggers**: Automatic updated_at timestamp

See [src/database/schema.md](./src/database/schema.md) for detailed schema documentation.

## 💡 Tips

Confirm connectivity anytime:

```bash
docker compose exec db psql -U app -d conductor -c "SELECT COUNT(*) FROM users;"
```

## 🏭 Production Considerations

1. **Backups**: Regularly backup production database
2. **Migrations**: Test migrations in staging before production
3. **Connection Pooling**: Configured in `src/db.js`
4. **Indexes**: All critical columns are indexed for performance
5. **Constraints**: Unique constraints enforce data integrity
