-- Migration: Add last_login to user_devices
-- Description: Ensures the last_login column exists for device management tracking

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_devices' AND column_name = 'last_login') THEN
        ALTER TABLE public.user_devices ADD COLUMN last_login TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

COMMENT ON COLUMN public.user_devices.last_login IS 'Timestamp of the last successful login from this device';
