-- Update RLS Policies for Approvals to allow Managers to view requests from their Department
-- This is a fallback mechanism: If no assignment exists, check department match.

-- 1. Helper Function to check if user is manager of the requestor's department
CREATE OR REPLACE FUNCTION public.is_manager_of_department(request_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  manager_dept_id UUID;
  user_dept_id UUID;
BEGIN
  -- Get current user's (manager) department
  SELECT department_id INTO manager_dept_id FROM public.profiles WHERE id = auth.uid();
  
  -- Get requestor's department
  SELECT department_id INTO user_dept_id FROM public.profiles WHERE id = request_user_id;

  -- Return true if same department (and not null)
  RETURN manager_dept_id IS NOT NULL AND manager_dept_id = user_dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update Leave Requests Policy
DROP POLICY IF EXISTS "Managers can view and approve team leave requests" ON public.leave_requests;

CREATE POLICY "Managers can view and approve team leave requests" ON public.leave_requests FOR ALL TO authenticated 
USING (
  public.has_role(auth.uid(), 'manager') AND (
    -- Option A: Explicit Assignment
    EXISTS (
      SELECT 1 FROM public.manager_assignments 
      WHERE manager_id = auth.uid() AND employee_id = public.leave_requests.user_id
    )
    OR
    -- Option B: Same Department Match
    public.is_manager_of_department(public.leave_requests.user_id)
  )
);

-- 3. Update Overtime Requests Policy
DROP POLICY IF EXISTS "Managers can view and approve team overtime" ON public.overtime_requests;

CREATE POLICY "Managers can view and approve team overtime" ON public.overtime_requests FOR ALL TO authenticated 
USING (
  public.has_role(auth.uid(), 'manager') AND (
    EXISTS (
      SELECT 1 FROM public.manager_assignments 
      WHERE manager_id = auth.uid() AND employee_id = public.overtime_requests.user_id
    )
    OR
    public.is_manager_of_department(public.overtime_requests.user_id)
  )
);

-- 4. Update Correction Requests Policy
DROP POLICY IF EXISTS "Managers can view and approve corrections" ON public.attendance_corrections;
-- Check if policy exists with exact name, usually it follows pattern. If not sure, we can do DO block but direct replacement is fine for now usually.
-- Let's try to be safe and drop if exists logic is implicit in replacement for some systems but standard SQL needs drop.

CREATE POLICY "Managers can view and approve corrections" ON public.attendance_corrections FOR ALL TO authenticated 
USING (
  public.has_role(auth.uid(), 'manager') AND (
    EXISTS (
      SELECT 1 FROM public.manager_assignments 
      WHERE manager_id = auth.uid() AND employee_id = public.attendance_corrections.user_id
    )
    OR
    public.is_manager_of_department(public.attendance_corrections.user_id)
  )
);

-- 5. Update Reimbursement Requests Policy
DROP POLICY IF EXISTS "Managers can view and approve reimbursements" ON public.reimbursements;

CREATE POLICY "Managers can view and approve reimbursements" ON public.reimbursements FOR ALL TO authenticated 
USING (
  public.has_role(auth.uid(), 'manager') AND (
    EXISTS (
      SELECT 1 FROM public.manager_assignments 
      WHERE manager_id = auth.uid() AND employee_id = public.reimbursements.user_id
    )
    OR
    public.is_manager_of_department(public.reimbursements.user_id)
  )
);
