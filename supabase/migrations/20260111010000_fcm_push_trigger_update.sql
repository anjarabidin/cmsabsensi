-- Migration: Auto-send FCM push notifications when new notification is inserted
-- Created: 2026-01-09
-- Updated: 2026-01-11 - Call Edge Function via pg_net

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION send_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get Supabase URL and service role key from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Call Edge Function asynchronously using pg_net
  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    SELECT INTO request_id net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'title', NEW.title,
        'body', NEW.message,
        'data', jsonb_build_object(
          'type', NEW.type,
          'link', NEW.link,
          'notificationId', NEW.id
        )
      )
    );
    
    RAISE LOG 'Push notification queued for user % with request_id %', NEW.user_id, request_id;
  ELSE
    RAISE LOG 'Supabase URL or Service Role Key not configured';
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;

CREATE TRIGGER on_notification_insert_send_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_fcm_push_notification();

-- Add comment
COMMENT ON FUNCTION send_fcm_push_notification() IS 'Calls Edge Function to send push notification via FCM when new notification is inserted.';
