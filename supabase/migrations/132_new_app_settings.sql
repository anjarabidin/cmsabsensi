-- Migration 132: Tambah pengaturan sistem baru
-- Settings: selfie kamera absensi, keep-alive, auto cleanup foto absensi

-- ─── 1. Tambah setting-setting baru ──────────────────────────────────────────

-- Wajib selfie (foto biasa, tanpa face recognition)
INSERT INTO public.app_settings (key, value, description)
VALUES ('require_selfie_photo', false, 'Wajib foto selfie saat absensi (tanpa scan wajah). Foto disimpan sebagai bukti.')
ON CONFLICT (key) DO NOTHING;

-- Auto-cleanup foto absensi (aktif/nonaktif)
INSERT INTO public.app_settings (key, value, description)
VALUES ('attendance_photo_auto_cleanup', true, 'Hapus otomatis foto absensi yang sudah lebih dari batas retensi untuk hemat storage.')
ON CONFLICT (key) DO NOTHING;

-- Retensi foto absensi dalam hari (default 30 hari)
INSERT INTO public.app_settings (key, value, description)
VALUES ('attendance_photo_retention_days', 30, 'Berapa hari foto absensi disimpan sebelum dihapus otomatis. Default: 30 hari.')
ON CONFLICT (key) DO NOTHING;

-- Keep-alive Supabase (ping DB agar tidak sleep di free tier)
INSERT INTO public.app_settings (key, value, description)
VALUES ('enable_keepalive_ping', true, 'Kirim ping ringan ke database setiap interval untuk mencegah Supabase free tier tidur.')
ON CONFLICT (key) DO NOTHING;

-- Interval keep-alive dalam menit (default 4 menit)
INSERT INTO public.app_settings (key, value, description)
VALUES ('keepalive_interval_minutes', 4, 'Interval ping keep-alive dalam menit. Supabase free tier sleep setelah ~5 menit idle.')
ON CONFLICT (key) DO NOTHING;

-- Jam operasional mulai (keep-alive hanya jalan di jam ini)
INSERT INTO public.app_settings (key, value, description)
VALUES ('keepalive_start_hour', 6, 'Jam mulai keep-alive aktif (WIB). Default: 06:00.')
ON CONFLICT (key) DO NOTHING;

-- Jam operasional selesai
INSERT INTO public.app_settings (key, value, description)
VALUES ('keepalive_end_hour', 22, 'Jam selesai keep-alive aktif (WIB). Default: 22:00.')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Fungsi cleanup foto absensi ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_attendance_photos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_enabled       BOOLEAN;
    v_days          INTEGER;
    v_cutoff        TIMESTAMPTZ;
    v_deleted_count INTEGER := 0;
    v_rec           RECORD;
    v_path          TEXT;
BEGIN
    -- Cek apakah cleanup diaktifkan
    SELECT (value::TEXT)::BOOLEAN INTO v_enabled
    FROM public.app_settings WHERE key = 'attendance_photo_auto_cleanup';

    IF NOT COALESCE(v_enabled, true) THEN
        RETURN jsonb_build_object('skipped', true, 'reason', 'auto_cleanup disabled');
    END IF;

    -- Ambil retensi hari
    SELECT (value::TEXT)::INTEGER INTO v_days
    FROM public.app_settings WHERE key = 'attendance_photo_retention_days';

    v_days   := COALESCE(v_days, 30);
    v_cutoff := now() - (v_days || ' days')::INTERVAL;

    -- Proses clock_in_photo_url
    FOR v_rec IN
        SELECT id, clock_in_photo_url AS photo_url, 'clock_in' AS photo_type
        FROM public.attendances
        WHERE clock_in_photo_url IS NOT NULL
          AND created_at < v_cutoff
        UNION ALL
        SELECT id, clock_out_photo_url AS photo_url, 'clock_out' AS photo_type
        FROM public.attendances
        WHERE clock_out_photo_url IS NOT NULL
          AND created_at < v_cutoff
    LOOP
        BEGIN
            -- Ekstrak path dari URL storage
            v_path := substring(v_rec.photo_url FROM '/attendance-photos/(.+)$');

            IF v_path IS NOT NULL THEN
                DELETE FROM storage.objects
                WHERE bucket_id = 'attendance-photos' AND name = v_path;

                -- Hapus URL dari record
                IF v_rec.photo_type = 'clock_in' THEN
                    UPDATE public.attendances SET clock_in_photo_url = NULL WHERE id = v_rec.id;
                ELSE
                    UPDATE public.attendances SET clock_out_photo_url = NULL WHERE id = v_rec.id;
                END IF;

                v_deleted_count := v_deleted_count + 1;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Gagal hapus foto attendance id=%: %', v_rec.id, SQLERRM;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'deleted_count', v_deleted_count,
        'retention_days', v_days,
        'cutoff_date',    v_cutoff::TEXT,
        'run_at',         now()::TEXT
    );
END;
$$;

-- ─── 3. Jadwalkan cron job cleanup foto absensi ───────────────────────────────
-- Jalankan setiap hari jam 03:00 WIB (= 20:00 UTC)
SELECT cron.schedule(
    'cleanup-attendance-photos-monthly',
    '0 20 * * *',
    $$SELECT public.cleanup_old_attendance_photos()$$
);

NOTIFY pgrst, 'reload config';
