-- 008_kleenworks_tenant.sql
--
-- Onboards "Kleen Works" as a second tenant in the existing multi-tenant
-- system. Same dashboard code, separate tenant_id, separate manager
-- login. Demo data is cloned from the first tenant's branch/services/
-- staff rows so the dashboard isn't empty on day one — swap these for
-- real data whenever Kleen Works has it.
--
-- AFTER running this SQL, create the manager's login in Supabase Auth:
--   Dashboard → Authentication → Users → Add User
--   Email: manager@kleenworks.com (or whatever they want)
--   Then run the final UPDATE at the bottom with that user's UUID.

-- 1. Create the tenant
INSERT INTO tenants (id, name, created_at)
VALUES (gen_random_uuid(), 'Kleen Works', now())
RETURNING id;
-- 👆 copy this id, you'll need it below. Call it <KW_TENANT_ID>.

-- 2. Create their branch (clone shape from an existing branch)
INSERT INTO branches (id, tenant_id, name, location, status, water_level, created_at)
SELECT gen_random_uuid(), '<KW_TENANT_ID>', 'Kleen Works - Main Branch', location, status, water_level, now()
FROM branches
LIMIT 1
RETURNING id;
-- 👆 copy this id too. Call it <KW_BRANCH_ID>.

-- 3. Clone services into the new tenant
INSERT INTO services (id, tenant_id, name, category, price, duration, usp, created_at)
SELECT gen_random_uuid(), '<KW_TENANT_ID>', name, category, price, duration, usp, now()
FROM services
WHERE tenant_id = (SELECT tenant_id FROM branches WHERE id != '<KW_BRANCH_ID>' LIMIT 1);

-- 4. Clone bays into the new branch (3 bays, same pattern as original)
INSERT INTO bays (id, tenant_id, branch_id, name, status, created_at)
SELECT gen_random_uuid(), '<KW_TENANT_ID>', '<KW_BRANCH_ID>', name, 'Available', now()
FROM bays
WHERE branch_id != '<KW_BRANCH_ID>'
LIMIT 3;

-- 5. Link the manager auth user (create them in Supabase Auth UI first,
--    then paste their UUID below)
INSERT INTO user_roles (user_id, role, tenant_id, branch_id)
VALUES ('<KW_MANAGER_AUTH_UUID>', 'manager', '<KW_TENANT_ID>', '<KW_BRANCH_ID>');

-- 6. Verify
SELECT t.name AS tenant, b.name AS branch, ur.role, ur.user_id
FROM tenants t
JOIN branches b ON b.tenant_id = t.id
JOIN user_roles ur ON ur.tenant_id = t.id
WHERE t.name = 'Kleen Works';
