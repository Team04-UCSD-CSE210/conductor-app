#!/usr/bin/env node
/**
 * Prune old authentication logs from the database
 * Usage: node scripts/prune-auth-logs.js
 * 
 * Environment variables:
 * - AUTH_LOG_RETENTION_DAYS: Number of days to retain logs (default: 90)
 * - DATABASE_URL: PostgreSQL connection string
 */

import 'dotenv/config';
import { pool } from '../src/db.js';

const daysConfig = process.env.AUTH_LOG_RETENTION_DAYS || "90";
const retentionDays = Number.parseInt(daysConfig, 10);

if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
  console.error("AUTH_LOG_RETENTION_DAYS must be a positive integer.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL must be set to prune auth logs.");
  process.exit(1);
}

const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

const run = async () => {
  try {
    // Delete auth logs older than cutoff date
    const result = await pool.query(
      'DELETE FROM auth_logs WHERE created_at < $1',
      [cutoff]
    );
    
    console.log(`Pruned ${result.rowCount} auth log entries older than ${retentionDays} day(s).`);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Failed to prune auth logs", error);
    try {
      await pool.end();
    } catch (closeError) {
      console.error("Failed to close database connection", closeError);
    }
    process.exit(1);
  }
};

run();
