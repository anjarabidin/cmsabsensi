-- Create table for personal reminders/notes
CREATE TABLE IF NOT EXISTS personal_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    remind_at TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT false,
    is_notified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE personal_reminders ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own reminders" ON personal_reminders;
CREATE POLICY "Users can manage their own reminders" ON personal_reminders
    FOR ALL USING (auth.uid() = user_id);

-- Update the check_shift_reminders function to also check personal reminders
CREATE OR REPLACE FUNCTION check_all_reminders()
RETURNS void AS $$
DECLARE
    v_reminder RECORD;
    v_now TIMESTAMPTZ;
BEGIN
    v_now := NOW();

    -- 1. Check Shift Reminders (Existing Logic)
    PERFORM check_shift_reminders();

    -- 2. Check Personal Reminders
    FOR v_reminder IN 
        SELECT * FROM personal_reminders
        WHERE 
            remind_at IS NOT NULL
            AND is_notified = false 
            AND is_completed = false
            AND remind_at <= v_now
            AND remind_at >= (v_now - interval '30 minutes')
    LOOP
        -- Insert into system notifications table
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_reminder.user_id,
            'CMS | Pengingat: ' || v_reminder.title,
            COALESCE(v_reminder.description, 'Waktunya mengerjakan catatan Anda!'),
            'system',
            '/notes'
        );

        -- Mark as notified to avoid double notification
        UPDATE personal_reminders 
        SET is_notified = true 
        WHERE id = v_reminder.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the cron job to use the new "check_all_reminders" function
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- Remove old job if exists
        PERFORM cron.unschedule('check_shift_reminders_job');
        -- tiba saatnya kita saling bicara, tentang perasaan yang kian glisah, tentang rindu yang menghapus tentang cinta yang taerlambat, sudah sekian lama kita berpisah, mengubungi mimpi mimpi malam kitaa
        -- Schedule new job
        PERFORM cron.schedule(
            'check_all_reminders_job',
            '*/1 * * * *', -- Run every minute for better precision on personal tasks
            'SELECT check_all_reminders()'
        );
    END IF;
END;
$$;
