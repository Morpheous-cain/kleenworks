-- 006_mpesa_columns.sql
-- Adds the columns needed to track a Daraja STK Push request through to
-- Safaricom's asynchronous callback.
--
-- checkout_request_id / merchant_request_id: returned immediately by
--   Safaricom when we initiate the STK Push. We store these so that when
--   the callback arrives (which only contains these IDs, not our internal
--   transaction id) we know which row to update.
--
-- mpesa_phone: the phone number the STK Push was actually sent to. May
--   differ slightly from the customer's stored phone (Daraja requires
--   254XXXXXXXXX format), so we record exactly what was sent.
--
-- failure_reason: populated when Safaricom's callback reports a non-zero
--   ResultCode (customer cancelled, insufficient funds, timeout, etc).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS checkout_request_id  text,
  ADD COLUMN IF NOT EXISTS merchant_request_id   text,
  ADD COLUMN IF NOT EXISTS mpesa_phone           text,
  ADD COLUMN IF NOT EXISTS failure_reason        text;

-- If transactions.status has a CHECK constraint limiting it to
-- ('Paid', 'Pending'), this widens it to include 'Failed' — needed
-- because M-Pesa STK Push attempts that the customer cancels, enters
-- the wrong PIN too many times, or that time out all need a terminal
-- state that is clearly distinct from a payment still in progress.
-- If no such constraint exists, this block is a safe no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_status_check'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT transactions_status_check;
  END IF;

  ALTER TABLE transactions
    ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('Paid', 'Pending', 'Failed'));
END $$;

-- Fast lookup when the callback arrives — Safaricom sends us back the
-- CheckoutRequestID and nothing else that maps to our schema.
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request_id
  ON transactions (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;
