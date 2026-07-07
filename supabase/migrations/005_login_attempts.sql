-- ============================================================
-- SparkFlow — Account Lockout Infrastructure
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  ip_address   text,
  success      boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lockout queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON login_attempts (email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_cleanup
  ON login_attempts (attempted_at);

-- RLS: only service role can read/write (API uses admin client)
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup old attempts (keep 30 days only)
-- Run this as a Supabase scheduled job or manually periodically:
-- DELETE FROM login_attempts WHERE attempted_at < now() - interval '30 days';

-- Verify
SELECT 'login_attempts table ready' AS status;
