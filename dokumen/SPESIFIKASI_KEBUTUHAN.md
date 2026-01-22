# Spesifikasi Kebutuhan Perangkat Lunak (SRS)
## **Duta Mruput Enterprise** - Sistem Informasi Sumber Daya Manusia Terintegrasi
**Versi Dokumen:** 2.1.0 (Rilis Enterprise)  
**Terakhir Diperbarui:** 21 Januari 2026  
**Kerahasiaan:** Internal & Mitra Saja  

---

## 1. Pendahuluan
**Duta Mruput Enterprise** adalah Sistem Informasi Sumber Daya Manusia (HRIS) mutakhir yang mengutamakan penggunaan seluler (mobile-first), dirancang untuk mempermudah manajemen tenaga kerja, pelacakan absensi, dan pemrosesan penggajian. Dibangun dengan pendekatan "Keamanan Utama" dan "Berpusat pada Pengguna", platform ini menjembatani kesenjangan antara aplikasi seluler asli (APK) yang aman dan teknologi web yang mudah diakses (PWA), memastikan operasi yang lancar di berbagai ekosistem perangkat (Android, iOS, Desktop).

### 1.1 Tujuan Bisnis
*   **Menghilangkan Kecurangan Waktu**: Mencegah "titip absen" dan pemalsuan lokasi melalui verifikasi berlapis (Biometrik + GPS + Penguncian Perangkat).
*   **Otomatisasi Penggajian**: Mengurangi kesalahan perhitungan manual dengan mengintegrasikan data kehadiran langsung dengan rumus gaji.
*   **Desentralisasi Manajemen**: Memberdayakan Manajer Unit dengan otoritas persetujuan untuk mengurangi hambatan administrasi HR.
*   **Meningkatkan Keterlibatan Karyawan**: Memberikan akses transparan ke slip gaji, riwayat, dan aset media perusahaan.

---

## 2. Tumpukan Teknologi & Arsitektur

### 2.1 Ekosistem Frontend & Mobile
*   **Kerangka Kerja Inti**: React 18 dengan TypeScript (Vite Bundler).
*   **Mesin UI/UX**: Tailwind CSS, Shadcn/UI, Lucide React (Estetika Modern, Glassmorphism).
*   **Mesin Hibrida**: Capacitor JS (Menjembatani Web ke Perangkat Keras Asli Android).
*   **Standar PWA**: Vite Plugin PWA (Dukungan Offline, Service Workers, Caching Aset).
*   **Biometrik**:
    *   **Native (APK)**: Capacitor Native Biometric (Sidik Jari/FaceID via Perangkat Keras OS).
    *   **PWA/Web**: MediaPipe Face Mesh AI (Client-side TensorFlow.js) untuk verifikasi berbasis kamera.

### 2.2 Backend & Infrastruktur (Serverless)
*   **Basis Data**: PostgreSQL (via Supabase) dengan konsistensi kuat.
*   **Lapisan Keamanan**: Kebijakan Row Level Security (RLS) yang menegakkan isolasi data di tingkat mesin basis data.
*   **Otentikasi**: Supabase Auth (JWT) + Tantangan Biometrik Kustom.
*   **Penyimpanan**: Supabase Storage Buckets (Gambar: Absensi, Profil, Reimbursement, Media).
*   **Fungsi Edge**: Logika sisi server untuk notifikasi push dan perhitungan gaji yang kompleks.
*   **Notifikasi Push**: Terintegrasi dengan OneSignal / FCM.

---

## 3. Spesifikasi Fitur Komprehensif

### 3.1 Modul Otentikasi & Keamanan
*   **Login Biometrik Hibrida**:
    *   **Android (APK)**: Menggunakan sensor sidik jari perangkat keras untuk login < 1 detik.
    *   **iOS/Web (PWA)**: Menggunakan pengenalan wajah bertenaga AI melalui kamera dengan pemeriksaan keaktifan (liveness checks).
*   **Penguncian Perangkat (UUID)**: Mengikat akun pengguna ke perangkat fisik tertentu. Mencegah login dari perangkat yang tidak sah.
*   **Manajemen Sesi**: Sesi persisten yang aman dengan mekanisme penyegaran otomatis.

### 3.2 Sistem Absensi Lanjutan
*   **Geo-Fencing 2.0**:
    *   Memvalidasi koordinat karyawan terhadap garis lintang/bujur Data Master Kantor.
    *   Radius yang dapat dikonfigurasi (default 50m) dengan penolakan ketat di luar zona.
*   **Anti-Fake GPS**:
    *   Mendeteksi penyedia lokasi palsu (mock interactions) di Android.
    *   Memvalidasi metrik akurasi GPS (akurasi >20m ditolak).
*   **Validasi Cerdas**:
    *   **Masuk (Clock-In)**: Mencegah check-in sebelum "Jendela Awal" yang diizinkan (misal, 30 menit sebelum shift).
    *   **Logika Keterlambatan**: Secara otomatis menghitung menit keterlambatan berdasarkan Toleransi Shift.
    *   **blokir Hari Libur**: Terintegrasi dengan kalender Jadwal/Libur untuk mencegah absensi yang tidak disengaja pada hari libur.
