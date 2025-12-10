# Local Development Guide

Best practices and workflows for developing Conductor locally.

## Development Environment

### Recommended Setup

- **IDE**: Visual Studio Code
- **Terminal**: Windows Terminal (Windows) / iTerm2 (macOS) / GNOME Terminal (Linux)
- **Database Tool**: pgAdmin, DBeaver, or VS Code PostgreSQL extension
- **API Testing**: Postman, Insomnia, or VS Code REST Client
- **Browser**: Chrome or Edge (for DevTools)

### VS Code Extensions

Install these extensions for the best experience:

```bash
# Essential
code --install-extension dbaeumer.vscode-eslint
code --install-extension stylelint.vscode-stylelint
code --install-extension esbenp.prettier-vscode

# Testing
code --install-extension ms-playwright.playwright
code --install-extension vitest.explorer

# Database
code --install-extension cweijan.vscode-postgresql-client2

# Utilities
code --install-extension streetsidesoftware.code-spell-checker
code --install-extension aaron-bond.better-comments
```

## Daily Workflow

### Starting Development

```bash
# 1. Ensure PostgreSQL is running
pg_ctl status

# 2. Start development server
npm start

# 3. Open in browser
# http://localhost:8443
```

### Development Server Options

```bash
# Standard start
npm start

# Auto-reload on file changes
npx nodemon src/server.js

# With debugging
node --inspect src/server.js

# With environment override
NODE_ENV=development PORT=3000 npm start
```

### Hot Reload Setup

Install nodemon for automatic server restart:

```bash
# Install globally
npm install -g nodemon

# Or use with npx
npx nodemon src/server.js

# Watch specific files
npx nodemon --watch src --watch migrations src/server.js
```

## Project Structure

```
conductor-app/
+-- src/
¦   +-- server.js              # Application entry point
¦   +-- db.js                  # Database connection pool
¦   +-- instrumentation.js     # OpenTelemetry setup
¦   ¦
¦   +-- routes/                # API route handlers
¦   ¦   +-- user-routes.js
¦   ¦   +-- attendance-routes.js
¦   ¦   +-- team-routes.js
¦   ¦   +-- ... (18 route files)
¦   ¦
¦   +-- middleware/            # Express middleware
¦   ¦   +-- auth-middleware.js
¦   ¦   +-- rbac-middleware.js
¦   ¦   +-- error-handler.js
¦   ¦   +-- metrics-middleware.js
¦   ¦
¦   +-- models/                # Data models
¦   ¦   +-- user-model.js
¦   ¦   +-- attendance-model.js
¦   ¦   +-- ...
¦   ¦
¦   +-- services/              # Business logic
¦   ¦   +-- permission-service.js
¦   ¦   +-- enrollment-service.js
¦   ¦   +-- ...
¦   ¦
¦   +-- database/              # Database utilities
¦   ¦   +-- init.js
¦   ¦
¦   +-- views/                 # HTML templates
¦   ¦   +-- index.html
¦   ¦   +-- student-dashboard.html
¦   ¦   +-- ...
¦   ¦
¦   +-- public/                # Static assets
¦       +-- css/               # Stylesheets
¦       +-- js/                # Client-side JavaScript
¦       +-- assets/            # Images, fonts
¦
+-- migrations/                # Database migrations (33 files)
+-- scripts/                   # Utility scripts
+-- e2e/                       # End-to-end tests
+-- config/                    # Configuration files
+-- docs/                      # Documentation
```

## Common Development Tasks

### Database Operations

```bash
# Initialize fresh database
npm run db:init

# Load demo data
npm run db:seed

# Reset everything (drop + recreate)
npm run db:reset

# Force re-run migrations
npm run db:force
```

### Running Tests

```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# E2E tests (all browsers)
npm run test:e2e

# E2E tests (Chromium only)
npm run test:e2e:chromium

# E2E tests with UI
npm run test:e2e:ui

# Load tests
npm run test:load

# Run all tests
npm run test:all
```

### Code Quality

```bash
# Lint all files
npm run lint

# Lint JavaScript only
npm run lint:js

# Lint CSS only
npm run lint:css

# Lint HTML only
npm run lint:html

# Lint Markdown only
npm run lint:md

# Fix auto-fixable issues
npx eslint . --fix
npx stylelint "src/**/*.css" --fix
```

