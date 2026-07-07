-- ============================================================
-- SparkFlow / Kleen Works — Migration 004: Phase 3 Tables
-- Run after 003_transaction_rpc.sql
-- ============================================================

-- ── payroll_records ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id    uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  staff_id     uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  month        text NOT NULL,
  base_amount  numeric NOT NULL DEFAULT 0,
  commission   numeric NOT NULL DEFAULT 0,
  deductions   numeric NOT NULL DEFAULT 0,
  net_pay      numeric GENERATED ALWAYS AS (base_amount + commission - deductions) STORED,
  status       text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Approved','Disbursed')),
  mpesa_receipt text,
  disbursed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── expenses ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id    uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category     text NOT NULL,
  description  text NOT NULL,
  amount       numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  type         text NOT NULL DEFAULT 'Direct'
    CHECK (type IN ('Direct','Indirect','Petty Cash')),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── chart_of_accounts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code      text NOT NULL,
  name      text NOT NULL,
  type      text NOT NULL CHECK (type IN ('Asset','Liability','Equity','Revenue','Expense')),
  balance   numeric NOT NULL DEFAULT 0
);

-- ── tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id    uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'Todo'
    CHECK (status IN ('Todo','In Progress','Done')),
  priority     text NOT NULL DEFAULT 'Medium'
    CHECK (priority IN ('High','Medium','Low')),
  due_date     date,
  assigned_to  uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── subscription_plans ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      text NOT NULL,
  price     numeric NOT NULL DEFAULT 0,
  discount  integer NOT NULL DEFAULT 0,
  benefits  text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── customer_subscriptions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id     uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Active','Expired','Cancelled')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── vouchers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code      text NOT NULL,
  discount  numeric NOT NULL DEFAULT 0,
  type      text NOT NULL DEFAULT 'Percentage'
    CHECK (type IN ('Percentage','Fixed')),
  expiry    date NOT NULL,
  status    text NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Active','Redeemed','Expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- ── promotions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── tenant_settings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  logo_url            text,
  primary_color       text DEFAULT '#00A8CC',
  invoice_prefix      text DEFAULT 'INV',
  business_phone      text,
  business_email      text,
  address             text,
  mpesa_till_number   text,
  sms_notifications   boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── RLS for phase 3 tables ────────────────────────────────────────────────
ALTER TABLE payroll_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings      ENABLE ROW LEVEL SECURITY;

-- All phase 3 tables: same tenant-scoped policy pattern
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'payroll_records','expenses','chart_of_accounts','tasks',
    'subscription_plans','customer_subscriptions','vouchers',
    'promotions','tenant_settings'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "%s_tenant" ON %I
       FOR ALL USING (
         tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
       )',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── Default chart of accounts entries for a new tenant ────────────────────
-- (inserted by the onboarding script per-tenant, not here globally)
