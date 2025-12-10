# Installation Guide

Complete installation and setup guide for the Conductor application.

## System Requirements

### Required Software

- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 18.0 or higher ([Download](https://www.postgresql.org/download/))
- **Git** 2.30.0 or higher ([Download](https://git-scm.com/))

### Recommended Tools

- **VS Code** - IDE with recommended extensions
- **Postman** or **Insomnia** - API testing
- **pgAdmin** or **DBeaver** - Database management
- **Docker Desktop** - For containerization (optional)

### Hardware Requirements

- **RAM**: 8 GB minimum, 16 GB recommended
- **Storage**: 2 GB free space
- **CPU**: Multi-core processor recommended

## Installation Steps

### 1. Install Prerequisites

#### Windows

**Node.js:**
```powershell
# Using winget
winget install OpenJS.NodeJS.LTS

# Or download from https://nodejs.org/
```

**PostgreSQL:**
```powershell
# Using winget
winget install PostgreSQL.PostgreSQL.18

# Or download from https://www.postgresql.org/download/windows/
```

**Git:**
```powershell
# Using winget
winget install Git.Git
```

#### macOS

```bash
# Using Homebrew
brew install node@18
brew install postgresql@18
brew install git

# Start PostgreSQL
brew services start postgresql@18
```

#### Linux (Ubuntu/Debian)

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install postgresql-18 postgresql-contrib

# Git
sudo apt-get install git

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/Team04-UCSD-CSE210/conductor-app.git

# Navigate to the project directory
cd conductor-app
```

### 3. Install Dependencies

```bash
# Install all npm packages
npm install

# This will install:
# - Express.js and middleware
# - PostgreSQL client (pg)
# - Passport.js for OAuth
# - Testing frameworks (Vitest, Playwright)
# - Linting tools (ESLint, Stylelint)
# - And all other dependencies (~300 packages)
```

**Installation time**: 2-5 minutes depending on internet speed

### 4. Configure PostgreSQL Database

#### Create Database

**Windows PowerShell:**
```powershell
# Set PostgreSQL bin directory in PATH if not already
$env:PATH += ";C:\Program Files\PostgreSQL\18\bin"

# Create database
createdb -U postgres conductor

# Or using psql
psql -U postgres -c "CREATE DATABASE conductor;"
```

**macOS/Linux:**
```bash
# Create database
createdb conductor

# Or using psql
psql -U postgres -c "CREATE DATABASE conductor;"
```

#### Create Database User (Optional)

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create user
CREATE USER conductor_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE conductor TO conductor_user;
ALTER DATABASE conductor OWNER TO conductor_user;

-- Exit
\q
```

### 5. Setup Environment Variables

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Server Configuration
PORT=8443
NODE_ENV=development
SESSION_SECRET=your-super-secret-session-key-min-32-chars-long-random-string

# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/conductor

# Google OAuth 2.0 Credentials
# Get these from: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8443/auth/google/callback

# Optional: SigNoz Observability
SIGNOZ_ENDPOINT=http://localhost:4318
SERVICE_NAME=conductor-app
ENVIRONMENT=development

# Optional: Redis Session Store (for production)
# REDIS_URL=redis://localhost:6379
```

#### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Web application"
6. Authorized redirect URIs: `http://localhost:8443/auth/google/callback`
7. Copy Client ID and Client Secret to `.env`

### 6. Initialize Database

```bash
# Initialize database with demo data (recommended for development)
npm run db:seed

# Or initialize schema only (no demo data)
npm run db:init
```

**What this does:**
- [OK] Creates all 15 database tables
- [OK] Sets up ENUM types
- [OK] Creates indexes for performance
- [OK] Sets up triggers for auto-updates
- [OK] Loads demo data:
  - 168 demo users (admin, instructors, TAs, students)
  - CSE 210 course offering
  - 10+ teams
  - Sample attendance sessions
  - RBAC permissions and roles

### 7. Start the Server

```bash
# Start in development mode
npm start

# Or start with auto-reload (using nodemon)
npx nodemon src/server.js
```

**Expected output:**
```
[database] Database connection verified
[database] Schema already initialized
[instrumentation] OpenTelemetry SDK initialized
[server] Server running on http://localhost:8443
[server] Environment: development
```

### 8. Verify Installation

Open your browser and navigate to:

**http://localhost:8443**

You should see the Conductor landing page.

#### Test Login

Click "Login with Google" and authenticate with one of these demo accounts:

| Role | Email | Access Level |
|------|-------|--------------|
| Admin | `admin@ucsd.edu` | Full system access |
| Instructor | `thomas@ucsd.edu` | Course management |
| TA | `alice@ucsd.edu` | Teaching assistant dashboard |
| Student | `bob@ucsd.edu` | Student dashboard |

## Post-Installation Setup

### 1. Run Tests

Verify everything is working:

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e:chromium

# Run all tests
npm run test:all
```

### 2. Install Browser for E2E Tests

```bash
# Install Playwright browsers
npx playwright install chromium
```

### 3. Setup IDE

#### VS Code Extensions (Recommended)

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "stylelint.vscode-stylelint",
    "esbenp.prettier-vscode",
    "ms-playwright.playwright",
    "cweijan.vscode-postgresql-client2"
  ]
}
```

Install them:
```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension stylelint.vscode-stylelint
```

### 4. Setup Git Hooks (Optional)

```bash
# Install husky for pre-commit hooks
npm install --save-dev husky

# Setup husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint"
```

## Troubleshooting

### Database Connection Issues

**Error: `ECONNREFUSED`**

```bash
# Check if PostgreSQL is running
# Windows:
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" status

# macOS:
brew services list | grep postgresql

# Linux:
sudo systemctl status postgresql

# Start PostgreSQL if not running
# Windows:
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" start

# macOS:
brew services start postgresql@18

# Linux:
sudo systemctl start postgresql
```

**Error: `database "conductor" does not exist`**

```bash
# Create the database
createdb -U postgres conductor
```

**Error: `password authentication failed`**

Update `DATABASE_URL` in `.env` with correct credentials:
```env
DATABASE_URL=postgresql://postgres:correct_password@localhost:5432/conductor
```

### Port Already in Use

**Error: `Port 8443 is already in use`**

```bash
# Windows - Find process using port
netstat -ano | findstr :8443

# Kill the process
taskkill /PID <process_id> /F

# Or change port in .env
PORT=3000
```

**macOS/Linux:**
```bash
# Find process
lsof -i :8443

# Kill process
kill -9 <process_id>
```

### OAuth Errors

**Error: `redirect_uri_mismatch`**

1. Check Google Cloud Console redirect URIs match exactly
2. Ensure protocol matches (http vs https)
3. Verify port number is correct

**Error: `invalid_client`**

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure no extra whitespace in `.env` file

### Migration Errors

**Error: `Migration failed`**

```bash
# Reset database and try again
npm run db:reset

# Check migration logs
npm run db:init 2>&1 | tee migration.log
```

### Module Not Found

**Error: `Cannot find module`**

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Permission Denied (Linux/macOS)

```bash
# Fix permissions
sudo chown -R $USER:$USER .
chmod -R 755 .
```

## Development Workflow

### Daily Development

```bash
# 1. Start PostgreSQL (if not running)
# 2. Pull latest changes
git pull origin main

# 3. Update dependencies (if package.json changed)
npm install

# 4. Run migrations (if schema changed)
npm run db:init

# 5. Start server
npm start

# 6. In separate terminal, run tests in watch mode
npm test -- --watch
```

### Before Committing

```bash
# 1. Run linters
npm run lint

# 2. Run tests
npm test

# 3. Check for errors
npm run lint:js
npm run lint:css
npm run lint:html

# 4. Commit with conventional commit message
git commit -m "feat: add new feature"
```

## Advanced Setup

### Docker Setup (Optional)

```bash
# Build Docker image
docker build -t conductor-app .

# Run container
docker run -p 8443:8443 \
  -e DATABASE_URL=postgresql://host.docker.internal:5432/conductor \
  -e GOOGLE_CLIENT_ID=your-client-id \
  -e GOOGLE_CLIENT_SECRET=your-client-secret \
  conductor-app
```

### Redis Session Store (Production)

```bash
# Install Redis
# Windows: https://github.com/microsoftarchive/redis/releases
# macOS: brew install redis
# Linux: sudo apt-get install redis-server

# Add to .env
REDIS_URL=redis://localhost:6379

# Uncomment Redis session configuration in src/server.js
```

### SigNoz Observability Setup

```bash
# Clone SigNoz
git clone https://github.com/SigNozHQ/signoz.git
cd signoz/deploy

# Start SigNoz with Docker
docker compose -f docker/clickhouse-setup/docker-compose.yaml up -d

# Access SigNoz UI: http://localhost:3301
```

## Uninstallation

```bash
# Stop server (Ctrl+C)

# Drop database
dropdb -U postgres conductor

# Remove project directory
cd ..
rm -rf conductor-app

# Uninstall global tools (optional)
npm uninstall -g nodemon
```

## Next Steps

-  [Quick Start Guide](quick-start.md) - Get running in 5 minutes
- 🏗️ [Architecture Overview](../architecture/overview.md) - Understand the system
-  [API Reference](../backend/api-reference.md) - Explore the APIs
-  [Testing Guide](../testing/overview.md) - Write and run tests
-  [Contributing Guide](../contributing/workflow.md) - Start contributing

## Getting Help

-  [Documentation](../README.md)
-  [Report Issues](https://github.com/Team04-UCSD-CSE210/conductor-app/issues)
-  Ask in team Slack channel

---

**Congratulations!** Your Conductor development environment is ready. 
