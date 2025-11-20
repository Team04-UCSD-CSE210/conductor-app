-- Schema for Conductor authentication logging and alerting

CREATE TABLE IF NOT EXISTS auth_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  message TEXT,
  user_email TEXT,
  ip_address TEXT,
  user_id TEXT,
  path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_event_created
  ON auth_logs (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_auth_logs_email_created
  ON auth_logs (user_email, created_at);

CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_created
  ON auth_logs (ip_address, created_at);
