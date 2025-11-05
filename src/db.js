import sqlite3 from 'sqlite3';
import { mkdir } from 'fs/promises';

let db;

export async function initDb() {
  await mkdir('data', { recursive: true });
  
  db = new sqlite3.Database('data/users.db');
  
  await new Promise((resolve, reject) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_email ON users(email);
    `, (err) => err ? reject(err) : resolve());
  });
}

export function getDb() {
  return db;
}
