-- ALGORITMA PERBAIKAN BUCKET STORAGE
-- Jalankan script ini di SQL Editor Dashboard Supabase Anda

-- 1. Buat bucket 'face-enrollments' (Wajib untuk Registrasi Wajah)
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-enrollments', 'face-enrollments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Buat bucket 'attendance-photos' (Wajib untuk Absensi)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Buat bucket 'avatars' (Untuk Profil)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Policy agar bucket bisa diakses publik (Membaca foto)
CREATE POLICY "Public Access Face Enrollments"
ON storage.objects FOR SELECT
USING ( bucket_id = 'face-enrollments' );

CREATE POLICY "Public Access Attendance Photos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'attendance-photos' );

CREATE POLICY "Public Access Avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 5. Policy agar User yang login bisa Upload foto
CREATE POLICY "Auth Users Upload Face Enrollments"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'face-enrollments' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Users Upload Attendance"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'attendance-photos' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Users Upload Avatars"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
