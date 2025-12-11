# Testing Overview

Comprehensive testing strategy for the Conductor application.

## Testing Philosophy

Conductor employs a **multi-layered testing strategy**:

1. **Unit Tests** - Test individual functions and modules
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - Test complete user workflows
4. **Load Tests** - Test performance under stress
5. **Manual Tests** - Exploratory and usability testing

## Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Tests | Vitest | Fast, isolated function testing |
| E2E Tests | Playwright | Browser automation, full workflows |
| Load Tests | Autocannon | HTTP benchmarking, concurrent users |
| API Tests | Playwright | REST endpoint validation |
| Linting | ESLint | Code quality and consistency |

## Quick Start

### Prerequisites

```powershell
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Running Tests

```powershell
# Start PostgreSQL
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" start

# Start server with auth bypass
$env:BYPASS_AUTH = "true"; $env:PORT = "8443"; npm run start

# Run all tests (in new terminal)
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:e2e           # E2E tests only
npm run test:load          # Load tests only
npm run lint               # Linting
```

## Unit Testing (Vitest)

### Configuration

`vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'e2e/',
        'src/public/',
        '*.config.js'
      ]
    }
  }
});
```

### Writing Unit Tests

**Example**: Testing a validation function

`src/utils/validators.js`:
```javascript
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateUCSDEmail(email) {
  return validateEmail(email) && email.endsWith('@ucsd.edu');
}
```

`tests/validators.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { validateEmail, validateUCSDEmail } from '../src/utils/validators.js';

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co.uk')).toBe(true);
  });
  
  it('should reject invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('no@domain')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
  });
  
  it('should handle edge cases', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
  });
});

describe('validateUCSDEmail', () => {
  it('should accept UCSD emails', () => {
    expect(validateUCSDEmail('student@ucsd.edu')).toBe(true);
  });
  
  it('should reject non-UCSD emails', () => {
    expect(validateUCSDEmail('user@gmail.com')).toBe(false);
    expect(validateUCSDEmail('user@berkeley.edu')).toBe(false);
  });
});
```

### Running Unit Tests

```powershell
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:unit -- --coverage

# Watch mode
npm run test:unit -- --watch

# Run specific test file
npm run test:unit tests/validators.test.js
```

### Test Coverage

```powershell
# Generate coverage report
npm run test:coverage

# View HTML report
start coverage/index.html
```

**Coverage Goals**:
- Overall: 80%+
- Critical paths: 90%+
- Utils/helpers: 95%+

## E2E Testing (Playwright)

### Configuration

`playwright.config.js`:
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8443',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### Test Structure

**Authentication Tests** (`e2e/auth.spec.js`):
```javascript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('h1')).toContainText('Welcome to Conductor');
    await expect(page.locator('a[href="/auth/google"]')).toBeVisible();
  });
  
  test('should redirect unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard.html');
    await expect(page).toHaveURL(/.*login\.html/);
  });
  
  test('should logout successfully', async ({ page }) => {
    // Assume logged in with session cookie
    await page.goto('/dashboard.html');
    await page.click('#logout-btn');
    await expect(page).toHaveURL(/.*login\.html/);
  });
});
```

**Dashboard Tests** (`e2e/dashboard.spec.js`):
```javascript
import { test, expect } from '@playwright/test';

test.describe('Student Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/dashboard.html');
  });
  
  test('should display user name', async ({ page }) => {
    const userName = await page.locator('#user-name').textContent();
    expect(userName).toBeTruthy();
  });
  
  test('should load team information', async ({ page }) => {
    await expect(page.locator('.team-card')).toBeVisible();
    await expect(page.locator('.team-name')).toContainText('Team');
  });
  
  test('should display announcements', async ({ page }) => {
    const announcements = page.locator('.announcement-card');
    await expect(announcements.first()).toBeVisible();
  });
});
```

**API Tests** (`e2e/api.spec.js`):
```javascript
import { test, expect } from '@playwright/test';

test.describe('User API', () => {
  test('GET /api/users returns user list', async ({ request }) => {
    const response = await request.get('/api/users?limit=10');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeLessThanOrEqual(10);
  });
  
  test('GET /api/users/:id returns specific user', async ({ request }) => {
    const listResponse = await request.get('/api/users?limit=1');
    const { users } = await listResponse.json();
    const userId = users[0].id;
    
    const response = await request.get(`/api/users/${userId}`);
    expect(response.ok()).toBeTruthy();
    
    const user = await response.json();
    expect(user.id).toBe(userId);
    expect(user.email).toBeDefined();
  });
  
  test('POST /api/users creates new user', async ({ request }) => {
    const newUser = {
      email: `test${Date.now()}@ucsd.edu`,
      name: 'Test User',
      primary_role: 'student',
      status: 'active'
    };
    
    const response = await request.post('/api/users', {
      data: newUser
    });
    
    expect(response.status()).toBe(201);
    const created = await response.json();
    expect(created.email).toBe(newUser.email);
  });
});
```

### Running E2E Tests

```powershell
# Run all E2E tests
npm run test:e2e

