-- Migration: Add missing columns for HRIS Core Features
-- Created: 2026-01-11
-- Description: Add home coordinates, annual leave quota, and shift break times

-- 1. Add home coordinates to profiles table (for WFH geofencing - Poin 2)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS home_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS home_longitude DOUBLE PRECISION;

COMMENT ON COLUMN profiles.home_latitude IS 'Latitude koordinat rumah karyawan untuk validasi WFH geofencing';
COMMENT ON COLUMN profiles.home_longitude IS 'Longitude koordinat rumah karyawan untuk validasi WFH geofencing';

-- 2. Add annual leave quota to profiles table (for leave calculation - Poin 1)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS annual_leave_quota INTEGER DEFAULT 12;

COMMENT ON COLUMN profiles.annual_leave_quota IS 'Jatah cuti tahunan karyawan (default: 12 hari per tahun)';

-- 3. Add break times to shifts table (for split shift support - Poin 4)
ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS break_start TIME,
ADD COLUMN IF NOT EXISTS break_end TIME;

COMMENT ON COLUMN shifts.break_start IS 'Waktu mulai istirahat untuk split shift (opsional)';
COMMENT ON COLUMN shifts.break_end IS 'Waktu selesai istirahat untuk split shift (opsional)';

-- 4. Ensure total_days column exists in leave_requests (for working days calculation - Poin 1)
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 1;

COMMENT ON COLUMN leave_requests.total_days IS 'Total hari kerja yang diajukan (exclude weekend & holidays)';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_home_coords ON profiles(home_latitude, home_longitude) 
WHERE home_latitude IS NOT NULL AND home_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- Update existing leave requests to calculate total_days if null
-- This is a one-time data fix for existing records
UPDATE leave_requests 
SET total_days = (end_date::date - start_date::date) + 1
WHERE total_days IS NULL OR total_days = 0;

COMMENT ON TABLE profiles IS 'User profiles with HRIS data including home coordinates and leave quota';
COMMENT ON TABLE shifts IS 'Work shift definitions with support for split shifts (break times)';
COMMENT ON TABLE leave_requests IS 'Employee leave requests with accurate working days calculation';
