-- Migration to broadcast internal notifications when a new announcement is created
-- This will populate the notifications table for all active users

CREATE OR REPLACE FUNCTION public.notify_all_users_on_announcement()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a notification for every active profile
    -- Using 'system' type which is already handled in the frontend
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
        id as user_id, 
        '📢 Pengumuman: ' || NEW.title as title, 
        CASE 
            WHEN length(NEW.content) > 100 THEN substring(NEW.content from 1 for 100) || '...'
            ELSE NEW.content 
        END as message,
        'system' as type,
        '/information' as link
    FROM public.profiles
    WHERE is_active = true;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after a new announcement is inserted
DROP TRIGGER IF EXISTS tr_on_announcement_created ON public.announcements;
CREATE TRIGGER tr_on_announcement_created
    AFTER INSERT ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_all_users_on_announcement();
