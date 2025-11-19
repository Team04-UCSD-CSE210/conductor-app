/**
 * Tests for PermissionService.hasPermission
 * 
 * These tests:
 * - Mock the database (pool.query)
 * - Simulate a small subset of your seeded permissions:
 *    - user.manage (global)
 *    - roster.view, roster.import, enrollment.manage, course.manage (course)
 * - Check that:
 *    1) An instructor has user.manage globally
 *    2) A student enrolled as 'student' does NOT have roster.import
 */

import { PermissionService } from '../services/permission-service.js';
import { pool as realPool } from '../db.js';

// ------------------------------
// In-memory mock data
// ------------------------------

const mockPermissions = [
  {
    id: 'perm-user-manage',
    scope: 'global',
    resource: 'user',
    action: 'manage',
    code: 'user.manage',
    description: 'Create, update, delete, restore users',
  },
  {
    id: 'perm-roster-view',
    scope: 'course',
    resource: 'roster',
    action: 'view',
    code: 'roster.view',
    description: 'View roster',
  },
  {
    id: 'perm-roster-import',
    scope: 'course',
    resource: 'roster',
    action: 'import',
    code: 'roster.import',
    description: 'Import roster',
  },
  {
    id: 'perm-enrollment-manage',
    scope: 'course',
    resource: 'enrollment',
    action: 'manage',
    code: 'enrollment.manage',
    description: 'Manage enrollments',
  },
  {
    id: 'perm-course-manage',
    scope: 'course',
    resource: 'course',
    action: 'manage',
    code: 'course.manage',
    description: 'Course-level admin & stats',
  },
];

// Global roles: admin, instructor, student, unregistered
const mockUsers = [
  {
    id: 'user-instructor-1',
    primary_role: 'instructor',  // PermissionService uses primary_role
    deleted_at: null,
  },
  {
    id: 'user-student-1',
    primary_role: 'student',
    deleted_at: null,
  },
  {
    id: 'user-unregistered-1',
    primary_role: 'unregistered',
    deleted_at: null,
  },
];

// Course enrollments
const mockEnrollments = [
  {
    user_id: 'user-student-1',
    offering_id: 'offering-1',
    course_role: 'student',   // PermissionService uses course_role
  },
];

const mockUserRolePermissions = [
  // instructor: many permissions (mirror your seed)
  { user_role: 'instructor', permission_id: 'perm-user-manage' },
  { user_role: 'instructor', permission_id: 'perm-roster-view' },
  { user_role: 'instructor', permission_id: 'perm-roster-import' },
  { user_role: 'instructor', permission_id: 'perm-enrollment-manage' },
  { user_role: 'instructor', permission_id: 'perm-course-manage' },

  // student: basic permissions
  { user_role: 'student', permission_id: 'perm-roster-view' },

  // unregistered: same as student
  { user_role: 'unregistered', permission_id: 'perm-roster-view' },

  // admin would typically get all permissions, but we don't need it here
];

const mockEnrollmentRolePermissions = [
  // student: only roster.view
  { enrollment_role: 'student', permission_id: 'perm-roster-view' },

  // ta: full set (not used in these tests but realistic)
  { enrollment_role: 'ta', permission_id: 'perm-roster-view' },
  { enrollment_role: 'ta', permission_id: 'perm-roster-import' },
  { enrollment_role: 'ta', permission_id: 'perm-enrollment-manage' },
  { enrollment_role: 'ta', permission_id: 'perm-course-manage' },
];

// ------------------------------
// Mock pool.query implementation
// ------------------------------

const originalPoolQuery = realPool.query.bind(realPool);

