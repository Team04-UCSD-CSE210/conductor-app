import { UserModel } from '../models/user-model.js';
import { AuditService } from './audit-service.js';

/**
 * User Service - Business logic layer for user management
 * Handles CRUD operations with audit logging
 */
export class UserService {
  /**
   * Create a new user with audit logging
   * @param {Object} userData - User data
   * @param {string} [createdBy] - User ID who is creating this user (for audit)
   */
  static async createUser(userData, createdBy = null) {
    // Check for duplicate email
    const existing = await UserModel.findByEmail(userData.email);
    if (existing) {
      throw new Error('User with this email already exists');
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
   * Get user by ID
   */
  static async getUserById(id) {
    const user = await UserModel.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  /**
   * Get user by email
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

    // Track role change for audit
    const roleChanged = updateData.primary_role && updateData.primary_role !== current.primary_role;
    const oldRole = current.primary_role;

    const updated = await UserModel.update(id, {
      name: updateData.name ?? current.name,
      email: updateData.email ?? current.email,
      ucsd_pid: updateData.ucsd_pid ?? current.ucsd_pid,
      preferred_name: updateData.preferred_name ?? current.preferred_name,
      major: updateData.major ?? current.major,
      degree_program: updateData.degree_program ?? current.degree_program,
      academic_year: updateData.academic_year ?? current.academic_year,
      department: updateData.department ?? current.department,
      class_level: updateData.class_level ?? current.class_level,
      primary_role: updateData.primary_role ?? current.primary_role,
      status: updateData.status ?? current.status,
      profile_url: updateData.profile_url ?? current.profile_url,
      image_url: updateData.image_url ?? current.image_url,
      phone_number: updateData.phone_number ?? current.phone_number,
      github_username: updateData.github_username ?? current.github_username,
      linkedin_url: updateData.linkedin_url ?? current.linkedin_url,
    });

    // Log the update
    await AuditService.logUserUpdate(updatedBy, updateData, current);

    // Log role change separately
    if (roleChanged) {
      await AuditService.logRoleChange(updatedBy, id, oldRole, updateData.primary_role, 'global');
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
   * Restore soft-deleted user with audit logging
   * @param {string} id - User ID to restore
   * @param {string} restoredBy - User ID who is restoring (for audit)
   */
  static async restoreUser(id, restoredBy) {
    const user = await UserModel.findById(id, true); // Include deleted
    if (!user) throw new Error('User not found');
    if (!user.deleted_at) throw new Error('User is not deleted');

    const ok = await UserModel.restore(id);
    if (!ok) throw new Error('Failed to restore user');

    // Log the restoration
    await AuditService.logUserRestore(restoredBy, id);

    return true;
  }

  /**
   * Get users with pagination
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of users per page
   * @param {number} options.offset - Number of users to skip
   * @param {boolean} options.includeDeleted - Include soft-deleted users
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
   * Get users by primary_role
   */
  static async getUsersByRole(role, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const offset = Math.max(0, Number(options.offset ?? 0));

    const users = await UserModel.findByRole(role, limit, offset);
    return users;
  }

  /**
   * Get users by institution_type
   */
  static async getUsersByInstitutionType(institutionType, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const offset = Math.max(0, Number(options.offset ?? 0));

    const users = await UserModel.findByInstitutionType(institutionType, limit, offset);
    return users;
  }
}
