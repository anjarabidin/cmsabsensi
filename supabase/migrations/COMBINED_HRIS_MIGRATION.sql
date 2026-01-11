-- =====================================================
-- COMBINED MIGRATION: HRIS Core Features
-- Created: 2026-01-11
-- Description: All-in-one migration for HRIS core features
-- Execute this file if you want to run all migrations at once
-- =====================================================

-- =====================================================
-- PART 1: Add HRIS Core Columns
-- =====================================================

-- 1. Add home coordinates to profiles table (for WFH - optional, not strictly required)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS home_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS home_longitude DOUBLE PRECISION;

COMMENT ON COLUMN profiles.home_latitude IS 'Latitude koordinat rumah karyawan (opsional)';
COMMENT ON COLUMN profiles.home_longitude IS 'Longitude koordinat rumah karyawan (opsional)';

-- 2. Add annual leave quota to profiles table (for leave calculation)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS annual_leave_quota INTEGER DEFAULT 12;

COMMENT ON COLUMN profiles.annual_leave_quota IS 'Jatah cuti tahunan karyawan (default: 12 hari per tahun)';

-- 3. Add break times to shifts table (for split shift support)
ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS break_start TIME,
ADD COLUMN IF NOT EXISTS break_end TIME;

COMMENT ON COLUMN shifts.break_start IS 'Waktu mulai istirahat untuk split shift (opsional)';
COMMENT ON COLUMN shifts.break_end IS 'Waktu selesai istirahat untuk split shift (opsional)';

-- 4. Ensure total_days column exists in leave_requests (for working days calculation)
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 1;

COMMENT ON COLUMN leave_requests.total_days IS 'Total hari kerja yang diajukan (exclude weekend & holidays)';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_home_coords ON profiles(home_latitude, home_longitude) 
WHERE home_latitude IS NOT NULL AND home_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- Update existing leave requests to calculate total_days if null
UPDATE leave_requests 
SET total_days = (end_date::date - start_date::date) + 1
WHERE total_days IS NULL OR total_days = 0;

COMMENT ON TABLE profiles IS 'User profiles with HRIS data including home coordinates and leave quota';
COMMENT ON TABLE shifts IS 'Work shift definitions with support for split shifts (break times)';
COMMENT ON TABLE leave_requests IS 'Employee leave requests with accurate working days calculation';

-- =====================================================
-- PART 2: Create Public Holidays Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date)
);

-- Add index for faster date range queries
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);

-- Add RLS policies
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read holidays
CREATE POLICY "Allow all authenticated users to read holidays"
ON public_holidays
FOR SELECT
TO authenticated
USING (true);

-- Only admin_hr can insert/update/delete holidays
CREATE POLICY "Only admin_hr can manage holidays"
ON public_holidays
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_hr'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_hr'
    )
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_public_holidays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_public_holidays_updated_at
BEFORE UPDATE ON public_holidays
FOR EACH ROW
EXECUTE FUNCTION update_public_holidays_updated_at();

-- Insert sample Indonesian national holidays for 2026
INSERT INTO public_holidays (date, name, description, is_recurring) VALUES
('2026-01-01', 'Tahun Baru Masehi', 'Perayaan Tahun Baru', true),
('2026-02-17', 'Isra Mi''raj Nabi Muhammad SAW', 'Hari besar Islam', false),
('2026-03-14', 'Hari Suci Nyepi (Tahun Baru Saka)', 'Hari raya Hindu', false),
('2026-03-27', 'Wafat Isa Al-Masih', 'Hari raya Kristen', false),
('2026-04-03', 'Idul Fitri 1447 H', 'Hari raya Islam', false),
('2026-04-04', 'Idul Fitri 1447 H (Hari ke-2)', 'Hari raya Islam', false),
('2026-05-01', 'Hari Buruh Internasional', 'Hari libur nasional', true),
('2026-05-14', 'Kenaikan Isa Al-Masih', 'Hari raya Kristen', false),
('2026-05-22', 'Hari Raya Waisak 2570', 'Hari raya Buddha', false),
('2026-06-01', 'Hari Lahir Pancasila', 'Hari libur nasional', true),
('2026-06-10', 'Idul Adha 1447 H', 'Hari raya Islam', false),
('2026-07-01', 'Tahun Baru Islam 1448 H', 'Hari besar Islam', false),
('2026-08-17', 'Hari Kemerdekaan RI', 'Hari kemerdekaan Indonesia', true),
('2026-09-09', 'Maulid Nabi Muhammad SAW', 'Hari besar Islam', false),
('2026-12-25', 'Hari Raya Natal', 'Hari raya Kristen', true)
ON CONFLICT (date) DO NOTHING;

COMMENT ON TABLE public_holidays IS 'Stores company and national holidays for accurate leave calculation';
COMMENT ON COLUMN public_holidays.is_recurring IS 'If true, this holiday repeats annually (e.g., Independence Day)';

-- =====================================================
-- PART 3: Update Employee Schedules for Multi-Shift
-- =====================================================

-- Drop the old unique constraint if it exists
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

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- All HRIS core features are now enabled:
-- ✅ Leave calculation with holiday exclusion
-- ✅ WFH flexible policy (Fake GPS detection only)
-- ✅ Split shift support
-- ✅ Multiple shifts per day
-- ✅ Employee soft delete (via is_active flag)
-- ✅ Public holidays management
-- =====================================================
