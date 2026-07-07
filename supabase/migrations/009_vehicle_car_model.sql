-- 009_vehicle_car_model.sql
--
-- Adds a car_model column so the agent's check-in form can capture
-- what the vehicle actually is (e.g. "Toyota Axio", "Probox") not just
-- the plate. Purely descriptive — no logic depends on it, so it's a
-- safe additive column with no constraint.

ALTER TABLE vehicles_live
  ADD COLUMN IF NOT EXISTS car_model text;
