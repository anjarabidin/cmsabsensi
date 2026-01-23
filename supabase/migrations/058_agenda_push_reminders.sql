-- Create a function to check for upcoming agendas (e.g. 15 minutes before)
-- This function is designed to be called by a cron job every minute or every 5 minutes

CREATE OR REPLACE FUNCTION check_agenda_reminders()
RETURNS void AS $$
DECLARE
    v_participant_record RECORD;
    v_now_timestamp TIMESTAMP WITH TIME ZONE;
    v_target_time_start TIMESTAMP WITH TIME ZONE;
    v_target_time_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- We want to notify 15 minutes before the agenda starts
    v_now_timestamp := now();
    -- Look for agendas starting between (NOW + 14 mins) and (NOW + 16 mins)
    -- This handles specific cron windows (e.g. if cron runs every 1 min)
    -- Or if cron runs every 5 mins, we might need a wider window like 10-20 mins
    -- Let's stick to "Starts in exactly 15 minutes" with a small buffer.
    
    v_target_time_start := v_now_timestamp + interval '14 minutes';
    v_target_time_end := v_now_timestamp + interval '16 minutes';

    FOR v_participant_record IN
        SELECT 
            ap.user_id,
            a.title,
            a.start_time,
            a.location
        FROM agenda_participants ap
        JOIN agendas a ON ap.agenda_id = a.id
        WHERE 
            a.start_time >= v_target_time_start
            AND a.start_time <= v_target_time_end
            AND ap.status != 'declined' -- Don't remind if declined
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.user_id = ap.user_id 
                -- We use the specific push type for filtering
                AND n.type = 'reminder_agenda' 
                -- Avoid duplicate for this specific agenda + time
                AND n.message LIKE '%' || a.title || '%' 
                AND n.created_at >= (now() - interval '1 hour')
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_participant_record.user_id,
            'Pengingat Agenda',
            'Agenda "' || v_participant_record.title || '" akan dimulai dalam 15 menit lagi.',
            'reminder_agenda', -- Standard type, shows in bell list AND push
            '/agenda'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
