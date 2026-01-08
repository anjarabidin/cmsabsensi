-- SQL Helper: Assign Multiple Roles to User
-- Gunakan ini di Supabase SQL Editor untuk memberikan multiple roles ke user tertentu

-- 1. Cari user_id berdasarkan email
-- Ganti 'anjarbdn@gmail.com' dengan email yang kamu inginkan
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Ambil user_id dari auth.users berdasarkan email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'anjarbdn@gmail.com';

  -- Jika user tidak ditemukan, tampilkan error
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User dengan email anjarbdn@gmail.com tidak ditemukan';
  END IF;

  -- Tampilkan user_id yang ditemukan
  RAISE NOTICE 'User ID: %', target_user_id;

  -- Assign role 'manager' (jika belum ada)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'manager')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Assign role 'admin_hr' (jika belum ada)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin_hr')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Roles berhasil ditambahkan ke user anjarbdn@gmail.com';
END $$;

-- 2. Verifikasi: Lihat semua roles yang dimiliki user ini
SELECT 
  u.email,
  ur.role
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'anjarbdn@gmail.com'
ORDER BY ur.role;

-- 3. (Opsional) Hapus role tertentu jika perlu
-- Uncomment baris di bawah untuk menghapus role 'employee' dari user ini
-- DELETE FROM public.user_roles 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'anjarbdn@gmail.com')
-- AND role = 'employee';
