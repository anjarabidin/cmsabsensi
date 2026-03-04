-- POLICY FIX: Izinkan Admin HR & manager mengelola tabel manager_assignments
-- Sebelumnya kena block RLS saat Auto-Assign.

-- 1. Enable RLS (just in case)
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Hapus policy lama yang mungkin restrict
DROP POLICY IF EXISTS "Admin HR can manage assignments" ON public.manager_assignments;
DROP POLICY IF EXISTS "managers can see their own assignments" ON public.manager_assignments;

-- 3. Policy BARU: Admin & Admin HR BOLEH MELAKUKAN APAPUN (All Access)
CREATE POLICY "Admins can manage all assignments"
ON public.manager_assignments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin_hr')
    )
);

-- 4. Policy BARU: manager boleh melihat (SELECT) timnya sendiri
CREATE POLICY "managers can view own assignments"
ON public.manager_assignments
FOR SELECT
USING (
    auth.uid() = manager_id
);

-- Note: manager TIDAK BOLEH insert sendiri (kecuali dikasih akses), 
-- tapi biasanya Admin yang assign manager. 
-- Jika manager boleh assign bawahan sendiri, uncomment ini:
/*
CREATE POLICY "managers can insert own assignments"
ON public.manager_assignments
FOR INSERT
WITH CHECK (
    auth.uid() = manager_id
);
*/

-- 5. Pastikan user yang sedang login punya akses ke tabel profiles untuk cek role
-- (Biasanya sudah ada policy 'Users can view their own profile', tapi kita butuh baca role)
-- Grant select on profiles to authenticated users is standard.
