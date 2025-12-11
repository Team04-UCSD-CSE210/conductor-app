import 'dotenv/config';
import pg from 'pg';
import { recordDbSample } from './observability/diagnostics.js';

// Use DATABASE_URL from environment, or default to a test database URL for CI/tests
// This allows tests to run in CI environments without requiring a .env file
// Try multiple common PostgreSQL usernames for local development
const getDefaultTestUrl = () => {
  const username = process.env.USER || process.env.USERNAME || 'postgres';
  return `postgresql://${username}@localhost:5432/conductor_test`;
};

const url = process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'test' || process.env.VITEST
    ? process.env.TEST_DATABASE_URL || getDefaultTestUrl()
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

pool.on('connect', () => {});

// Wrap pool.query to capture duration/errors for diagnostics
const baseQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  const start = process.hrtime.bigint();
  try {
    const result = await baseQuery(...args);
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordDbSample({ durationMs });
    return result;
  } catch (err) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordDbSample({ durationMs, error: err.message });
    throw err;
  }
};

export async function assertDb() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    throw new Error(`Database connection failed: ${err.message}`);
  }
}
