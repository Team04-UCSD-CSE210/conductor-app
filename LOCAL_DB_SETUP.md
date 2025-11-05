# 🐘 Local Database Setup & Command Reference

Complete guide for setting up, managing, and using the Conductor App database and development environment.

---

## 🚀 Quick Start

```bash
# 1. Copy environment file
cp env.example .env

# 2. Start database
docker compose up -d db

# 3. Initialize database with seed data
npm run db:seed

# 4. Start the server
npm start
```

The server will run on `http://localhost:3000` and the database on `localhost:5432`.

---

## 📦 Database Setup

### 1️⃣ Environment Configuration

Create a local `.env` from the example template:

```bash
cp env.example .env
```

Edit `.env` if needed:

```env
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor
PORT=3000
```

**Note**: The default password in docker-compose.yml is `app_pw`, not `password`.

### 2️⃣ Start Database Container

Use Docker Compose to start the PostgreSQL service:

```bash
docker compose up -d db
```

This starts a local Postgres instance named **db** with the configured username and password.

### 3️⃣ Initialize Database

You have two options for initialization:

#### Option A: Automated (Recommended)

```bash
# Initialize schema only
npm run db:init

# Initialize with demo users
npm run db:seed

# Reset database (drop and recreate)
npm run db:reset

# Reset with seed data
npm run db:reset -- --seed

# Force re-run migrations
npm run db:force
```

#### Option B: Manual (Using Docker)

```bash
# Run migration SQL script
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/01-create-users.sql

# Seed demo users
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/02-seed-demo-users.sql
```

**Note**: Migrations run automatically when the container starts for the first time (via `/docker-entrypoint-initdb.d`).

### 4️⃣ Verify Database

Check that the `users` table exists and data is inserted:

```bash
# List tables
docker compose exec db psql -U app -d conductor -c "\dt"

# View users
docker compose exec db psql -U app -d conductor -c "SELECT * FROM users LIMIT 5;"

# Count users
docker compose exec db psql -U app -d conductor -c "SELECT COUNT(*) FROM users;"
```

Expected output should list demo users like:

```text
 id | name     | email             | role  | status 
----+----------+-------------------+-------+---------
 1  | Prof X   | prof@ucsd.edu    | admin | active
 2  | Alice    | alice@ucsd.edu   | user  | active
```

---

## 📋 Database Commands Reference

### Database Container Management

```bash
# Start PostgreSQL container
docker compose up -d db

# Stop database container
docker compose down

# View database status
docker compose ps db

# Restart database
docker compose restart db

# View logs
docker compose logs db
docker compose logs -f db  # Follow logs

# Remove database volume (complete reset)
docker compose down -v
```

### Database Initialization Commands

```bash
npm run db:init      # Initialize schema only
npm run db:seed      # Initialize with demo users
npm run db:reset     # Reset database (drop and recreate)
npm run db:force     # Force re-run migrations
```

### Database Queries

```bash
# Connect to database interactively
docker compose exec db psql -U app -d conductor

# Common queries
docker compose exec db psql -U app -d conductor -c "SELECT COUNT(*) FROM users;"
docker compose exec db psql -U app -d conductor -c "SELECT * FROM users;"
docker compose exec db psql -U app -d conductor -c "\d users"      # Table structure
docker compose exec db psql -U app -d conductor -c "\dt"          # List tables
docker compose exec db psql -U app -d conductor -c "\di"          # List indexes
```

### SQL Commands (Inside psql)

```sql
-- List all tables
\dt

-- Describe users table
\d users

-- Check indexes
\di

-- View all users
SELECT * FROM users;

-- Count users by role
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Find user by email (case-insensitive)
SELECT * FROM users WHERE email = 'user@example.com';
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm run local:test

# Run specific test file
npx vitest run src/tests/roster-service.test.js
npx vitest run src/tests/user-service.test.js
npx vitest run src/tests/user-model.test.js

# Run tests in watch mode
npx vitest watch src/tests/roster-service.test.js
```

### Test Coverage

The tests cover:
- Table creation and inserts
- Duplicate email protection
- Listing with limit/offset
- Update and delete behavior
- Integration with DB connection pool
- Roster import/export functionality
- CSV and JSON parsing
- Error handling

### Testing Workflow

```bash
# 1. Reset database before tests
npm run db:reset

# 2. Run tests
npm run local:test

# 3. Start server and test manually
npm start
```

---

## 🔧 Development Commands

### Server

```bash
# Start development server
npm start

# Server runs on http://localhost:3000
```

### Code Quality

