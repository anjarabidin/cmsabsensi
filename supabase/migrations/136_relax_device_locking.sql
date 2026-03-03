-- MODULE: DEVICE LOCK RELAXATION
-- Description: Allow users to have multiple devices (e.g., Laptop + HP) while still preventing unlimited account sharing.
-- Default limit: 3 devices per user.

-- 1. Remove the strict 1-device-per-user constraint
ALTER TABLE public.user_devices DROP CONSTRAINT IF EXISTS user_devices_user_id_key;

-- 2. Add composite unique constraint to prevent duplicate same-device registrations
-- This allows different device_ids for the same user_id.
ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_user_device_unique UNIQUE(user_id, device_id);

-- 3. Add a setting to app_settings to control max allowed devices globally
INSERT INTO public.app_settings (key, value, description)
VALUES ('max_devices_per_user', '3', 'Jumlah maksimal perangkat/browser yang diizinkan untuk satu akun (mencegah sharing akun).')
ON CONFLICT (key) DO UPDATE SET value = '3';

-- 4. Correct the DELETE policy to ensure super_admin can also delete
-- Although has_role covers it, let's be explicit and robust.
DROP POLICY IF EXISTS "Admins can delete devices" ON public.user_devices;
CREATE POLICY "Admins can delete devices" 
  ON public.user_devices FOR DELETE 
  TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin_hr') 
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 5. Correct the SELECT policy for admins as well
DROP POLICY IF EXISTS "Admins can view all devices" ON public.user_devices;
CREATE POLICY "Admins can view all devices" 
  ON public.user_devices FOR SELECT 
  TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin_hr') 
    OR public.has_role(auth.uid(), 'super_admin')
    OR user_id = auth.uid()
  );
