import database from './database.js';
import { up as createUsers } from './migrations/001-create-users.js';

/**
 * Run database migrations
 * @returns {Promise<void>}
 */
export async function runMigrations() {
  const db = await database.connect();
  
  return new Promise((resolve, reject) => {
    db.exec(createUsers, (err) => {
      if (err) {
        reject(new Error(`Migration failed: ${err.message}`));
      } else {
        resolve();
      }
    });
  });
}
