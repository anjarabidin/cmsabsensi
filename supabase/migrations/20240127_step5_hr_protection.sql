-- STEP 5: HR ADMIN PROTECTION & FINAL SECURITY 
-- Script ini fokus melindungi Super Admin dari kesalahan/tindakan Admin HR
-- serta memperbaiki logika audit.

-- 1. PROTEKSI SUPER ADMIN (Anti-Kudeta)
-- Mencegah Admin HR mengedit atau menonaktifkan Super Admin via policy database.
-- Walaupun UI sudah disembunyikan, API harus tetap dilindungi.

CREATE OR REPLACE FUNCTION public.check_admin_updates() RETURNS TRIGGER AS $$
BEGIN
  -- Jika target yang diedit/dihapus adalah Super Admin
  -- DAN pelaku BUKAN Super Admin, maka TOLAK.
  IF (OLD.role = 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
       RAISE EXCEPTION 'Forbidden: You cannot modify a Super Admin account.';
    END IF;
  END IF;
  
  -- Jika mencoba mengubah role KE Super Admin (sudah ada di script sebelumnya, tapi diperkuat disini)
  IF (NEW.role = 'super_admin' AND OLD.role != 'super_admin') THEN
     IF NOT public.has_role(auth.uid(), 'super_admin') THEN
       RAISE EXCEPTION 'Forbidden: Only Super Admin can promote others to Super Admin.';
     END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang Trigger pada tabel Profiles (Update & Delete)
DROP TRIGGER IF EXISTS protect_super_admin_update ON public.profiles;
CREATE TRIGGER protect_super_admin_update
BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_admin_updates();


-- 2. FIX AKSES MASTER DATA (Memastikan Admin HR bisa hapus/edit)
-- Admin HR perlu akses penuh ke departments/job_positions/shifts/holidays.
-- Script step4 sudah handle open access, tapi kita pastikan ulang DELETE policy.

DROP POLICY IF EXISTS "Admins can delete departments" ON public.departments;
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete job_positions" ON public.job_positions;
CREATE POLICY "Admins can delete job_positions" ON public.job_positions FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete shifts" ON public.shifts;
CREATE POLICY "Admins can delete shifts" ON public.shifts FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete holidays" ON public.holidays;
CREATE POLICY "Admins can delete holidays" ON public.holidays FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));


-- 3. AUDIT LOG UNTUK ADMIN HR
-- Memastikan Admin HR bisa melihat log aktivitas yang relevan (misal: koreksi absensi).
-- Tapi System Logs tetap eksklusif Super Admin.
-- Kita buat view terpisah atau policy? 
-- Sesuai request "Audit lebih dalam", kita berikan akses READ ONLY ke table audit_logs terbatas.

-- Revisi Policy audit_logs: Super Admin lihat semua. Admin HR lihat logs terkait 'attendance', 'leave', 'overtime'.
DROP POLICY IF EXISTS "Admins view relevant audit logs" ON public.audit_logs;
CREATE POLICY "Admins view relevant audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        public.has_role(auth.uid(), 'super_admin') -- Super Admin Full Access
        OR (
            public.has_role(auth.uid(), 'admin_hr') 
            AND table_name IN ('attendances', 'leave_requests', 'overtime_requests', 'attendance_corrections', 'reimbursements')
        )
    );
