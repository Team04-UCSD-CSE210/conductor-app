# Technology Stack

Detailed analysis of all technologies used in the Conductor application.

## Overview

Conductor is built with a modern, production-ready technology stack prioritizing:
- **Simplicity**: Minimal dependencies, vanilla JavaScript
- **Performance**: Fast response times, efficient database queries
- **Reliability**: Type-safe database operations, comprehensive testing
- **Maintainability**: Clear code structure, well-documented APIs

## Backend Technologies

### Node.js 18 LTS

**Why Node.js?**
- Non-blocking I/O for handling concurrent requests
- JavaScript everywhere (frontend + backend)
- Rich ecosystem (npm)
- Long-term support (LTS) for stability

**Version**: 18.x (LTS)
**Key Features Used**:
- ES Modules (`import`/`export`)
- Async/await for promises
- Built-in fetch API
- Node.js crypto module

### Express.js 4.x

**Why Express?**
- Minimal, flexible web framework
- Large ecosystem of middleware
- Well-documented and battle-tested
- Easy to learn and use

**Version**: 4.21.2
**Middleware Stack**:
```javascript
- body-parser     # JSON/URL-encoded parsing
- cors           # Cross-origin requests  
- express-session # Session management
- multer         # File uploads
- passport       # Authentication
```

**Alternatives Considered**:
- Fastify (faster but less mature ecosystem)
- Koa (more modern but smaller community)
- NestJS (too opinionated for our use case)

### PostgreSQL 18

**Why PostgreSQL?**
- ACID compliance for data integrity
- Rich data types (JSONB, arrays, ENUMs)
- Full-text search capabilities
- Excellent performance
- Open source and free

**Version**: 18.0
**Features Used**:
- UUID primary keys (`gen_random_uuid()`)
- JSONB for flexible metadata
- ENUM types for type safety
- Triggers for automatic updates
- Partial indexes for performance
- Foreign keys with CASCADE

**Configuration**:
```javascript
// Connection pool
{
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // 30s idle timeout
  connectionTimeoutMillis: 2000, // 2s connect timeout
}
```

**Alternatives Considered**:
- MySQL (less feature-rich)
- MongoDB (no ACID guarantees)
- SQLite (not suitable for multi-user)

### node-postgres (pg)

**Why Raw SQL?**
- Full control over queries
- Better performance (no ORM overhead)
- Easier to optimize
- Type-safe with parameterized queries

**Version**: 8.16.3

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

**Alternatives Considered**:
- Sequelize (ORM - too heavy)
- Prisma (ORM - adds build step)
- TypeORM (requires TypeScript)

### Passport.js

**Why Passport?**
- De facto standard for Node.js auth
- Supports 500+ authentication strategies
- Session integration
- Well-maintained

**Version**: 0.7.0
**Strategy**: Google OAuth 2.0

**Configuration**:
```javascript
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  // Find or create user
  const user = await findOrCreateUser(profile);
  return done(null, user);
}));
```

### express-session

**Storage**:
- Development: MemoryStore (in-memory)
- Production: Redis (recommended)

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

**Semantic Markup**:
- `<header>`, `<nav>`, `<main>`, `<section>`
- Proper heading hierarchy (`<h1>`-`<h6>`)
- ARIA attributes for accessibility
- Valid W3C-compliant HTML

### CSS3

**Modern Features**:
- CSS Custom Properties (variables) for theming
- CSS Grid for layouts
- Flexbox for components
- CSS animations
- Media queries for responsive design

**Architecture**:
```
public/css/
├── global.css            # Base styles
├── dashboard-global.css  # Dashboard shared styles
├── student-dashboard.css # Role-specific styles
├── instructor-dashboard.css
└── ...
```

**Theming System**:
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

### Vanilla JavaScript (ES6+)

**Why No Framework?**
- Faster page loads (no framework overhead)
- No build step required
- Direct DOM manipulation
- Easier to debug
- Smaller bundle size

**Modern Features Used**:
- ES Modules (`import`/`export`)
- Arrow functions
- Async/await
- Destructuring
- Template literals
- `fetch` API
- Spread operator

