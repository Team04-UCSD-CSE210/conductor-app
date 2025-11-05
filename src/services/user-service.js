import { User } from '../models/user.js';

/**
 * User service for business logic and CRUD operations
 */
export class UserService {
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<User>}
   */
  static async createUser(userData) {
    const existingUser = await User.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = new User(userData);
    return await user.save();
  }

  /**
   * Get user by ID
   * @param {number} id - User ID
   * @returns {Promise<User>}
   */
  static async getUserById(id) {
    const user = await User.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Update user
   * @param {number} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<User>}
   */
  static async updateUser(id, updateData) {
    const user = await User.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findByEmail(updateData.email);
      if (existingUser) {
        throw new Error('Email already in use by another user');
      }
    }

    Object.assign(user, updateData);
    return await user.update();
  }

  /**
   * Delete user
   * @param {number} id - User ID
   * @returns {Promise<boolean>}
   */
  static async deleteUser(id) {
    const deleted = await User.deleteById(id);
    if (!deleted) {
      throw new Error('User not found');
    }
    return true;
  }

  /**
   * Get all users with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  static async getUsers(options = {}) {
    const users = await User.findAll(options);
    const total = await User.count();
    
    return {
      users,
      total,
      page: Math.floor((options.offset || 0) / (options.limit || 50)) + 1,
      totalPages: Math.ceil(total / (options.limit || 50))
    };
  }
}
