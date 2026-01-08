-- Fix Schema: Add Missing Unique Constraint on employee_salaries
-- REVISED V3: Fix NOT NULL constraint violation for 'effective_date'

-- 1. Deduplicate entries
DELETE FROM public.employee_salaries
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at DESC) as rnum
    FROM public.employee_salaries
  ) t
  WHERE t.rnum > 1
);

-- 2. Add Unique Constraint
ALTER TABLE public.employee_salaries
DROP CONSTRAINT IF EXISTS employee_salaries_user_id_key;

ALTER TABLE public.employee_salaries
ADD CONSTRAINT employee_salaries_user_id_key UNIQUE (user_id);

-- 3. Insert Default Salaries (Now including 'effective_date')
INSERT INTO public.employee_salaries (
  user_id, 
  base_salary, 
  transport_allowance, 
  meal_allowance,
  effective_date -- Creating the missing column value
)
SELECT 
  id, 
  5000000, 
  500000, 
  500000,
  CURRENT_DATE -- Set effective date to today
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 4. Re-apply RLS policies
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin HR manage all salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "Users can view own salary" ON public.employee_salaries;
DROP POLICY IF EXISTS "Users can view their own salary" ON public.employee_salaries;

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
