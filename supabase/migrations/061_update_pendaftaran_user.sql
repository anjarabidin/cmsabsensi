-- Migrasi untuk Update Logika Pendaftaran User Baru
-- Tujuan: Set onboarding_status = 'pending_verification' secara default
-- Supaya trigger notifikasi "Verifikasi Karyawan Baru" di Dashboard HR bekerja.

-- 1. Tambahkan kolom onboarding_status di PROFILES jika belum ada (idempotent)
-- (Kolom ini mungkin sudah ada di migrasi sebelumnya, tapi kita pastikan ulang)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_status') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_status VARCHAR(50) DEFAULT 'draft';
    END IF;
END $$;

-- 2. Update Function handle_new_user yang dipanggil saat Register/SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    email, 
    onboarding_status -- Set status awal
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    'pending_verification' -- KUNCI: Status ini memicu notifikasi HR
  );
  
  -- Assign default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;

-- Trigger on_auth_user_created sudah ada di migrasi 001, jadi kita tidak perlu create trigger ulang.
-- Cukup replace function-nya saja seperti di atas.
