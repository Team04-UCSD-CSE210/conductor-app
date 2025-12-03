# Testing Documentation - Conductor App

**Team**: Team04-UCSD-CSE210  
**Branch**: `sprint4/diagnostics`  
**Last Updated**: December 3, 2025

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Load Testing](#load-testing)
4. [E2E Testing](#e2e-testing)
5. [Test Results](#test-results)
6. [CI/CD Integration](#cicd-integration)

---

## Quick Start

### Prerequisites

```bash
npm install
npx playwright install chromium
```

### Running Tests

```powershell
# 1) Start PostgreSQL
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" start

# 2) Start the server
$env:BYPASS_AUTH = "true"; $env:PORT = "8443"; npm run start

# 3) In a new terminal, run tests
$env:BASE_URL = "http://localhost:8443"
npm run test:load              # Load tests
npm run test:e2e:chromium      # E2E tests (Chromium)
npm run lint                   # Linting
```

---

## Overview

This testing infrastructure demonstrates comprehensive quality assurance for the Conductor application:

- **Load Testing**: Validates performance with 150+ concurrent users
- **E2E Testing**: Automates 46 tests covering complete user workflows
- **CI/CD Integration**: Automated testing on every commit via GitHub Actions

### Technologies Used

| Tool | Purpose |
|------|---------|
| **Autocannon** | HTTP load testing and benchmarking |
| **Playwright** | Browser automation for E2E tests |
| **Vitest** | Unit testing framework |
| **PostgreSQL** | Database (168 seeded users) |

---

## Load Testing

### Purpose

Simulates real-world traffic with 150+ concurrent users to verify:

- Response time under load
- System stability  
- Throughput capacity
- Error rates

### Test Scenarios

#### Test 1: User List API - Student Load

- **Endpoint**: `GET /api/users?limit=50&offset=0`
- **Connections**: 150 concurrent students
- **Duration**: 30 seconds
- **Purpose**: Simulate students accessing roster data

#### Test 2: Dashboard - Realistic Load

- **Endpoint**: `GET /dashboard.html`
- **Connections**: 90 concurrent users (60% of typical peak)
- **Duration**: 30 seconds
- **Purpose**: Simulate typical dashboard access

#### Test 3: Spike Test - Sudden High Load

- **Endpoint**: `GET /api/users`
- **Connections**: 200 concurrent users
- **Duration**: 15 seconds
- **Purpose**: Test system resilience during traffic spikes

### Running Load Tests

```bash
# Set server URL
export BASE_URL=http://localhost:8443  # Unix/Mac
$env:BASE_URL = "http://localhost:8443"  # Windows PowerShell

# Run load tests
npm run test:load

# Custom configuration
DURATION=60 STUDENT_COUNT=200 npm run test:load
```

---

## E2E Testing

### Test Suites

1. **Authentication Tests** (`e2e/auth.spec.js`)
   - Login page rendering
   - OAuth flow (Google)
   - Session persistence
   - Logout functionality

2. **Dashboard Tests** (`e2e/dashboard.spec.js`)
   - Navigation verification
   - Role-based rendering
   - Data loading
   - Interactive elements

3. **Professor Workflow** (`e2e/professor-workflow.spec.js`)
   - Attendance management
   - Roster management
   - Student interactions
   - Report generation

4. **Student Workflow** (`e2e/student-workflow.spec.js`)
   - Course enrollment
   - Assignment submission
   - Journal entries
   - Team interactions

5. **API Tests** (`e2e/api.spec.js`)
   - RESTful endpoint validation
   - Error handling
   - Response formats
   - Concurrent request handling

### Running E2E Tests

```bash
# All browsers
npm run test:e2e

# Chromium only (faster)
npm run test:e2e:chromium

# With UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

---

## Test Results

### Load Testing Results ✅

**Test Date**: December 1-3, 2025  
**Database**: PostgreSQL with 168 users  
**Success Rate**: **100%**

#### Test 1: User List API

- **Requests**: 31,277 total
- **Req/sec**: 1,042.57
- **Success Rate**: 100% ✅
- **Latency**: 143ms avg (P50: 142ms, P95: 178ms)
- **Throughput**: 28.11 MB/s

#### Test 2: Dashboard Load

- **Requests**: 209,230 total
- **Req/sec**: 6,974.94
- **Success Rate**: 100% ✅
- **Latency**: 12.41ms avg (P50: 12ms, P95: 16ms)
- **Throughput**: 46.17 MB/s

#### Test 3: Spike Test

- **Requests**: 13,771 total
- **Req/sec**: 918.07
- **Success Rate**: 100% ✅
- **Latency**: 216.56ms avg (P50: 214ms, P95: 244ms)
- **Throughput**: 24.75 MB/s

**Total**: 274,691 requests processed with 0 errors

### E2E Testing Results ✅

**Test Date**: December 1-3, 2025  
**Browser**: Chromium  
**Tests**: 46/46 passed

| Test Suite | Tests | Status |
|------------|-------|--------|
| Authentication | 8 | ✅ All passed |
| Dashboard | 10 | ✅ All passed |
| Professor Workflow | 12 | ✅ All passed |
| Student Workflow | 11 | ✅ All passed |
| API Tests | 5 | ✅ All passed |

**Total Duration**: ~7.9 seconds

### Key Achievements

✅ **Server handles 150+ concurrent students** with 100% success  
✅ **Dashboard supports 90 concurrent users** flawlessly  
✅ **Spike test with 200 users** - no crashes  
✅ **All 46 E2E tests pass** consistently  
✅ **Zero errors** across 274,691 requests  
✅ **Average latency** under 220ms for all scenarios  

---

## CI/CD Integration

### GitHub Actions Workflow

The testing suite runs automatically on every push and pull request via `.github/workflows/testing.yml`:

#### Jobs

1. **Unit Tests**
   - Runs Vitest with coverage reporting
   - Uploads coverage artifacts
   - Requires PostgreSQL service

2. **E2E Tests**
   - Installs Playwright browsers
   - Runs Chromium tests
   - Uploads test reports (on failure)
   - Requires PostgreSQL service

3. **Load Tests**
   - Simulates production load
   - Validates performance metrics
   - Uploads test summaries
   - Requires PostgreSQL service

4. **Test Summary**
   - Aggregates results from all jobs
   - Posts summary to GitHub

### Environment Variables

```yaml
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/conductor_test
NODE_ENV: test
PORT: 3000
SESSION_SECRET: test-secret-key-for-ci
GOOGLE_CLIENT_ID: fake-client-id
GOOGLE_CLIENT_SECRET: fake-client-secret
```

### Badge Status

![Testing Suite](https://github.com/Team04-UCSD-CSE210/conductor-app/actions/workflows/testing.yml/badge.svg)

---

## Maintenance

### Adding New Load Tests

Edit `scripts/load-test.js` and add to the results array:

```javascript
const results = [
  // Existing tests...
  
  // New test
  await runLoadTest('Test 4: My New Test', {
    url: `${BASE_URL}/my-endpoint`,
    connections: 100,
    duration: 30,
    method: 'GET',
  })
];
```

### Adding New E2E Tests

Create a new spec file in `e2e/` or add to existing:

```javascript
test('my new test', async ({ page }) => {
  await page.goto('/my-page');
  await expect(page.locator('h1')).toContainText('Expected Text');
});
```

### Updating CI Configuration

Edit `.github/workflows/testing.yml` to modify:

- Node.js version
- Database configuration
- Test timeouts
- Environment variables

---

## Troubleshooting

### Common Issues

**PostgreSQL Connection Failed**

```bash
# Ensure PostgreSQL is running
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" start

# Check connection
psql -U postgres -c "SELECT 1"
```

**Server Won't Start**

```bash
# Check if port is already in use
netstat -ano | findstr :8443

# Kill existing process if needed
taskkill /PID <process_id> /F
```

**E2E Tests Timeout**

```bash
# Increase timeout in playwright.config.js
timeout: 60000  // 60 seconds
```

**Load Tests Fail**

```bash
# Ensure server is running and accessible
curl http://localhost:8443/api/health

# Check BASE_URL is set correctly
echo $env:BASE_URL
```

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Autocannon Documentation](https://github.com/mcollina/autocannon)
- [Vitest Documentation](https://vitest.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**For questions or issues**, please create an issue in the repository or contact the team.
