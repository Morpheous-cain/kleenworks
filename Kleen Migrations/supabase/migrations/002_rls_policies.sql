-- ============================================================
-- SparkFlow / Kleen Works — Migration 002: Row Level Security
-- Run after 001_schema.sql
-- ============================================================

-- Enable RLS on every table
ALTER TABLE tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bays              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles_live     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_requests ENABLE ROW LEVEL SECURITY;

-- ── tenants ───────────────────────────────────────────────────────────────
CREATE POLICY "tenant_own" ON tenants
  FOR ALL USING (
    id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── user_roles ────────────────────────────────────────────────────────────
CREATE POLICY "user_roles_own" ON user_roles
  FOR ALL USING (user_id = auth.uid());

-- ── branches ──────────────────────────────────────────────────────────────
CREATE POLICY "branches_tenant" ON branches
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── services ──────────────────────────────────────────────────────────────
CREATE POLICY "services_tenant" ON services
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── bays ──────────────────────────────────────────────────────────────────
CREATE POLICY "bays_tenant" ON bays
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── staff ─────────────────────────────────────────────────────────────────
CREATE POLICY "staff_tenant" ON staff
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── customers ─────────────────────────────────────────────────────────────
CREATE POLICY "customers_tenant" ON customers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── inventory_items ───────────────────────────────────────────────────────
CREATE POLICY "inventory_tenant" ON inventory_items
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── vehicles_live ─────────────────────────────────────────────────────────
CREATE POLICY "vehicles_tenant" ON vehicles_live
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── transactions ──────────────────────────────────────────────────────────
CREATE POLICY "transactions_tenant" ON transactions
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ── logistics_requests ────────────────────────────────────────────────────
CREATE POLICY "logistics_manager_insert" ON logistics_requests
  FOR INSERT WITH CHECK (get_my_role() = 'manager');

CREATE POLICY "logistics_manager_delete" ON logistics_requests
  FOR DELETE USING (get_my_role() = 'manager');

CREATE POLICY "logistics_select" ON logistics_requests
  FOR SELECT USING (
    get_my_role() = 'manager'
    OR customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

CREATE POLICY "logistics_update" ON logistics_requests
  FOR UPDATE USING (
    get_my_role() = 'manager'
    OR assigned_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );
