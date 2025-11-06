import 'dotenv/config';
import pg from 'pg';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const url = process.env.DATABASE_URL;

let pool;
let dbType = 'sqlite'; // Default to SQLite for development

if (url && url.startsWith('postgresql://')) {
  // Use PostgreSQL
  dbType = 'postgresql';
  pool = new pg.Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('connect', () => {
    if (process.env.DEBUG_DB) console.log('[db] PostgreSQL connect event');
  });
} else {
  // Use SQLite for development
  console.log('[db] Using SQLite for development');
  const db = new sqlite3.Database('./data/conductor.db');
  
  // Promisify SQLite methods
  const dbRun = promisify(db.run.bind(db));
  const dbGet = promisify(db.get.bind(db));
  const dbAll = promisify(db.all.bind(db));

  // Create a pool-like interface for SQLite
  pool = {
    query: async (text, params = []) => {
      try {
        const trimmedText = text.trim().toUpperCase();
        
        if (trimmedText.startsWith('SELECT') || trimmedText.startsWith('WITH')) {
          const rows = await dbAll(text, params);
          return { rows, rowCount: rows.length };
        } else if (trimmedText.startsWith('INSERT')) {
          const result = await dbRun(text, params);
          return { 
            rows: result && result.lastID ? [{ id: result.lastID }] : [], 
            rowCount: result ? (result.changes || 1) : 0
          };
        } else if (trimmedText.startsWith('UPDATE') || trimmedText.startsWith('DELETE')) {
          const result = await dbRun(text, params);
          return { 
            rows: [], 
            rowCount: result ? (result.changes || 0) : 0
          };
        } else {
          // DDL statements (CREATE, DROP, etc.)
          await dbRun(text, params);
          return { rows: [], rowCount: 0 };
        }
      } catch (error) {
        console.error('[db] SQLite query error:', error);
        throw error;
      }
    },
    connect: async () => ({
      query: pool.query,
      release: () => {}
    }),
    end: async () => {
      // Close SQLite database
      return new Promise((resolve) => {
        db.close((err) => {
          if (err) console.error('[db] Error closing SQLite:', err);
          resolve();
        });
      });
    }
  };
}

export { pool, dbType };

export async function assertDb() {
  try {
    if (dbType === 'postgresql') {
      await pool.query('SELECT 1');
    } else {
      await pool.query('SELECT 1');
    }
    if (process.env.DEBUG_DB) console.log(`[db] ${dbType} connection verified`);
  } catch (err) {
    throw new Error(`Database connection failed: ${err.message}`);
  }
}
