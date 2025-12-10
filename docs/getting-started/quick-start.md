# Quick Start Guide

Get Conductor up and running in under 5 minutes!

## Prerequisites

Before you begin, ensure you have:

- [OK] **Node.js** 18+ ([Download](https://nodejs.org/))
- [OK] **PostgreSQL** 18+ ([Download](https://www.postgresql.org/download/))
- [OK] **Git** ([Download](https://git-scm.com/))

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/Team04-UCSD-CSE210/conductor-app.git
cd conductor-app
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages (~2-3 minutes).

### 3. Setup Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=8443
NODE_ENV=development
SESSION_SECRET=your-secret-key-min-32-chars-long

# Update with your PostgreSQL credentials
DATABASE_URL=postgresql://postgres:password@localhost:5432/conductor

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8443/auth/google/callback
```

### 4. Initialize Database

```bash
# Create database and load demo data
npm run db:seed
```

This will:
- [OK] Create all database tables
- [OK] Set up RBAC permissions
- [OK] Load 168 demo users
- [OK] Create sample course offering (CSE 210)
- [OK] Create teams and assignments

### 5. Start the Server

```bash
npm start
```

You should see:

```
[server] Server running on http://localhost:8443
[database] Connected to PostgreSQL
[instrumentation] OpenTelemetry initialized
```

### 6. Access the Application

Open your browser to: **http://localhost:8443**

## Demo Accounts

Try these demo accounts (password: Google OAuth):

| Role | Email | Description |
|------|-------|-------------|
| Admin | `admin@ucsd.edu` | Full system access |
| Instructor | `thomas@ucsd.edu` | Course management |
| TA | `alice@ucsd.edu` | Teaching assistant |
| Student | `bob@ucsd.edu` | Student view |

## Next Steps

### Development

```bash
# Run tests
npm test

# Run linters
npm run lint

# Watch for changes (use nodemon)
npx nodemon src/server.js
```

### Explore the Code

```
src/
├── server.js           # Entry point
├── routes/             # API endpoints
│   ├── user-routes.js
│   ├── attendance-routes.js
│   └── ...
├── views/              # HTML pages
├── public/             # CSS, JS, images
└── middleware/         # Express middleware
```

### Learn More

-  [Full Installation Guide](installation.md) - Detailed setup
- 🏗️ [Architecture Overview](../architecture/overview.md) - System design
-  [Database Schema](../database/schema.md) - Database structure
-  [API Reference](../backend/api-reference.md) - API endpoints

## Troubleshooting

### Database Connection Failed

```bash
# Ensure PostgreSQL is running
# Windows PowerShell:
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" start

# macOS:
brew services start postgresql@18

# Linux:
sudo systemctl start postgresql
```

### Port Already in Use

```bash
# Change PORT in .env file
PORT=3000
```

### OAuth Errors

Make sure your Google OAuth credentials are correct:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add `http://localhost:8443/auth/google/callback` as redirect URI

## Common Commands

```bash
# Database
npm run db:init          # Initialize schema only
npm run db:seed          # Initialize with demo data
npm run db:reset         # Drop and recreate everything

# Testing
npm test                 # Unit tests
npm run test:e2e         # E2E tests
npm run test:load        # Load tests

# Quality
npm run lint             # All linters
npm run docs             # Generate JSDoc
```

## Getting Help

-  Check the [full documentation](../README.md)
-  [Report issues](https://github.com/Team04-UCSD-CSE210/conductor-app/issues)
-  Ask in team Slack channel

---

**You're all set!** 

Next: [Learn about the architecture](../architecture/overview.md) or [start contributing](../contributing/workflow.md)
