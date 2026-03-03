-- Migration 128: Tambah kolom vehicle_id ke driver_assignments
-- Catatan: tabel vehicles sudah dibuat di migration 121
-- Di sini hanya tambah FK vehicle_id di driver_assignments

ALTER TABLE public.driver_assignments
    ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload config';