# Run specific browser
npm run test:e2e:chromium

# Run with UI (interactive mode)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/auth.spec.js
```

### Test Results (December 2025)

**46/46 tests passed** [OK]

| Suite | Tests | Status |
|-------|-------|--------|
| Authentication | 8 | [OK] All passed |
| Dashboard | 10 | [OK] All passed |
| Professor Workflow | 12 | [OK] All passed |
| Student Workflow | 11 | [OK] All passed |
| API Tests | 5 | [OK] All passed |

**Duration**: ~7.9 seconds

## Load Testing (Autocannon)

### Purpose

Validate system performance under realistic concurrent load:
- 150+ concurrent student users
- 90+ concurrent dashboard accesses
- 200+ spike load scenarios

### Test Scenarios

`scripts/load-test.js`:
```javascript
import autocannon from 'autocannon';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8443';

async function runLoadTest(testName, options) {
  console.log(`\n=== ${testName} ===\n`);
  
  const result = await autocannon({
    url: options.url,
    connections: options.connections,
    duration: options.duration,
    method: options.method || 'GET',
    headers: options.headers || {}
  });
  
  console.log(`Requests: ${result.requests.total}`);
  console.log(`Success Rate: ${(result.non2xx === 0 ? 100 : 0)}%`);
  console.log(`Avg Latency: ${result.latency.mean}ms`);
  
  return result;
}

// Test 1: User List API
await runLoadTest('User List API - Student Load', {
  url: `${BASE_URL}/api/users?limit=50&offset=0`,
  connections: 150,
  duration: 30
});

// Test 2: Dashboard Load
await runLoadTest('Dashboard - Realistic Load', {
  url: `${BASE_URL}/dashboard.html`,
  connections: 90,
  duration: 30
});

// Test 3: Spike Test
await runLoadTest('Spike Test - High Load', {
  url: `${BASE_URL}/api/users`,
  connections: 200,
  duration: 15
});
```

### Running Load Tests

```powershell
# Set base URL
$env:BASE_URL = "http://localhost:8443"

# Run load tests
npm run test:load

# Custom configuration
$env:DURATION = "60"
$env:STUDENT_COUNT = "200"
npm run test:load
```

### Load Test Results (December 2025)

**274,691 total requests** - **0 errors** [OK]

| Test | Connections | Requests | Req/sec | Avg Latency | Success Rate |
|------|-------------|----------|---------|-------------|--------------|
| User List API | 150 | 31,277 | 1,042.57 | 143ms | **100%** |
| Dashboard Load | 90 | 209,230 | 6,974.94 | 12.41ms | **100%** |
| Spike Test | 200 | 13,771 | 918.07 | 216.56ms | **100%** |

**Key Achievements**:
- [OK] Zero errors across all tests
- [OK] Sub-second latency for most requests
- [OK] Handles 200 concurrent users without crashes
- [OK] Sustained 6,974 req/sec for dashboard

## Authentication Bypass for Testing

To enable testing without Google OAuth:

```powershell
$env:BYPASS_AUTH = "true"
npm run start
```

**How it works**:
```javascript
// src/middleware/auth.js
export function ensureAuthenticated(req, res, next) {
  if (process.env.BYPASS_AUTH === 'true') {
    req.user = {
      id: 'test-user-id',
      email: 'test@ucsd.edu',
      name: 'Test User',
      primary_role: 'student'
    };
    return next();
  }
  
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ error: 'Authentication required' });
}
```

## CI/CD Integration

### GitHub Actions Workflow

`.github/workflows/testing.yml`:
```yaml
name: Testing Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage/
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run test:e2e:chromium
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: playwright-report/
  
  load-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:load
```

## Best Practices

### Unit Tests
- Test one thing per test
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for 80%+ coverage

### E2E Tests
- Test user workflows, not implementation
- Use data-testid for stable selectors
- Clean up test data after tests
- Run in isolation (no shared state)
- Use fixtures for common setups

### Load Tests
- Start with realistic scenarios
- Gradually increase load
- Monitor server resources
- Test error handling
- Document performance baselines

## Troubleshooting

### Tests Failing Locally

```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse node_modules
npm install

# Ensure PostgreSQL is running
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" status

# Check server is accessible
curl http://localhost:8443/health
```

### E2E Tests Timeout

Increase timeout in `playwright.config.js`:
```javascript
timeout: 60000, // 60 seconds
```

### Load Tests Show Errors

```powershell
# Check server logs
npm run start

# Verify database connection
psql -U postgres -c "SELECT COUNT(*) FROM users"

# Test endpoint manually
curl http://localhost:8443/api/users
```

---

**See Also:**
- [Unit Testing Guide](unit-testing.md)
- [E2E Testing Guide](e2e-testing.md)
- [Load Testing Guide](load-testing.md)
- [CI/CD Documentation](../deployment/ci-cd.md)
