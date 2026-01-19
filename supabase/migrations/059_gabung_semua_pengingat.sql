-- Migrasi ini menggabungkan logika Pengingat Shift (058) dan Pengingat Pribadi (035) 
-- menjadi satu CRON JOB terpusat agar tidak saling menimpa.

-- 1. Install pg_cron (Idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Buat Fungsi Master untuk Menjalankan Semua Pengecekan
CREATE OR REPLACE FUNCTION process_all_reminders()
RETURNS void AS $$
DECLARE
    -- Variabel untuk Shift
    v_shift_user RECORD;
    v_now_time TIME;
    v_today DATE;
    v_shift_buffer INTERVAL := '20 minutes'; -- Buffer shift

    -- Variabel untuk Personal Reminder
    v_personal_note RECORD;
    v_now_timestamp TIMESTAMPTZ;
BEGIN
    v_now_time := CURRENT_TIME;
    v_today := CURRENT_DATE;
    v_now_timestamp := NOW();

    -- ==========================================
    -- A. PENGINGAT PRIBADI (PERSONAL NOTES)
    -- ==========================================
    -- Logic: Cari catatan yang waktunya sudah lewat/sekarang, belum notif, dan belum selesai.
    FOR v_personal_note IN 
        SELECT * FROM personal_reminders
        WHERE 
            remind_at IS NOT NULL
            AND is_notified = false 
            AND is_completed = false
            AND remind_at <= v_now_timestamp
            -- Ambil yang "telat" maksimal 24 jam terakhir (biar gak notif catatan tahun lalu saat script jalan)
            AND remind_at >= (v_now_timestamp - interval '24 hours')
    LOOP
        -- Kirim Notifikasi
        -- Perbaikan: Pake kolom 'read' bukan 'is_read'
        INSERT INTO notifications (user_id, title, message, type, link, read)
        VALUES (
            v_personal_note.user_id,
            'Pengingat: ' || v_personal_note.title,
            COALESCE(v_personal_note.description, 'Waktunya kegiatan Anda dimulai.'),
            'personal_reminder',
            '/notes',
            false
        );

        -- Tandai Sudah Dikirim
        UPDATE personal_reminders 
        SET is_notified = true 
        WHERE id = v_personal_note.id;
    END LOOP;

    -- ==========================================
    -- B. PENGINGAT SHIFT (CLOCK IN & OUT)
    -- ==========================================
    
    -- B.1. Clock In Reminder
    FOR v_shift_user IN 
        SELECT 
            es.user_id, 
            p.full_name,
            s.name as shift_name,
            s.start_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        LEFT JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE 
            es.date = v_today 
            AND es.is_day_off = false 
            AND a.clock_in IS NULL 
            AND s.start_time > v_now_time 
            AND s.start_time <= (v_now_time + v_shift_buffer)
            AND NOT EXISTS ( 
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'reminder_clock_in' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_shift_user.user_id,
            'Pengingat Masuk Kerja',
            'Halo ' || split_part(v_shift_user.full_name, ' ', 1) || ', jam masuk Anda (' || to_char(v_shift_user.start_time, 'HH24:MI') || ') segera dimulai.',
            'reminder_clock_in',
            '/dashboard'
        );
    END LOOP;

    -- B.2. Clock Out Reminder
    FOR v_shift_user IN 
        SELECT 
            es.user_id, 
            p.full_name,
            s.name as shift_name,
            s.end_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE 
            es.date = v_today 
            AND es.is_day_off = false 
            AND a.clock_in IS NOT NULL 
            AND a.clock_out IS NULL 
            AND s.end_time > v_now_time 
            AND s.end_time <= (v_now_time + v_shift_buffer)
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'reminder_clock_out' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_shift_user.user_id,
            'Pengingat Pulang Kerja',
            'Jam pulang (' || to_char(v_shift_user.end_time, 'HH24:MI') || ') sebentar lagi. Jangan lupa Check Out!',
            'reminder_clock_out',
            '/dashboard'
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. JADWALKAN CRON JOB TERPUSAT
-- Kita bersihkan dulu semua job lama yang mungkin konflik
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Hapus job shift yang lama
    FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'check_shift_reminders_job' LOOP
        PERFORM cron.unschedule(r.jobid);
    END LOOP;
    
    -- Hapus job personal lama (jika ada)
    FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'check_all_reminders_job' LOOP
        PERFORM cron.unschedule(r.jobid);
    END LOOP;
    
    -- Hapus job master lama (jika ada re-run)
    FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'master_reminder_job' LOOP
        PERFORM cron.unschedule(r.jobid);
    END LOOP;
END $$;

-- 4. Schedule Job Baru (Setiap 2 Menit)
SELECT cron.schedule(
    'master_reminder_job',
    '*/2 * * * *', 
    'SELECT process_all_reminders()'
);
