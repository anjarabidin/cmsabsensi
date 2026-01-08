-- SEED ENTERPRISE MASTER DATA
-- To be run after enterprise_schema.sql

-- 1. JOB GRADES (Golongan BUMN Standard - Example)
-- Using typical Grade 1-15 scale or Eselon-like structure
INSERT INTO job_grades (name, level_rank, min_salary, max_salary) VALUES
('Grade 1 (Staff Pemula)', 1, 4500000, 6000000),
('Grade 2 (Staff Senior)', 2, 6000000, 8000000),
('Grade 3 (Supervisor)', 3, 8000000, 12000000),
('Grade 4 (Assistant Manager)', 4, 12000000, 18000000),
('Grade 5 (Manager)', 5, 18000000, 25000000),
('Grade 6 (Senior Manager)', 6, 25000000, 35000000),
('Grade 7 (General Manager)', 7, 35000000, 50000000),
('Grade 8 (Vice President)', 8, 50000000, 75000000),
('Grade 9 (Director)', 9, 75000000, 120000000)
ON CONFLICT DO NOTHING;

-- 2. DIRECTORATES & DIVISIONS
-- Assuming 'organization_directorates' was seeded in previous migration.
-- Let's ensure divisions exist.

-- Main Directorates (Ensure they exist first to get IDs)
DO $$
DECLARE
    dir_main_id UUID;
    dir_fin_id UUID;
    dir_ops_id UUID;
BEGIN
    -- Get IDs (assuming names match previous seed)
    SELECT id INTO dir_main_id FROM organization_directorates WHERE code = 'DIRUT' LIMIT 1;
    SELECT id INTO dir_fin_id FROM organization_directorates WHERE code = 'DIRKEU' LIMIT 1;
    SELECT id INTO dir_ops_id FROM organization_directorates WHERE code = 'DIROPS' LIMIT 1;

    -- Seed Divisions
    IF dir_main_id IS NOT NULL THEN
        INSERT INTO organization_divisions (directorate_id, name, code) VALUES
        (dir_main_id, 'Divisi Sekretariat Perusahaan', 'SEC'),
        (dir_main_id, 'Divisi Satuan Pengawas Internal', 'SPI')
        ON CONFLICT (code) DO NOTHING;
    END IF;

    IF dir_fin_id IS NOT NULL THEN
        INSERT INTO organization_divisions (directorate_id, name, code) VALUES
        (dir_fin_id, 'Divisi Akuntansi & Pajak', 'AKT'),
        (dir_fin_id, 'Divisi Perbendaharaan', 'TRE'),
        (dir_fin_id, 'Divisi SDM & Umum', 'HRGA')
        ON CONFLICT (code) DO NOTHING;
    END IF;

    IF dir_ops_id IS NOT NULL THEN
        INSERT INTO organization_divisions (directorate_id, name, code) VALUES
        (dir_ops_id, 'Divisi Teknologi Informasi', 'TI'),
        (dir_ops_id, 'Divisi Layanan Pelanggan', 'CS'),
        (dir_ops_id, 'Divisi Pemasaran', 'MKT')
        ON CONFLICT (code) DO NOTHING;
    END IF;
END $$;

-- 3. DEPARTMENTS & POSITIONS (Linking to Divisions)
-- We will update existing departments to link to Divisions if possible, or create new ones.
-- For simplicity, let's create standard Job Positions for the HRGA Division (since we are focusing on HR)

DO $$
DECLARE
    div_hrga_id UUID;
    div_it_id UUID;
    dept_hr_id UUID;
    dept_it_id UUID;
    grade_staff_id UUID;
    grade_mgr_id UUID;
BEGIN
    -- Get Division IDs
    SELECT id INTO div_hrga_id FROM organization_divisions WHERE code = 'HRGA' LIMIT 1;
    SELECT id INTO div_it_id FROM organization_divisions WHERE code = 'TI' LIMIT 1;
    
    -- Get Grade IDs
    SELECT id INTO grade_staff_id FROM job_grades WHERE level_rank = 1 LIMIT 1;
    SELECT id INTO grade_mgr_id FROM job_grades WHERE level_rank = 5 LIMIT 1;

    -- Create/Update Departments
    IF div_hrga_id IS NOT NULL THEN
        -- Insert Department if not exists
        INSERT INTO departments (name, division_id, code) 
        VALUES ('Human Capital', div_hrga_id, 'HC')
        ON CONFLICT DO NOTHING; -- Assuming name constraint or just ignore
        
        SELECT id INTO dept_hr_id FROM departments WHERE name = 'Human Capital' LIMIT 1;
        
        -- Insert Items
        IF dept_hr_id IS NOT NULL AND grade_staff_id IS NOT NULL THEN
             INSERT INTO job_positions (department_id, grade_id, title, code) VALUES
             (dept_hr_id, grade_staff_id, 'Staff Recruitment', 'REC-01'),
             (dept_hr_id, grade_staff_id, 'Staff Payroll', 'PAY-01')
             ON CONFLICT DO NOTHING;
        END IF;

        IF dept_hr_id IS NOT NULL AND grade_mgr_id IS NOT NULL THEN
             INSERT INTO job_positions (department_id, grade_id, title, code, is_leadership) VALUES
             (dept_hr_id, grade_mgr_id, 'Manager Human Capital', 'MGR-HC', true)
             ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- IT Dept
    IF div_it_id IS NOT NULL THEN
        INSERT INTO departments (name, division_id, code) 
        VALUES ('Information Technology', div_it_id, 'IT')
        ON CONFLICT DO NOTHING;

        SELECT id INTO dept_it_id FROM departments WHERE name = 'Information Technology' LIMIT 1;

        IF dept_it_id IS NOT NULL AND grade_staff_id IS NOT NULL THEN
             INSERT INTO job_positions (department_id, grade_id, title, code) VALUES
             (dept_it_id, grade_staff_id, 'Frontend Developer', 'DEV-FE'),
             (dept_it_id, grade_staff_id, 'Backend Developer', 'DEV-BE')
             ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;
