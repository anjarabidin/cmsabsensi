-- Migration: Create public_holidays table
-- Created: 2026-01-11
-- Description: Stores company and national holidays for leave calculation

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
