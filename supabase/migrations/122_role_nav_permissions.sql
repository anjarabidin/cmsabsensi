-- Migration: Role & Navigation Permission Management
-- Description: Menyimpan izin akses menu sidebar per role.
-- Super Admin dapat mengubah ini melalui halaman Role Management.

CREATE TABLE IF NOT EXISTS public.role_nav_permissions (
    role        TEXT    NOT NULL,
    nav_key     TEXT    NOT NULL,
    is_enabled  BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (role, nav_key)
);

ALTER TABLE public.role_nav_permissions ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "superadmin_manage_nav_perms" ON public.role_nav_permissions;
DROP POLICY IF EXISTS "all_read_nav_perms" ON public.role_nav_permissions;

-- Super admin bisa manage semua
CREATE POLICY "superadmin_manage_nav_perms"
    ON public.role_nav_permissions FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));

-- Semua user bisa baca (buat filter sidebar)
CREATE POLICY "all_read_nav_perms"
    ON public.role_nav_permissions FOR SELECT
    TO authenticated
    USING (true);

-- ================================================================
-- DEFAULT PERMISSIONS
-- ================================================================
INSERT INTO public.role_nav_permissions (role, nav_key, is_enabled) VALUES

-- ── SUPER ADMIN (akses penuh) ────────────────────────────────────
('super_admin','dashboard',true),
('super_admin','attendance',true),
('super_admin','quick_attendance',true),
('super_admin','history',true),
('super_admin','corrections',true),
('super_admin','leave',true),
('super_admin','overtime',true),
('super_admin','reimbursement',true),
('super_admin','salary_slips',true),
('super_admin','payroll',true),
('super_admin','payroll_report',true),
('super_admin','employees',true),
('super_admin','shifts',true),
('super_admin','locations',true),
('super_admin','team_map',true),
('super_admin','reports',true),
('super_admin','approvals',true),
('super_admin','holidays',true),
('super_admin','settings',true),
('super_admin','audit_logs',true),
('super_admin','device_management',true),
('super_admin','role_management',true),
('super_admin','information',true),
('super_admin','agenda',true),
('super_admin','albums',true),
('super_admin','notes',true),
('super_admin','profile',true),
('super_admin','notifications',true),
('super_admin','driver_logbook',false),
('super_admin','driver_reports',true),

-- ── ADMIN HR ────────────────────────────────────────────────────
('admin_hr','dashboard',true),
('admin_hr','attendance',true),
('admin_hr','quick_attendance',true),
('admin_hr','history',true),
('admin_hr','corrections',true),
('admin_hr','leave',true),
('admin_hr','overtime',true),
('admin_hr','reimbursement',true),
('admin_hr','salary_slips',true),
('admin_hr','payroll',true),
('admin_hr','payroll_report',true),
('admin_hr','employees',true),
('admin_hr','shifts',true),
('admin_hr','locations',true),
('admin_hr','team_map',true),
('admin_hr','reports',true),
('admin_hr','approvals',true),
('admin_hr','holidays',true),
('admin_hr','settings',true),
('admin_hr','audit_logs',false),
('admin_hr','device_management',false),
('admin_hr','role_management',false),
('admin_hr','information',true),
('admin_hr','agenda',true),
('admin_hr','albums',true),
('admin_hr','notes',true),
('admin_hr','profile',true),
('admin_hr','notifications',true),
('admin_hr','driver_logbook',false),
('admin_hr','driver_reports',true),

-- ── manager ─────────────────────────────────────────────────────
('manager','dashboard',true),
('manager','attendance',true),
('manager','quick_attendance',false),
('manager','history',true),
('manager','corrections',false),
('manager','leave',true),
('manager','overtime',true),
('manager','reimbursement',true),
('manager','salary_slips',true),
('manager','payroll',false),
('manager','payroll_report',false),
('manager','employees',true),
('manager','shifts',false),
('manager','locations',false),
('manager','team_map',true),
('manager','reports',true),
('manager','approvals',true),
('manager','holidays',false),
('manager','settings',false),
('manager','audit_logs',false),
('manager','device_management',false),
('manager','role_management',false),
('manager','information',true),
('manager','agenda',true),
('manager','albums',true),
('manager','notes',true),
('manager','profile',true),
('manager','notifications',true),
('manager','driver_logbook',false),
('manager','driver_reports',true),

-- ── EMPLOYEE ─────────────────────────────────────────────────────
('employee','dashboard',true),
('employee','attendance',true),
('employee','quick_attendance',false),
('employee','history',true),
('employee','corrections',true),
('employee','leave',true),
('employee','overtime',true),
('employee','reimbursement',true),
('employee','salary_slips',true),
('employee','payroll',false),
('employee','payroll_report',false),
('employee','employees',false),
('employee','shifts',false),
('employee','locations',false),
('employee','team_map',false),
('employee','reports',false),
('employee','approvals',false),
('employee','holidays',false),
('employee','settings',false),
('employee','audit_logs',false),
('employee','device_management',false),
('employee','role_management',false),
('employee','information',true),
('employee','agenda',true),
('employee','albums',true),
('employee','notes',true),
('employee','profile',true),
('employee','notifications',true),
('employee','driver_logbook',false),
('employee','driver_reports',false),

-- ── DRIVER ───────────────────────────────────────────────────────
('driver','dashboard',true),
('driver','attendance',true),
('driver','quick_attendance',false),
('driver','history',true),
('driver','corrections',false),
('driver','leave',true),
('driver','overtime',false),
('driver','reimbursement',false),
('driver','salary_slips',true),
('driver','payroll',false),
('driver','payroll_report',false),
('driver','employees',false),
('driver','shifts',false),
('driver','locations',false),
('driver','team_map',false),
('driver','reports',false),
('driver','approvals',false),
('driver','holidays',false),
('driver','settings',false),
('driver','audit_logs',false),
('driver','device_management',false),
('driver','role_management',false),
('driver','information',true),
('driver','agenda',false),
('driver','albums',false),
('driver','notes',false),
('driver','profile',true),
('driver','notifications',true),
('driver','driver_logbook',true),
('driver','driver_reports',false)

ON CONFLICT (role, nav_key) DO NOTHING;
