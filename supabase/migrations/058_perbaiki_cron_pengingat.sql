-- 1. Install pg_cron jika belum ada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Pastikan fungsi reminder ada dan logika benar
CREATE OR REPLACE FUNCTION check_shift_reminders()
RETURNS void AS $$
DECLARE
    v_user_record RECORD;
    v_now_time TIME;
    v_today DATE;
    v_buffer_minutes INTERVAL := '15 minutes';
BEGIN
    v_now_time := CURRENT_TIME;
    v_today := CURRENT_DATE;

    -- A. PENGINGAT MASUK (Clock In)
    -- Mencari yg punya jadwal hari ini, belum clock in, dan jam masuk sebentar lagi
    FOR v_user_record IN 
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
            AND s.start_time <= (v_now_time + v_buffer_minutes)
            AND NOT EXISTS ( 
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'reminder_clock_in' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'Pengingat Masuk',
            'Halo ' || split_part(v_user_record.full_name, ' ', 1) || ', sebentar lagi jam masuk (' || to_char(v_user_record.start_time, 'HH24:MI') || '). Jangan lupa absen!',
            'reminder_clock_in',
            '/dashboard'
        );
    END LOOP;

    -- B. PENGINGAT PULANG (Clock Out)
    -- Mencari yg sudah clock in, belum clock out, dan jam pulang sebentar lagi
    FOR v_user_record IN 
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
            AND s.end_time <= (v_now_time + v_buffer_minutes)
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'reminder_clock_out' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'Pengingat Pulang',
            'Sebentar lagi jam pulang (' || to_char(v_user_record.end_time, 'HH24:MI') || '). Pastikan absen pulang ya!',
            'reminder_clock_out',
            '/dashboard'
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. JADWALKAN CRON JOB (Versi Aman Error 'job not found')
-- Kita menggunakan blok anonim untuk menghapus job hanya jika ID-nya ditemukan di tabel cron.job
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'check_shift_reminders_job' LOOP
        PERFORM cron.unschedule(r.jobid);
    END LOOP;
END $$;

-- 4. Buat Jadwal Baru (Setiap 10 Menit)
SELECT cron.schedule(
    'check_shift_reminders_job',
    '*/10 * * * *', 
    'SELECT check_shift_reminders()'
);
