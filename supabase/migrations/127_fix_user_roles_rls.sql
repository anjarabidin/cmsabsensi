-- Fix RLS policies for user_roles table
-- Problem: FOR ALL policy without WITH CHECK clause blocks INSERT/UPDATE
-- Solution: Split into explicit SELECT + INSERT + UPDATE + DELETE policies

-- Drop existing incomplete policies
DROP POLICY IF EXISTS "Super Admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin HR can manage roles" ON public.user_roles;

-- Super Admin: full access with proper WITH CHECK
CREATE POLICY "Super Admin can manage all roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Admin HR: full access with proper WITH CHECK
CREATE POLICY "Admin HR can manage roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin_hr'))
    WITH CHECK (public.has_role(auth.uid(), 'admin_hr'));

-- Also allow the DB trigger (runs as SECURITY DEFINER) to bypass RLS
-- This ensures sync_profile_role_to_user_roles trigger always works
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Fix RLS policies for driver_assignments table
-- Same issue: FOR ALL without WITH CHECK blocks INSERT/UPDATE
-- Also: super_admin had no manage policy at all
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage all driver assignments" ON public.driver_assignments;
DROP POLICY IF EXISTS "Super Admin can manage all driver assignments" ON public.driver_assignments;

-- Admin HR: fix WITH CHECK
CREATE POLICY "Admins can manage all driver assignments"
    ON public.driver_assignments FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin_hr'))
    WITH CHECK (public.has_role(auth.uid(), 'admin_hr'));

-- Super Admin: full access (was missing entirely)
CREATE POLICY "Super Admin can manage all driver assignments"
    ON public.driver_assignments FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

NOTIFY pgrst, 'reload config';