### Database Queries

```bash
# Connect to database
psql -U postgres conductor

# Or using environment variable
psql $DATABASE_URL
```

**Useful queries:**

```sql
-- List all users
SELECT id, email, name, primary_role FROM users LIMIT 10;

-- Check enrollments
SELECT u.name, e.course_role, e.status
FROM enrollments e
JOIN users u ON e.user_id = u.id
WHERE e.offering_id = 'your-offering-id';

-- View permissions
SELECT * FROM permissions ORDER BY scope, resource;

-- Check team members
SELECT t.name AS team, u.name AS member, tm.role
FROM team_members tm
JOIN team t ON tm.team_id = t.id
JOIN users u ON tm.user_id = u.id;
```

## Debugging

### Node.js Debugger

**VS Code launch.json:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/src/server.js",
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debug Logging

```javascript
// Add to any file for debugging
import { inspect } from 'node:util';

console.log('Debug:', inspect(obj, { depth: null, colors: true }));
```

### Database Debugging

```bash
# Enable query logging in PostgreSQL
# Edit postgresql.conf:
log_statement = 'all'
log_duration = on

# Restart PostgreSQL
```

### Network Debugging

```bash
# View all HTTP requests
DEBUG=express:* npm start

# View specific module
DEBUG=conductor:* npm start
```

## Environment-Specific Configuration

### Development (.env.development)

```env
NODE_ENV=development
PORT=8443
DEBUG=conductor:*
LOG_LEVEL=debug
```

### Testing (.env.test)

```env
NODE_ENV=test
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/conductor_test
BYPASS_AUTH=true
```

### Production (.env.production)

```env
NODE_ENV=production
PORT=8443
LOG_LEVEL=info
SESSION_SECRET=very-secure-random-string
REDIS_URL=redis://localhost:6379
```

## Performance Optimization

### Database Connection Pooling

```javascript
// src/db.js
export const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Wait 2s for connection
});
```

### Caching Strategies

```javascript
// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}
```

### Query Optimization

```sql
-- Use EXPLAIN ANALYZE to check query performance
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'test@ucsd.edu';

-- Add indexes for frequently queried columns
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

## Common Issues & Solutions

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :8443
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :8443
kill -9 <pid>
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
pg_ctl status

# Verify connection
psql -U postgres -c "SELECT 1"

# Check DATABASE_URL in .env
echo $env:DATABASE_URL  # Windows
echo $DATABASE_URL      # macOS/Linux
```

### Module Not Found

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### OAuth Errors

1. Verify Google OAuth credentials in `.env`
2. Check redirect URI matches in Google Console
3. Clear browser cookies and try again

## Best Practices

### Code Style

- Use ES6+ features (arrow functions, destructuring, async/await)
- Follow naming conventions from [Contributing Guide](../contributing/code-style.md)
- Write descriptive commit messages
- Keep functions small and focused
- Add JSDoc comments for public APIs

### Error Handling

```javascript
// Always use try-catch for async operations
try {
  const result = await someAsyncFunction();
  return result;
} catch (error) {
  console.error('Error in someAsyncFunction:', error);
  throw error; // Or handle appropriately
}
```

### Database Transactions

```javascript
// Use transactions for multi-step operations
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO table1 ...');
  await client.query('UPDATE table2 ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Security

- Never commit `.env` files
- Use parameterized queries (no string concatenation)
- Validate all user inputs
- Use HTTPS in production
- Keep dependencies updated

## Useful Commands

```bash
# View logs
tail -f logs/app.log

# Check Node.js version
node --version

# Check npm packages
npm list --depth=0

# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Generate documentation
npm run docs
```

## Next Steps

-  [API Reference](../backend/api-reference.md) - Explore available APIs
-  [Testing Guide](../testing/overview.md) - Write comprehensive tests
-  [Frontend Guide](../frontend/overview.md) - Build UI components
-  [RBAC System](../backend/rbac.md) - Implement permissions
-  [Contributing](../contributing/workflow.md) - Submit your first PR

---

**Happy Coding!**
