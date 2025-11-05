import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { User } from '../models/user.js';
import { UserService } from '../services/user-service.js';
import { initializeDatabase } from '../database/init.js';
import database from '../database/database.js';

describe('User Model and Service', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    const db = database.getInstance();
    await new Promise((resolve) => {
      db.run('DELETE FROM users', resolve);
    });
  });

  describe('User Validation', () => {
    it('should_validate_correct_user_data', () => {
      const user = new User({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        status: 'active'
      });

      const validation = user.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should_reject_invalid_email', () => {
      const user = new User({
        name: 'John Doe',
        email: 'invalid-email',
        role: 'user'
      });

      const validation = user.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid email format');
    });

    it('should_reject_short_name', () => {
      const user = new User({
        name: 'J',
        email: 'john@example.com',
        role: 'user'
      });

      const validation = user.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Name must be at least 2 characters long');
    });

    it('should_reject_invalid_role', () => {
      const user = new User({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'invalid'
      });

      const validation = user.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Role must be user, admin, or moderator');
    });
  });

  describe('CRUD Operations', () => {
    it('should_create_user_successfully', async () => {
      const userData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'admin'
      };

      const user = await UserService.createUser(userData);
      
      expect(user.id).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
    });

    it('should_prevent_duplicate_email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'duplicate@example.com',
        role: 'user'
      };

      await UserService.createUser(userData);
      
      await expect(UserService.createUser(userData))
        .rejects.toThrow('User with this email already exists');
    });

    it('should_find_user_by_id', async () => {
      const userData = {
        name: 'Bob Wilson',
        email: 'bob@example.com',
        role: 'moderator'
      };

      const createdUser = await UserService.createUser(userData);
      const foundUser = await UserService.getUserById(createdUser.id);
      
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(userData.email);
    });

    it('should_update_user_successfully', async () => {
      const userData = {
        name: 'Alice Brown',
        email: 'alice@example.com',
        role: 'user'
      };

      const user = await UserService.createUser(userData);
      const updatedUser = await UserService.updateUser(user.id, {
        name: 'Alice Johnson',
        role: 'admin'
      });
      
      expect(updatedUser.name).toBe('Alice Johnson');
      expect(updatedUser.role).toBe('admin');
      expect(updatedUser.email).toBe(userData.email);
    });

    it('should_delete_user_successfully', async () => {
      const userData = {
        name: 'Charlie Davis',
        email: 'charlie@example.com',
        role: 'user'
      };

      const user = await UserService.createUser(userData);
      const deleted = await UserService.deleteUser(user.id);
      
      expect(deleted).toBe(true);
      
      await expect(UserService.getUserById(user.id))
        .rejects.toThrow('User not found');
    });

    it('should_get_users_with_pagination', async () => {
      // Create multiple users
      for (let i = 1; i <= 5; i++) {
        await UserService.createUser({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          role: 'user'
        });
      }

      const result = await UserService.getUsers({ limit: 3, offset: 0 });
      
      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('Performance Testing', () => {
    it('should_handle_large_dataset', async () => {
      const startTime = Date.now();
      
      // Create 100 users
      const promises = [];
      for (let i = 1; i <= 100; i++) {
        promises.push(UserService.createUser({
          name: `User ${i}`,
          email: `user${i}@test.com`,
          role: 'user'
        }));
      }
      
      await Promise.all(promises);
      const endTime = Date.now();
      
      const count = await User.count();
      expect(count).toBe(100);
      
      // Should complete within reasonable time (adjust as needed)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
