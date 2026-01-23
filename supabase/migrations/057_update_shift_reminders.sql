-- Update the check_shift_reminders function to include a 17:00 WIB reminder and use push-only types
CREATE OR REPLACE FUNCTION check_shift_reminders()
RETURNS void AS $$
DECLARE
    v_user_record RECORD;
    v_now_time TIME;
    v_today DATE;
    v_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Fix Check: Convert server time (UTC) to WIB (Asia/Jakarta)
    -- This ensures comparison with shift times (stored as 08:00, etc) is correct
    v_timestamp := now() AT TIME ZONE 'Asia/Jakarta';
    v_today := v_timestamp::date;
    v_now_time := v_timestamp::time;

    -- 1. Check for Clock In Reminder (5-10 minutes before start)
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
                AND n.type = 'push_reminder_clock_in' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'CMS | Pengingat Absensi Masuk',
            'Halo ' || v_user_record.full_name || ', 5 menit lagi jam kerja Anda (' || v_user_record.shift_name || ') akan dimulai. Jangan lupa absen ya!',
            'push_reminder_clock_in', -- Changed to push_ prefix
            '/dashboard' -- Direct to dashboard to clock in
        );
    END LOOP;

    -- 2. Check for Clock Out Reminder (5-10 minutes before end)
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
            AND es.is_day_off = false 
            AND a.clock_in IS NOT NULL -- Currently working
            AND a.clock_out IS NULL -- Has not clocked out
            AND s.end_time > v_now_time 
            AND s.end_time <= (v_now_time + interval '10 minutes')
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'push_reminder_clock_out' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'CMS | Pengingat Pulang',
            'Sebentar lagi jam pulang. Rapikan meja kerja dan pastikan tidak ada barang yang tertinggal ya!',
            'push_reminder_clock_out', -- Changed to push_ prefix
            '/dashboard'
        );
    END LOOP;

    -- 3. [NEW] 17:00 WIB Reminder for those still clocked in
    -- Logic: If it is between 17:00 and 17:10 WIB, remind everyone who hasn't clocked out yet
    -- BUT exclude those whose Shift End Time is > 17:00 (they shouldn't be reminded to leave early)
    IF v_now_time >= '17:00:00' AND v_now_time < '17:10:00' THEN
        FOR v_user_record IN 
            SELECT 
                es.user_id, 
                p.full_name,
                s.end_time as shift_end
            FROM employee_schedules es
            JOIN profiles p ON es.user_id = p.id
            LEFT JOIN shifts s ON es.shift_id = s.id
            JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
            WHERE 
                es.date = v_today 
                AND a.clock_in IS NOT NULL 
                AND a.clock_out IS NULL
                -- Condition: Only remind if they don't have a shift ending later than 17:00
                AND (s.end_time IS NULL OR s.end_time < '17:00:00')
                AND NOT EXISTS (
                    SELECT 1 FROM notifications n 
                    WHERE n.user_id = es.user_id 
                    AND n.type = 'push_reminder_1700' 
                    AND n.created_at::date = v_today
                )
        LOOP
            INSERT INTO notifications (user_id, title, message, type, link)
            VALUES (
                v_user_record.user_id,
                'CMS | Pengingat Sore (17:00)',
                'Halo ' || v_user_record.full_name || ', sudah jam 17:00 WIB. Jangan lupa absen pulang jika pekerjaan sudah selesai! (Notifikasi Otomatis)',
                'push_reminder_1700', -- Changed to push_ prefix
                '/dashboard'
            );
        END LOOP;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
