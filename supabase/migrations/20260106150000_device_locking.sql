-- MODULE: DEVICE LOCKING
-- Description: Bind user account to a specific device ID (UUID generated on frontend) to prevent account sharing/titip absen.

-- 1. Create table to store user devices
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, -- UUID string generated on client side and stored in localStorage
  device_name TEXT, -- User Agent or custom name
  last_login TIMESTAMPTZ DEFAULT now(),
  is_verified BOOLEAN DEFAULT true, -- If we want manual approval later
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- ENFORCE 1 DEVICE PER USER RULE
);

-- 2. Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- 3. Policies

-- A. Users can view their own device info
CREATE POLICY "Users can view own device" 
  ON public.user_devices FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- B. Users can register their device (INSERT) if they don't have one yet
CREATE POLICY "Users can register device" 
  ON public.user_devices FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- C. Admin HR can view all devices (for troubleshooting/resetting)
CREATE POLICY "Admins can view all devices" 
  ON public.user_devices FOR SELECT 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin_hr'));

-- D. Admin HR can delete devices (Reset Device)
CREATE POLICY "Admins can delete devices" 
  ON public.user_devices FOR DELETE 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin_hr'));
