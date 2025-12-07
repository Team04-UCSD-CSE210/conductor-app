// Simple in-memory diagnostics aggregator for API categories.
// Tracks request count, total duration, min/max duration, and status code counts.

const store = new Map();
const dbStats = {
  count: 0,
  slowCount: 0,
  errorCount: 0,
  totalDurationMs: 0,
  minDurationMs: Number.POSITIVE_INFINITY,
  maxDurationMs: 0,
  lastError: null,
};

const initEntry = () => ({
  count: 0,
  totalDurationMs: 0,
  minDurationMs: Number.POSITIVE_INFINITY,
  maxDurationMs: 0,
  statusCounts: {},
});

export const recordApiMetric = ({ category, durationMs, status }) => {
  if (!store.has(category)) {
    store.set(category, initEntry());
  }
  const entry = store.get(category);
  entry.count += 1;
  entry.totalDurationMs += durationMs;
  entry.minDurationMs = Math.min(entry.minDurationMs, durationMs);
  entry.maxDurationMs = Math.max(entry.maxDurationMs, durationMs);
  const statusKey = String(status);
  entry.statusCounts[statusKey] = (entry.statusCounts[statusKey] || 0) + 1;
};

export const recordDbSample = ({ durationMs, error }) => {
  dbStats.count += 1;
  dbStats.totalDurationMs += durationMs;
  dbStats.minDurationMs = Math.min(dbStats.minDurationMs, durationMs);
  dbStats.maxDurationMs = Math.max(dbStats.maxDurationMs, durationMs);
  if (durationMs >= 500) dbStats.slowCount += 1;
  if (error) {
    dbStats.errorCount += 1;
    dbStats.lastError = {
      message: error,
      at: new Date().toISOString(),
    };
  }
};

export const getDiagnosticsSnapshot = () => {
  const result = {};
  for (const [category, entry] of store.entries()) {
    result[category] = {
      count: entry.count,
      totalDurationMs: entry.totalDurationMs,
      avgDurationMs: entry.count > 0 ? entry.totalDurationMs / entry.count : 0,
      minDurationMs: entry.minDurationMs === Number.POSITIVE_INFINITY ? 0 : entry.minDurationMs,
      maxDurationMs: entry.maxDurationMs,
      statusCounts: entry.statusCounts,
    };
  }
  return {
    categories: result,
    db: {
      count: dbStats.count,
      slowCount: dbStats.slowCount,
      errorCount: dbStats.errorCount,
      totalDurationMs: dbStats.totalDurationMs,
      avgDurationMs: dbStats.count > 0 ? dbStats.totalDurationMs / dbStats.count : 0,
      minDurationMs: dbStats.minDurationMs === Number.POSITIVE_INFINITY ? 0 : dbStats.minDurationMs,
      maxDurationMs: dbStats.maxDurationMs,
      lastError: dbStats.lastError,
    },
  };
};

export const resetDiagnostics = () => store.clear();

// Express middleware factory for per-category tracking
export const trackApiCategory = (category) => (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordApiMetric({ category, durationMs, status: res.statusCode });
  });
  next();
};
