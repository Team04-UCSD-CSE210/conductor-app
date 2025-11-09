import { UserModel } from '../models/user-model.js';
import { AuditService } from './audit-service.js';

/**
 * User Service - Business logic layer for user management
 * Handles CRUD operations with audit logging and soft delete support
 */
export class UserService {
  /**
   * Create a new user with audit logging
   * @param {Object} userData - User data
   * @param {string} [createdBy] - User ID who is creating this user (for audit)
   */
  static async createUser(userData, createdBy = null) {
    // Check for duplicate email (excluding soft-deleted)
    const existing = await UserModel.findByEmail(userData.email);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Check for duplicate user_id if provided
    if (userData.user_id) {
      const existingById = await UserModel.findByUserId(userData.user_id);
      if (existingById) {
        throw new Error('User with this user_id already exists');
      }
    }

    const user = await UserModel.create(userData);

    // Log the creation
    if (createdBy) {
      await AuditService.logUserCreate(createdBy, userData);
    } else {
      // Self-registration
      await AuditService.logUserCreate(user.id, userData);
    }

    return user;
  }

  /**
   * Get user by ID (excludes soft-deleted)
   */
  static async getUserById(id) {
    const user = await UserModel.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  /**
   * Get user by email (excludes soft-deleted)
   */
  static async getUserByEmail(email) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('User not found');
    return user;
  }

  /**
   * Update user with audit logging
   * @param {string} id - User ID to update
   * @param {Object} updateData - Data to update
   * @param {string} updatedBy - User ID who is making the update (for audit)
   */
  static async updateUser(id, updateData, updatedBy) {
    const current = await UserModel.findById(id);
    if (!current) throw new Error('User not found');

    // Check for duplicate email if changing email
    if (updateData.email && updateData.email !== current.email) {
      const dup = await UserModel.findByEmail(updateData.email);
      if (dup) throw new Error('Email already in use by another user');
    }

    // Check for duplicate user_id if changing user_id
    if (updateData.user_id && updateData.user_id !== current.user_id) {
      const dup = await UserModel.findByUserId(updateData.user_id);
      if (dup) throw new Error('User ID already in use by another user');
    }

    // Track role change for audit
    const roleChanged = updateData.role && updateData.role !== current.role;
    const oldRole = current.role;

    const updated = await UserModel.update(id, {
      name: updateData.name ?? current.name,
      email: updateData.email ?? current.email,
      preferred_name: updateData.preferred_name ?? current.preferred_name,
      major: updateData.major ?? current.major,
      bio: updateData.bio ?? current.bio,
      academic_year: updateData.academic_year ?? current.academic_year,
      department: updateData.department ?? current.department,
      class_level: updateData.class_level ?? current.class_level,
      role: updateData.role ?? current.role,
      status: updateData.status ?? current.status,
      auth_source: updateData.auth_source ?? current.auth_source,
      profile_url: updateData.profile_url ?? current.profile_url,
      image_url: updateData.image_url ?? current.image_url,
      phone_url: updateData.phone_url ?? current.phone_url,
      github_username: updateData.github_username ?? current.github_username,
      linkedin_url: updateData.linkedin_url ?? current.linkedin_url,
      openai_url: updateData.openai_url ?? current.openai_url,
      password_hash: updateData.password_hash ?? current.password_hash,
      user_id: updateData.user_id ?? current.user_id,
    });

    // Log the update
    await AuditService.logUserUpdate(updatedBy, updateData, current);

    // Log role change separately
    if (roleChanged) {
      await AuditService.logRoleChange(updatedBy, id, oldRole, updateData.role, 'global');
    }

    return updated;
  }

  /**
   * Soft delete user with audit logging
   * @param {string} id - User ID to delete
   * @param {string} deletedBy - User ID who is deleting (for audit)
   */
  static async deleteUser(id, deletedBy) {
    const user = await UserModel.findById(id);
    if (!user) throw new Error('User not found');

    const ok = await UserModel.delete(id);
    if (!ok) throw new Error('User not found or already deleted');

    // Log the deletion
    await AuditService.logUserDelete(deletedBy, id);

    return true;
  }

  /**
   * Restore soft-deleted user
   * @param {string} id - User ID to restore
   * @param {string} restoredBy - User ID who is restoring (for audit)
   */
  static async restoreUser(id, restoredBy) {
    const ok = await UserModel.restore(id);
    if (!ok) throw new Error('User not found or not deleted');

    // Log the restoration
    await AuditService.logActivity({
      userId: restoredBy,
      action: 'user.restored',
      metadata: { restored_user_id: id },
    });

    return true;
  }

  /**
   * Get users with pagination
   */
  static async getUsers(options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const offset = Math.max(0, Number(options.offset ?? 0));
    const includeDeleted = options.includeDeleted === true;

    const users = await UserModel.findAll(limit, offset, includeDeleted);
    const total = await UserModel.count(includeDeleted);

    return {
      users,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get users by role
   */
  static async getUsersByRole(role, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const offset = Math.max(0, Number(options.offset ?? 0));

    const users = await UserModel.findByRole(role, limit, offset);
    return users;
  }

  /**
   * Get users by auth_source
   */
  static async getUsersByAuthSource(authSource, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const offset = Math.max(0, Number(options.offset ?? 0));

    const users = await UserModel.findByAuthSource(authSource, limit, offset);
    return users;
  }
}
