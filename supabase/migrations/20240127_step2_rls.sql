-- STEP 2: JALANKAN INI SETELAH STEP 1 BERHASIL
-- Script ini berisi pembuatan tabel dan update policy keamanan.

-- 1. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,           -- e.g., 'CREATE', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,       -- e.g., 'profiles', 'leave_requests'
    record_id UUID NOT NULL,        -- ID of the affected record
    old_data JSONB,                 -- Previous state (for updates/deletes)
    new_data JSONB,                 -- New state
    changed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Audit Logs RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin can view audit logs" ON public.audit_logs;
CREATE POLICY "Super admin can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));

-- 3. Update Policies for Super Admin Access

-- LEAVE REQUESTS
DROP POLICY IF EXISTS "Managers can view and approve team leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Managers and Admins can view leave requests" ON public.leave_requests;

CREATE POLICY "Managers and Admins can view leave requests" ON public.leave_requests FOR ALL TO authenticated 
USING (
  (auth.uid() = user_id) OR
  (public.has_role(auth.uid(), 'admin_hr')) OR
  (public.has_role(auth.uid(), 'super_admin')) OR
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);

-- OVERTIME REQUESTS
DROP POLICY IF EXISTS "Managers can view and approve team overtime" ON public.overtime_requests;
DROP POLICY IF EXISTS "Managers and Admins can view overtime" ON public.overtime_requests;

CREATE POLICY "Managers and Admins can view overtime" ON public.overtime_requests FOR ALL TO authenticated 
USING (
  (auth.uid() = user_id) OR
  (public.has_role(auth.uid(), 'admin_hr')) OR
  (public.has_role(auth.uid(), 'super_admin')) OR
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);

-- CORRECTIONS
DROP POLICY IF EXISTS "Managers can view and approve corrections" ON public.attendance_corrections;
DROP POLICY IF EXISTS "Managers and Admins can view corrections" ON public.attendance_corrections;

CREATE POLICY "Managers and Admins can view corrections" ON public.attendance_corrections FOR ALL TO authenticated 
USING (
  (auth.uid() = user_id) OR
  (public.has_role(auth.uid(), 'admin_hr')) OR
  (public.has_role(auth.uid(), 'super_admin')) OR
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);

-- REIMBURSEMENTS
DROP POLICY IF EXISTS "Managers can view and approve reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Managers and Admins can view reimbursements" ON public.reimbursements;

CREATE POLICY "Managers and Admins can view reimbursements" ON public.reimbursements FOR ALL TO authenticated 
USING (
  (auth.uid() = user_id) OR
  (public.has_role(auth.uid(), 'admin_hr')) OR
  (public.has_role(auth.uid(), 'super_admin')) OR
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);

-- LOCATIONS
DROP POLICY IF EXISTS "Only HR Admin can insert locations" ON public.office_locations;
DROP POLICY IF EXISTS "Only HR Admin can update locations" ON public.office_locations;
DROP POLICY IF EXISTS "Only HR Admin can delete locations" ON public.office_locations;
DROP POLICY IF EXISTS "Admins can insert locations" ON public.office_locations;
DROP POLICY IF EXISTS "Admins can update locations" ON public.office_locations;
DROP POLICY IF EXISTS "Admins can delete locations" ON public.office_locations;

CREATE POLICY "Admins can insert locations" ON public.office_locations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can update locations" ON public.office_locations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can delete locations" ON public.office_locations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- 5. Enable Super Admin to manage Roles (Sensitive!)
DROP POLICY IF EXISTS "Super Admin can update sensitive profile fields" ON public.profiles;

CREATE POLICY "Super Admin can update sensitive profile fields" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
