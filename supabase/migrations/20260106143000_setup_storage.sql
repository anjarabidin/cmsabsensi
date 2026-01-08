-- MODULE: STORAGE SETUP
-- Description: Create storage bucket for reimbursement attachments and set up RLS policies.

-- 1. Create 'reimbursements' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('reimbursements', 'reimbursements', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects (if not already enabled, usually enabled by default)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies for Storage
-- A. Policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload reimbursement files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reimbursements' AND
  auth.uid() = owner
);

-- B. Policy to allow users to view their own files (or everyone if public? Let's make it public for simplicity in this app context, or strictly owner/admin)
-- Since we made the bucket public (public=true), files are accessible via public URL if known. 
-- However, for RLS on select (fetching the object metadata), we need a policy.
CREATE POLICY "Users can view reimbursement files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'reimbursements');

-- C. Policy to allow users to delete their own files
CREATE POLICY "Users can delete their own reimbursement files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reimbursements' AND
  auth.uid() = owner
);
