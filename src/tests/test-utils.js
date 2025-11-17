import { pool } from '../db.js';

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 */
export async function delay(ms = 200) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for database to be ready by checking a simple query
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries in milliseconds
 */
export async function waitForDatabase(maxRetries = 5, delayMs = 50) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(delayMs);
    }
  }
  return false;
}

/**
 * Wait for a record to exist in the database
 * @param {string} table - Table name
 * @param {string} column - Column to check
 * @param {*} value - Value to check for
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries
 */
export async function waitForRecord(table, column, value, maxRetries = 10, delayMs = 50) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Handle UUID columns properly
      const { rows } = await pool.query(
        `SELECT * FROM ${table} WHERE ${column} = $1::uuid`,
        [value]
      );
      if (rows.length > 0) {
        return rows[0];
      }
    } catch (_error) {
      // If UUID cast fails, try without cast
      try {
        const { rows } = await pool.query(
          `SELECT * FROM ${table} WHERE ${column} = $1`,
          [value]
        );
        if (rows.length > 0) {
          return rows[0];
        }
      } catch (_e) {
        // Ignore and retry
      }
    }
    await delay(delayMs);
  }
  return null;
}

/**
 * Force database synchronization by committing any pending transactions
 */
export async function syncDatabase() {
  // Execute a simple query to ensure previous operations are committed
  await pool.query('SELECT 1');
  // Small delay to ensure commit propagation
  await delay(20);
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 */
export async function retryWithBackoff(fn, maxRetries = 5, initialDelay = 50) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delayMs = initialDelay * Math.pow(2, i);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

