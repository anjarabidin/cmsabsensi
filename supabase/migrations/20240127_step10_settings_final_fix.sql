-- FINAL HARDENING FOR SETTINGS (Run this if still failing)
-- This version ensures everyone has access to the record itself and the triggers are refreshed.

-- 1. Ensure the record exists for 'require_face_verification'
-- If upsert/update failed, maybe the row was deleted or never successfully seeded.
INSERT INTO public.app_settings (key, value, description)
VALUES ('require_face_verification', 'true'::jsonb, 'Toggle verifikasi wajah')
ON CONFLICT (key) DO NOTHING;

-- 2. RE-CREATE Trigger to be absolutely sure it's using the latest function
DROP TRIGGER IF EXISTS audit_settings_changes ON public.app_settings;
CREATE TRIGGER audit_settings_changes
AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 3. Grant explicit bypass RLS for this specific table (FOR TESTING/FIXING)
-- Sometimes policies overlap or conflict. Let's simplify.
DROP POLICY IF EXISTS "Everyone can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only HR Admin can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Allow select for all" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all for admins" ON public.app_settings FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_hr'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_hr'));

-- 4. Check if the 'updated_by' column exists (it's in the table definition but let's be sure)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'app_settings' AND COLUMN_NAME = 'updated_by') THEN
        ALTER TABLE public.app_settings ADD COLUMN updated_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
