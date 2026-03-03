-- Migration 131: Auto-cleanup foto nota lama (> 6 bulan)
-- Menggunakan pg_cron yang sudah built-in di Supabase
-- Jadwal: Setiap tanggal 1 jam 02:00 WIB (19:00 UTC)

-- ─── 1. Enable ekstensi yang dibutuhkan ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── 2. Fungsi utama cleanup ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_driver_receipts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_cutoff        TIMESTAMPTZ := now() - INTERVAL '6 months';
    v_deleted_count INTEGER     := 0;
    v_freed_bytes   BIGINT      := 0;
    v_rec           RECORD;
    v_storage_path  TEXT;
BEGIN
    -- Loop semua expense yang punya foto dan sudah > 6 bulan
    FOR v_rec IN
        SELECT
            de.id,
            de.receipt_url,
            de.expense_time
        FROM public.driver_expenses de
        WHERE de.receipt_url IS NOT NULL
          AND de.expense_time < v_cutoff
    LOOP
        BEGIN
            -- Ekstrak path dari URL Supabase Storage
            -- Format URL: https://<ref>.supabase.co/storage/v1/object/public/driver-receipts/<path>
            v_storage_path := substring(
                v_rec.receipt_url
                FROM '/driver-receipts/(.+)$'
            );

            IF v_storage_path IS NOT NULL THEN
                -- Hapus file dari storage (storage.objects)
                -- Supabase menyimpan referensi di tabel ini
                SELECT COALESCE(SUM(metadata->>'size')::BIGINT, 0)
                INTO v_freed_bytes
                FROM storage.objects
                WHERE bucket_id = 'driver-receipts'
                  AND name = v_storage_path;

                DELETE FROM storage.objects
                WHERE bucket_id = 'driver-receipts'
                  AND name = v_storage_path;

                -- Hapus URL dari record expense (data tetap ada, foto dihapus)
                UPDATE public.driver_expenses
                SET receipt_url  = NULL,
                    description  = COALESCE(description, '') ||
                                   ' [Foto dihapus otomatis ' ||
                                   TO_CHAR(now(), 'DD Mon YYYY') || ']',
                    updated_at   = now()
                WHERE id = v_rec.id;

                v_deleted_count := v_deleted_count + 1;

                RAISE NOTICE 'Deleted receipt: % (expense_time: %)',
                    v_storage_path, v_rec.expense_time;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                -- Jangan stop loop jika ada 1 file error
                RAISE WARNING 'Gagal hapus receipt id=%: %', v_rec.id, SQLERRM;
        END;
    END LOOP;

    -- Kembalikan ringkasan hasil
    RETURN jsonb_build_object(
        'deleted_count', v_deleted_count,
        'cutoff_date',   v_cutoff::TEXT,
        'run_at',        now()::TEXT
    );
END;
$$;

-- ─── 3. Jadwalkan cron job: setiap tanggal 1, jam 02:00 WIB (= 19:00 UTC) ──
-- Format: menit jam hari-bulan bulan hari-minggu
SELECT cron.schedule(
    'cleanup-driver-receipts-6mo',   -- nama job (unik)
    '0 19 1 * *',                    -- setiap tanggal 1, jam 19:00 UTC
    $$SELECT public.cleanup_old_driver_receipts()$$
);

-- ─── 4. Tampilkan konfirmasi job terdaftar ────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'Cron job cleanup-driver-receipts-6mo berhasil didaftarkan.';
    RAISE NOTICE 'Jadwal: Setiap tanggal 1 jam 02:00 WIB.';
    RAISE NOTICE 'Foto nota > 6 bulan akan otomatis dihapus dari storage.';
END;
$$;
