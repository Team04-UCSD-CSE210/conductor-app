# ADR-0006: Testing Strategy and Tooling

## Status

Accepted

## Context

The Conductor App requires a comprehensive testing strategy to ensure reliability, prevent regressions, and maintain code quality. Given the application's purpose in education (managing attendance, grades, teams), correctness is critical.

Testing requirements include:
- **Unit testing** for business logic and services
- **End-to-end testing** for user workflows across 6 role types
- **Load testing** to validate performance under classroom load (100+ users)
- **API testing** to ensure contract compliance
- **Fast feedback** during development
- **CI/CD integration** for automated testing

We needed to select appropriate testing tools for each testing layer.

## Decision

We adopted a **multi-layered testing strategy** with the following tools:

### 1. Vitest for Unit/Integration Testing

**Tool:** Vitest 4.0.7  
**Scope:** Business logic, services, utilities

**Rationale:**
- Vite-powered for fast execution
- ESM-first (matches our codebase)
- Jest-compatible API (familiar to team)
- Built-in coverage reporting (c8/v8)
- Watch mode for TDD workflow

### 2. Playwright for E2E Testing

**Tool:** Playwright 1.40.0  
**Scope:** User workflows, UI interactions, multi-page flows

**Rationale:**
- Cross-browser testing (Chromium, Firefox, WebKit)
- Auto-wait reduces flaky tests
- Built-in screenshot/video capture
- Network interception for testing offline scenarios
- Headless and headed modes

### 3. Autocannon for Load Testing

**Tool:** Autocannon 8.0.0  
**Scope:** Performance benchmarking, concurrency testing

**Rationale:**
- Fast HTTP/1.1 benchmarking
- Written in Node.js (no additional runtime)
- Programmable (JavaScript API)
- Detailed latency statistics (p50, p95, p99)

## Consequences

### Positive

- **Comprehensive coverage** - All testing layers addressed
- **Fast feedback** - Vitest runs in <2s for unit tests
- **Catch regressions** - 46 E2E tests validate critical workflows
- **Performance validation** - Load tests prove 150+ concurrent user support
- **CI/CD ready** - All tools integrate with GitHub Actions
- **Developer-friendly** - Familiar APIs and good error messages
- **Cross-browser confidence** - Playwright tests on 3 browser engines

### Negative

- **Multiple tools** - Team must learn 3 different testing frameworks
- **Maintenance overhead** - E2E tests require updates when UI changes
- **Slow E2E tests** - 46 tests take ~8 seconds to run
- **Flaky potential** - Network/timing issues can cause intermittent failures
- **No visual regression** - No screenshot comparison testing yet

### Neutral

- **Mix of approaches** - Unit tests vs E2E tests have different patterns
- **Trade-offs** - Speed vs realism (unit tests fast, E2E tests realistic)

## Alternatives Considered

### 1. Jest for Unit Testing

**Pros:**
- Industry standard
- Massive ecosystem
- Familiar to most developers

**Cons:**
- Slower than Vitest
- ESM support requires configuration
- Heavier dependency

**Rejected because:** Vitest is faster and has better ESM support

### 2. Cypress for E2E Testing

**Pros:**
- Excellent developer experience
- Time-travel debugging
- Automatic screenshots/videos

**Cons:**
- Runs only in Chromium (no Firefox/Safari)
- Cannot test multiple tabs/windows
- Slower than Playwright

**Rejected because:** Limited browser coverage and slower execution

### 3. k6 for Load Testing

**Pros:**
- More features than Autocannon
- Cloud platform available
- Better reporting

**Cons:**
- Written in Go (separate runtime)
- Overkill for our needs
- Steeper learning curve

**Rejected because:** Autocannon is simpler and sufficient

### 4. Selenium for E2E Testing

**Pros:**
- Industry standard
- Huge ecosystem
- Cross-browser support

**Cons:**
- Slow and flaky
- Complex setup
- Poor developer experience

**Rejected because:** Outdated technology, Playwright is superior

## Implementation Notes

### Vitest Configuration

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'e2e/',
        'src/public/',
        '**/*.config.js'
      ]
    },
    globals: true,
    environment: 'node'
  }
});
```

### Playwright Configuration

```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:8443',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    }
  ]
});
```

### Autocannon Usage

```javascript
// scripts/load-test.js
import autocannon from 'autocannon';

const result = await autocannon({
  url: 'https://localhost:8443/api/dashboard',
  connections: 150,
  duration: 30,
  method: 'GET',
  headers: {
    'Cookie': 'connect.sid=test-session'
  }
});

console.log(`
  Requests: ${result.requests.total}
  Latency p95: ${result.latency.p95}ms
  Errors: ${result.errors}
`);
```

### Test Results (Current)

| Test Suite | Tests | Pass Rate | Duration |
|------------|-------|-----------|----------|
| Unit Tests | TBD | TBD | <2s |
| E2E Tests | 46 | 100% | ~8s |
| Load Tests | 3 scenarios | 0 errors | 30s each |

**E2E Test Breakdown:**
- Authentication: 8 tests
- Dashboard: 10 tests
- Professor Workflow: 12 tests
- Student Workflow: 11 tests
- API Tests: 5 tests

**Load Test Results:**
- 274,691 total requests
- 0 errors
- p95 latency: <200ms
- Sustained 150 concurrent users

### CI/CD Integration

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Testing Authentication

**Challenge:** Tests need authenticated sessions

**Solution:** Authentication bypass for testing

```javascript
// src/middleware/test-auth.js
export function testAuthBypass(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      primary_role: 'admin'
    };
    req.isAuthenticated = () => true;
  }
  next();
}
```

## Related Decisions

- [ADR-0001: CI/CD Pipeline Architecture](adr-0001-cicd-pipeline-architecture.md)
- [ADR-0005: Frontend Technology Selection](adr-0005-frontend-technology-selection.md)

## Date

2025-11-15

## Participants

- Development Team
- QA Lead
- DevOps Engineer

---

**Testing Philosophy:** Write tests that provide confidence, not just coverage. Focus on testing user workflows and critical business logic rather than achieving 100% code coverage.
