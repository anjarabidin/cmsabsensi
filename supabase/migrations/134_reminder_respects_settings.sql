-- ============================================================
-- Migration 134: Make clock-in/clock-out reminders dynamic
-- They now respect settings from app_settings:
--   - reminder_enabled (bool): toggle reminders on/off globally
--   - reminder_clockin_minutes_before (int): how many mins before to remind
--   - reminder_clockout_minutes_before (int): how many mins before to remind
--   - reminder_workdays_only (bool): skip weekends if true
--   - company_timezone (text): use correct local time for comparisons
-- ============================================================

CREATE OR REPLACE FUNCTION check_shift_reminders()
RETURNS void AS $$
DECLARE
    v_user_record RECORD;
    v_now_time TIME;
    v_today DATE;
    v_today_dow INT; -- 0=Sun, 6=Sat

    -- Settings vars (fetched from app_settings)
    v_tz TEXT := 'Asia/Jakarta';
    v_enabled BOOLEAN := true;
    v_clockin_mins INT := 10;
    v_clockout_mins INT := 10;
    v_workdays_only BOOLEAN := false;
BEGIN

    -- 1. Fetch settings from app_settings
    SELECT value INTO v_tz
    FROM app_settings WHERE key = 'company_timezone' LIMIT 1;
    IF v_tz IS NULL OR v_tz = '' THEN v_tz := 'Asia/Jakarta'; END IF;

    SELECT
        COALESCE((SELECT value = 'true' FROM app_settings WHERE key = 'reminder_enabled' LIMIT 1), true),
        COALESCE((SELECT value::int FROM app_settings WHERE key = 'reminder_clockin_minutes_before' LIMIT 1), 10),
        COALESCE((SELECT value::int FROM app_settings WHERE key = 'reminder_clockout_minutes_before' LIMIT 1), 10),
        COALESCE((SELECT value = 'true' FROM app_settings WHERE key = 'reminder_workdays_only' LIMIT 1), false)
    INTO v_enabled, v_clockin_mins, v_clockout_mins, v_workdays_only;

    -- 2. If reminders are disabled globally, exit early
    IF NOT v_enabled THEN
        RAISE LOG '[Reminders] Disabled by settings. Exiting.';
        RETURN;
    END IF;

    -- 3. Get local time based on company timezone
    v_today    := (now() AT TIME ZONE v_tz)::date;
    v_now_time := (now() AT TIME ZONE v_tz)::time;
    v_today_dow := EXTRACT(DOW FROM (now() AT TIME ZONE v_tz))::int; -- 0=Sun, 6=Sat

    -- 4. Skip weekends if workdays_only is true
    IF v_workdays_only AND (v_today_dow = 0 OR v_today_dow = 6) THEN
        RAISE LOG '[Reminders] Skipping — today is a weekend and workdays_only=true.';
        RETURN;
    END IF;

    RAISE LOG '[Reminders] Running at tz=% local_time=% clockin_mins=% clockout_mins=%',
        v_tz, v_now_time, v_clockin_mins, v_clockout_mins;

    -- 5. CLOCK-IN REMINDER: shift starts in ~v_clockin_mins
    FOR v_user_record IN
        SELECT
            es.user_id,
            p.full_name,
            s.name AS shift_name,
            s.start_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        LEFT JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE
            es.date = v_today
            AND es.is_day_off = false
            AND a.clock_in IS NULL  -- Has not clocked in yet
            AND s.start_time > v_now_time
            AND s.start_time <= (v_now_time + (v_clockin_mins || ' minutes')::interval)
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
            'CMS | Pengingat Absensi Masuk',
            'Halo ' || v_user_record.full_name || ', ' || v_clockin_mins ||
                ' menit lagi jam kerja Anda (' || v_user_record.shift_name ||
                ') akan dimulai. Jangan lupa absen ya!',
            'reminder_clock_in',
            '/attendance'
        );
        RAISE LOG '[Reminder] Clock-in notif sent to user=%', v_user_record.user_id;
    END LOOP;

    -- 6. CLOCK-OUT REMINDER: shift ends in ~v_clockout_mins
    FOR v_user_record IN
        SELECT
            es.user_id,
            p.full_name,
            s.name AS shift_name,
            s.end_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE
            es.date = v_today
            AND es.is_day_off = false
            AND a.clock_in IS NOT NULL  -- Currently working
            AND a.clock_out IS NULL     -- Has not clocked out
            AND s.end_time > v_now_time
            AND s.end_time <= (v_now_time + (v_clockout_mins || ' minutes')::interval)
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
            'Sebentar lagi jam pulang (' || v_user_record.shift_name || '). Rapikan pekerjaan Anda dan jangan lupa Clock Out!',
            'reminder_clock_out',
            '/attendance'
        );
        RAISE LOG '[Reminder] Clock-out notif sent to user=%', v_user_record.user_id;
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Ensure the cron job is registered (replace if already exists)
DO $$
DECLARE
    j RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Loop through and unschedule by jobid to prevent name-matching errors
        FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'check_shift_reminders_job'
        LOOP
            BEGIN
                PERFORM cron.unschedule(j.jobid);
            EXCEPTION WHEN OTHERS THEN
                -- Ignore errors if job is already gone
            END;
        END LOOP;

        -- Re-schedule with every 5 minutes (unchanged)
        PERFORM cron.schedule(
            'check_shift_reminders_job',
            '*/5 * * * *',
            'SELECT check_shift_reminders()'
        );
        RAISE NOTICE 'cron job check_shift_reminders_job re-scheduled.';
    ELSE
        RAISE NOTICE 'pg_cron not installed. Manual or external scheduling required.';
    END IF;
END
$$;


-- Insert default settings if they don't exist yet
INSERT INTO app_settings (key, value, description) VALUES
    ('reminder_enabled', 'true', 'Aktifkan pengingat absensi masuk/pulang'),
    ('reminder_clockin_minutes_before', '10', 'Berapa menit sebelum shift mulai untuk mengirim pengingat masuk'),
    ('reminder_clockout_minutes_before', '10', 'Berapa menit sebelum shift berakhir untuk mengirim pengingat pulang'),
    ('reminder_workdays_only', 'false', 'Hanya kirim pengingat di hari kerja (Senin-Jumat)')
ON CONFLICT (key) DO NOTHING;
