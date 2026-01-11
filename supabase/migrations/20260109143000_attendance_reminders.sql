-- Create a function to check and send shift reminders
CREATE OR REPLACE FUNCTION check_shift_reminders()
RETURNS void AS $$
DECLARE
    v_user_record RECORD;
    v_shift_record RECORD;
    v_now_time TIME;
    v_today DATE;
BEGIN
    v_now_time := CURRENT_TIME;
    v_today := CURRENT_DATE;

    -- 1. Check for Clock In Reminder (5 minutes before start)
    -- Logic: Find users who have a schedule today, haven't clocked in, and shift starts in ~5 mins
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
            AND es.is_day_off = false -- Ignore on day off
            AND a.clock_in IS NULL -- Has not clocked in
            AND s.start_time > v_now_time 
            AND s.start_time <= (v_now_time + interval '10 minutes') -- Broaden window slightly to catch cron intervals
            AND NOT EXISTS ( -- Avoid duplicate notifications
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'reminder_clock_in' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'CMS | Pengingat Absensi Masuk',
            'Halo ' || v_user_record.full_name || ', 5 menit lagi jam kerja Anda (' || v_user_record.shift_name || ') akan dimulai. Jangan lupa absen ya!',
            'reminder_clock_in',
            '/dashboard' -- Direct to dashboard to clock in
        );
    END LOOP;

    -- 2. Check for Clock Out Reminder (5 minutes before end)
    -- Logic: Find users who are clocked in, haven't clocked out, and shift ends in ~5 mins
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
            AND es.is_day_off = false -- Ignore on day off
            AND a.clock_in IS NOT NULL -- Currently working
            AND a.clock_out IS NULL -- Has not clocked out
            AND s.end_time > v_now_time 
            AND s.end_time <= (v_now_time + interval '10 minutes')
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
            'CMS | Pengingat Pulang',
            'Sebentar lagi jam pulang. Rapikan meja kerja dan pastikan tidak ada barang yang tertinggal ya!',
            'reminder_clock_out',
            '/dashboard'
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note on Automation:
-- To make this run automatically, we use pg_cron.
-- However, enabling extensions often requires superuser or dashboard access.
-- We will attempt to create the cron job if the extension exists.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- Run every 5 minutes
        PERFORM cron.schedule(
            'check_shift_reminders_job',
            '*/5 * * * *', 
            'SELECT check_shift_reminders()'
        );
    END IF;
END
$$;
