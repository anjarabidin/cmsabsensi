# Fitur Manajemen Hari Libur

## Deskripsi
Modul manajemen hari libur memungkinkan Admin HR untuk mengelola kalender hari libur perusahaan dan nasional secara terpusat. Hari libur yang didaftarkan akan secara otomatis dikecualikan dari perhitungan hari kerja dalam sistem pengajuan cuti.

## Fitur Utama

### 1. Tambah Hari Libur
- Admin HR dapat menambahkan hari libur baru dengan informasi:
  - **Tanggal**: Tanggal libur
  - **Nama**: Nama hari libur (contoh: "Hari Kemerdekaan RI")
  - **Keterangan**: Deskripsi tambahan (opsional)
  - **Libur Tahunan**: Checkbox untuk menandai libur yang berulang setiap tahun (contoh: Tahun Baru, Hari Kemerdekaan)

### 2. Daftar Hari Libur
- Menampilkan semua hari libur yang terdaftar dalam bentuk tabel
- Informasi yang ditampilkan:
  - Tanggal dengan visualisasi kalender
  - Nama hari libur
  - Keterangan
  - Tipe (Tahunan/Sekali)
- Aksi: Hapus hari libur

### 3. Integrasi dengan Perhitungan Cuti
- Sistem pengajuan cuti (`/leave`) secara otomatis:
  - Mengambil data hari libur dari database
  - Mengecualikan hari libur dari perhitungan `total_days`
  - Hanya menghitung hari kerja efektif (Senin-Jumat, kecuali hari libur)

## Akses
- **Route**: `/holidays`
- **Role**: `admin_hr` only
- **Menu**: Dashboard → Menu Admin → "Libur" (icon kalender merah)

## Database Schema

### Tabel: `public_holidays`
```sql
- id: UUID (Primary Key)
- date: DATE (Unique)
- name: VARCHAR(255)
- description: TEXT (nullable)
- is_recurring: BOOLEAN (default: false)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Row Level Security (RLS)
- **Read**: Semua authenticated users dapat membaca data hari libur
- **Write**: Hanya `admin_hr` yang dapat menambah/mengubah/menghapus

## Data Awal
Migration sudah menyertakan hari libur nasional Indonesia tahun 2026, termasuk:
- Tahun Baru Masehi
- Hari Raya Idul Fitri
- Hari Kemerdekaan RI
- Hari Raya Natal
- Dan hari libur nasional lainnya

## Cara Penggunaan

### Untuk Admin HR:
1. Login sebagai Admin HR
2. Buka Dashboard
3. Klik menu "Libur" di bagian Menu Admin
4. Klik tombol "Tambah Hari Libur"
5. Isi form dan simpan

### Untuk Karyawan:
- Tidak ada aksi khusus diperlukan
- Saat mengajukan cuti, sistem otomatis menghitung hari kerja dengan mengecualikan:
  - Sabtu & Minggu
  - Hari libur yang terdaftar di sistem

## Contoh Perhitungan
Jika karyawan mengajukan cuti dari **Kamis 14 Agustus 2026** sampai **Selasa 19 Agustus 2026**:

- Kamis 14 Agustus: Hari kerja ✓
- Jumat 15 Agustus: Hari kerja ✓
- Sabtu 16 Agustus: Weekend ✗
- **Minggu 17 Agustus: Hari Kemerdekaan RI (Libur Nasional)** ✗
- Senin 18 Agustus: Hari kerja ✓
- Selasa 19 Agustus: Hari kerja ✓

**Total hari kerja yang dipotong dari kuota**: **4 hari** (bukan 6 hari)

## File Terkait
- **UI Component**: `src/pages/Holidays.tsx`
- **Route**: `src/App.tsx`
- **Integration**: `src/pages/Leave.tsx` (fungsi `calculateWorkingDays`)
- **Migration**: `supabase/migrations/20260111214551_create_public_holidays.sql`
- **Dashboard Menu**: `src/pages/Dashboard.tsx`

## Catatan Penting
⚠️ **Untuk Admin HR**: Pastikan untuk selalu memperbarui kalender hari libur setiap awal tahun agar perhitungan cuti tetap akurat.

✅ **Best Practice**: Gunakan flag "Libur Tahunan" untuk hari libur yang berulang setiap tahun (seperti Tahun Baru, Hari Kemerdekaan) agar lebih mudah dikelola.
