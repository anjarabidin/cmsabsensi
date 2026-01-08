-- Fix Relationships for easy joining with Profiles
-- This migration adds explicit Foreign Keys to public.profiles for easier PostgREST joins

-- 1. Leave Requests
ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_user_id_fkey,
  ADD CONSTRAINT leave_requests_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Overtime Requests
ALTER TABLE public.overtime_requests
  DROP CONSTRAINT IF EXISTS overtime_requests_user_id_fkey,
  ADD CONSTRAINT overtime_requests_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Attendance Corrections
ALTER TABLE public.attendance_corrections
  DROP CONSTRAINT IF EXISTS attendance_corrections_user_id_fkey,
  ADD CONSTRAINT attendance_corrections_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Attendances (Optional, but good for consistency)
ALTER TABLE public.attendances
  DROP CONSTRAINT IF EXISTS attendances_user_id_fkey,
  ADD CONSTRAINT attendances_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
