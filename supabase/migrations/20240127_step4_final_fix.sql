-- STEP 4: FINAL SUPER ADMIN PRIVILEGES & FIXES (REVISED)
-- Script ini menyempurnakan akses Super Admin untuk:
-- 1. Payroll (Gaji)
-- 2. Master Data (Jabatan, Departemen, Shift, Libur)
-- 3. Pengumuman & Notifikasi (Support RPC Function)
-- 4. Keamanan Role (Super Admin Only)
-- 5. Face Enrollment (Reset Wajah)
-- 6. App Settings (Fix "Gagal Menyimpan")
-- 7. Fix Timezone Bug pada Pengingat Otomatis

-- =============================================================================
-- 1. PAYROLL MODULE (Membuka akses Gaji untuk Super Admin)
-- =============================================================================

-- Employee Salaries
DROP POLICY IF EXISTS "Admin HR can view all salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "Admin HR can manage salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "Admins can view all salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "Admins can manage salaries" ON public.employee_salaries;

CREATE POLICY "Admins can view all salaries" ON public.employee_salaries FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage salaries" ON public.employee_salaries FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Payroll Runs
DROP POLICY IF EXISTS "Admin HR can view all payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Admin HR can manage payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Admins can view all payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Admins can manage payroll runs" ON public.payroll_runs;

CREATE POLICY "Admins can view all payroll runs" ON public.payroll_runs FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage payroll runs" ON public.payroll_runs FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Payroll Details
DROP POLICY IF EXISTS "Admin HR can view all payroll details" ON public.payroll_details;
DROP POLICY IF EXISTS "Admin HR can manage payroll details" ON public.payroll_details;
DROP POLICY IF EXISTS "Admins can view all payroll details" ON public.payroll_details;
DROP POLICY IF EXISTS "Admins can manage payroll details" ON public.payroll_details;

CREATE POLICY "Admins can view all payroll details" ON public.payroll_details FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage payroll details" ON public.payroll_details FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Payroll Adjustments
DROP POLICY IF EXISTS "Admin HR can manage adjustments" ON public.payroll_adjustments;
DROP POLICY IF EXISTS "Admins can manage adjustments" ON public.payroll_adjustments;

CREATE POLICY "Admins can manage adjustments" ON public.payroll_adjustments FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- PTKP Rates
DROP POLICY IF EXISTS "Admin HR can manage PTKP rates" ON public.ptkp_rates;
DROP POLICY IF EXISTS "Admins can manage PTKP rates" ON public.ptkp_rates;

CREATE POLICY "Admins can manage PTKP rates" ON public.ptkp_rates FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));


-- =============================================================================
-- 2. MASTER DATA (Departemen, Jabatan, Shift, Libur)
-- =============================================================================

-- Departments
DROP POLICY IF EXISTS "Admin HR can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;

CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Job Positions
DROP POLICY IF EXISTS "Admin HR can manage job positions" ON public.job_positions;
DROP POLICY IF EXISTS "Admins can manage job positions" ON public.job_positions;

CREATE POLICY "Admins can manage job positions" ON public.job_positions FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Shifts
DROP POLICY IF EXISTS "Admin HR can manage shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins can manage shifts" ON public.shifts;

CREATE POLICY "Admins can manage shifts" ON public.shifts FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Holidays
DROP POLICY IF EXISTS "Admin HR can manage holidays" ON public.holidays;
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;

CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));


-- =============================================================================
-- 3. ANNOUNCEMENTS & LOGIC FIX
-- =============================================================================

-- Announcements Table Access
DROP POLICY IF EXISTS "Only Admin HR can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;

CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- FIX FUNCTION: publish_announcement
CREATE OR REPLACE FUNCTION public.publish_announcement(
  p_title TEXT,
  p_content TEXT,
  p_created_by UUID,
  p_send_notification BOOLEAN DEFAULT true,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_announcement_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Caller must match p_created_by
  IF auth.uid() <> p_created_by THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Only privileged roles can publish (ADDED super_admin)
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin_hr', 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1. Insert Announcement
  INSERT INTO public.announcements (title, content, created_by, is_active, created_at, expires_at)
  VALUES (p_title, p_content, p_created_by, true, NOW(), p_expires_at)
  RETURNING id INTO v_announcement_id;

  -- 2. Bulk Insert Notifications
  IF p_send_notification THEN
    INSERT INTO public.notifications (user_id, title, message, type, is_read, created_at)
    SELECT
      id,
      p_title,
      p_content,
      'info',
      false,
      NOW()
    FROM public.profiles
    WHERE is_active = true;
  END IF;

  RETURN v_announcement_id;
END;
$$;

-- FIX FUNCTION: check_shift_reminders (Timezone Bug)
CREATE OR REPLACE FUNCTION check_shift_reminders()
RETURNS void AS $$
DECLARE
    v_user_record RECORD;
    v_now_time TIME;
    v_today DATE;
    v_buffer_minutes INTERVAL := '15 minutes';
BEGIN
    -- FIX: Force Asia/Jakarta Timezone
    v_now_time := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::time;
    v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date;

    -- A. PENGINGAT MASUK
    FOR v_user_record IN 
        SELECT 
            es.user_id, 
            p.full_name,
            s.name as shift_name,
            s.start_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        LEFT JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE 
            es.date = v_today 
            AND es.is_day_off = false 
            AND a.clock_in IS NULL 
            AND s.start_time > v_now_time 
            AND s.start_time <= (v_now_time + v_buffer_minutes)
            AND NOT EXISTS ( 
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'reminder_clock_in' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'Pengingat Masuk',
            'Halo ' || split_part(v_user_record.full_name, ' ', 1) || ', sebentar lagi jam masuk (' || to_char(v_user_record.start_time, 'HH24:MI') || '). Jangan lupa absen!',
            'reminder_clock_in',
            '/dashboard'
        );
    END LOOP;

    -- B. PENGINGAT PULANG
    FOR v_user_record IN 
        SELECT 
            es.user_id, 
            p.full_name,
            s.name as shift_name,
            s.end_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE 
            es.date = v_today 
            AND es.is_day_off = false 
            AND a.clock_in IS NOT NULL 
            AND a.clock_out IS NULL 
            AND s.end_time > v_now_time 
            AND s.end_time <= (v_now_time + v_buffer_minutes)
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND n.type = 'reminder_clock_out' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'Pengingat Pulang',
            'Sebentar lagi jam pulang (' || to_char(v_user_record.end_time, 'HH24:MI') || '). Pastikan absen pulang ya!',
            'reminder_clock_out',
            '/dashboard'
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 4. FACE ENROLLMENTS & ALBUMS
-- =============================================================================

-- Face Enrollments
DROP POLICY IF EXISTS "Admin can manage all face enrollments" ON public.face_enrollments;
DROP POLICY IF EXISTS "Admins can manage all face enrollments" ON public.face_enrollments;

CREATE POLICY "Admins can manage all face enrollments" ON public.face_enrollments FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin_hr', 'manager')
  )
);

-- Albums
DROP POLICY IF EXISTS "Admins can manage albums" ON public.albums;
CREATE POLICY "Admins can manage albums" ON public.albums FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));


-- =============================================================================
-- 5. APP SETTINGS (Fix "Gagal Menyimpan")
-- =============================================================================

DROP POLICY IF EXISTS "Only HR Admin can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));


-- =============================================================================
-- 6. ROLE ESCALATION PROTECTION (Refined)
-- =============================================================================

-- Allow Admin HR to change standard roles, but PROTECT 'super_admin' role.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    
    -- 1. Super Admin can do anything
    IF (public.has_role(auth.uid(), 'super_admin')) THEN
       RETURN NEW;
    END IF;

    -- 2. Admin HR checks
    IF (public.has_role(auth.uid(), 'admin_hr')) THEN
       -- Cannot promote TO super_admin
       IF (NEW.role::text = 'super_admin') THEN
         RAISE EXCEPTION 'Only Super Admin can promote users to Super Admin.';
       END IF;
       -- Cannot demote FROM super_admin
       IF (OLD.role::text = 'super_admin') THEN
         RAISE EXCEPTION 'Only Super Admin can demote a Super Admin.';
       END IF;
       
       -- Safe to proceed for other roles (employee <-> manager <-> admin_hr)
       RETURN NEW;
    END IF;
    
    -- 3. Block everyone else
    RAISE EXCEPTION 'You are not authorized to change user roles.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
