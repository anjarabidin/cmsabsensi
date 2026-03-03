-- Migration 126: Manual Salary Slips
-- This allows admins to upload PDF salary slips for users, bypassing automatic calculations.

-- 1. Create the salary_slips table
CREATE TABLE IF NOT EXISTS public.salary_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase storage
  file_name TEXT NOT NULL, -- Original name of the file
  status TEXT DEFAULT 'published', -- published, draft
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, month, year)
);

-- 2. Enable RLS
ALTER TABLE public.salary_slips ENABLE ROW LEVEL SECURITY;

-- 3. Policies for salary_slips table
-- User can view their own slips
CREATE POLICY "Users can view their own salary slips"
ON public.salary_slips FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin/HR can manage all slips
CREATE POLICY "Admin HR can manage salary slips"
ON public.salary_slips FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin_hr'));

-- 4. Storage Bucket
-- Create 'salary-slips' bucket if it doesn't exist. Private for security.
INSERT INTO storage.buckets (id, name, public)
VALUES ('salary-slips', 'salary-slips', false) 
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Policies
-- Admin/HR can perform all actions
CREATE POLICY "Admin HR can manage salary slip files"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'salary-slips' AND
  public.has_role(auth.uid(), 'admin_hr')
);

-- Users can only read their own files
-- Assuming the file path is structured as "user_id/filename.pdf"
CREATE POLICY "Users can view their own salary slip files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'salary-slips' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Trigger for updated_at
CREATE TRIGGER update_salary_slips_updated_at 
  BEFORE UPDATE ON public.salary_slips 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
