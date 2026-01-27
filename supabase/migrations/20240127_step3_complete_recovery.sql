-- COMPREHENSIVE RECOVERY & HARDENING SCRIPT
-- Gunakan script ini untuk memperbaiki error "relation app_settings does not exist"
-- dan menyelesaikan setup super_admin sekaligus.

-- 1. Ensure 'super_admin' exists in enum (Safe to re-run)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Create app_settings table (FIX MISSING TABLE ERROR)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create Audit Logs Table (If not exists)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Audit Log Policy
DROP POLICY IF EXISTS "Super admin can view audit logs" ON public.audit_logs;
CREATE POLICY "Super admin can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));

-- 5. Audit Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF (TG_OP = 'INSERT') THEN
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data, changed_by)
  VALUES (TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), v_old_data, v_new_data, v_user_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Settings Policy & Seed (Fixing access)
DROP POLICY IF EXISTS "Everyone can read app settings" ON public.app_settings;
CREATE POLICY "Everyone can read app settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only HR Admin can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.app_settings (key, value, description)
VALUES ('require_face_verification', 'true'::jsonb, 'Toggle whether face verification is required for attendance')
ON CONFLICT (key) DO NOTHING;

-- 7. Enable Triggers for Audit
DROP TRIGGER IF EXISTS audit_settings_changes ON public.app_settings;
CREATE TRIGGER audit_settings_changes
AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;
CREATE TRIGGER audit_profiles_changes
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 8. Anti-Escalation (Role Locking)
CREATE OR REPLACE FUNCTION public.prevent_role_escalation() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    IF (public.has_role(auth.uid(), 'super_admin')) THEN
       RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only Super Admin can change user roles.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_role_escalation ON public.profiles;
CREATE TRIGGER check_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();
