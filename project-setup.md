## Environment Variables

Create a `.env` file at the project root before running `npm start`. Required keys:

| Key | Description |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID issued to the Conductor OAuth app |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret for the same app |
| `GOOGLE_CALLBACK_URL` | Public callback URL registered with Google (e.g., `http://localhost:3000/auth/google/callback`) |
| `SESSION_SECRET` | Random string used to sign Express session cookies |
| `DATABASE_URL` | PostgreSQL connection string for audit logging (e.g., `postgres://user:pass@localhost:5432/conductor`) |

Optional keys:

| Key | Description |
| --- | --- |
| `ALLOWED_GOOGLE_DOMAIN` | Domain restriction for OAuth logins (defaults to `ucsd.edu`) |
| `AUTH_LOG_RETENTION_DAYS` | Number of days to retain audit log rows before pruning (defaults to `90`) |
| `REDIS_URL` | Redis connection string for session storage and rate limiting |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed by CORS |
| `SESSION_SAME_SITE` | Explicit SameSite policy for the session cookie (`lax`, `strict`, or `none`) |
| `SESSION_SECURE` | Set to `true` to force secure cookies even in non-production environments |
| `SESSION_COOKIE_DOMAIN` | Override cookie domain when hosting behind a shared domain |
| `SUCCESS_REDIRECT_URL` | Redirect location after successful login (defaults to `/auth/success`) |
| `FAILURE_REDIRECT_URL` | Redirect location after failed login (defaults to `/auth/failure`) |
| `PORT` | Port for the Express server (defaults to `3000`) |
| `NODE_ENV` | Standard Node environment flag (`development`, `production`, etc.) |
| `LOGIN_FAILURE_THRESHOLD` | Number of failed logins within the window that triggers an alert log (defaults to `5`) |
| `LOGIN_FAILURE_WINDOW_MINUTES` | Minutes used to evaluate excessive login failures (defaults to `15`) |
| `PGSSLMODE` | Set to `disable`, `no-verify`, or another libpq-compatible value to control TLS when connecting to Postgres |

To initialize a local development database, run the migration script after creating your database:

```bash
psql "$DATABASE_URL" -f schema.sql
```

## Redis Setup

The login flow stores sessions in Redis. Install and run a local instance before starting the server:

### Install

- **macOS (Homebrew):** `brew install redis`
- **Windows (WSL Ubuntu):**
  1. Install [WSL](https://learn.microsoft.com/windows/wsl/install) with the Ubuntu distribution.
  2. Inside the WSL terminal run `sudo apt update && sudo apt install redis-server`.
- **Windows (Docker Desktop):** `docker run --name conductor-redis -p 6379:6379 redis`
- **Linux (APT):** `sudo apt update && sudo apt install redis-server`

### Run

- Homebrew service: `brew services start redis`
- Manual foreground: `redis-server /opt/homebrew/etc/redis.conf`
- WSL/Linux service: `sudo service redis-server start`
- Docker container: keep the container from the install step running

### Verify

```bash
redis-cli ping
```

You should see `PONG`. When finished, stop Redis with `brew services stop redis`, `Ctrl+C`, or `docker stop conductor-redis`.

### Login Rate Limiting

Redis also backs the server-side login throttle. Configure guardrails in `.env`:

- `LOGIN_FAILURE_THRESHOLD` — number of failed attempts allowed before blocking (default `5`)
- `LOGIN_FAILURE_WINDOW_MINUTES` — rolling window for measuring failures (default `15`)
- `ALLOWED_GOOGLE_DOMAIN` — permitted Google Workspace domain (`ucsd.edu` by default)

When the threshold is exceeded, the app records a `LOGIN_RATE_LIMITED` audit entry and rejects new sign-in attempts until the window expires.

### Auth Log Retention

Authentication events accumulate in the `auth_logs` table. To keep it tidy:

- `AUTH_LOG_RETENTION_DAYS` (default `90`) controls how long entries stay.
- Run `npm run prune:auth-logs` locally or from a scheduled job—this script removes rows older than the retention window.

## Database Setup

Follow this procedure to prepare a local PostgreSQL instance:

1. Confirm the `psql` client is available:

   ```bash
   psql --version
   ```

2. Connect as a superuser (e.g., `postgres`) and run:

   ```sql
   CREATE USER conductor_app_user WITH PASSWORD 'YOUR_PASSWORD';
   CREATE DATABASE conductor_db OWNER conductor_app_user;
   GRANT ALL PRIVILEGES ON DATABASE conductor_db TO conductor_app_user;
   ```

3. Disconnect from the session with `\q`.


### Steps to run the application

1. Setup environment variables  
   - Create `.env` file in the root folder  
   - Copy the content of `env.sample` to `.env`  
   - Change the values with yours

2. Install the dependencies  
   `npm install`

3. Run the server  
   ``node server.js``
