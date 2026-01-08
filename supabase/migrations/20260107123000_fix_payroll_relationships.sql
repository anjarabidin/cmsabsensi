-- FIX RELATIONSHIPS FOR PAYROLL TABLES
-- Ensure all user_id columns reference public.profiles(id) for easier joining in PostgREST

-- 1. Monthly Attendance Summary
ALTER TABLE public.monthly_attendance_summary
  DROP CONSTRAINT IF EXISTS monthly_attendance_summary_user_id_fkey,
  ADD CONSTRAINT monthly_attendance_summary_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Payroll Details
ALTER TABLE public.payroll_details
  DROP CONSTRAINT IF EXISTS payroll_details_user_id_fkey,
  ADD CONSTRAINT payroll_details_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Payroll Runs (optional but good for consistency)
ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_generated_by_fkey,
  ADD CONSTRAINT payroll_runs_generated_by_fkey 
  FOREIGN KEY (generated_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS payroll_runs_finalized_by_fkey,
  ADD CONSTRAINT payroll_runs_finalized_by_fkey 
  FOREIGN KEY (finalized_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Employee Families (from Enterprise Schema)
ALTER TABLE public.employee_families
  DROP CONSTRAINT IF EXISTS employee_families_user_id_fkey,
  ADD CONSTRAINT employee_families_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. Re-check Employee Salaries (In case some missed)
ALTER TABLE public.employee_salaries
  DROP CONSTRAINT IF EXISTS employee_salaries_user_id_fkey,
  ADD CONSTRAINT employee_salaries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. Add Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_monthly_summary_user_id ON public.monthly_attendance_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_details_user_id ON public.payroll_details(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_id ON public.employee_salaries(user_id);
