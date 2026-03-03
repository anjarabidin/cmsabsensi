-- Migration: Lengkapi tabel vehicles yang sudah ada
-- Tabel vehicles sudah dibuat di migration 121, di sini kita tambahkan kolom baru
-- dan perbaiki RLS agar super_admin juga bisa CRUD

-- 1. Tambah kolom baru (IF NOT EXISTS agar aman dijalankan ulang)
ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS year INTEGER,
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Migrasi data: sinkronisasi is_active → status
-- Kendaraan yang is_active=false → 'maintenance', sisanya tetap 'available'
UPDATE public.vehicles
    SET status = CASE WHEN is_active = false THEN 'maintenance' ELSE 'available' END
    WHERE status = 'available'; -- hanya yang belum diubah

-- 3. Perbaiki RLS vehicles
-- Problem: FOR ALL tanpa WITH CHECK block INSERT/UPDATE
-- Juga tambah super_admin yang belum ada sama sekali

DROP POLICY IF EXISTS "Admins can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Super Admin can manage all vehicles" ON public.vehicles;

CREATE POLICY "Admin HR can manage vehicles"
    ON public.vehicles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin_hr'))
    WITH CHECK (public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "Super Admin can manage all vehicles"
    ON public.vehicles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Perbaiki RLS driver_trip_logs: tambah super_admin manage
DROP POLICY IF EXISTS "Super Admin can manage all trip logs" ON public.driver_trip_logs;
CREATE POLICY "Super Admin can manage all trip logs"
    ON public.driver_trip_logs FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Perbaiki RLS Admins can view all logs → tambah WITH CHECK untuk write
DROP POLICY IF EXISTS "Admins can manage all logs" ON public.driver_trip_logs;
CREATE POLICY "Admins can manage all logs"
    ON public.driver_trip_logs FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin_hr'))
    WITH CHECK (public.has_role(auth.uid(), 'admin_hr'));

NOTIFY pgrst, 'reload config';
