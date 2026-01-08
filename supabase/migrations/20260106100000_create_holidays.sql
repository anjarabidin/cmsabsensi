-- Create holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can view holidays
CREATE POLICY "Everyone can view holidays" ON public.holidays
    FOR SELECT USING (true);

-- Only admins can manage holidays
CREATE POLICY "Admins can insert holidays" ON public.holidays
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.profiles WHERE role IN ('admin_hr', 'super_admin')
        )
    );

CREATE POLICY "Admins can update holidays" ON public.holidays
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM public.profiles WHERE role IN ('admin_hr', 'super_admin')
        )
    );

CREATE POLICY "Admins can delete holidays" ON public.holidays
    FOR DELETE USING (
        auth.uid() IN (
            SELECT user_id FROM public.profiles WHERE role IN ('admin_hr', 'super_admin')
        )
    );