**Code Organization**:
```javascript
// Service pattern
const DashboardService = {
  async getActiveOffering() { /* ... */ },
  async getTeams(offeringId) { /* ... */ },
  async getAnnouncements() { /* ... */ }
};

// Module pattern
(function() {
  'use strict';
  // Private variables
  let offeringId = null;
  
  // Public init
  function init() { /* ... */ }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

## Testing Technologies

### Vitest

**Why Vitest?**
- Vite-powered (fast)
- ESM support
- Watch mode
- Coverage reports
- Compatible with Jest API

**Version**: 4.0.7

**Features Used**:
- Unit testing
- Mocking
- Code coverage (c8)
- Snapshot testing

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

**Why Playwright?**
- Cross-browser testing (Chromium, Firefox, WebKit)
- Auto-wait for elements
- Screenshot/video capture
- Network interception
- Mobile emulation

**Version**: 1.40.0

**Browsers Supported**:
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

**Why Autocannon?**
- Fast HTTP/1.1 benchmarking
- Written in Node.js
- Programmable
- Detailed statistics

**Usage**:
```javascript
autocannon({
  url: 'http://localhost:8443/api/users',
  connections: 150,
  duration: 30,
  method: 'GET'
});
```

## DevOps Technologies

### Docker

**Why Docker?**
- Consistent environments
- Easy deployment
- Isolation
- Portability

**Multi-stage Build**:
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

**CI/CD Pipeline**:
- Lint on every PR
- Run tests on every PR
- Build Docker images for all branches
- Deploy to Render on main branch

**Workflow Files**:
- `.github/workflows/ci.yml` - Continuous Integration
- `.github/workflows/cd.yml` - Continuous Deployment

### Render

**Why Render?**
- Free tier for hobby projects
- Automatic HTTPS
- Easy PostgreSQL addon
- Zero-downtime deployments
- Health checks

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

### AWS (Infrastructure)

**Services Used**:
- **ECS** (Elastic Container Service)
- **ECR** (Elastic Container Registry)
- **CloudFormation** (Infrastructure as Code)

## Observability Technologies

### OpenTelemetry

**Why OpenTelemetry?**
- Vendor-neutral standard
- Auto-instrumentation
- Metrics + traces + logs
- Future-proof

**Instrumented**:
- HTTP requests (Express)
- Database queries (PostgreSQL)
- External API calls

**Custom Metrics**:
```javascript
const httpCounter = meter.createCounter('http.requests');
const dbHistogram = meter.createHistogram('db.query.duration');
const activeGauge = meter.createUpDownCounter('active.sessions');
```

### SigNoz

**Why SigNoz?**
- Open source
- All-in-one (metrics + traces + logs)
- Easy self-hosting
- Beautiful dashboards
- OpenTelemetry native

**Features**:
- Real-time metrics
- Distributed tracing
- Custom dashboards
- Alerts (future)

## Development Tools

### ESLint

**Configuration**: Based on `@eslint/js` recommended

**Rules**:
- No unused variables
- Consistent code style
- Best practices enforcement

### Stylelint

**Configuration**: `stylelint-config-standard`

**Rules**:
- Property order
- Color format consistency
- No vendor prefixes (use autoprefixer)

### HTMLHint

**Rules**:
- Valid HTML5
- Alt text for images
- Proper tag closure

### Markdownlint

**Rules**:
- Consistent heading levels
- No trailing spaces
- Proper link formatting

### Commitlint

**Convention**: Conventional Commits

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

## Dependency Management

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

## Security Stack

- **OAuth 2.0** - Industry standard authentication
- **HTTPS** - Encrypted communication
- **Parameterized queries** - SQL injection prevention
- **HttpOnly cookies** - XSS mitigation
- **CORS** - Cross-origin protection
- **Helmet.js** (future) - Security headers

## Future Additions

### Planned
- TypeScript migration
- Redis caching layer
- WebSocket for real-time updates
- CDN for static assets
- Rate limiting middleware
- GraphQL API (optional)

### Under Consideration
- Server-side rendering framework (Next.js)
- Frontend framework (React/Vue)
- Mobile app (React Native)
- Microservices architecture

---

**See Also:**
- [Architecture Overview](overview.md)
- [Database Schema](../database/schema.md)
- [API Reference](../backend/api-reference.md)
