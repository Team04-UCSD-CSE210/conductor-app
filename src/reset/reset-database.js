// reset-database.js
// This script safely clears all key tables (users, whitelist, access_requests, logs, etc.)
// without dropping them, effectively resetting your Conductor app database.
// Usage: node reset-database.js

import dotenv from 'dotenv';
import { pool } from '../db.js';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment. Please set it in .env file.');
  process.exit(1);
}

async function resetDatabase() {
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');

    // Tables to clear (in order to respect foreign key constraints)
    const tables = [
      'access_requests',
      'whitelist',
      'auth_logs',
      'enrollments',
      'users'
    ];

    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      console.log(`🧹 Cleared table: ${table}`);
    }

    console.log('✅ Database reset completed successfully.');
    await pool.end();
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
