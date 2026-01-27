-- STEP 7: SUPER ADMIN PERMISSIONS CORRECTION
-- This migration fixes the missing permissions for 'super_admin' on Attendance and related tables.

-- 1. ATTENDANCES
DROP POLICY IF EXISTS "Super Admin can view all attendances" ON public.attendances;
CREATE POLICY "Super Admin can view all attendances" ON public.attendances 
    FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super Admin can manage all attendances" ON public.attendances;
CREATE POLICY "Super Admin can manage all attendances" ON public.attendances 
    FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'super_admin'));

-- 2. ATTENDANCE CORRECTIONS
DROP POLICY IF EXISTS "Super Admin can manage all corrections" ON public.attendance_corrections;
CREATE POLICY "Super Admin can manage all corrections" ON public.attendance_corrections 
    FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'super_admin'));

-- 3. USER ROLES (Essential for Super Admin to assign roles)
DROP POLICY IF EXISTS "Super Admin can view all roles" ON public.user_roles;
CREATE POLICY "Super Admin can view all roles" ON public.user_roles 
    FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super Admin can manage all roles" ON public.user_roles;
CREATE POLICY "Super Admin can manage all roles" ON public.user_roles 
    FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'super_admin'));

-- 4. REFRESH CONFIG
NOTIFY pgrst, 'reload config';