*   **Mode Kerja**:
    *   **(WFO) Kerja Dari Kantor**: Geo-Fencing ketat aktif.
    *   **(WFH) Kerja Dari Rumah**: Geo-Fencing longgar, Biometrik ketat.
    *   **(Dinas) Lapangan**: Perekaman GPS saja, Biometrik ketat.

### 3.3 Manajemen Karyawan & Organisasi
*   **Data Master**: Manajemen Departemen, Posisi Pekerjaan, dan Tingkatan (Level/Grade).
*   **Profil Karyawan**: Penyimpanan data komprehensif (NIK, Tanggal Bergabung, Kontak, Info Darurat, Detail Bank).
*   **Visualisasi Hirarki**: Bagan Organisasi yang dibuat secara otomatis berdasarkan ID Departemen.
*   **Manajemen Shift**:
    *   Shift Statis (Jam Tetap).
    *   Penjadwalan Dinamis (Rostering).
    *   Dukungan untuk "Lintas Hari" (Shift malam).

### 3.4 Alur Kerja Permohonan & Persetujuan
*   **Jenis**: Cuti Tahunan, Sakit, Lembur, Koreksi Absen, Reimbursement.
*   **Alur Kerja**:
    *   Karyawan mengajukan permohonan dengan lampiran (PDF/IMG).
    *   Manajer menerima Notifikasi Push Real-time.
    *   Manajer Menyetujui/Menolak melalui Dashboard.
    *   HR (Admin) memiliki kemampuan override (mengambil alih).
*   **Manajemen Kuota**: Pengurangan kuota Cuti Tahunan secara otomatis.

### 3.5 Sistem Penggajian (Payroll)
*   **Mesin Perhitungan Otomatis**:
    *   Input: Hari Kehadiran, Jam Lembur, Potongan Keterlambatan (Dapat Dikonfigurasi), Tunjangan Tetap, Tunjangan Variabel (Uang Makan/Transport).
    *   Output: Gaji Bersih (Take Home Pay).
*   **Slip Gaji**: Pembuatan slip gaji digital terenkripsi yang dapat diakses secara pribadi oleh karyawan.
*   **Ekspor**: Dukungan untuk ekspor rekap gaji untuk Departemen Keuangan.

### 3.6 Media & Keterlibatan
*   **Galeri Duta Mruput**:
    *   Album foto/video kesetiaan tinggi untuk acara perusahaan.
    *   Pengunggahan berbasis peran (Manajer/HR).
    *   Kemampuan unduh untuk karyawan.

---

## 4. Peran Pengguna & Kontrol Akses (RBAC)

| Fitur / Kemampuan | **Karyawan (Employee)** | **Manajer / Kepala Unit** | **Admin HR / Super** |
| :--- | :---: | :---: | :---: |
| **Absensi** | Diri Sendiri Saja | Diri Sendiri + Lihat Tim | Semua Karyawan |
| **Persetujuan** | Hanya Mengajukan | Menyetujui Tim | Mengambil Alih Semua |
| **Visibilitas Data** | Diri Sendiri Saja | Diri Sendiri + Tim Departemen | Akses Penuh |
| **Data Master** | Hanya Baca (Read Only) | Hanya Baca (Read Only) | Kendali Penuh (CRUD) |
| **Akses Gaji** | Slip Sendiri | Slip Sendiri | Kelola & Generate |
| **Pengaturan** | Dasar | Manajemen Unit | Konfigurasi Sistem |

---

## 5. Persyaratan Non-Fungsional (NFR)

### 5.1 Performa
*   **Waktu Respon**: Waktu muat dashboard < 1,5 detik pada jaringan 4G.
*   **Verifikasi Wajah**: Waktu pemrosesan AI < 3 detik pada perangkat menengah.
*   **Ukuran Aset**: Ukuran bundle awal dioptimalkan (< 3MB) dengan lazy loading.

### 5.2 Keandalan & Ketersediaan
*   **Mode Offline (PWA)**: Aset inti disimpan dalam cache melalui Service Worker. UI berfungsi dalam mode "Baca Saja" saat offline.
*   **Integritas Data**: Menggunakan batasan relasional yang ketat (Foreign Keys) untuk mencegah data yatim piatu (orphan data).

### 5.3 Kompatibilitas
*   **Android**: Dukungan APK asli untuk Android 10+.
*   **iOS**: Dukungan PWA untuk Safari (iOS 15+).
*   **Desktop**: Dukungan tata letak responsif penuh untuk Chrome/Edge/Safari.

---

## 6. Status Implementasi (Build Saat Ini)

*   [x] **Kerangka Kerja Inti & Pustaka UI** (Selesai)
*   [x] **Migrasi Skema Basis Data** (Enterprise V2 Selesai)
*   [x] **Sistem Otentikasi (Biometrik Hibrida)** (Selesai - Wajah & Sidik Jari Aktif)
*   [x] **Logika Absensi (Geo + FakeGPS)** (Selesai & Diperketat)
*   [x] **Manajemen Data Master** (Selesai)
*   [x] **Mesin Penggajian** (Beta - Fungsional)
*   [x] **PWA / Service Workers** (Terinstal & Dikonfigurasi)
*   [ ] **Dashboard Analitik Lanjutan** (Sedang Berjalan)
*   [ ] **Obrolan / Pesan Internal** (Direncanakan)

---

**Disertifikasi untuk Penerapan (Deployment)**  
*Tim Pengembang Duta Mruput Enterprise*
