import { ROLES } from '../config/roles.js';

export class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.name = data.name;
    this.role = data.role || ROLES.STUDENT_STANDARD;
    this.isProvisioned = data.isProvisioned || false;
    this.provisioningCode = data.provisioningCode;
    this.createdAt = data.createdAt || new Date();
    this.lastLogin = data.lastLogin;
    this.loginAttempts = data.loginAttempts || 0;
    this.isBlocked = data.isBlocked || false;
  }

  static async findByEmail(email) {
    // TODO: Replace with actual database query
    const users = await this.getAllUsers();
    return users.find(user => user.email === email);
  }

  static async getAllUsers() {
    // TODO: Replace with actual database query
    return [];
  }

  static async create(userData) {
    const user = new User({
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date()
    });
    
    // TODO: Save to database
    return user;
  }

  async save() {
    // TODO: Save to database
    return this;
  }

  incrementLoginAttempts() {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.isBlocked = true;
    }
  }

  resetLoginAttempts() {
    this.loginAttempts = 0;
    this.isBlocked = false;
    this.lastLogin = new Date();
  }

  requiresProvisioning() {
    return !this.isProvisioned && this.role !== ROLES.STUDENT_STANDARD;
  }
}
