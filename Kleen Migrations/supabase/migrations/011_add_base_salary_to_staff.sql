-- 011_add_base_salary_to_staff.sql
--
-- Add base_salary column to staff table for payroll calculations.
-- Also refresh PostgREST schema cache via NOTIFY pgrst.

ALTER TABLE IF EXISTS staff
  ADD COLUMN IF NOT EXISTS base_salary numeric NOT NULL DEFAULT 0;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
