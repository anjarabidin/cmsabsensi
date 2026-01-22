-- DIAGNOSTIC QUERY
-- Jalankan ini di SQL Editor untuk melihat apakah JOIN profiles berfungsi
-- Dan apakah RLS mengizinkan manager melihat data.

-- 1. Cek Data Request Raw (Tanpa Filter)
SELECT count(*) as total_requests FROM leave_requests;

-- 2. Cek Apakah ada FK ke Profiles (Cek metadata)
SELECT 
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='leave_requests';

-- 3. Cek Simulasi Query Frontend (JOIN)
-- Ganti 'UUID_MANAGER_ANDA' dengan ID akun manager yang sedang login (Helmi Afandi)
-- Kita gunakan auth.uid() simulasi dengan SET LOCAL ROLE
-- TAPI karena itu ribet, kita test query biasa saja dulu tanpa RLS.

SELECT 
    lr.id, 
    lr.user_id, 
    p.full_name as profile_name,
    p.department_id
FROM leave_requests lr
LEFT JOIN profiles p ON lr.user_id = p.id
LIMIT 5;

-- Jika query no 3 menghasilkan profile_name yang NULL, berarti JOIN gagal atau ID tidak match.
-- Jika query no 3 berhasil, berarti masalahnya murni di RLS (Permission).
