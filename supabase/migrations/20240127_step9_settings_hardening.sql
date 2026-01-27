-- STEP 9: SETTINGS & AUDIT LOG HARDENING
-- This migration fixes the "Gagal Menyimpan" error in Settings by ensuring 
-- the app_settings table is compatible with the audit log trigger.

-- 1. Add 'id' column to app_settings
-- The process_audit_log function expects an 'id' column for record_id.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'app_settings' AND COLUMN_NAME = 'id') THEN
        ALTER TABLE public.app_settings ADD COLUMN id UUID DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 2. Update process_audit_log to be more robust
-- If a table doesn't have an 'id', we should fallback to something else or skip record_id.
CREATE OR REPLACE FUNCTION public.process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_user_id UUID;
  v_record_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Try to get ID safely
  BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id;
    ELSE
        v_record_id := NEW.id;
    END IF;
  EXCEPTION WHEN others THEN
    v_record_id := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
  END IF;

  -- Only insert if we have a record_id or if we allow NULL record_id
  -- We'll use a dummy UUID if record_id is NULL for tables that are important but don't have UUIDs
  -- But since we added 'id' to app_settings, this is a safety net.
  
  INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data, changed_by)
  VALUES (TG_OP, TG_TABLE_NAME, COALESCE(v_record_id, '00000000-0000-0000-0000-000000000000'::uuid), v_old_data, v_new_data, v_user_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure Policies are inclusive for Super Admin
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

-- 4. REFRESH
NOTIFY pgrst, 'reload config';
