-- 012_fix_attendance_status.sql
--
-- Update staff.attendance_status CHECK constraint to match API/frontend values
-- Old: 'On Duty','Off Duty','Leave'
-- New: 'Present','Late','Absent','On-Leave'

-- First, drop the existing CHECK constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_attendance_status_check;

-- Update existing data to map old values to new ones BEFORE adding new constraint
UPDATE staff
SET attendance_status = CASE
  WHEN attendance_status = 'On Duty' THEN 'Present'
  WHEN attendance_status = 'Off Duty' THEN 'Absent'
  WHEN attendance_status = 'Leave' THEN 'On-Leave'
  ELSE 'Absent'
END
WHERE attendance_status IN ('On Duty','Off Duty','Leave');

-- Add new CHECK constraint with correct values (now all data satisfies it's valid)
ALTER TABLE staff ADD CONSTRAINT staff_attendance_status_check
  CHECK (attendance_status IN ('Present','Late','Absent','On-Leave'));

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';