-- Hardening manager Role RLS & Permissions
-- This migration ensures managers can see and manage data within their own department

-- 1. Profiles: managers can view all, but update only their department
DROP POLICY IF EXISTS "managers can update department profiles" ON public.profiles;
CREATE POLICY "managers can update department profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND EXISTS (
      SELECT 1 FROM public.profiles manager_p
      WHERE manager_p.id = auth.uid() AND manager_p.department_id = public.profiles.department_id
    )
  );

-- 2. Attendances
DROP POLICY IF EXISTS "managers can view department attendance" ON public.attendances;
CREATE POLICY "managers can view department attendance" ON public.attendances 
  FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'manager') AND EXISTS (
      SELECT 1 FROM public.profiles manager_p
      JOIN public.profiles employee_p ON employee_p.department_id = manager_p.department_id
      WHERE manager_p.id = auth.uid() AND employee_p.id = public.attendances.user_id
    )
  );

-- 3. Leave Requests
DROP POLICY IF EXISTS "managers can view and approve department leave requests" ON public.leave_requests;
CREATE POLICY "managers can view and approve department leave requests" ON public.leave_requests 
  FOR ALL TO authenticated 
  USING (
    public.has_role(auth.uid(), 'manager') AND EXISTS (
      SELECT 1 FROM public.profiles manager_p
      JOIN public.profiles employee_p ON employee_p.department_id = manager_p.department_id
      WHERE manager_p.id = auth.uid() AND employee_p.id = public.leave_requests.user_id
    )
  );

-- 4. Overtime Requests
DROP POLICY IF EXISTS "managers can view and approve department overtime requests" ON public.overtime_requests;
CREATE POLICY "managers can view and approve department overtime requests" ON public.overtime_requests 
  FOR ALL TO authenticated 
  USING (
    public.has_role(auth.uid(), 'manager') AND EXISTS (
      SELECT 1 FROM public.profiles manager_p
      JOIN public.profiles employee_p ON employee_p.department_id = manager_p.department_id
      WHERE manager_p.id = auth.uid() AND employee_p.id = public.overtime_requests.user_id
    )
  );

-- 5. Attendance Corrections
DROP POLICY IF EXISTS "managers can manage department corrections" ON public.attendance_corrections;
CREATE POLICY "managers can manage department corrections" ON public.attendance_corrections
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND EXISTS (
      SELECT 1 FROM public.profiles manager_p
      JOIN public.profiles employee_p ON employee_p.department_id = manager_p.department_id
      WHERE manager_p.id = auth.uid() AND employee_p.id = public.attendance_corrections.user_id
    )
  );

-- 6. Announcements
DROP POLICY IF EXISTS "managers can manage announcements" ON public.announcements;
CREATE POLICY "managers can manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin_hr'));

-- 7. Departments: Allow manager to update their own department info
DROP POLICY IF EXISTS "managers can update own department" ON public.departments;
CREATE POLICY "managers can update own department" ON public.departments
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.department_id = public.departments.id
    )
  );

-- 8. Add Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON public.profiles(department_id);
