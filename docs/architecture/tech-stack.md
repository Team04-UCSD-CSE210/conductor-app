# Technology Stack

Quick reference for all technologies used in the Conductor application.

> **Note:** For detailed decision rationale, see the [Architecture Decision Records (ADRs)](../adrs/).

## Overview

Conductor is built with a modern, production-ready technology stack prioritizing:
- **Simplicity**: Minimal dependencies, vanilla JavaScript
- **Performance**: Fast response times, efficient database queries
- **Reliability**: Type-safe database operations, comprehensive testing
- **Maintainability**: Clear code structure, well-documented APIs

## Core Technologies

| Component | Technology | Version | ADR |
|-----------|-----------|---------|-----|
| **Runtime** | Node.js LTS | 18.x | - |
| **Server** | Express.js | 4.21.2 | [ADR-0004](../adrs/adr-0004-server-selection.md) |
| **Database** | PostgreSQL | 18.0 | [ADR-0002](../adrs/adr-0002-database-selection.md) |
| **DB Client** | node-postgres (pg) | 8.16.3 | [ADR-0002](../adrs/adr-0002-database-selection.md) |
| **Authentication** | Passport.js (Google OAuth) | 0.7.0 | [ADR-0003](../adrs/adr-0003-authentication-selection.md) |
| **Session Store** | express-session | 1.18.2 | [ADR-0003](../adrs/adr-0003-authentication-selection.md) |
| **Frontend** | Vanilla JavaScript (ES6+) | Native | [ADR-0005](../adrs/adr-0005-frontend-technology-selection.md) |
| **Styling** | CSS3 + Custom Properties | Native | [ADR-0005](../adrs/adr-0005-frontend-technology-selection.md) |
| **Testing (Unit)** | Vitest | 4.0.7 | [ADR-0006](../adrs/adr-0006-testing-strategy.md) |
| **Testing (E2E)** | Playwright | 1.40.0 | [ADR-0006](../adrs/adr-0006-testing-strategy.md) |
| **Testing (Load)** | Autocannon | 8.0.0 | [ADR-0006](../adrs/adr-0006-testing-strategy.md) |
| **Observability** | OpenTelemetry + SigNoz | 0.208.0 | [ADR-0007](../adrs/adr-0007-observability-stack.md) |
| **CI/CD** | GitHub Actions | - | [ADR-0001](../adrs/adr-0001-cicd-pipeline-architecture.md) |
| **Hosting** | Render | - | - |
| **Containers** | Docker | - | - |

## Backend Technologies

### Node.js 18 LTS

**Key Features Used**:
- ES Modules (`import`/`export`)
- Async/await for promises
- Built-in fetch API
- Node.js crypto module

### Express.js

**Middleware Stack**:
- `body-parser` - JSON/URL-encoded parsing
- `cors` - Cross-origin requests  
- `express-session` - Session management
- `multer` - File uploads
- `passport` - Authentication

See [ADR-0004](../adrs/adr-0004-server-selection.md) for selection rationale.

### PostgreSQL

**Features Used**:
- UUID primary keys (`gen_random_uuid()`)
- JSONB for flexible metadata
- ENUM types for type safety
- Triggers for automatic updates
- Partial indexes for performance
- Foreign keys with CASCADE

**Connection Pool Configuration**:
```javascript
{
  max: 20,                      // Max connections
  idleTimeoutMillis: 30000,     // 30s idle timeout
  connectionTimeoutMillis: 2000 // 2s connect timeout
}
```

See [ADR-0002](../adrs/adr-0002-database-selection.md) for database selection rationale.

### node-postgres (pg)

**Why Raw SQL:** Full control over queries, better performance, easier optimization

**Example Usage**:
```javascript
// Parameterized query (SQL injection safe)
const result = await pool.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Transaction support
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users ...');
  await client.query('INSERT INTO enrollments ...');
  await client.query('COMMIT');
} finally {
  client.release();
}
```

### Passport.js

**Strategy**: Google OAuth 2.0

**Configuration Example**:
```javascript
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  const user = await findOrCreateUser(profile);
  return done(null, user);
}));
```

See [ADR-0003](../adrs/adr-0003-authentication-selection.md) for authentication strategy.

### express-session

**Configuration**:
```javascript
{
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}
```

## Frontend Technologies

### HTML5

**Semantic Elements Used**:
- `<header>`, `<nav>`, `<main>`, `<section>`
- Proper heading hierarchy (`<h1>`-`<h6>`)
- ARIA attributes for accessibility
- Valid W3C-compliant markup

### CSS3

**Architecture**:
```
public/css/
├── global.css            # Base styles
├── dashboard-global.css  # Dashboard shared styles
├── student-dashboard.css # Role-specific styles
├── instructor-dashboard.css
└── ...
```

**CSS Custom Properties (Theming)**:
```css
:root {
  --palette-primary: #0F766E;
  --palette-secondary: #0891B2;
  --palette-accent: #14B8A6;
  --palette-background: #F0FDFA;
  --gray-50: #f9fafb;
  --gray-900: #111827;
}
```

