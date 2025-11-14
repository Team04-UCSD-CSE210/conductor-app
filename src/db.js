import 'dotenv/config';
import pg from 'pg';

// Use DATABASE_URL from environment, or default to a test database URL for CI/tests
// This allows tests to run in CI environments without requiring a .env file
const url = process.env.DATABASE_URL || 
  (process.env.NODE_ENV === 'test' || process.env.VITEST 
    ? process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/conductor_test'
    : null);

if (!url) {
  throw new Error('DATABASE_URL not defined in .env. For tests, set TEST_DATABASE_URL or ensure DATABASE_URL is set.');
}

export const pool = new pg.Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  if (process.env.DEBUG_DB) console.log('[db] connect event');
});

export async function assertDb() {
  try {
    await pool.query('SELECT 1');
    if (process.env.DEBUG_DB) console.log('[db] connection verified');
  } catch (err) {
    throw new Error(`Database connection failed: ${err.message}`);
  }
}
