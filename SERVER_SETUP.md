# 🚀 Server Setup & Performance Guide

This doc explains how to run the **Express server**, verify endpoints, and run the **performance
benchmarks** against the API and the database.

---

## 1) Prerequisites

- Node.js 18+ (we use ESM: `"type": "module"`)
- Docker Desktop (for Postgres)
- The DB is up and initialized (see `LOCAL_DB_SETUP_FULL.md`)

Environment variables (in `.env`):

```bash
# Required
DATABASE_URL=postgresql://app:password@db:5432/conductor
PORT=3000

# Optional: for local (non-docker) DB
# DATABASE_URL=postgresql://app:password@localhost:5432/conductor
```

> Tip (Windows PowerShell): `curl` is aliased to `Invoke-WebRequest`. Use `curl.exe` or `irm` for
> raw output:
>
> ```powershell
> curl.exe http://localhost:3000/health
> # or
> irm http://localhost:3000/health
> ```

---

## 2) Start the server

Install deps and start:

```bash
npm i
node src/server.js
```

You should see something like:

```text
[server] listening on http://localhost:3000
[db] connect event
```

---

## 3) Quick health checks

### Health

```bash
curl.exe -i http://localhost:3000/health
```

Expected:

```text
HTTP/1.1 200 OK
...
{"ok":true,"service":"conductor-api"}
```

### Users API

```bash
# list (pagination)
curl.exe "http://localhost:3000/api/users?limit=10&offset=0"

# create
curl.exe -X POST "http://localhost:3000/api/users" ^
  -H "Content-Type: application/json" ^
  -d "{"name":"Alice","email":"alice@ex.com","role":"user"}"
```

If you see 404, confirm the route is `/api/users` and the server imported routes:

```js
// src/server.js
import userRoutes from './routes/user-routes.js';
app.use('/api/users', userRoutes);
```

---

## 4) Performance tests

We provide two scripts:

- **Database-only** throughput/latency: `scripts/perf-db.js`
- **HTTP API** load test: `scripts/perf-api.js` (uses `autocannon`)

### 4.1 DB Perf

Run a DB-only test (bulk insert, read pages, update, delete):

```bash
node scripts/perf-db.js
```

Output includes averaged timings for:

- 5k inserts
- list (pages of 50)
- updates
- deletes

> Notes
>
> - Ensure Docker DB is up and `DATABASE_URL` points to it.
> - If you want a clean slate, run `docker compose down -v && docker compose up -d db`
>   and re-run the schema/seed SQL.

### 4.2 API Perf

First, start the server (port 3000), then in a **new terminal**:

```bash
node scripts/perf-api.js
```

What it does:

- **GET** warm-up: `/api/users?limit=50&offset=0`
- **GET** sustained: same endpoint with more connections
- **POST** create users: `/api/users` with randomized payloads

If you see **non-2xx responses** or **0 req/sec**:

- Check base URL in `scripts/perf-api.js` (should be `http://localhost:3000`).
- Check path strings contain leading slashes: `/api/users` (not `api/users` or `users`).
- Ensure the server is running and printing `[server] listening...`.

Example expected block (values vary by machine):

```text
== GET /api/users (sustained) ==
Latency p50: 4 ms | p99: 7 ms
Req/s ~ 9-10k | Non-2xx: 0 | Errors: 0
```

---

## 5) Troubleshooting

- **`connection refused`**: The DB container may be down. Run `docker compose ps` and
  `docker compose up -d db`.
- **`uuid-ossp` / `citext` errors**: Re-run the SQL that enables extensions:

  ```bash
  docker compose exec db psql -U app -d conductor -c "CREATE EXTENSION IF NOT EXISTS "uuid-ossp";"
  docker compose exec db psql -U app -d conductor -c "CREATE EXTENSION IF NOT EXISTS citext;"
  ```
  
- **PowerShell escaping**: Prefer `curl.exe` (not `curl`) or use Postman/Insomnia.
- **CORS (for frontend)**: Add `cors()` to the server if the UI runs on another origin.

---

## 6) What to commit

- `src/` (server, routes, models)
- `scripts/perf-db.js`, `scripts/perf-api.js`
- `docker-compose.yml` and `docker-entrypoint-initdb.d/*.sql`
- `.env.example` (never commit real `.env`)
- `LOCAL_DB_SETUP_FULL.md` and `SERVER_SETUP.md` (this file)

---

## 7) Scaling notes (for later)

- Prefer **pooled** DB connections (we already use `pg.Pool`).
- Add **indexes** as data grows (email, created_at already indexed).
- Consider **pagination by cursor** (id/created_at) for high concurrency.
- Run API behind **reverse proxy** (Nginx) if needed.
- For production DB, use a managed Postgres (RDS/Neon/Supabase/etc.).

---

Happy shipping! 🛳️
