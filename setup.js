/**
 * Global test setup file
 * Initializes database schema before all tests run
 * 
 * Vitest global setup format:
 * export default async function setup() { ... }
 */
import { DatabaseInitializer } from './src/database/init.js';

export default async function setup() {
  try {
    console.log('[test setup] Initializing database schema...');

    // Check if schema already exists
    const isValid = await DatabaseInitializer.verifySchema();
    
    if (!isValid) {
      // Initialize schema (without seed data for tests)
      await DatabaseInitializer.initialize({ seed: false, force: false });
      console.log('[test setup] Database schema initialized');
    } else {
      console.log('[test setup] Database schema already exists');
    }
  } catch (error) {
    console.error('[test setup] Failed to initialize database schema:', error);
    throw error;
  }
}

