#!/usr/bin/env node

/**
 * Database initialization script
 * Usage:
 *   node scripts/init-db.js              # Initialize schema only
 *   node scripts/init-db.js --seed       # Initialize with demo data
 *   node scripts/init-db.js --reset     # Drop and recreate everything
 *   node scripts/init-db.js --force      # Force re-run migrations
 */

import 'dotenv/config';
import { DatabaseInitializer } from '../src/database/init.js';
import { pool } from '../src/db.js';

async function main() {
  const args = process.argv.slice(2);
  const seed = args.includes('--seed');
  const reset = args.includes('--reset');
  const force = args.includes('--force');

  try {
    if (reset) {
      await DatabaseInitializer.reset(seed);
    } else {
      await DatabaseInitializer.initialize({ seed, force });
    }

    console.log('✅ Database setup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

