# Absensi + Payroll - CMS Duta Solusi

Sistem HRIS lengkap dengan attendance tracking, leave management, overtime calculation, dan payroll processing terintegrasi. **100% Gratis, No Subscription Fees!**

## Fitur Utama

### Attendance System
- **Absensi Real-time**: Clock in/out dengan selfie + GPS verification
- **Multi Work Mode**: WFO, WFH, dan Dinas Luar
- **History & Analytics**: Riwayat lengkap dengan filtering & statistics
- **Attendance Corrections**: Koreksi absensi dengan approval workflow

### Leave & Overtime Management
- **Leave Balance Tracking**: Saldo cuti tahunan (12 hari/tahun) dengan auto-deduct
- **Quota Validation**: Validasi otomatis sebelum submit leave request
- **Medical Certificate**: Upload surat dokter untuk sick leave > 2 hari
- **Overtime Calculation**: Auto-calculate upah lembur sesuai UU Ketenagakerjaan
- **Legal Compliance**: Multiplier sesuai UU No. 13/2003 (weekday vs holiday)

### Payroll Module
- **Salary Management**: Kelola gaji pokok + tunjangan per karyawan
- **BPJS Calculation**: Auto-calculate BPJS Kesehatan & Ketenagakerjaan
- **PPh 21 Calculation**: Progressive tax calculation (5%-35%)
- **Payroll Processing**: Generate payroll bulanan dengan status tracking
- **Payroll Report**: Export CSV untuk payroll software integration
- **Slip Gaji**: Generate slip gaji (coming soon)

### Admin Features
- **Multi-role Support**: Employee, Manager, Admin HR dengan role switcher
- **Employee Management**: CRUD karyawan dengan salary configuration
- **Location Management**: Kelola lokasi kantor dengan interactive map picker
- **Approval Workflow**: Approve/reject leave, overtime, corrections
- **Comprehensive Reports**: Monthly summary, payroll reports, analytics

### Fitur Manager
- **Approval Workflow**: Approve/reject cuti, lembur, dan koreksi absensi
- **Laporan Tim**: Lihat rekap absensi team dengan export CSV
- **Dashboard Analytics**: Statistik kehadiran dan pending requests

### 🔐 Fitur Admin HR
- **Manajemen Karyawan**: CRUD employees, assign roles, toggle active status
- **Manajemen Lokasi**: Setup office locations dengan geofencing + **Map Picker interaktif**
- **Work Schedule**: Konfigurasi jam kerja, toleransi keterlambatan
- **Departemen**: Kelola struktur organisasi
- **Full Reports**: Export data absensi lengkap

### 🛡️ Keamanan & Anti-Fraud
- **Selfie Verification**: Wajib foto saat clock in/out
- **GPS Tracking**: Validasi lokasi dengan radius geofencing
- **Face Enrollment**: Biometric consent & reference photo storage
- **Audit Logs**: Track semua perubahan data penting
- **Role-Based Access**: Multi-role support dengan role switcher

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS + Radix UI
- **Backend**: Supabase (Auth, Database, Storage)
- **Maps**: Leaflet + React Leaflet (interactive map picker)
- **State Management**: React Context API
- **Date Handling**: date-fns
- **Icons**: Lucide React

## 📦 Setup & Installation

### Prerequisites
- Node.js 18+ dan npm
- Supabase account (gratis)

### 1. Clone Repository
```bash
git clone <repository-url>
cd absensi-ceria
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Supabase

#### A. Buat Project Supabase
1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Create new project
3. Catat **Project URL** dan **anon public key**

#### B. Setup Environment Variables
Buat file `.env.local` di root project:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

#### C. Run Database Migrations
Di Supabase SQL Editor, jalankan berurutan:
1. `supabase/migrations/20260106020904_....sql` (schema + RLS + storage)
2. `supabase/migrations/20260106020916_....sql` (fix function)

### 4. Run Development Server
```bash
npm run dev
```

Akses aplikasi di `http://localhost:5173`

## 👥 User Management

### Assign Multiple Roles
Jalankan SQL di Supabase SQL Editor:
```sql
-- File: supabase/assign-multiple-roles.sql
-- Ganti email sesuai kebutuhan
```

### Default Roles
- **employee**: Akses dasar (absensi, cuti, lembur)
- **manager**: + Approval workflow + Laporan tim
- **admin_hr**: Full access (kelola karyawan, lokasi, settings)

## 📱 Panduan Penggunaan

### Untuk Karyawan
1. **Login** dengan email & password
2. **Absensi**: Pilih work mode → Ambil selfie → Clock in/out
3. **Cuti/Izin**: Buka menu "Cuti & Izin" → Isi form → Submit
4. **Koreksi**: Jika lupa absen, buka "Koreksi Absensi" → Ajukan koreksi

### Untuk Manager/Admin HR
1. **Approval**: Buka "Persetujuan" → Pilih tab (Cuti/Lembur/Koreksi) → Approve/Reject
2. **Laporan**: Buka "Laporan" → Pilih periode → Export CSV
3. **Kelola Karyawan** (Admin HR): Buka "Karyawan" → Edit data/role/status

### Role Switcher
Jika punya multiple roles:
1. Klik **avatar** di header
2. Pilih role yang diinginkan
3. Menu otomatis berubah sesuai role aktif

## 🗂️ Struktur Database

### Tables
- `profiles`: Data karyawan
- `user_roles`: Role assignment (support multiple roles)
- `departments`: Departemen perusahaan
- `attendances`: Record absensi harian
- `leave_requests`: Pengajuan cuti/izin
- `overtime_requests`: Pengajuan lembur
- `attendance_corrections`: Koreksi absensi
- `office_locations`: Lokasi kantor dengan geofencing
- `work_schedules`: Jadwal kerja
- `audit_logs`: Audit trail

### Storage Buckets
- `attendance-photos`: Selfie clock in/out + face enrollment

## 🔒 Security Features

### Row Level Security (RLS)
- User hanya bisa akses data mereka sendiri
- Manager bisa lihat data team yang di-assign
- Admin HR full access

### Authentication
- Email/password via Supabase Auth
- Session management dengan auto-refresh token

## 🚀 Build & Deploy

### Build Production
```bash
npm run build
```

### Preview Build
```bash
npm run preview
```

### Deploy
Deploy ke platform pilihan (Vercel, Netlify, dll):
1. Connect repository
2. Set environment variables
3. Deploy

## 📝 Development

### Lint
```bash
npm run lint
```

### Fix Vulnerabilities
```bash
npm audit fix
```

## 📄 License

Proprietary - CMS Duta Solusi

## 🤝 Support

Untuk bantuan teknis, hubungi tim IT CMS Duta Solusi.

---

**Version**: 1.0.0  
**Last Updated**: Januari 2026
