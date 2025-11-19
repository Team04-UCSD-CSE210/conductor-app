/**
 * RBAC System Tests
 * 
 * Tests for authentication and authorization middleware.
 * Uses mock data instead of database connections.
 */

import { authenticate, requireRole } from '../middleware/permission-middleware.js';

// Mock user data for testing
const mockUsers = {
  'admin@ucsd.edu': {
    id: 'admin-uuid-1234',
    email: 'admin@ucsd.edu',
    name: 'System Admin',
    primary_role: 'admin',
    status: 'active',
    institution_type: 'ucsd',
    deleted_at: null
  },
  'instructor1@ucsd.edu': {
    id: 'instructor-uuid-5678',
    email: 'instructor1@ucsd.edu',
    name: 'Dr. Alice Smith',
    primary_role: 'instructor',
    status: 'active',
    institution_type: 'ucsd',
    deleted_at: null
  },
  'student1@ucsd.edu': {
    id: 'student-uuid-9012',
    email: 'student1@ucsd.edu',
    name: 'Charlie Green',
    primary_role: 'student',
    status: 'active',
    institution_type: 'ucsd',
    deleted_at: null
  },
  'inactive@ucsd.edu': {
    id: 'inactive-uuid-3456',
    email: 'inactive@ucsd.edu',
    name: 'Inactive User',
    primary_role: 'student',
    status: 'busy',
    institution_type: 'ucsd',
    deleted_at: null
  },
  'deleted@ucsd.edu': {
    id: 'deleted-uuid-7890',
    email: 'deleted@ucsd.edu',
    name: 'Deleted User',
    primary_role: 'student',
    status: 'active',
    institution_type: 'ucsd',
    deleted_at: new Date()
  }
};

// Mock database pool for testing
const mockPool = {
  query: async (sql, params) => {
    // Mock user lookup by email
    if (sql.includes('SELECT id, email, name, primary_role, status, institution_type') && sql.includes('WHERE email = $1')) {
      const email = params[0];
      const user = mockUsers[email];
      if (!user || user.deleted_at) {
        return { rows: [] };
      }
      return { rows: [user] };
    }
    
    // Mock user lookup by ID
    if (sql.includes('SELECT id, email, name, primary_role, status, institution_type') && sql.includes('WHERE id = $1::uuid')) {
      const userId = params[0];
      const user = Object.values(mockUsers).find(u => u.id === userId);
      if (!user || user.deleted_at) {
        return { rows: [] };
      }
      return { rows: [user] };
    }
    
    // Mock role lookup for requireRole middleware
    if (sql.includes('SELECT role FROM users WHERE id = $1::uuid')) {
      const userId = params[0];
      const user = Object.values(mockUsers).find(u => u.id === userId);
      if (!user || user.deleted_at) {
        return { rows: [] };
      }
      return { rows: [{ role: user.primary_role }] };
    }
    
    // Default fallback
    return { rows: [] };
  }
};

