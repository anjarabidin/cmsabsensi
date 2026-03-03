-- Migration: Per-User Navigation Permissions
-- Description: Menyimpan pengecualian (override) izin menu sidebar per individu.
-- Jika user_id ada di sini, maka status is_enabled ini yang akan dipakai, me-override settingan Role.

CREATE TABLE IF NOT EXISTS public.user_nav_permissions (
    user_id     UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nav_key     TEXT    NOT NULL,
    is_enabled  BOOLEAN NOT NULL,
    PRIMARY KEY (user_id, nav_key)
);

ALTER TABLE public.user_nav_permissions ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "superadmin_manage_user_nav_perms" ON public.user_nav_permissions;
DROP POLICY IF EXISTS "user_read_own_nav_perms" ON public.user_nav_permissions;

-- Super admin bisa manage semua
CREATE POLICY "superadmin_manage_user_nav_perms"
    ON public.user_nav_permissions FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));

-- User bisa baca izinnya sendiri
CREATE POLICY "user_read_own_nav_perms"
    ON public.user_nav_permissions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
