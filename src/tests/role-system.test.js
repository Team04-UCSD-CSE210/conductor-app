import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoleModel } from '../models/role-model.js';
import { CourseModel } from '../models/course-model.js';
import { UserModel } from '../models/user-model.js';
import { pool } from '../db.js';

describe('Role System', () => {
  let testUser, testCourse, testAssigner;

  beforeEach(async () => {
    // Create test users and course
    testUser = await UserModel.create({
      name: 'Test Student',
      email: 'student@test.com'
    });

    testAssigner = await UserModel.create({
      name: 'Test Professor',
      email: 'professor@test.com'
    });

    testCourse = await CourseModel.create({
      name: 'Test Course',
      code: 'TEST101',
      semester: 'fall',
      year: 2024
    });
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM role_audit_log WHERE user_id = $1 OR user_id = $2', [testUser.id, testAssigner.id]);
    await pool.query('DELETE FROM user_course_roles WHERE user_id = $1 OR user_id = $2', [testUser.id, testAssigner.id]);
    await pool.query('DELETE FROM courses WHERE id = $1', [testCourse.id]);
    await pool.query('DELETE FROM users WHERE id = $1 OR id = $2', [testUser.id, testAssigner.id]);
  });

  describe('Role Assignment', () => {
    it('should assign role to user in course', async () => {
      const assignment = await RoleModel.assignRole(
        testUser.id,
        testCourse.id,
        'student',
        testAssigner.id,
        'Initial enrollment'
      );

      expect(assignment).toBeDefined();
      expect(assignment.user_id).toBe(testUser.id);
      expect(assignment.course_id).toBe(testCourse.id);
      expect(assignment.role).toBe('student');
      expect(assignment.assigned_by).toBe(testAssigner.id);
    });

    it('should update existing role assignment', async () => {
      // First assignment
      await RoleModel.assignRole(testUser.id, testCourse.id, 'student', testAssigner.id);

      // Update to team leader
      const updated = await RoleModel.assignRole(
        testUser.id,
        testCourse.id,
        'team_leader',
        testAssigner.id,
        'Promoted to team leader'
      );

      expect(updated.role).toBe('team_leader');

      // Check audit log
      const auditLog = await RoleModel.getAuditLog(testCourse.id, testUser.id);
      expect(auditLog).toHaveLength(2); // Initial assignment + update
      expect(auditLog[0].old_role).toBe('student');
      expect(auditLog[0].new_role).toBe('team_leader');
    });

    it('should reject invalid roles', async () => {
      await expect(
        RoleModel.assignRole(testUser.id, testCourse.id, 'invalid_role', testAssigner.id)
      ).rejects.toThrow('Invalid role: invalid_role');
    });

    it('should handle bulk role assignments', async () => {
      const user2 = await UserModel.create({
        name: 'Test Student 2',
        email: 'student2@test.com'
      });

      const assignments = [
        { userId: testUser.id, courseId: testCourse.id, role: 'student', reason: 'Bulk enrollment' },
        { userId: user2.id, courseId: testCourse.id, role: 'student', reason: 'Bulk enrollment' }
      ];

      const results = await RoleModel.bulkAssignRoles(assignments, testAssigner.id);
      expect(results).toHaveLength(2);
      expect(results[0].role).toBe('student');
      expect(results[1].role).toBe('student');

      // Cleanup
      await pool.query('DELETE FROM user_course_roles WHERE user_id = $1', [user2.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user2.id]);
    });
  });

  describe('Permission Checking', () => {
    beforeEach(async () => {
      // Assign student role for permission tests
      await RoleModel.assignRole(testUser.id, testCourse.id, 'student', testAssigner.id);
    });

    it('should check user permissions correctly', async () => {
      const hasViewCourse = await RoleModel.hasPermission(testUser.id, testCourse.id, 'view_course');
      const hasEditCourse = await RoleModel.hasPermission(testUser.id, testCourse.id, 'edit_course');

      expect(hasViewCourse).toBe(true);  // Students can view courses
      expect(hasEditCourse).toBe(false); // Students cannot edit courses
    });

    it('should get all user permissions', async () => {
      const permissions = await RoleModel.getUserPermissions(testUser.id, testCourse.id);
      
      expect(permissions).toContain('view_course');
      expect(permissions).toContain('view_queue');
      expect(permissions).toContain('view_teams');
      expect(permissions).toContain('view_assignments');
      expect(permissions).not.toContain('edit_course');
      expect(permissions).not.toContain('assign_roles');
    });

    it('should handle permission inheritance for higher roles', async () => {
      // Promote to TA
      await RoleModel.assignRole(testUser.id, testCourse.id, 'ta', testAssigner.id);

      const permissions = await RoleModel.getUserPermissions(testUser.id, testCourse.id);
      
      expect(permissions).toContain('view_course');
      expect(permissions).toContain('view_students');
      expect(permissions).toContain('manage_queue');
      expect(permissions).toContain('grade_assignments');
      expect(permissions).toContain('view_analytics');
    });

    it('should return false for invalid permissions', async () => {
      const hasInvalidPermission = await RoleModel.hasPermission(
        testUser.id, 
        testCourse.id, 
        'invalid_permission'
      );
      expect(hasInvalidPermission).toBe(false);
    });
  });

  describe('Role Queries', () => {
    beforeEach(async () => {
      await RoleModel.assignRole(testUser.id, testCourse.id, 'student', testAssigner.id);
    });

    it('should get user role in course', async () => {
      const userRole = await RoleModel.getUserRole(testUser.id, testCourse.id);
      
      expect(userRole).toBeDefined();
      expect(userRole.role).toBe('student');
      expect(userRole.user_name).toBe('Test Student');
      expect(userRole.course_name).toBe('Test Course');
    });

    it('should get all user roles across courses', async () => {
      const course2 = await CourseModel.create({
        name: 'Test Course 2',
        code: 'TEST102',
        semester: 'spring',
        year: 2024
      });

      await RoleModel.assignRole(testUser.id, course2.id, 'tutor', testAssigner.id);

      const userRoles = await RoleModel.getUserRoles(testUser.id);
      expect(userRoles).toHaveLength(2);
      
      const roles = userRoles.map(r => r.role);
      expect(roles).toContain('student');
      expect(roles).toContain('tutor');

      // Cleanup
      await pool.query('DELETE FROM user_course_roles WHERE course_id = $1', [course2.id]);
      await pool.query('DELETE FROM courses WHERE id = $1', [course2.id]);
    });

    it('should get all roles in a course', async () => {
      // Add another user to the course
      const user2 = await UserModel.create({
        name: 'Test TA',
        email: 'ta@test.com'
      });
      await RoleModel.assignRole(user2.id, testCourse.id, 'ta', testAssigner.id);

      const courseRoles = await RoleModel.getCourseRoles(testCourse.id);
      expect(courseRoles).toHaveLength(2);
      
      const roles = courseRoles.map(r => r.role);
      expect(roles).toContain('student');
      expect(roles).toContain('ta');

      // Cleanup
      await pool.query('DELETE FROM user_course_roles WHERE user_id = $1', [user2.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user2.id]);
    });
  });

  describe('Role Removal', () => {
    beforeEach(async () => {
      await RoleModel.assignRole(testUser.id, testCourse.id, 'student', testAssigner.id);
    });

    it('should remove role assignment', async () => {
      const removed = await RoleModel.removeRole(
        testUser.id, 
        testCourse.id, 
        testAssigner.id, 
        'Course completed'
      );

      expect(removed).toBe(true);

      // Verify role is removed
      const userRole = await RoleModel.getUserRole(testUser.id, testCourse.id);
      expect(userRole).toBeNull();

      // Check audit log
      const auditLog = await RoleModel.getAuditLog(testCourse.id, testUser.id);
      const removalEntry = auditLog.find(entry => entry.new_role === null);
      expect(removalEntry).toBeDefined();
      expect(removalEntry.old_role).toBe('student');
      expect(removalEntry.reason).toBe('Course completed');
    });

    it('should return false when removing non-existent role', async () => {
      // Remove the role first
      await RoleModel.removeRole(testUser.id, testCourse.id, testAssigner.id);

      // Try to remove again
      const removed = await RoleModel.removeRole(testUser.id, testCourse.id, testAssigner.id);
      expect(removed).toBe(false);
    });
  });

  describe('Audit Log', () => {
    it('should track role changes in audit log', async () => {
      // Initial assignment
      await RoleModel.assignRole(testUser.id, testCourse.id, 'student', testAssigner.id, 'Initial enrollment');
      
      // Role change
      await RoleModel.assignRole(testUser.id, testCourse.id, 'team_leader', testAssigner.id, 'Promoted');
      
      // Role removal
      await RoleModel.removeRole(testUser.id, testCourse.id, testAssigner.id, 'Course ended');

      const auditLog = await RoleModel.getAuditLog(testCourse.id, testUser.id);
      expect(auditLog).toHaveLength(3);

      // Check chronological order (newest first)
      expect(auditLog[0].old_role).toBe('team_leader');
      expect(auditLog[0].new_role).toBeNull();
      expect(auditLog[0].reason).toBe('Course ended');

      expect(auditLog[1].old_role).toBe('student');
      expect(auditLog[1].new_role).toBe('team_leader');
      expect(auditLog[1].reason).toBe('Promoted');

      expect(auditLog[2].old_role).toBeNull();
      expect(auditLog[2].new_role).toBe('student');
      expect(auditLog[2].reason).toBe('Initial enrollment');
    });

    it('should filter audit log by course and user', async () => {
      const course2 = await CourseModel.create({
        name: 'Another Course',
        code: 'TEST201',
        semester: 'fall',
        year: 2024
      });

      // Assignments in different courses
      await RoleModel.assignRole(testUser.id, testCourse.id, 'student', testAssigner.id);
      await RoleModel.assignRole(testUser.id, course2.id, 'tutor', testAssigner.id);

      // Filter by course
      const course1Log = await RoleModel.getAuditLog(testCourse.id);
      const course2Log = await RoleModel.getAuditLog(course2.id);

      expect(course1Log).toHaveLength(1);
      expect(course2Log).toHaveLength(1);
      expect(course1Log[0].new_role).toBe('student');
      expect(course2Log[0].new_role).toBe('tutor');

      // Filter by user
      const userLog = await RoleModel.getAuditLog(null, testUser.id);
      expect(userLog).toHaveLength(2);

      // Cleanup
      await pool.query('DELETE FROM user_course_roles WHERE course_id = $1', [course2.id]);
      await pool.query('DELETE FROM courses WHERE id = $1', [course2.id]);
    });
  });

  describe('Role Permissions Matrix', () => {
    it('should return role permissions matrix', async () => {
      const rolePermissions = await RoleModel.getRolePermissions();
      
      expect(rolePermissions).toHaveLength(5); // 5 roles
      
      const studentPerms = rolePermissions.find(rp => rp.role === 'student');
      const professorPerms = rolePermissions.find(rp => rp.role === 'professor');
      
      expect(studentPerms.permissions).toContain('view_course');
      expect(studentPerms.permissions).not.toContain('edit_course');
      
      expect(professorPerms.permissions).toContain('view_course');
      expect(professorPerms.permissions).toContain('edit_course');
      expect(professorPerms.permissions).toContain('assign_roles');
    });

    it('should return available roles and permissions', async () => {
      const roles = RoleModel.getAvailableRoles();
      const permissions = RoleModel.getAvailablePermissions();

      expect(roles).toContain('student');
      expect(roles).toContain('professor');
      expect(roles).toHaveLength(5);

      expect(permissions).toContain('view_course');
      expect(permissions).toContain('assign_roles');
      expect(permissions.length).toBeGreaterThan(10);
    });
  });

  describe('Performance Requirements', () => {
    it('should check permissions in under 50ms', async () => {
      await RoleModel.assignRole(testUser.id, testCourse.id, 'student', testAssigner.id);

      const start = Date.now();
      await RoleModel.hasPermission(testUser.id, testCourse.id, 'view_course');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should handle bulk operations efficiently', async () => {
      const users = [];
      for (let i = 0; i < 10; i++) {
        const user = await UserModel.create({
          name: `Bulk User ${i}`,
          email: `bulk${i}@test.com`
        });
        users.push(user);
      }

      const assignments = users.map(user => ({
        userId: user.id,
        courseId: testCourse.id,
        role: 'student',
        reason: 'Bulk test'
      }));

      const start = Date.now();
      await RoleModel.bulkAssignRoles(assignments, testAssigner.id);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      // Cleanup
      for (const user of users) {
        await pool.query('DELETE FROM user_course_roles WHERE user_id = $1', [user.id]);
        await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
      }
    });
  });
});
