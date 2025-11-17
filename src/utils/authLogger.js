import fs from 'fs/promises';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'logs', 'auth.log');

export async function logAuthEvent(event, data) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...data
  };

  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to write auth log:', error);
  }
}

export async function checkExcessiveLoginAttempts(email, timeWindow = 15 * 60 * 1000) {
  try {
    const logs = await fs.readFile(LOG_FILE, 'utf8');
    const entries = logs.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter(entry => 
        entry.event === 'LOGIN_FAILED' && 
        entry.email === email &&
        new Date(entry.timestamp) > new Date(Date.now() - timeWindow)
      );

    return entries.length >= 5;
  } catch {
    return false;
  }
}
