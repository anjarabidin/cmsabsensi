-- FIX SALARY SCHEMA & POLICIES FINAL V4
-- Resolving Syntax Errors and Constraint Issues

-- 1. Deduplicate entries safely
DELETE FROM public.employee_salaries
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at DESC) as rnum
    FROM public.employee_salaries
  ) t
  WHERE t.rnum > 1
);

-- 2. Ensure Unique Constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_salaries_user_id_key'
  ) THEN
    ALTER TABLE public.employee_salaries
    ADD CONSTRAINT employee_salaries_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 3. Default Salaries Seeding (Safe Insert)
INSERT INTO public.employee_salaries (
  user_id, 
  base_salary, 
  transport_allowance, 
  meal_allowance,
  effective_date
)
SELECT 
  id, 
  5000000, 
  500000, 
  500000,
  CURRENT_DATE
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 4. Reset & Re-apply Policies Safely
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

-- Drop checking existence to avoid errors
DROP POLICY IF EXISTS "Admin HR manage all salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "Users can view own salary" ON public.employee_salaries;

-- Create Policies (Standard SQL format)
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