```bash
# Run all linters
npm run lint

# Run specific linters
npm run lint:js      # ESLint
npm run lint:css      # Stylelint
npm run lint:html     # HTMLHint
npm run lint:md       # Markdownlint
```

### Performance Testing

```bash
# Database performance test
npm run perf:db

# API performance test
npm run perf:api
```

### Examples

```bash
# Run user CRUD example
node examples/user-crud-example.js

# Run roster import/export example
node examples/roster-import-export-example.js
```

---

## 🌐 API Endpoints

Once the server is running, you can test these endpoints:

### Health Check

```bash
curl http://localhost:3000/health
```

### User Management

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","role":"user"}'

# Get all users
curl http://localhost:3000/users

# Get user by ID
curl http://localhost:3000/users/{id}

# Update user
curl -X PUT http://localhost:3000/users/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","role":"admin"}'

# Delete user
curl -X DELETE http://localhost:3000/users/{id}
```

### Roster Management

```bash
# Import roster from JSON
curl -X POST http://localhost:3000/users/roster/import/json \
  -H "Content-Type: application/json" \
  -d '[{"name":"Alice","email":"alice@example.com","role":"user"}]'

# Import roster from CSV (file upload)
curl -X POST http://localhost:3000/users/roster/import/csv \
  -F "file=@roster.csv"

# Import roster from CSV (text)
curl -X POST http://localhost:3000/users/roster/import/csv \
  -H "Content-Type: application/json" \
  -d '{"csv":"name,email,role\nAlice,alice@example.com,user"}'

# Export roster as JSON
curl http://localhost:3000/users/roster/export/json -o roster.json

# Export roster as CSV
curl http://localhost:3000/users/roster/export/csv -o roster.csv
```

---

## 🗄️ Database Schema

The database consists of:

- **Extensions**: uuid-ossp, citext
- **Types**: user_role, user_status
- **Tables**: users
- **Indexes**: email, created_at, role, status
- **Triggers**: Automatic updated_at timestamp

### Schema Details

See [src/database/schema.md](./src/database/schema.md) for detailed schema documentation including:
- Table structures
- Column definitions
- Indexes and constraints
- Usage examples
- Performance considerations

---

## 🔍 Debugging

### Check Server Health

```bash
curl http://localhost:3000/health
```

### View Database Logs

```bash
docker compose logs db
docker compose logs -f db  # Follow logs
```

### Check Environment Variables

```bash
cat .env
```

### Verify Database Connection

```bash
docker compose exec db psql -U app -d conductor -c "SELECT 1;"
```

### Check Port Usage

```bash
lsof -i :3000   # Server port
lsof -i :5432   # Database port
```

---

## 🆘 Troubleshooting

### Connection Errors

If you see "DATABASE_URL not defined":
1. Check that `.env` file exists: `ls -la .env`
2. Verify `DATABASE_URL` is set correctly: `cat .env`
3. Ensure database is running: `docker compose ps db`

### Migration Errors

If migrations fail:
1. Check database connection: `npm run db:init`
2. Verify PostgreSQL is running: `docker compose ps db`
3. Check migration files exist: `ls migrations/`
4. Use `--force` flag to re-run: `npm run db:force`

### Schema Already Exists

If you see "Schema already initialized":
- Use `--force` to re-run: `npm run db:force`
- Or reset completely: `npm run db:reset`

### Reset Everything

```bash
# Complete reset
docker compose down -v
docker compose up -d db
npm run db:seed
```

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :5432

# Kill process if needed (replace PID)
kill -9 <PID>
```

---

## ⚡ Common Workflows

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp env.example .env

# 3. Start database
docker compose up -d db

# 4. Initialize database
npm run db:seed

# 5. Start server
npm start
```

### Development Workflow

```bash
# Terminal 1: Start database
docker compose up -d db

# Terminal 2: Start server
npm start

# Terminal 3: Run tests
npm run local:test
```

### Testing Workflow

```bash
# 1. Reset database
npm run db:reset

# 2. Run tests
npm run local:test

# 3. Start server and test manually
npm start
```

### Reset for Clean State

```bash
# Drop everything and start fresh
npm run db:reset -- --seed
```

---

## 🧹 Cleanup

```bash
# Stop and remove containers
docker compose down

# Remove containers and volumes (complete cleanup)
docker compose down -v

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## ✅ Done

Your local PostgreSQL database and backend are now fully configured.

Backend connects via:
```env
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor
```

**Tip**: Confirm connectivity anytime:
```bash
docker compose exec db psql -U app -d conductor -c "SELECT COUNT(*) FROM users;"
```
