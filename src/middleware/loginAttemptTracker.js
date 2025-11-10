const failedAttempts = {}; // In-memory cache for demo (Redis recommended for production)
const MAX_ATTEMPTS = 3;
const BLOCK_TIME_MS = 5 * 60 * 1000; // 5 minutes

export function trackLoginAttempt(email, success, _res) {
  const key = email.toLowerCase();

  if (!failedAttempts[key]) {
    failedAttempts[key] = { count: 0, lastAttempt: Date.now() };
  }

  if (success) {
    failedAttempts[key] = { count: 0, lastAttempt: Date.now() };
    return;
  }

  failedAttempts[key].count++;
  failedAttempts[key].lastAttempt = Date.now();

  if (failedAttempts[key].count >= MAX_ATTEMPTS) {
    failedAttempts[key].blockedUntil = Date.now() + BLOCK_TIME_MS;
  }
}

export function isBlocked(email) {
  const record = failedAttempts[email?.toLowerCase()];
  if (!record) return false;
  if (record.blockedUntil && record.blockedUntil > Date.now()) {
    return true;
  }
  return false;
}
