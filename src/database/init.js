import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import database from './database.js';
import { runMigrations } from './migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize database and run migrations
 * @returns {Promise<void>}
 */
export async function initializeDatabase() {
  try {
    // Ensure data directory exists
    await mkdir(dirname(__dirname) + '/../data', { recursive: true });
    
    // Connect to database
    await database.connect();
    console.log('Database connected successfully');
    
    // Run migrations
    await runMigrations();
    console.log('Database migrations completed');
    
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  }
}
