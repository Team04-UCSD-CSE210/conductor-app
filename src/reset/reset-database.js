// reset-database.js
// This script safely clears all key tables (users, whitelist, access_requests, logs, etc.)
// without dropping them, effectively resetting your Conductor app database.
// Usage: node reset-database.js

import dotenv from 'dotenv';
import { createSequelize } from '../config/db.js';
import { defineWhitelistModel } from '../models/whitelist.js';
import { defineAccessRequestModel } from '../models/access-request.js';
import { defineAuthLogModel } from '../models/auth-log.js';
import { DataTypes } from 'sequelize';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const PG_SSL_MODE = process.env.PGSSLMODE;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment. Please set it in .env file.');
  process.exit(1);
}

const sequelize = createSequelize({ databaseUrl: DATABASE_URL, sslMode: PG_SSL_MODE });

// Define all models to clean
const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING },
  user_type: {
    type: DataTypes.ENUM('Admin', 'Professor', 'TA', 'Student', 'Unregistered'),
    defaultValue: 'Unregistered'
  },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'users',
  timestamps: false
});

const Whitelist = defineWhitelistModel(sequelize);
const AccessRequest = defineAccessRequestModel(sequelize);
const AuthLog = defineAuthLogModel(sequelize);

async function resetDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const tables = [AccessRequest, Whitelist, AuthLog, User];

    for (const table of tables) {
      const name = table.getTableName();
      await table.destroy({ where: {}, truncate: true, restartIdentity: true });
      console.log(`🧹 Cleared table: ${name}`);
    }

    console.log('✅ Database reset completed successfully.');
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();

