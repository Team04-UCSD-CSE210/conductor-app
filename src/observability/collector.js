import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { getDiagnosticsSnapshot } from './diagnostics.js';
import { pool } from '../db.js';

/**
 * Build a full diagnostics snapshot (server + api + db + pool).
 */
export const buildDiagnosticsSnapshot = () => {
  const base = getDiagnosticsSnapshot();
  const mem = process.memoryUsage();
  const elu = performance.eventLoopUtilization
    ? performance.eventLoopUtilization()
    : null;
  const activeHandles = typeof process._getActiveHandles === 'function'
    ? process._getActiveHandles().length
    : null;
  const activeRequests = typeof process._getActiveRequests === 'function'
    ? process._getActiveRequests().length
    : null;
  const poolStats = {
    total: pool.totalCount || 0,
    idle: pool.idleCount || 0,
    waiting: pool.waitingCount || 0,
    max: pool.options?.max || pool.options?.maxClients || null,
  };
  const categories = base.categories || {};
  const totalApi = Object.values(categories).reduce((acc, d) => acc + (d.count || 0), 0);
  const successApi = Object.values(categories).reduce((acc, d) => {
    const sc = d.statusCounts || {};
    return acc + Object.entries(sc).reduce((inner, [code, count]) => {
      const n = Number(code);
      return inner + (n >= 100 && n < 400 ? count : 0);
    }, 0);
  }, 0);
  const avgApiLatency = totalApi > 0
    ? Object.values(categories).reduce((acc, d) => acc + (d.totalDurationMs || 0), 0) / totalApi
    : 0;

  return {
    generated_at: new Date().toISOString(),
    ...base,
    pool: poolStats,
    server: {
      uptime_sec: process.uptime(),
      loadavg: os.loadavg(),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      cpu_count: os.cpus()?.length || 0,
      event_loop_utilization: elu,
      active_handles: activeHandles,
      active_requests: activeRequests,
    },
    summary: {
      api_total: totalApi,
      api_avg_ms: avgApiLatency,
      api_success_ratio: totalApi > 0 ? successApi / totalApi : 1,
      db_avg_ms: base.db?.avgDurationMs || 0,
      db_slow: base.db?.slowCount || 0,
      db_errors: base.db?.errorCount || 0,
    },
  };
};

/**
 * Persist a daily snapshot into diagnostics_history.
 */
export const persistDiagnosticsSnapshot = async (snapshot, date = new Date()) => {
  const day = new Date(date);
  const dateOnly = day.toISOString().slice(0, 10); // YYYY-MM-DD
  await pool.query(
    `INSERT INTO diagnostics_history (snapshot_date, data)
     VALUES ($1::date, $2::jsonb)
     ON CONFLICT (snapshot_date) DO UPDATE SET data = EXCLUDED.data, created_at = NOW()`,
    [dateOnly, snapshot.summary ? snapshot.summary : snapshot]
  );
};
