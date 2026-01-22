# Absensi + Payroll - CMS Duta Solusi

Sistem HRIS lengkap dengan pelacakan kehadiran, manajemen cuti, perhitungan lembur, dan pemrosesan penggajian yang terintegrasi. **Gratis, Tanpa Biaya Berlangganan!**

## Fitur Utama

### Sistem Kehadiran (Attendance System)
- **Absensi Real-time**: Masuk/Keluar (Clock in/out) dengan swafoto + verifikasi GPS.
- **Mode Kerja Fleksibel**: Mendukung WFO (Kantor), WFH (Rumah), dan Dinas Luar.
- **Riwayat & Analitik**: Riwayat lengkap dengan penyaringan & statistik.
- **Koreksi Absensi**: Pengajuan koreksi absensi dengan alur persetujuan.

### Manajemen Cuti & Lembur
- **Pelacakan Saldo Cuti**: Saldo cuti tahunan (12 hari/tahun) dengan pengurangan otomatis.
- **Validasi Kuota**: Validasi otomatis sebelum pengajuan cuti.
- **Surat Dokter**: Unggah surat dokter untuk cuti sakit lebih dari 2 hari.
- **Perhitungan Lembur**: Perhitungan otomatis upah lembur sesuai UU Ketenagakerjaan.
- **Kepatuhan Hukum**: Pengali upah lembur sesuai peraturan (hari kerja vs hari libur).

### Modul Penggajian (Payroll)
- **Manajemen Gaji**: Kelola gaji pokok + tunjangan per karyawan.
- **Perhitungan BPJS**: Hitung otomatis BPJS Kesehatan & Ketenagakerjaan.
- **Perhitungan PPh 21**: Perhitungan pajak progresif.
- **Pemrosesan Penggajian**: Buat penggajian bulanan dengan pelacakan status.
- **Laporan Penggajian**: Ekspor CSV untuk integrasi perangkat lunak akuntansi.
- **Slip Gaji**: Pembuatan slip gaji otomatis.

### Fitur Admin
- **Dukungan Multi-peran**: Karyawan, Manajer, Admin HR dengan penukar peran.
- **Manajemen Karyawan**: Tambah/Ubah/Hapus data karyawan dan konfigurasi gaji.
- **Manajemen Lokasi**: Kelola lokasi kantor dengan pemilih peta interaktif.
- **Alur Persetujuan**: Setujui/Tolak cuti, lembur, dan koreksi.
- **Laporan Komprehensif**: Ringkasan bulanan, laporan penggajian, analitik.

### Fitur Manajer
- **Alur Persetujuan**: Setujui/Tolak permintaan tim.
- **Laporan Tim**: Lihat rekap absensi tim dengan ekspor CSV.
- **Dasbor Analitik**: Statistik kehadiran dan permintaan tertunda.

### Fitur Keamanan
- **Verifikasi Swafoto**: Wajib foto saat clock in/out..
- **Pelacakan GPS**: Validasi lokasi dengan radius geofencing.
- **Pendaftaran Wajah**: Penyimpanan foto referensi biometrik.
- **Log Audit**: Melacak semua perubahan data penting.
- **Akses Berbasis Peran**: Hak akses spesifik berdasarkan peran pengguna.

## Spesifikasi Teknis (Tech Stack)

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS + Radix UI
- **Backend**: Supabase (Auth, Database, Storage)
- **Peta**: Leaflet + React Leaflet
- **Manajemen State**: React Context API
- **Pengolahan Tanggal**: date-fns
- **Ikon**: Lucide React

## Panduan Instalasi & Pengaturan

### Prasyarat
- Node.js 18+ dan npm
- Akun Supabase (Gratis)

### 1. Clone Repository
```bash
git clone <repository-url>
cd absensi-ceria
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Pengaturan Supabase

#### A. Buat Proyek Supabase
1. Buka [Dashboard Supabase](https://supabase.com/dashboard)
2. Buat proyek baru
3. Catat **Project URL** dan **anon public key**

#### B. Pengaturan Variabel Lingkungan
Buat file `.env.local` di root proyek:
```env
VITE_SUPABASE_URL=https://proyek-anda.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=kunci-anon-anda
```

#### C. Jalankan Migrasi Database
Di SQL Editor Supabase, jalankan file migrasi yang terdapat di folder `supabase/migrations/` secara berurutan sesuai nomor urut file.

### 4. Jalankan Server Development
```bash
npm run dev
```

Akses aplikasi di `http://localhost:5173`

## Manajemen Pengguna

### Peran Bawaan (Default Roles)
- **employee**: Akses dasar (absensi, cuti, lembur).
- **manager**: Tambahan akses persetujuan dan laporan tim.
- **admin_hr**: Akses penuh (kelola karyawan, lokasi, pengaturan).

## Panduan Penggunaan Singkat

### Untuk Karyawan
1. **Login** dengan email & kata sandi.
2. **Absensi**: Pilih mode kerja → Ambil swafoto → Masuk/Keluar.
3. **Cuti/Izin**: Buka menu "Cuti & Izin" → Isi formulir → Kirim.
4. **Koreksi**: Jika lupa absen, buka "Koreksi Absensi" → Ajukan koreksi.

### Untuk Manajer/Admin HR
1. **Persetujuan**: Buka "Persetujuan" → Pilih tab (Cuti/Lembur/Koreksi) → Setujui/Tolak.
2. **Laporan**: Buka "Laporan" → Pilih periode → Ekspor CSV.
3. **Kelola Karyawan** (Admin HR): Buka "Karyawan" → Edit data/peran/status.

## Struktur Database

### Tabel Utama
- `profiles`: Data karyawan.
- `user_roles`: Penugasan peran.
- `departments`: Departemen perusahaan.
- `attendances`: Catatan absensi harian.
- `leave_requests`: Pengajuan cuti/izin.
- `overtime_requests`: Pengajuan lembur.
- `attendance_corrections`: Koreksi absensi.
- `office_locations`: Lokasi kantor dengan geofencing.
- `work_schedules`: Jadwal kerja.
- `audit_logs`: Jejak audit sistem.

### Penyimpanan (Storage Buckets)
- `attendance-photos`: Swafoto masuk/keluar & pendaftaran wajah.

## Pembangunan & Deployment

### Build Produksi
```bash
npm run build
```

### Pratinjau Build
```bash
npm run preview
```

## Lisensi

Proprietary - CMS Duta Solusi
