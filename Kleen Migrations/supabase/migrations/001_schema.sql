-- ============================================================
-- SparkFlow / Kleen Works — Migration 001: Core Schema
-- Run first, before any other migration.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── tenants ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── branches ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  location    text,
  status      text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed','Limited')),
  water_level integer NOT NULL DEFAULT 100 CHECK (water_level BETWEEN 0 AND 100),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── user_roles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('manager','agent','attendant','customer','saas-admin','driver')),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL
);

-- ── Helper: get current user's role ───────────────────────────────────────
-- Defined AFTER user_roles exists to avoid the forward-reference error.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── services ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  category   text NOT NULL DEFAULT 'Wash',
  price      numeric NOT NULL DEFAULT 0,
  duration   integer NOT NULL DEFAULT 30,
  usp        text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── bays ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bays (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id             uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  status                text NOT NULL DEFAULT 'Available'
    CHECK (status IN ('Available','Occupied','Maintenance')),
  current_vehicle_plate text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── staff ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name              text NOT NULL,
  role              text NOT NULL CHECK (role IN ('manager','agent','attendant','driver')),
  performance       integer NOT NULL DEFAULT 0,
  rating            numeric NOT NULL DEFAULT 0,
  attendance_status text NOT NULL DEFAULT 'Off Duty'
    CHECK (attendance_status IN ('On Duty','Off Duty','Leave')),
  points            integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── customers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  phone             text,
  email             text,
  subscription_tier text NOT NULL DEFAULT 'None'
    CHECK (subscription_tier IN ('None','Silver','Gold','Platinum')),
  loyalty_points    integer NOT NULL DEFAULT 0,
  total_visits      integer NOT NULL DEFAULT 0,
  total_spent       numeric NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── inventory_items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name          text NOT NULL,
  quantity      integer NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT 'units',
  reorder_level integer NOT NULL DEFAULT 5,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── vehicles_live ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles_live (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id      uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  plate          text NOT NULL,
  car_model      text,
  status         text NOT NULL DEFAULT 'Queue'
    CHECK (status IN ('Queue','In-Bay','Ready','Completed')),
  progress       integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  services       text[] NOT NULL DEFAULT '{}',
  total_amount   numeric NOT NULL DEFAULT 0,
  bay_id         uuid REFERENCES bays(id) ON DELETE SET NULL,
  customer_id    uuid REFERENCES customers(id) ON DELETE SET NULL,
  attendant_id   uuid REFERENCES staff(id) ON DELETE SET NULL,
  arrival_time   timestamptz NOT NULL DEFAULT now(),
  scheduled_for  timestamptz,
  booking_source text NOT NULL DEFAULT 'walk-in'
    CHECK (booking_source IN ('walk-in','customer-app')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── transactions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id            uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  vehicle_id           uuid REFERENCES vehicles_live(id) ON DELETE SET NULL,
  customer_id          uuid REFERENCES customers(id) ON DELETE SET NULL,
  plate                text,
  amount               numeric NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Paid','Pending','Failed')),
  payment_method       text NOT NULL DEFAULT 'Cash',
  services             text[] NOT NULL DEFAULT '{}',
  duration             integer NOT NULL DEFAULT 0,
  receipt              text,
  checkout_request_id  text,
  merchant_request_id  text,
  mpesa_phone          text,
  failure_reason       text,
  date                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request_id
  ON transactions (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

-- ── logistics_requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logistics_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id          uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id        uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name      text,
  item_type          text,
  status             text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending','Picked Up','In Transit','Delivered','Cancelled')),
  address            text,
  amount             numeric NOT NULL DEFAULT 0,
  assigned_staff_id  uuid REFERENCES staff(id) ON DELETE SET NULL,
  pickup_window      text,
  qr_tag             text,
  tracking_progress  integer NOT NULL DEFAULT 0,
  request_time       timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Realtime — enable for the two tables the app subscribes to
ALTER PUBLICATION supabase_realtime ADD TABLE bays;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles_live;