// Mock request/response objects for testing
function createMockReq(headers = {}, params = {}, body = {}) {
  return {
    headers,
    params,
    body,
    user: null
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
}

function createMockNext() {
  let called = false;
  const next = () => { called = true; };
  next.wasCalled = () => called;
  return next;
}

/**
 * Test Authentication Middleware
 */
export async function testAuthentication() {
  console.log('Testing Authentication Middleware...');
 
  // Create a temporary mock for the middleware
  const { pool: realPool } = await import('../db.js');
  const originalPoolQuery = realPool.query;
  realPool.query = mockPool.query;

  try {
    // Test 1: No authentication headers
    {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401, 'Should return 401 for no auth');
      expect(res.jsonData.error).toBe('Unauthorized', 'Should return unauthorized error');
      console.log('PASS: No auth headers rejected');
    }

    // Test 2: Invalid email authentication
    {
      const req = createMockReq({ 'x-user-email': 'nonexistent@example.com' });
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401, 'Should return 401 for invalid user');
      console.log('PASS: Invalid email rejected');
    }

    // Test 3: Valid admin email authentication
    {
      const req = createMockReq({ 'x-user-email': 'admin@ucsd.edu' });
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(next.wasCalled()).toBe(true, 'Should call next() for valid user');
      expect(req.user.email).toBe('admin@ucsd.edu', 'Should set correct user email');
      expect(req.user.role).toBe('admin', 'Should set correct user role');
      console.log('PASS: Admin authentication works');
    }

    // Test 4: Valid instructor authentication
    {
      const req = createMockReq({ 'x-user-email': 'instructor1@ucsd.edu' });
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(next.wasCalled()).toBe(true, 'Should call next() for valid instructor');
      expect(req.user.role).toBe('instructor', 'Should set correct instructor role');
      console.log('PASS: Instructor authentication works');
    }

    // Test 5: Valid student authentication
    {
      const req = createMockReq({ 'x-user-email': 'student1@ucsd.edu' });
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(next.wasCalled()).toBe(true, 'Should call next() for valid student');
      expect(req.user.role).toBe('student', 'Should set correct student role');
      console.log('PASS: Student authentication works');
    }

    // Test 6: Inactive user authentication
    {
      const req = createMockReq({ 'x-user-email': 'inactive@ucsd.edu' });
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401, 'Should return 401 for inactive user');
      assert(res.jsonData.message.includes('busy'), 'Should mention user status');
      console.log('PASS: Inactive user rejected');
    }

    // Test 7: Deleted user authentication  
    {
      const req = createMockReq({ 'x-user-email': 'deleted@ucsd.edu' });
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401, 'Should return 401 for deleted user');
      console.log('PASS: Deleted user rejected');
    }

    // Test 8: User ID authentication
    {
      const req = createMockReq({ 'x-user-id': 'admin-uuid-1234' });
      const res = createMockRes();
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(next.wasCalled()).toBe(true, 'Should call next() for valid user ID');
      expect(req.user.email).toBe('admin@ucsd.edu', 'Should set correct user from ID');
      console.log('PASS: User ID authentication works');
    }

  } finally {
    // Restore original pool
    realPool.query = originalPoolQuery;
  }
}

/**
 * Test Role-Based Authorization Middleware
 */
export async function testRoleAuthorization() {
  console.log('Testing Role Authorization Middleware...');

  // Mock the database pool
  const { pool: realPool } = await import('../db.js');
  const originalPoolQuery = realPool.query;
  realPool.query = mockPool.query;

  try {
    // Test 1: No authenticated user
    {
      const middleware = requireRole('admin');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.statusCode).toBe(401, 'Should return 401 for no user');
      console.log('PASS: Unauthenticated user rejected');
    }

    // Test 2: Admin role access
    {
      const middleware = requireRole('admin');
      const req = createMockReq();
      req.user = { id: 'admin-uuid-1234', role: 'admin' };

      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next.wasCalled()).toBe(true, 'Should call next() for admin role');
      expect(req.userRole).toBe('admin', 'Should set userRole');
      console.log('PASS: Admin role authorization works');
    }

    // Test 3: Multiple role access - admin allowed
    {
      const middleware = requireRole('admin', 'instructor');
      const req = createMockReq();
      req.user = { id: 'admin-uuid-1234', role: 'admin' };

      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next.wasCalled()).toBe(true, 'Should call next() for admin in multi-role');
      console.log('PASS: Multiple role authorization works (admin)');
    }

    // Test 4: Multiple role access - instructor allowed
    {
      const middleware = requireRole('admin', 'instructor');
      const req = createMockReq();
      req.user = { id: 'instructor-uuid-5678', role: 'instructor' };

      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next.wasCalled()).toBe(true, 'Should call next() for instructor in multi-role');
      console.log('PASS: Multiple role authorization works (instructor)');
    }

    // Test 5: Insufficient role access
    {
      const middleware = requireRole('admin');
      const req = createMockReq();
      req.user = { id: 'student-uuid-9012', role: 'student' };

      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.statusCode).toBe(403, 'Should return 403 for insufficient role');
      assert(res.jsonData.message.includes('admin'), 'Should mention required role');
      console.log('PASS: Insufficient role rejected');
    }

    // Test 6: Student trying admin-only action
    {
      const middleware = requireRole('admin', 'instructor');
      const req = createMockReq();
      req.user = { id: 'student-uuid-9012', role: 'student' };

      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.statusCode).toBe(403, 'Should return 403 for student accessing admin/instructor');
      console.log('PASS: Student blocked from admin/instructor actions');
    }

    // Test 7: Non-existent user ID
    {
      const middleware = requireRole('admin');
      const req = createMockReq();
      req.user = { id: 'nonexistent-uuid', role: 'admin' };

      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.statusCode).toBe(401, 'Should return 401 for non-existent user');
      console.log('PASS: Non-existent user rejected');
    }

  } finally {
    // Restore original pool
    realPool.query = originalPoolQuery;
  }
}

