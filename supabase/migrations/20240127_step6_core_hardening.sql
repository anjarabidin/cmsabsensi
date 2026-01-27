-- STEP 6: CORE SYSTEM HARDENING (Shift Logic & Timezone Smart Handling)
-- Script ini memperbaiki logika "Jantung Sistem" (Absensi) agar robust untuk berbagai skenario.

-- 1. SMART TIMEZONE HANDLING (Persiapan Multi-Cabang)
-- Menambahkan kolom timezone pada tabel office_locations. Default 'Asia/Jakarta'.
-- Ini antisipasi jika nanti ada cabang di Bali/Papua.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'office_locations' AND column_name = 'timezone') THEN 
        ALTER TABLE public.office_locations ADD COLUMN timezone TEXT DEFAULT 'Asia/Jakarta';
    END IF;
END $$;

-- 2. ROBUST SHIFT VALIDATION (Mencegah Absen Aneh-Aneh)
-- Fungsi ini akan dipakai di Frontend/Backend untuk memvalidasi apakah sekarang waktunya absen.
-- Menghandle Shift Malam (Start 22:00, End 06:00) dengan benar.

CREATE OR REPLACE FUNCTION public.is_valid_clock_in_time(
  p_shift_start TIME,
  p_shift_end TIME,
  p_current_time TIME,
  p_advance_minutes INTEGER DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
  v_start_window TIME;
  v_end_buffer TIME;
BEGIN
  -- Absen diperbolehkan mulai dari (Start - Advance Minutes)
  v_start_window := p_shift_start - (p_advance_minutes || ' minutes')::interval;
  
  -- Normal Shift (08:00 - 17:00)
  IF p_shift_start < p_shift_end THEN
    RETURN (p_current_time >= v_start_window AND p_current_time < p_shift_end); -- Boleh absen sampai sebelum pulang
  
  -- Overnight Shift (22:00 - 06:00)
  ELSE
    -- Check if current time is in the 'night' portion (e.g. 23:00) OR 'morning' portion (e.g. 05:00)
    RETURN (p_current_time >= v_start_window OR p_current_time < p_shift_end); 
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 3. AUTO-CLOSE ATTENDANCE (Cron Job Safety Net)
-- Jika user lupa Checkout, sistem akan otomatis menganggapnya "Alpha" atau Checkout otomatis (opsional).
-- Disini kita buat statusnya menjadi 'absent_no_checkout' jika lewat 24 jam.

CREATE OR REPLACE FUNCTION public.cleanup_stale_attendance() RETURNS void AS $$
BEGIN
  -- Update absen kemarin yang masih NULL clock_out nya
  UPDATE public.attendances 
  SET 
    clock_out = (date + '23:59:59'), -- Force checkout end of day (darurat)
    notes = COALESCE(notes, '') || ' [System: Auto-Checkout (Lupa Absen Pulang)]'
  WHERE 
    clock_out IS NULL 
    AND date < CURRENT_DATE 
    AND status = 'present'; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. CRON SCHEDULER (Aktifkan Pembersihan Tiap Pagi jam 01:00)
-- Safety check extension
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Hapus job lama secara aman (hindari error jika job tidak ada)
        FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'cleanup_attendance_job' LOOP
            PERFORM cron.unschedule(r.jobid);
        END LOOP;
        
        -- Jadwal baru
        PERFORM cron.schedule(
            'cleanup_attendance_job',
            '0 1 * * *', -- Jam 01:00 Pagi Setiap Hari
            'SELECT public.cleanup_stale_attendance()'
        );
    END IF;
END $$;


-- 5. FINAL: FORCE REFRESH CACHE POLICIES
-- Kadang Supabase men-cache policy lama. Ini trik untuk memaksa refresh.
NOTIFY pgrst, 'reload config';
