-- FIX MANAGER RLS POLICIES (FINAL VERSION)
-- Purpose: Ensure Managers can view requests from employees in their department OR assigned to them.
-- Strategy: Drop conflicting policies and recreate with explicit Dept Match logic.

-- 1. Helper Function to check Department Match (Versi Optimized)
CREATE OR REPLACE FUNCTION public.check_manager_access(request_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check 1: Is user assigned to manager?
  IF EXISTS (SELECT 1 FROM public.manager_assignments WHERE manager_id = auth.uid() AND employee_id = request_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Check 2: Are they in the same department?
  IF EXISTS (
    SELECT 1 
    FROM public.profiles manager, public.profiles employee
    WHERE manager.id = auth.uid() 
      AND employee.id = request_user_id
      AND manager.department_id = employee.department_id
      AND manager.department_id IS NOT NULL -- Pastikan tidak NULL match
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. APPLY TO LEAVE REQUESTS
DROP POLICY IF EXISTS "Managers can view and approve team leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Managers can view team leave requests" ON public.leave_requests; -- Jaga-jaga nama beda

CREATE POLICY "Managers can view and approve team leave requests" ON public.leave_requests FOR ALL TO authenticated 
USING (
  -- User sendiri boleh lihat
  (auth.uid() = user_id) 
  OR
  -- Admin HR boleh semua
  (public.has_role(auth.uid(), 'admin_hr'))
  OR
  -- Manager: Cek Access via Function (Assignment OR Dept)
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);


-- 3. APPLY TO OVERTIME REQUESTS
DROP POLICY IF EXISTS "Managers can view and approve team overtime" ON public.overtime_requests;

CREATE POLICY "Managers can view and approve team overtime" ON public.overtime_requests FOR ALL TO authenticated 
USING (
  (auth.uid() = user_id) 
  OR
  (public.has_role(auth.uid(), 'admin_hr'))
  OR
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);


-- 4. APPLY TO CORRECTIONS
DROP POLICY IF EXISTS "Managers can view and approve corrections" ON public.attendance_corrections;

CREATE POLICY "Managers can view and approve corrections" ON public.attendance_corrections FOR ALL TO authenticated 
USING (
  (auth.uid() = user_id) 
  OR
  (public.has_role(auth.uid(), 'admin_hr'))
  OR
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);


-- 5. APPLY TO REIMBURSEMENTS
DROP POLICY IF EXISTS "Managers can view and approve reimbursements" ON public.reimbursements;

CREATE POLICY "Managers can view and approve reimbursements" ON public.reimbursements FOR ALL TO authenticated 
USING (
  (auth.uid() = user_id) 
  OR
  (public.has_role(auth.uid(), 'admin_hr'))
  OR
  (public.has_role(auth.uid(), 'manager') AND public.check_manager_access(user_id))
);
