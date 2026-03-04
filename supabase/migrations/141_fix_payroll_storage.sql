-- Recovery Migration: Fix Payroll Storage & Policies
-- Ensure the salary-slips bucket exists and has proper policies for super_admin

-- 1. Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('salary-slips', 'salary-slips', false) 
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to recreation them cleanly
DROP POLICY IF EXISTS "Admin HR can manage salary slip files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own salary slip files" ON storage.objects;
DROP POLICY IF EXISTS "Super Admin can manage all library files" ON storage.objects;

-- 3. Create robust policies
-- Super Admin: Full Access
CREATE POLICY "Super Admin manage salary slips"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'salary-slips' AND
  (
    public.has_role(auth.uid(), 'super_admin') OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
);

-- Admin HR: Full Access (backup)
CREATE POLICY "Admin HR manage salary slips"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'salary-slips' AND
  public.has_role(auth.uid(), 'admin_hr')
);

-- Users: Read Only their own folder
CREATE POLICY "Users view own salary slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'salary-slips' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
