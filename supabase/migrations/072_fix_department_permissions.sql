-- DATA MASTER HARDENING (DEPARTMENTS & POSITIONS)
-- Tujuan: Mengunci akses Data Master agar hanya Admin HR yang bisa mengubah struktur.
-- Manager hanya diperbolehkan MELIHAT (Read-Only) untuk referensi.

-- 1. Pastikan RLS Aktif
ALTER TABLE IF EXISTS public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_positions ENABLE ROW LEVEL SECURITY;

-- 2. Reset Policy Departemen (Hapus semua policy lama yang mungkin bocor)
DROP POLICY IF EXISTS "Departments are viewable by authenticated users" ON public.departments;
DROP POLICY IF EXISTS "Admin HR can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Managers can update own department" ON public.departments; -- Hapus izin Manager edit dept
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.departments; -- Jaga-jaga jika ada

-- 3. Policy Baru Departemen (Strict)
-- VIEW: Semua user yang login boleh lihat daftar departemen (untuk dropdown, filter, dll)
CREATE POLICY "View Departments" ON public.departments
    FOR SELECT
    TO authenticated
    USING (true);

-- MANAGE: Hanya Admin HR yang boleh Tambah, Edit, Hapus
CREATE POLICY "Manage Departments (Admin Only)" ON public.departments
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin_hr'));


-- 4. Reset Policy Jabatan (Job Positions)
DROP POLICY IF EXISTS "Job positions are viewable by authenticated users" ON public.job_positions;
DROP POLICY IF EXISTS "Admin HR can manage job positions" ON public.job_positions;

-- 5. Policy Baru Jabatan (Strict)
-- VIEW: Semua user boleh lihat
CREATE POLICY "View Job Positions" ON public.job_positions
    FOR SELECT
    TO authenticated
    USING (true);

-- MANAGE: Hanya Admin HR yang boleh
CREATE POLICY "Manage Job Positions (Admin Only)" ON public.job_positions
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin_hr'));

-- Catatan:
-- Dengan script ini, Manager yang mencoba menghapus/edit departemen akan ditolak oleh database (Row Level Security Violation).
