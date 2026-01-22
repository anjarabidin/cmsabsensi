-- LINK REQUESTS TO PROFILES TO ENABLE JOIN
-- Purpose: Allow Frontend to query `leave_requests` and join with `profiles` directly using `user_id`.
-- Reason: Currently user_id references auth.users. Supabase needs a reference to public.profiles to enable easier joins.

-- 1. Leave Requests
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_user_id_fkey, -- Drop old ref to auth.users (optional, but cleaner if we replace, actually better to keep both or just add secondary? FKs usually one per column. Actually we can reference profiles(id) instead of auth.users(id) since profiles(id) is 1:1 with auth users)
ADD CONSTRAINT leave_requests_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Overtime Requests
ALTER TABLE public.overtime_requests
DROP CONSTRAINT IF EXISTS overtime_requests_user_id_fkey,
ADD CONSTRAINT overtime_requests_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Attendance Corrections
ALTER TABLE public.attendance_corrections
DROP CONSTRAINT IF EXISTS attendance_corrections_user_id_fkey,
ADD CONSTRAINT attendance_corrections_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Reimbursements
ALTER TABLE public.reimbursements
DROP CONSTRAINT IF EXISTS reimbursements_user_id_fkey,
ADD CONSTRAINT reimbursements_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. Manager Assignments (Ensure link to profiles too for easy fetching)
ALTER TABLE public.manager_assignments
DROP CONSTRAINT IF EXISTS manager_assignments_manager_id_fkey,
ADD CONSTRAINT manager_assignments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.manager_assignments
DROP CONSTRAINT IF EXISTS manager_assignments_employee_id_fkey,
ADD CONSTRAINT manager_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
