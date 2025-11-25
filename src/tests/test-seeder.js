/**
 * Test data seeder for minimal required data
 * Used by global test setup to ensure database is ready
 */
import { pool } from '../db.js';

export class TestSeeder {
  /**
   * Seeds minimal test data
   * Note: Most tests create their own admin user if needed
   * This just verifies database connectivity
   */
  static async seedMinimalData() {
    try {
      // Just verify database is accessible
      await pool.query('SELECT 1');
      console.log('[test-seeder] Database connection verified');
    } catch (error) {
      console.error('[test-seeder] Error accessing database:', error);
      throw error;
    }
  }
}
