-- 19-diagnostics-history.sql
-- Create diagnostics history table and seed 30 days of data (11/07 - 12/06)

CREATE TABLE IF NOT EXISTS diagnostics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed 30 days with synthetic metrics
INSERT INTO diagnostics_history (snapshot_date, data)
SELECT d::date,
       jsonb_build_object(
         'api_total', 1500 + (EXTRACT(DAY FROM d) * 15),
         'api_avg_ms', 90 + (EXTRACT(DAY FROM d) % 7) * 5,
         'api_success_ratio', 0.95 + ((EXTRACT(DAY FROM d)::int % 5) * 0.005),
         'db_avg_ms', 28 + (EXTRACT(DAY FROM d) % 5) * 2,
         'db_slow', 5 + (EXTRACT(DAY FROM d) % 3),
         'db_errors', EXTRACT(DAY FROM d)::int % 2,
         'pool', jsonb_build_object(
            'max', 10,
            'total', 6 + (EXTRACT(DAY FROM d) % 4),
            'idle', 2 + (EXTRACT(DAY FROM d) % 3),
            'waiting', EXTRACT(DAY FROM d)::int % 2
         ),
         'loadavg', jsonb_build_array(
            0.3 + (EXTRACT(DAY FROM d) % 4) * 0.05,
            0.25 + (EXTRACT(DAY FROM d) % 4) * 0.04,
            0.2 + (EXTRACT(DAY FROM d) % 4) * 0.03
         ),
         'mem_mb', 420 + (EXTRACT(DAY FROM d) % 6) * 8,
         'elu', 0.18 + (EXTRACT(DAY FROM d) % 5) * 0.01
       )
FROM generate_series('2025-11-07'::date, '2025-12-06'::date, '1 day') AS d
ON CONFLICT (snapshot_date) DO NOTHING;
