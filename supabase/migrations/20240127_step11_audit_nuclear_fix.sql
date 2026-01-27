-- STEP 11: AUDIT SYSTEM NUCLEAR FIX
-- This migration standardizes the audit_logs table and the trigger function 
-- to prevent internal database errors that block saving.

-- 1. Standardize audit_logs table columns
DO $$ 
BEGIN
    -- Rename user_id to changed_by if it exists (for compatibility with existing scripts)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
        ALTER TABLE public.audit_logs RENAME COLUMN user_id TO changed_by;
    END IF;

    -- Ensure all expected columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'changed_by') THEN
        ALTER TABLE public.audit_logs ADD COLUMN changed_by UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'record_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN record_id UUID;
    END IF;

    -- Make record_id NULLABLE to prevent crashes on tables without UUID IDs
    ALTER TABLE public.audit_logs ALTER COLUMN record_id DROP NOT NULL;
END $$;

-- 2. Robust Audit Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_user_id UUID;
  v_record_id UUID;
BEGIN
  -- 1. Get current user safely
  v_user_id := auth.uid();
  
  -- 2. Try to get record ID safely (handle missing 'id' column)
  BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id;
    ELSE
        v_record_id := NEW.id;
    END IF;
  EXCEPTION WHEN others THEN
    v_record_id := NULL;
  END;

  -- 3. Capture data
  IF (TG_OP = 'INSERT') THEN
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
  END IF;

  -- 4. INSERT INTO LOGS (Using dynamic column detection or safe insert)
  -- We wrap this in another sub-block to ensure if audit fails, the MAIN transaction still succeeds.
  -- THIS IS KEY: Audit failure should NOT block the business logic.
  BEGIN
    INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data, changed_by)
    VALUES (TG_OP, TG_TABLE_NAME, v_record_id, v_old_data, v_new_data, v_user_id);
  EXCEPTION WHEN others THEN
    -- If audit fails, just log it to postgres stderr but don't stop the main update
    RAISE WARNING 'Audit log failed for table %: %', TG_TABLE_NAME, SQLERRM;
  END;
  
  -- ALWAYS RETURN NEW/OLD to allow the main operation to continue
  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFRESH TRIGGERS (Standardize standard tables)
DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;
CREATE TRIGGER audit_profiles_changes AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_settings_changes ON public.app_settings;
CREATE TRIGGER audit_settings_changes AFTER INSERT OR UPDATE OR DELETE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 4. SETTINGS TABLE RE-SYC
-- Ensure it has an ID and correctly linked
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'app_settings' AND COLUMN_NAME = 'id') THEN
        ALTER TABLE public.app_settings ADD COLUMN id UUID DEFAULT gen_random_uuid();
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
