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

Run the migration SQL script inside the container:

```bash
docker compose exec db psql -U app -d conductor -f /docker-entrypoint-initdb.d/01-create-users.sql
```

This creates the `users` table and related triggers and indexes.

---

## 4️⃣ Seed demo users

Once the schema is created, populate the database with demo data:

```bash
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

## Tip

Confirm connectivity anytime:

```bash
docker compose exec db psql -U app -d conductor -c "SELECT COUNT(*) FROM users;"
```
