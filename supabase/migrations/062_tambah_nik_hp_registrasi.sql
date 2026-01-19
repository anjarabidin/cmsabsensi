-- Migrasi 062: Update Profil dengan NIK dan No HP
-- Menambahkan kolom dan update trigger registrasi

-- 1. Tambahkan kolom ke tabel profiles jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'nik') THEN
        ALTER TABLE public.profiles ADD COLUMN nik VARCHAR(20);
    END IF;
END $$;

-- 2. Update fungsi handle_new_user untuk support data tambahan dari metadata
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
    phone,    -- Baru
    nik,      -- Baru
    onboarding_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',  -- Ambil dari metadata
    NEW.raw_user_meta_data ->> 'nik',    -- Ambil dari metadata
    'pending_verification'
  );
  
  -- Assign role default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;
