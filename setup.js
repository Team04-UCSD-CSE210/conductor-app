/**
 * Global test setup file
 * Initializes database schema before all tests run
 * 
 * Vitest global setup format:
 * export default async function setup() { ... }
 */
import { DatabaseInitializer } from './src/database/init.js';
import { TestSeeder } from './src/tests/test-seeder.js';

export default async function setup() {
  try {
    console.log('[test setup] Initializing database schema...');

    // Check if schema already exists
    const isValid = await DatabaseInitializer.verifySchema();
    
    if (!isValid) {
      // Initialize schema WITH seed data (includes permissions and roles)
      await DatabaseInitializer.initialize({ seed: true, force: false });
      console.log('[test setup] Database schema initialized with seed data');
    } else {
      console.log('[test setup] Database schema already exists');
      // Run seed migrations to ensure permissions are up to date
      await DatabaseInitializer.initialize({ seed: true, force: false });
    }

    // Seed minimal test data (admin user)
    await TestSeeder.seedMinimalData();
    console.log('[test setup] Minimal test data seeded');
  } catch (error) {
    console.error('[test setup] Failed to initialize database schema:', error);
    throw error;
  }
}