**Modern Features Used**:
- CSS Custom Properties (variables)
- CSS Grid for layouts
- Flexbox for components
- CSS animations
- Media queries for responsive design

### Vanilla JavaScript (ES6+)

**Modern Features Used**:
- ES Modules (`import`/`export`)
- Arrow functions
- Async/await
- Destructuring
- Template literals
- Fetch API
- Spread operator

**Code Organization Pattern**:
```javascript
// Module pattern for page scripts
(function() {
  'use strict';
  let offeringId = null;
  
  async function init() {
    // Initialize page
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Service pattern for API calls
const DashboardService = {
  async getActiveOffering() { /* ... */ },
  async getTeams(offeringId) { /* ... */ }
};
```

See [ADR-0005](../adrs/adr-0005-frontend-technology-selection.md) for frontend technology rationale.

## Testing Technologies

### Vitest

**Configuration**:
```javascript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: ['node_modules/', 'e2e/']
    }
  }
});
```

### Playwright

**Browsers Tested**:
- Chromium (Chrome, Edge)
- Firefox
- WebKit (Safari)

**Example Test**:
```javascript
test('student can check in to session', async ({ page }) => {
  await page.goto('/dashboard.html');
  await page.fill('#access-code', 'TEST123');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success-message'))
    .toContainText('Checked in successfully');
});
```

### Autocannon

**Example Usage**:
```javascript
autocannon({
  url: 'http://localhost:8443/api/users',
  connections: 150,
  duration: 30,
  method: 'GET'
});
```

See [ADR-0006](../adrs/adr-0006-testing-strategy.md) for testing strategy and tooling decisions.

## DevOps Technologies

### Docker

**Multi-stage Build Example**:
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 8443
CMD ["node", "src/server.js"]
```

### GitHub Actions

**Pipeline Stages**:
- Lint on every PR
- Run tests on every PR
- Build Docker images
- Deploy to production

See [ADR-0001](../adrs/adr-0001-cicd-pipeline-architecture.md) for CI/CD architecture.

### Render

**Configuration** (`render.yaml`):
```yaml
services:
  - type: web
    name: conductor-app
    env: node
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
```

## Observability Technologies

### OpenTelemetry

**Auto-instrumentation Enabled**:
- HTTP requests (Express)
- Database queries (PostgreSQL)
- File system operations

**Custom Metrics**:
```javascript
const httpCounter = meter.createCounter('http.requests');
const dbHistogram = meter.createHistogram('db.query.duration');
const activeGauge = meter.createUpDownCounter('active.sessions');
```

### SigNoz

**Features**:
- Real-time metrics dashboard
- Distributed tracing
- Custom dashboards
- Performance monitoring

See [Monitoring Guide](../deployment/monitoring.md) for setup and usage.

## Development Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **ESLint** | JavaScript linting | `@eslint/js` recommended |
| **Stylelint** | CSS linting | `stylelint-config-standard` |
| **HTMLHint** | HTML validation | Default rules |
| **Markdownlint** | Markdown linting | Default rules |
| **Commitlint** | Commit message validation | Conventional Commits |

### Conventional Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

## Dependencies

### Production Dependencies

```json
{
  "express": "^4.21.2",
  "pg": "^8.16.3",
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "express-session": "^1.18.2",
  "body-parser": "^1.20.3",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "validator": "^13.15.20",
  "multer": "^1.4.5-lts.1",
  "@opentelemetry/sdk-node": "^0.208.0"
}
```

### Development Dependencies

```json
{
  "vitest": "^4.0.7",
  "@playwright/test": "^1.40.0",
  "eslint": "^9.39.1",
  "stylelint": "^16.0.0",
  "htmlhint": "^1.1.4",
  "markdownlint-cli": "^0.46.0",
  "autocannon": "^8.0.0"
}
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Server startup | ~2s | Includes DB connection |
| Average API response | 50-200ms | Simple queries |
| Page load time | <2s | Without cache |
| Concurrent users | 150+ | Load tested |
| Database query time | 10-50ms | Indexed queries |
| Memory usage | 150-300MB | Running server |
| E2E test suite | ~8s | 46 tests |
| Load test throughput | 6,974 req/sec | Dashboard endpoint |

## Security Stack

- **OAuth 2.0** - Industry standard authentication
- **HTTPS** - Encrypted communication (production)
- **Parameterized queries** - SQL injection prevention
- **HttpOnly cookies** - XSS mitigation
- **CORS** - Cross-origin protection
- **Session secrets** - Cryptographically secure
- **Audit logging** - Authentication events tracked

## Future Considerations

### Planned
- Redis session store (production)
- Rate limiting middleware
- Database connection pooling optimization
- CDN for static assets

### Under Evaluation
- TypeScript migration
- WebSocket for real-time updates
- GraphQL API (optional)
- Server-side rendering framework

---

## Related Documentation

- [Architecture Decision Records (ADRs)](../adrs/) - Detailed technology decisions
- [Architecture Overview](overview.md) - System architecture
- [Database Schema](../database/schema.md) - Database structure
- [API Reference](../backend/api-reference.md) - API endpoints
- [Monitoring Guide](../deployment/monitoring.md) - Observability setup

---

**Last Updated**: December 2025
