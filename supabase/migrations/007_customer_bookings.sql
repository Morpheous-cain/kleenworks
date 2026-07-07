-- 007_customer_bookings.sql
--
-- Adds scheduling support so customers can book a wash for a future
-- time slot instead of only being checked in by an agent on arrival.
--
-- scheduled_for: when the customer wants the wash done. NULL means the
--   row was created the normal way (agent walk-in check-in), so nothing
--   about the existing flow changes.
--
-- booking_source: distinguishes a customer self-service booking from
--   the normal agent-created check-in. Lets the manager/agent UI show
--   "Booked by customer" vs "Walk-in" without guessing from other
--   fields.

ALTER TABLE vehicles_live
  ADD COLUMN IF NOT EXISTS scheduled_for   timestamptz,
  ADD COLUMN IF NOT EXISTS booking_source  text NOT NULL DEFAULT 'walk-in'
    CHECK (booking_source IN ('walk-in', 'customer-app'));

CREATE INDEX IF NOT EXISTS idx_vehicles_live_scheduled_for
  ON vehicles_live (branch_id, scheduled_for)
  WHERE scheduled_for IS NOT NULL;
