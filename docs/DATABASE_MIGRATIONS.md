# Database Migrations - HRIS Core Features

## Ringkasan Migration yang Diperlukan

Untuk mengaktifkan semua fitur HRIS Core yang baru diimplementasikan, Anda perlu menjalankan **3 migration files** berikut secara berurutan:

---

## 1️⃣ Migration: Add HRIS Core Columns
**File:** `20260111214927_add_hris_core_columns.sql`

### Perubahan:
- ✅ Tambah `home_latitude` & `home_longitude` di tabel `profiles` (untuk WFH geofencing)
- ✅ Tambah `annual_leave_quota` di tabel `profiles` (default: 12 hari/tahun)
- ✅ Tambah `break_start` & `break_end` di tabel `shifts` (untuk split shift)
- ✅ Tambah `total_days` di tabel `leave_requests` (untuk perhitungan hari kerja)
- ✅ Index untuk performa query

### Dampak:
- **Poin 1 (Leave)**: Sistem bisa validasi kuota cuti
- **Poin 2 (WFH)**: Sistem bisa validasi lokasi rumah
- **Poin 4 (Shift)**: Sistem bisa handle split shift dengan jam istirahat

---

## 2️⃣ Migration: Create Public Holidays Table
**File:** `20260111214551_create_public_holidays.sql`

### Perubahan:
- ✅ Buat tabel `public_holidays` baru
- ✅ RLS policies (Read: all users, Write: admin_hr only)
- ✅ Insert data awal: Hari libur nasional Indonesia 2026
- ✅ Index untuk query tanggal

### Dampak:
- **Poin 1 (Leave)**: Perhitungan cuti exclude hari libur nasional
- **Bonus Feature**: Admin HR bisa kelola kalender libur

---

## 3️⃣ Migration: Update Employee Schedules (Multi-Shift)
**File:** `20260111215002_update_employee_schedules_multi_shift.sql`

### Perubahan:
- ✅ Hapus unique constraint `(user_id, date)` di tabel `employee_schedules`
- ✅ Tambah composite index untuk performa
- ✅ Memungkinkan multiple shift records per karyawan per hari

### Dampak:
- **Poin 4 (Shift)**: Karyawan bisa punya multiple shift dalam 1 hari (split shift)

---

## 🚀 Cara Menjalankan Migration

### Opsi 1: Menggunakan Supabase CLI (Recommended)
```bash
# Pastikan sudah login ke Supabase
supabase login

# Link project (jika belum)
supabase link --project-ref your-project-ref

# Push semua migration ke database
supabase db push
```

### Opsi 2: Manual via Supabase Dashboard
1. Buka Supabase Dashboard → SQL Editor
2. Copy-paste isi file migration satu per satu
3. Jalankan secara berurutan:
   - `20260111214927_add_hris_core_columns.sql`
   - `20260111214551_create_public_holidays.sql`
   - `20260111215002_update_employee_schedules_multi_shift.sql`

---

## ✅ Verifikasi Migration Berhasil

Setelah migration, cek apakah kolom-kolom berikut sudah ada:

### Tabel `profiles`:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('home_latitude', 'home_longitude', 'annual_leave_quota');
```

### Tabel `shifts`:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shifts' 
AND column_name IN ('break_start', 'break_end');
```

### Tabel `public_holidays`:
```sql
SELECT COUNT(*) FROM public_holidays;
-- Harusnya return 15 (hari libur nasional 2026)
```

### Tabel `leave_requests`:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leave_requests' 
AND column_name = 'total_days';
```

---

## 📝 Data Setup Setelah Migration

### 1. Set Annual Leave Quota untuk Karyawan Existing
```sql
-- Set semua karyawan aktif dengan quota 12 hari (default)
UPDATE profiles 
SET annual_leave_quota = 12 
WHERE is_active = true AND annual_leave_quota IS NULL;

-- Atau custom per karyawan
UPDATE profiles 
SET annual_leave_quota = 15 
WHERE id = 'user_id_here'; -- Karyawan senior dapat 15 hari
```

### 2. Set Home Coordinates untuk WFH Geofencing
```sql
-- Contoh: Set koordinat rumah karyawan
UPDATE profiles 
SET 
  home_latitude = -6.200000,  -- Latitude rumah
  home_longitude = 106.816666 -- Longitude rumah
WHERE id = 'user_id_here';

-- Atau bulk update untuk karyawan yang sudah submit koordinat via form
```

### 3. Tambah Hari Libur Custom (Opsional)
```sql
-- Contoh: Tambah cuti bersama perusahaan
INSERT INTO public_holidays (date, name, description, is_recurring) 
VALUES 
  ('2026-12-24', 'Cuti Bersama Natal', 'Kebijakan perusahaan', false),
  ('2026-12-26', 'Cuti Bersama', 'Kebijakan perusahaan', false);
```

---

## ⚠️ Catatan Penting

1. **Backup Database**: Selalu backup database sebelum menjalankan migration
2. **Test di Development**: Test migration di environment development dulu
3. **Urutan Migration**: Jalankan migration sesuai urutan timestamp
4. **RLS Policies**: Pastikan RLS policies tidak konflik dengan existing policies

---

## 🔧 Troubleshooting

### Error: "column already exists"
- Aman diabaikan, migration sudah menggunakan `IF NOT EXISTS`

### Error: "constraint does not exist"
- Aman diabaikan, migration sudah menggunakan `IF EXISTS`

### Error: RLS policy conflict
- Cek existing policies dengan:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'public_holidays';
  ```
- Drop policy yang konflik jika perlu

---

## 📊 Summary

| Migration File | Tabel yang Diubah | Fitur yang Diaktifkan |
|----------------|-------------------|----------------------|
| `20260111214927_add_hris_core_columns.sql` | `profiles`, `shifts`, `leave_requests` | Leave quota, WFH geofencing, Split shift |
| `20260111214551_create_public_holidays.sql` | `public_holidays` (new) | Holiday management, Accurate leave calculation |
| `20260111215002_update_employee_schedules_multi_shift.sql` | `employee_schedules` | Multiple shifts per day |

**Total Kolom Baru:** 7 kolom
**Total Tabel Baru:** 1 tabel (`public_holidays`)
**Total Index Baru:** 6 indexes

---

Setelah migration selesai, semua fitur HRIS Core akan langsung aktif dan siap digunakan! 🎉