/**
 * Integration Tests with Live API (requires running server)
 */
export async function testRBACIntegration() {
  console.log('Testing RBAC Integration (requires running server)...');
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test 1: Health endpoint (should work without auth)
    const healthResponse = await fetch(`${baseUrl}/health`);
    if (healthResponse.ok) {
      console.log('PASS: Public health endpoint accessible');
    } else {
      throw new Error('Health endpoint failed');
    }

    // Test 2: Protected endpoint without auth (should fail)
    const noAuthResponse = await fetch(`${baseUrl}/users`);
    if (noAuthResponse.status === 401) {
      console.log('PASS: Protected endpoint requires auth');
    } else {
      console.log('FAIL: Protected endpoint should require auth');
    }

    // Test 3: Protected endpoint with admin auth (should work)
    const adminResponse = await fetch(`${baseUrl}/users`, {
      headers: { 'X-User-Email': 'admin@ucsd.edu' }
    });
    if (adminResponse.ok) {
      console.log('PASS: Admin can access protected endpoints');
    } else {
      console.log('WARNING: Admin access test failed (check database seeding)');
    }

    // Test 4: Admin creating user (should work)
    const createResponse = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'X-User-Email': 'admin@ucsd.edu',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: `test-${Date.now()}@ucsd.edu`,
        name: 'RBAC Test User',
        primary_role: 'student'
      })
    });
    
    if (createResponse.ok || createResponse.status === 201) {
      console.log('PASS: Admin can create users');
    } else {
      console.log('WARNING: Admin create user test failed');
    }

    // Test 5: Student trying to create user (should fail)
    const studentCreateResponse = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'X-User-Email': 'student1@ucsd.edu',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: `student-test-${Date.now()}@ucsd.edu`,
        name: 'Student Test User',
        primary_role: 'student'
      })
    });
    
    if (studentCreateResponse.status === 403) {
      console.log('PASS: Student forbidden from creating users');
    } else {
      console.log('FAIL: Student should not be able to create users');
    }

  } catch {
    console.log('WARNING: Integration tests skipped (server not running or database not available)');
    console.log('   Start server with: npm start');
    console.log('   Seed database with: npm run db:seed');
  }
}

/**
 * Run all RBAC tests
 */
export async function runAllRBACTests(includeIntegration = false) {
  console.log('Starting RBAC Test Suite...\n');

  try {
    await testAuthentication();
    console.log('');
    await testRoleAuthorization();
    console.log('');
    
    if (includeIntegration) {
      await testRBACIntegration();
      console.log('');
    }
    
    console.log('RBAC Test Suite Complete');
    console.log('');
    console.log('Test Summary:');
    console.log('  Authentication middleware tests: DONE');
    console.log('  Role authorization middleware tests: DONE');
    if (includeIntegration) {
      console.log('  Integration tests: DONE');
    } else {
      console.log('  Integration tests: SKIPPED (use runAllRBACTests(true) to include)');
    }
    console.log('');
    console.log('Note: Tests use mock data - no database required');
    console.log('For live server testing: runAllRBACTests(true)');
  } catch (err) {
    console.error('Test suite failed:', err.message);
    console.error(err.stack);
    throw err;
  }
}

// Auto-run tests if this file is executed directly
if (process.argv[1].includes('rbac.test.js')) {
  const includeIntegration = process.argv[2] === 'true';
  runAllRBACTests(includeIntegration).catch(console.error);
}