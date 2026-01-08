-- Allow employees to view their own salary for Overtime estimation
DROP POLICY IF EXISTS "Admin HR manage salaries" ON public.employee_salaries;

-- Split into two policies
CREATE POLICY "Admin HR manage all salaries" 
  ON public.employee_salaries
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "Users can view own salary" 
  ON public.employee_salaries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
