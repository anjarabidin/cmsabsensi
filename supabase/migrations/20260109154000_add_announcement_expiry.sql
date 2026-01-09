-- Add expires_at column to announcements
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Update the view policy to only show non-expired announcements
DROP POLICY IF EXISTS "Everyone can view active announcements" ON public.announcements;
CREATE POLICY "Everyone can view active announcements" ON public.announcements
    FOR SELECT USING (
        is_active = true AND (expires_at IS NULL OR expires_at > NOW())
    );
