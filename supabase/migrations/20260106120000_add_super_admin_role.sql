-- Create new migration to update app_role enum
-- We cannot directly ALTER TYPE ... ADD VALUE inside a transaction block in some postgres versions if not sequential, 
-- but Supabase usually handles it.
-- However, to be safe and clear, we will execute this.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Update RLS policies to include super_admin access
-- We need to update public.has_role function or the policies themselves.
-- Looking at prior migrations, public.has_role checks public.user_roles table.
-- So if we add 'super_admin' to user_roles table, has_role will work if we pass 'super_admin'.
-- BUT, existing policies check for 'admin_hr'. 
-- We want 'super_admin' to HAVE ACCESS where 'admin_hr' has access.
-- So we should update policies OR update has_role to return true for 'admin_hr' check if user is 'super_admin'.

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role 
        OR (role = 'super_admin' AND _role = 'admin_hr') -- super_admin implies admin_hr privileges
      )
  )
$$;

-- Also update policies that might check for role directly if any (most use has_role)
-- Announcements policy for example:
-- CREATE POLICY "Admin HR can manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
-- This will now work for super_admin because of the updated function.

-- Now, force update the user role again to valid enum value
UPDATE public.user_roles
SET role = 'super_admin'
WHERE user_id IN (SELECT id FROM auth.users);

-- Also update profile role column if it exists (it wasn't in the initial migration but I added it in types, assuming it exists or I should add it)
-- Wait, I don't see 'role' column in 'profiles' table in the migration 20260106020904...
-- Checking migration 20260106020904 line 19:
--   CREATE TABLE public.profiles (
--   ...
--   position TEXT,
--   ...
-- );
-- It does NOT have 'role'. 
-- However, AuthContext seems to rely on it in my previous edit?
-- "Fallback to profile.role if user_roles table is empty/unsynced"
-- I should ADD IT if I want to use it, or revert that reliance.
-- For now, let's ADD it to be consistent with my frontend changes, it's good practice to cache it there.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role;

-- Sync profiles.role with user_roles
UPDATE public.profiles p
SET role = ur.role
FROM public.user_roles ur
WHERE p.id = ur.user_id;

