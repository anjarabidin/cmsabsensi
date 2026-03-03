-- 125_cleanup_voice_calls.sql
-- Goal: Menghapus seluruh infrastruktur fitur panggilan suara (Voice Call) yang sudah tidak digunakan.

-- 1. Hapus tabel calls beserta seluruh kebijakannya
DROP TABLE IF EXISTS public.calls CASCADE;

-- 2. Hapus fungsi dan trigger terkait (CASCADE pada tabel harusnya sudah menangani trigger, tapi kita pastikan fungsi dihapus)
DROP FUNCTION IF EXISTS public.notify_on_missed_call() CASCADE;

-- 3. Hapus tabel calls dari publikasi realtime Supabase
-- Ambil tindakan pencegahan agar tidak error jika tabel sudah tidak ada dalam publikasi
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.calls;
    END IF;
END $$;

-- 4. Opsional: Bersihkan notifikasi sistem yang berhubungan dengan panggilan
DELETE FROM public.notifications WHERE type = 'system' AND (title LIKE '%Panggilan%' OR link = '/panggilan');
