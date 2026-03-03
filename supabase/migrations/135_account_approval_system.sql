-- Migration: Account Approval System
-- Description: Menambahkan sistem persetujuan akun registrasi baru.
-- Memungkinkan admin memilih siapa yang berhak menyetujui, dan mengaktifkan 
-- proses verifikasi (is_active = false) saat mendaftar.

-- 1. Tambahkan pengaturan baru ke app_settings untuk menentukan role mana yang bisa menyetujui akun
INSERT INTO public.app_settings (key, value, description)
VALUES 
('account_approval_roles', '"super_admin,admin_hr"'::jsonb, 'Role yang diizinkan untuk menyetujui pendaftaran akun baru'),
('enable_account_approval', '"true"'::jsonb, 'Aktifkan proses persetujuan admin untuk pendaftaran akun baru')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Update fungsi handle_new_user untuk menghormati pengaturan approval
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    approval_enabled BOOLEAN;
BEGIN
    -- Cek apakah approval diaktifkan (lebih robust terhadap berbagai format JSON)
    SELECT (value::text = 'true' OR value::text = '"true"') INTO approval_enabled 
    FROM public.app_settings 
    WHERE key = 'enable_account_approval';

    INSERT INTO public.profiles (
        id, 
        full_name, 
        email, 
        phone, 
        nik,
        role,
        onboarding_status,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data ->> 'phone',
        NEW.raw_user_meta_data ->> 'nik',
        'employee', -- Default role
        'pending_verification',
        CASE WHEN approval_enabled THEN false ELSE true END, -- Nonaktif jika approval aktif
        NOW(),
        NOW()
    );
    
    RETURN NEW;
END;
$$;

-- 3. Tambahkan izin navigasi 'account_approvals' (opsional jika mau dipisah, tapi saat ini kita gabung di 'approvals')
-- Pastikan role yang diizinkan memiliki akses ke 'approvals'
INSERT INTO public.role_nav_permissions (role, nav_key, is_enabled)
VALUES 
('super_admin', 'approvals', true),
('admin_hr', 'approvals', true)
ON CONFLICT (role, nav_key) DO UPDATE SET is_enabled = true;
