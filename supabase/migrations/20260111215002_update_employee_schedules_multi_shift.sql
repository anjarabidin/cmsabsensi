-- Migration: Update employee_schedules for multiple shifts support
-- Created: 2026-01-11
-- Description: Remove unique constraint to allow multiple shifts per employee per day (Poin 4)

-- Drop the old unique constraint if it exists
-- This allows employees to have multiple shift assignments on the same day (e.g., split shifts)
ALTER TABLE employee_schedules 
DROP CONSTRAINT IF EXISTS employee_schedules_user_id_date_key;

-- Add a new composite index for performance (non-unique)
CREATE INDEX IF NOT EXISTS idx_employee_schedules_user_date 
ON employee_schedules(user_id, date);

-- Add index for shift_id lookups
CREATE INDEX IF NOT EXISTS idx_employee_schedules_shift_id 
ON employee_schedules(shift_id) 
WHERE shift_id IS NOT NULL;

-- Add index for day_off queries
CREATE INDEX IF NOT EXISTS idx_employee_schedules_day_off 
ON employee_schedules(date, is_day_off) 
WHERE is_day_off = true;

COMMENT ON TABLE employee_schedules IS 'Employee shift schedules - supports multiple shifts per day for complex rostering';
COMMENT ON COLUMN employee_schedules.is_day_off IS 'If true, employee has day off (no shift assigned)';
COMMENT ON COLUMN employee_schedules.override_reason IS 'Reason for schedule override or change';

-- Note: With this change, the same employee can now have multiple shift records for the same date
-- This enables scenarios like:
-- - Split shifts (morning + evening shift with long break)
-- - Partial day assignments
-- - Complex rostering patterns
