-- Enable RLS for job_positions
ALTER TABLE IF EXISTS public.job_positions ENABLE ROW LEVEL SECURITY;

-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_positions' AND column_name = 'description') THEN
        ALTER TABLE public.job_positions ADD COLUMN description TEXT;
    END IF;
END $$;

-- Policies for job_positions
DROP POLICY IF EXISTS "Job positions are viewable by authenticated users" ON public.job_positions;
CREATE POLICY "Job positions are viewable by authenticated users" 
ON public.job_positions FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Admin HR can manage job positions" ON public.job_positions;
CREATE POLICY "Admin HR can manage job positions" 
ON public.job_positions FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr'));

-- Ensure 'General' department exists if not present
INSERT INTO public.departments (name, description)
VALUES ('General', 'Departemen Umum')
ON CONFLICT (name) DO NOTHING;

-- Ensure 'Staff' position exists for General department if not present
DO $$
DECLARE
    gen_dept_id UUID;
BEGIN
    SELECT id INTO gen_dept_id FROM public.departments WHERE name = 'General' LIMIT 1;
    
    IF gen_dept_id IS NOT NULL THEN
        INSERT INTO public.job_positions (department_id, title, is_leadership)
        SELECT gen_dept_id, 'Staff', false
        WHERE NOT EXISTS (
            SELECT 1 FROM public.job_positions WHERE title = 'Staff' AND department_id = gen_dept_id
        );

        INSERT INTO public.job_positions (department_id, title, is_leadership)
        SELECT gen_dept_id, 'Manager', true
        WHERE NOT EXISTS (
            SELECT 1 FROM public.job_positions WHERE title = 'Manager' AND department_id = gen_dept_id
        );
    END IF;
END $$;