const mockPool = {
  async query(sql, params = []) {
    sql = sql.trim();

    // Handle: SELECT id FROM permissions WHERE code = $1
    if (sql.includes('SELECT id FROM permissions WHERE code')) {
      const [code] = params;
      const perm = mockPermissions.find((p) => p.code === code);
      if (!perm) {
        return { rows: [] };
      }
      return { rows: [{ id: perm.id }] };
    }

    // Handle: SELECT primary_role AS role FROM users WHERE id = $2::uuid
    if (sql.includes('SELECT primary_role') && sql.includes('FROM users')) {
      const userId = params[1] || params[0];
      const user = mockUsers.find((u) => u.id === userId && !u.deleted_at);
      if (!user) {
        return { rows: [] };
      }
      return { rows: [{ role: user.primary_role }] };
    }

    // Handle: SELECT course_role FROM enrollments WHERE offering_id = $3::uuid AND user_id = $2::uuid
    if (sql.includes('SELECT course_role') && sql.includes('FROM enrollments')) {
      const [offeringId, userId] = params.length >= 2 ? [params[0], params[1]] : [null, params[0]];
      const enrollment = mockEnrollments.find(
        (e) => e.offering_id === offeringId && e.user_id === userId
      );
      if (!enrollment) {
        return { rows: [] };
      }
      return { rows: [{ course_role: enrollment.course_role }] };
    }

    // --- Handle the big CTE used in PermissionService.hasPermission ---
    if (sql.startsWith('WITH perm AS') || sql.includes('WITH perm AS')) {
      const [permissionCode, userId, offeringId] = params;

      // 1) Look up the permission by code
      const perm = mockPermissions.find((p) => p.code === permissionCode);
      if (!perm) {
        return { rows: [{ allowed: false }] };
      }

      // 2) Look up the user and their global role (using primary_role)
      const user = mockUsers.find((u) => u.id === userId && !u.deleted_at);
      if (!user) {
        return { rows: [{ allowed: false }] };
      }

      // 3) Global role → permission mapping (using primary_role)
      let allowedGlobal = false;
      if (user.primary_role === 'admin') {
        allowedGlobal = true;
      } else {
        const globalPermIds = mockUserRolePermissions
          .filter((urp) => urp.user_role === user.primary_role)
          .map((urp) => urp.permission_id);
        allowedGlobal = globalPermIds.includes(perm.id);
      }

      // 4) Course-level role → permission mapping (if offeringId is provided)
      let allowedCourse = false;
      if (offeringId) {
        // find all course roles for this user in this offering (using course_role)
        const courseRoles = mockEnrollments
          .filter(
            (e) =>
              e.offering_id === offeringId &&
              e.user_id === userId
          )
          .map((e) => e.course_role); // 'student', 'ta', 'tutor', etc.

        if (courseRoles.length > 0) {
          const coursePermIds = mockEnrollmentRolePermissions
            .filter((erp) => courseRoles.includes(erp.enrollment_role))
            .map((erp) => erp.permission_id);

          allowedCourse = coursePermIds.includes(perm.id);
        }
      }

      // 5) Team-level (we don't use teams in this mock; always false for now)
      const allowedTeam = false;

      const allowed = allowedCourse || allowedTeam || allowedGlobal;
      return { rows: [{ allowed }] };
    }

    // Anything else: just warn and return no rows
    console.warn('[mockPool] Unhandled SQL query:', sql);
    return { rows: [] };
  },
};

// ------------------------------
// Tiny test helpers
// ------------------------------

async function withMockedPool(testFn) {
  realPool.query = mockPool.query;
  try {
    await testFn();
  } finally {
    realPool.query = originalPoolQuery;
  }
}

function logResult(name, ok, extra = '') {
  const status = ok ? 'OK' : 'FAIL';
  console.log(`${name}: ${status}${extra ? ' - ' + extra : ''}`);
}

// ------------------------------
// Tests
// ------------------------------

async function testInstructorHasUserManageGlobally() {
  await withMockedPool(async () => {
    const userId = 'user-instructor-1';

    const allowed = await PermissionService.hasPermission(
      userId,
      'user.manage',
      null,       // offeringId
      null        // teamId
    );

    logResult(
      'testInstructorHasUserManageGlobally',
      allowed === true,
      `expected true, got ${allowed}`
    );
  });
}

async function testStudentDoesNotHaveRosterImport() {
  await withMockedPool(async () => {
    const userId = 'user-student-1';
    const offeringId = 'offering-1';

    const allowed = await PermissionService.hasPermission(
      userId,
      'roster.import',
      offeringId,
      null
    );

    logResult(
      'testStudentDoesNotHaveRosterImport',
      allowed === false,
      `expected false, got ${allowed}`
    );
  });
}

async function testUnregisteredHasSamePermissionsAsStudent() {
  await withMockedPool(async () => {
    const userId = 'user-unregistered-1';

    // Unregistered should have roster.view (same as student)
    const hasView = await PermissionService.hasPermission(
      userId,
      'roster.view',
      null,
      null
    );

    // Unregistered should NOT have roster.import (same as student)
    const hasImport = await PermissionService.hasPermission(
      userId,
      'roster.import',
      null,
      null
    );

    logResult(
      'testUnregisteredHasSamePermissionsAsStudent',
      hasView === true && hasImport === false,
      `expected view=true, import=false, got view=${hasView}, import=${hasImport}`
    );
  });
}

// ------------------------------
// Runner
// ------------------------------

async function run() {
  await testInstructorHasUserManageGlobally();
  await testStudentDoesNotHaveRosterImport();
  await testUnregisteredHasSamePermissionsAsStudent();
}

if (process.argv[1].includes('permission-service.test.js')) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}