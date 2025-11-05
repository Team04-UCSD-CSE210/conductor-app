import { UserModel } from '../models/user-model.js';

export class UserService {
  static async createUser(userData) {
    const existing = await UserModel.findByEmail(userData.email);
    if (existing) throw new Error('User with this email already exists');
    return await UserModel.create(userData);
  }

  static async getUserById(id) {
    const user = await UserModel.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  static async updateUser(id, updateData) {
    const current = await UserModel.findById(id);
    if (!current) throw new Error('User not found');

    if (updateData.email && updateData.email !== current.email) {
      const dup = await UserModel.findByEmail(updateData.email);
      if (dup) throw new Error('Email already in use by another user');
    }
    return await UserModel.update(id, {
      name: updateData.name ?? current.name,
      email: updateData.email ?? current.email,
      role: updateData.role ?? current.role,
      status: updateData.status ?? current.status,
    });
  }

  static async deleteUser(id) {
    const ok = await UserModel.delete(id);
    if (!ok) throw new Error('User not found');
    return true;
  }

  static async getUsers(options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const offset = Math.max(0, Number(options.offset ?? 0));
    const users = await UserModel.findAll(limit, offset);
    const total = await UserModel.count();
    return {
      users,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit),
    };
  }
}
