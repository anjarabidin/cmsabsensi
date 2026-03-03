-- Migration: Setup Storage bucket untuk foto nota driver
-- Bucket: driver-receipts (sudah ada policy RLS di storage)

-- Note: Bucket creation harus dilakukan via Supabase Dashboard atau API,
-- karena DDL SQL tidak mendukung storage bucket creation.
-- Script ini mendokumentasikan intent dan setup policy level tabel.

-- Tambahkan kolom receipt_url ke driver_expenses jika belum ada
-- (kolom ini sudah ada di migration 124, tapi ditambahkan di sini untuk keamanan)
ALTER TABLE public.driver_expenses
    ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Tambahkan super_admin ke policy driver_expenses (bisa lihat dan kelola semua)
DROP POLICY IF EXISTS "Super Admin can manage all expenses" ON public.driver_expenses;
CREATE POLICY "Super Admin can manage all expenses"
    ON public.driver_expenses FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Perbaiki policy "Admins and Managers can view all expenses" → tambah super_admin
DROP POLICY IF EXISTS "Admins and Managers can view all expenses" ON public.driver_expenses;
CREATE POLICY "Admins and Managers can view all expenses"
    ON public.driver_expenses FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'super_admin') OR
        public.has_role(auth.uid(), 'admin_hr') OR
        public.has_role(auth.uid(), 'manager')
    );

NOTIFY pgrst, 'reload config';

-- ─────────────────────────────────────────────────────────────────────────────
-- INSTRUKSI MANUAL (jalankan di Supabase Dashboard → Storage):
-- 1. Buat bucket baru: driver-receipts
-- 2. Set bucket: Public = true (agar foto bisa diakses langsung via URL)
-- 3. Di Supabase Dashboard → Storage → driver-receipts → Policies:
--    CREATE POLICY "Drivers can upload their receipts"
--        ON storage.objects FOR INSERT TO authenticated
--        WITH CHECK (bucket_id = 'driver-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
--    CREATE POLICY "Authenticated can view receipts"
--        ON storage.objects FOR SELECT TO authenticated
--        USING (bucket_id = 'driver-receipts');
-- ─────────────────────────────────────────────────────────────────────────────
