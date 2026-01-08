-- ENTERPRISE HRIS SCHEMA UPDATE
-- Based on requirements for BPJS Subsidiary Standards

-- 1. MASTER ORGANIZATION HIERARCHY
-- Top Level: E.g., Directorate of Finance, Directorate of Operations
CREATE TABLE IF NOT EXISTS organization_directorates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Second Level: E.g., Division of Human Capital, Division of IT
CREATE TABLE IF NOT EXISTS organization_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    directorate_id UUID REFERENCES organization_directorates(id),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Third Level: Departments (Enhancing existing table if needed, otherwise using this hierarchy)
-- We will link the existing 'departments' table to 'organization_divisions'
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'division_id') THEN
        ALTER TABLE departments ADD COLUMN division_id UUID REFERENCES organization_divisions(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'code') THEN
        ALTER TABLE departments ADD COLUMN code TEXT;
    END IF;
END $$;

-- 2. MASTER JOB GRADING & POSITIONS (Jenjang Jabatan & Posisi)
-- Critical for Enterprise Payroll struct
CREATE TABLE IF NOT EXISTS job_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- E.g., "Grade 1", "Eselon I"
    level_rank INTEGER NOT NULL, -- 1 (Lowest) to N (Highest)
    min_salary NUMERIC DEFAULT 0,
    max_salary NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id),
    grade_id UUID REFERENCES job_grades(id),
    title TEXT NOT NULL, -- E.g., "Senior Manager IT"
    code TEXT,
    is_leadership BOOLEAN DEFAULT false, -- If true, counts as 'Atasan'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. EMPLOYMENT STATUS (Status Kepegawaian)
CREATE TABLE IF NOT EXISTS employment_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- PKWT, PKWTT, Probation
    category TEXT CHECK (category IN ('permanent', 'contract', 'probation', 'intern', 'freelance')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. BANK DATA (For Payroll)
CREATE TABLE IF NOT EXISTS banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- BCA, BNI, Mandiri
    code TEXT, -- Clearing Code
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. EMPLOYEE FAMILY (Keluarga - For BPJS/Tax)
CREATE TABLE IF NOT EXISTS employee_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    relationship TEXT CHECK (relationship IN ('spouse', 'child', 'parent', 'sibling')),
    date_of_birth DATE,
    ktp_number TEXT,
    gender TEXT CHECK (gender IN ('male', 'female')),
    is_bpjs_covered BOOLEAN DEFAULT false,
    education_level TEXT,
    job TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ENRICHING PROFILES (Data Karyawan Lengkap)
-- Adding fields required for Official HR Records
DO $$ 
BEGIN
    -- Personal IDs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'nik_ktp') THEN
        ALTER TABLE profiles ADD COLUMN nik_ktp TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'kk_number') THEN
        ALTER TABLE profiles ADD COLUMN kk_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'npwp_number') THEN
        ALTER TABLE profiles ADD COLUMN npwp_number TEXT;
    END IF;

    -- Demographics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN
        ALTER TABLE profiles ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'place_of_birth') THEN
        ALTER TABLE profiles ADD COLUMN place_of_birth TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'date_of_birth') THEN
        ALTER TABLE profiles ADD COLUMN date_of_birth DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'marital_status') THEN
        ALTER TABLE profiles ADD COLUMN marital_status TEXT CHECK (marital_status IN ('single', 'married', 'widowed', 'divorced'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'religion') THEN
        ALTER TABLE profiles ADD COLUMN religion TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'blood_type') THEN
        ALTER TABLE profiles ADD COLUMN blood_type TEXT;
    END IF;

    -- Addresses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_ktp') THEN
        ALTER TABLE profiles ADD COLUMN address_ktp TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_domicile') THEN
        ALTER TABLE profiles ADD COLUMN address_domicile TEXT;
    END IF;

    -- Family Background (Mother's maiden name is crucial for payroll/insurance)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'mother_maiden_name') THEN
        ALTER TABLE profiles ADD COLUMN mother_maiden_name TEXT;
    END IF;

    -- Banking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bank_id') THEN
        ALTER TABLE profiles ADD COLUMN bank_id UUID REFERENCES banks(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bank_account_number') THEN
        ALTER TABLE profiles ADD COLUMN bank_account_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bank_account_holder') THEN
        ALTER TABLE profiles ADD COLUMN bank_account_holder TEXT;
    END IF;

    -- Employment Details Links
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'job_position_id') THEN
        ALTER TABLE profiles ADD COLUMN job_position_id UUID REFERENCES job_positions(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'job_grade_id') THEN
        ALTER TABLE profiles ADD COLUMN job_grade_id UUID REFERENCES job_grades(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'employment_status_id') THEN
        ALTER TABLE profiles ADD COLUMN employment_status_id UUID REFERENCES employment_statuses(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'end_contract_date') THEN
        ALTER TABLE profiles ADD COLUMN end_contract_date DATE;
    END IF;

    -- Onboarding Workflow
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_step') THEN
        ALTER TABLE profiles ADD COLUMN onboarding_step INTEGER DEFAULT 1; -- Tracking progress
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_status') THEN
        ALTER TABLE profiles ADD COLUMN onboarding_status TEXT DEFAULT 'draft' CHECK (onboarding_status IN ('draft', 'pending_verification', 'approved', 'rejected'));
    END IF;
END $$;


-- SEED DEFAULT DATA (To ensure system isn't empty)
INSERT INTO organization_directorates (name, code) VALUES 
('Direktorat Utama', 'DIRUT'),
('Direktorat Keuangan', 'DIRKEU'),
('Direktorat Operasional', 'DIROPS')
ON CONFLICT (code) DO NOTHING;

-- Seed banks
INSERT INTO banks (name, code) VALUES
('Bank Mandiri', '008'),
('Bank Central Asia (BCA)', '014'),
('Bank Negara Indonesia (BNI)', '009'),
('Bank Rakyat Indonesia (BRI)', '002'),
('Bank Syariah Indonesia (BSI)', '451')
ON CONFLICT DO NOTHING;

-- Seed employment statuses
INSERT INTO employment_statuses (name, category) VALUES
('PKWTT (Tetap)', 'permanent'),
('PKWT I (Kontrak 1th)', 'contract'),
('PKWT II (Kontrak 2th)', 'contract'),
('Probation (3 Bulan)', 'probation'),
('Freelance', 'freelance')
ON CONFLICT DO NOTHING;
