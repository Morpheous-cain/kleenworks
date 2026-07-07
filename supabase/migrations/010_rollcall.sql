-- 010_rollcall.sql
--
-- Staff clock-in / clock-out log table.
-- Supports both manual UI entries and fingerprint scanner webhook entries.
-- source column distinguishes them for audit purposes.

CREATE TABLE IF NOT EXISTS rollcall_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id   uuid NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  action     text NOT NULL CHECK (action IN ('clock-in', 'clock-out')),
  source     text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'fingerprint')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rollcall_tenant_date
  ON rollcall_logs (tenant_id, created_at DESC);

ALTER TABLE rollcall_logs ENABLE ROW LEVEL SECURITY;

-- Managers can see all logs; staff can only see their own
CREATE POLICY "rollcall_manager_all" ON rollcall_logs
  FOR ALL USING (get_my_role() = 'manager');

CREATE POLICY "rollcall_staff_own" ON rollcall_logs
  FOR SELECT USING (
    staff_id IN (
      SELECT id FROM staff WHERE user_id = auth.uid()
    )
  );

-- Fingerprint scanner writes via service-role (bypasses RLS) so no extra
-- policy is needed for that path.
