-- PPh 21 TER (Tarif Efektif Rata-rata) Rates 2024
-- Source: PP 58 Tahun 2023

CREATE TABLE IF NOT EXISTS pph21_ter_codes (
    code TEXT PRIMARY KEY, -- A, B, C
    description TEXT
);

CREATE TABLE IF NOT EXISTS pph21_ter_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code TEXT REFERENCES pph21_ter_codes(code),
    min_gross_income NUMERIC NOT NULL,
    max_gross_income NUMERIC NOT NULL, -- Use extremely high number for infinity
    rate_percentage NUMERIC NOT NULL, -- e.g. 0.05 for 5%
    created_at TIMESTAMPTZ DEFAULT now()
);

-- PTKP Status Mapping to TER Code
-- TER A: TK/0, TK/1, K/0
-- TER B: TK/2, TK/3, K/1, K/2
-- TER C: K/3
CREATE TABLE IF NOT EXISTS ptkp_ter_mappings (
    ptkp_status TEXT PRIMARY KEY, -- e.g. TK/0, K/1
    ter_category TEXT REFERENCES pph21_ter_codes(code),
    annual_ptkp_amount NUMERIC NOT NULL
);

-- Shift Management / Rostering
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Pagi, Siang, Malam
    code TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start TIME,
    break_end TIME,
    is_night_shift BOOLEAN DEFAULT false, -- Crosses midnight
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id),
    date DATE NOT NULL,
    is_day_off BOOLEAN DEFAULT false,
    override_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
);

-- SEED DATA FOR PPH 21 TER
INSERT INTO pph21_ter_codes (code, description) VALUES
('A', 'PTKP: TK/0 (54jt), TK/1 (58.5jt), K/0 (58.5jt)'),
('B', 'PTKP: TK/2 (63jt), TK/3 (67.5jt), K/1 (63jt), K/2 (67.5jt)'),
('C', 'PTKP: K/3 (72jt)')
ON CONFLICT DO NOTHING;

INSERT INTO ptkp_ter_mappings (ptkp_status, ter_category, annual_ptkp_amount) VALUES
('TK/0', 'A', 54000000),
('TK/1', 'A', 58500000),
('K/0', 'A', 58500000),
('TK/2', 'B', 63000000),
('TK/3', 'B', 67500000),
('K/1', 'B', 63000000),
('K/2', 'B', 67500000),
('K/3', 'C', 72000000)
ON CONFLICT (ptkp_status) DO UPDATE SET ter_category = EXCLUDED.ter_category;

-- SEED SOME SAMPLE RATES (Simplified for Briefness, usually has many rows)
-- CATEGORY A
INSERT INTO pph21_ter_rates (category_code, min_gross_income, max_gross_income, rate_percentage) VALUES
('A', 0, 5400000, 0.00),
('A', 5400001, 5650000, 0.0025),
('A', 5650001, 5950000, 0.005),
('A', 5950001, 6300000, 0.0075),
('A', 6300001, 6750000, 0.01),
('A', 6750001, 7500000, 0.015),
('A', 7500001, 8550000, 0.02),
('A', 8550001, 9650000, 0.0225),
('A', 9650001, 10050000, 0.025);
-- (In reality this table has ~40 rows per category, we start with critical ones)

-- SEED SHIFTS
INSERT INTO shifts (name, code, start_time, end_time) VALUES
('Shift Pagi (General)', 'PAGI', '08:00:00', '17:00:00'),
('Shift Siang', 'SIANG', '14:00:00', '22:00:00'),
('Shift Malam', 'MALAM', '22:00:00', '06:00:00')
ON CONFLICT DO NOTHING;
