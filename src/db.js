import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL not defined in .env');
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
