-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can view active announcements
CREATE POLICY "Everyone can view active announcements" ON public.announcements
    FOR SELECT USING (is_active = true);

-- Admins can view all announcements (including inactive)
CREATE POLICY "Admins can view all announcements" ON public.announcements
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM public.profiles WHERE role IN ('admin_hr', 'super_admin')
        )
    );

-- Only admins can insert announcements
CREATE POLICY "Admins can insert announcements" ON public.announcements
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.profiles WHERE role IN ('admin_hr', 'super_admin')
        )
    );

-- Only admins can update announcements
CREATE POLICY "Admins can update announcements" ON public.announcements
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM public.profiles WHERE role IN ('admin_hr', 'super_admin')
        )
    );

-- Only admins can delete announcements
CREATE POLICY "Admins can delete announcements" ON public.announcements
    FOR DELETE USING (
        auth.uid() IN (
            SELECT user_id FROM public.profiles WHERE role IN ('admin_hr', 'super_admin')
        )
    );
