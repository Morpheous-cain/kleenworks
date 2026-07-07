-- ============================================================
-- SparkFlow — Migration 008: Kleen Works Tenant Onboarding
-- ============================================================
-- This script is FULLY SELF-CONTAINED — no manual UUID copy-paste needed.
-- It uses a DO block with variables so everything links correctly.
--
-- BEFORE running this script:
--   1. Go to Supabase Dashboard → Authentication → Users → Add User
--      Email:    manager@kleenworks.co.ke   (use their real email)
--      Password: choose a strong password
--      Toggle "Auto Confirm User" ON
--   2. Copy the new user's UUID from the Users list
--   3. Replace the value of v_manager_auth_uuid below with that UUID
-- ============================================================

DO $$
DECLARE
  -- !! REPLACE THIS with the actual UUID from Supabase Auth → Users
  v_manager_auth_uuid uuid := 'REPLACE-WITH-MANAGER-AUTH-UUID';

  v_tenant_id  uuid;
  v_branch_id  uuid;
BEGIN

  -- ── 1. Create the Kleen Works tenant ─────────────────────────────────
  INSERT INTO tenants (name)
  VALUES ('Kleen Works')
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE 'Tenant created: %', v_tenant_id;

  -- ── 2. Create main branch ────────────────────────────────────────────
  INSERT INTO branches (tenant_id, name, location, status, water_level)
  VALUES (v_tenant_id, 'Kleen Works - Main Branch', 'Nairobi, Kenya', 'Open', 100)
  RETURNING id INTO v_branch_id;

  RAISE NOTICE 'Branch created: %', v_branch_id;

  -- ── 3. Create 3 service bays ─────────────────────────────────────────
  INSERT INTO bays (tenant_id, branch_id, name, status)
  VALUES
    (v_tenant_id, v_branch_id, 'Bay 1', 'Available'),
    (v_tenant_id, v_branch_id, 'Bay 2', 'Available'),
    (v_tenant_id, v_branch_id, 'Bay 3', 'Available');

  -- ── 4. Seed services catalogue ───────────────────────────────────────
  INSERT INTO services (tenant_id, name, category, price, duration, usp)
  VALUES
    (v_tenant_id, 'Basic Wash',       'Wash',   500,  20, 'Quick exterior rinse and dry'),
    (v_tenant_id, 'Full Wash',        'Wash',   800,  35, 'Interior and exterior full clean'),
    (v_tenant_id, 'Premium Detail',   'Detail', 2500, 90, 'Full detail with wax and interior shampoo'),
    (v_tenant_id, 'Engine Wash',      'Wash',   1500, 45, 'Engine bay degreasing and rinse'),
    (v_tenant_id, 'Carpet Pickup',    'Add-on', 1200, 45, 'Interior carpet deep clean'),
    (v_tenant_id, 'Air Freshener',    'Add-on',  200,  5, 'Premium scent application');

  -- ── 5. Seed starter inventory ────────────────────────────────────────
  INSERT INTO inventory_items (tenant_id, branch_id, name, quantity, unit, reorder_level, cost_per_unit)
  VALUES
    (v_tenant_id, v_branch_id, 'Car Shampoo (20L)',     4,  'Jerry Can', 2, 1800),
    (v_tenant_id, v_branch_id, 'Microfibre Cloths',    20,  'Pieces',   10,  120),
    (v_tenant_id, v_branch_id, 'Dashboard Polish',      6,  'Bottles',   3,  450),
    (v_tenant_id, v_branch_id, 'Tyre Shine',            5,  'Bottles',   2,  380),
    (v_tenant_id, v_branch_id, 'Air Freshener Units',  12,  'Pieces',    5,  150);

  -- ── 6. Seed chart of accounts ────────────────────────────────────────
  INSERT INTO chart_of_accounts (tenant_id, code, name, type, balance)
  VALUES
    (v_tenant_id, '1000', 'Cash',             'Asset',   0),
    (v_tenant_id, '1100', 'M-Pesa Float',     'Asset',   0),
    (v_tenant_id, '4000', 'Wash Revenue',     'Revenue', 0),
    (v_tenant_id, '4100', 'Add-on Revenue',   'Revenue', 0),
    (v_tenant_id, '5000', 'Cost of Supplies', 'Expense', 0),
    (v_tenant_id, '5100', 'Staff Wages',      'Expense', 0),
    (v_tenant_id, '5200', 'Utilities',        'Expense', 0);

  -- ── 7. Tenant settings ───────────────────────────────────────────────
  INSERT INTO tenant_settings (
    tenant_id, invoice_prefix, business_phone,
    business_email, sms_notifications, email_notifications
  )
  VALUES (
    v_tenant_id, 'KW', '+254700000000',
    'admin@kleenworks.co.ke', true, true
  );

  -- ── 8. Link the manager auth account ─────────────────────────────────
  IF v_manager_auth_uuid::text = 'REPLACE-WITH-MANAGER-AUTH-UUID' THEN
    RAISE WARNING 'Manager auth UUID not set — skipping user_roles insert. Run the INSERT below manually after creating the auth user.';
    RAISE NOTICE 'When ready, run: INSERT INTO user_roles (user_id, role, tenant_id, branch_id) VALUES (''<UUID>'', ''manager'', ''%'', ''%'');', v_tenant_id, v_branch_id;
  ELSE
    INSERT INTO user_roles (user_id, role, tenant_id, branch_id)
    VALUES (v_manager_auth_uuid, 'manager', v_tenant_id, v_branch_id);
    RAISE NOTICE 'Manager linked: %', v_manager_auth_uuid;
  END IF;

  -- ── 9. Verification ──────────────────────────────────────────────────
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Kleen Works onboarding complete';
  RAISE NOTICE 'Tenant ID  : %', v_tenant_id;
  RAISE NOTICE 'Branch ID  : %', v_branch_id;
  RAISE NOTICE '========================================';

END $$;

-- Final verification query — run this to confirm everything linked:
SELECT
  t.id          AS tenant_id,
  t.name        AS tenant_name,
  b.id          AS branch_id,
  b.name        AS branch_name,
  ur.role,
  ur.user_id    AS manager_auth_id,
  (SELECT count(*) FROM services s WHERE s.tenant_id = t.id)       AS services_count,
  (SELECT count(*) FROM bays    ba WHERE ba.tenant_id = t.id)       AS bays_count,
  (SELECT count(*) FROM inventory_items i WHERE i.tenant_id = t.id) AS inventory_count
FROM tenants t
LEFT JOIN branches   b  ON b.tenant_id = t.id
LEFT JOIN user_roles ur ON ur.tenant_id = t.id AND ur.role = 'manager'
WHERE t.name = 'Kleen Works';
