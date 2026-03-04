# 📘 BUKU PANDUAN LENGKAP: SISTEM ABSENSI CMS & MANAJEMEN SDM

Dokumen ini berisi panduan langkah-demi-langkah bagi **Karyawan** dan **Administrator** untuk menggunakan seluruh fitur aplikasi dengan benar.

---

## 📱 BAGIAN 0: PANDUAN INSTALASI (PWA)

Aplikasi ini menggunakan teknologi **PWA (Progressive Web App)**, sehingga Anda tidak perlu mendownload dari Play Store atau App Store. Cukup "Instal" langsung dari link browser Anda.

### 🍎 Untuk Pengguna iPhone (iOS)
1.  Buka **Safari**.
2.  Masukkan alamat URL aplikasi Anda.
3.  Klik tombol **Share** (ikon kotak dengan panah ke atas) di menu bawah Safari.
4.  Gulir ke bawah dan klik **"Add to Home Screen"** atau **"Tambah ke Layar Utama"**.
5.  Klik **Add** (Tambah). Ikon aplikasi kini ada di layar utama iPhone Anda.

### 🤖 Untuk Pengguna Android (Chrome)
1.  Buka **Google Chrome**.
2.  Masukkan alamat URL aplikasi Anda.
3.  Klik **tiga titik vertikal (⋮)** di pojok kanan atas.
4.  Pilih **"Install App"** atau **"Pasang Aplikasi"**.
5.  Konfirmasi instalasi. Ikon aplikasi kini ada di layar utama & menu HP Anda.

---

## 🟢 BAGIAN 1: PANDUAN KARYAWAN (USER)

### 1. Pendaftaran Akun (Registrasi)
Langkah pertama bagi karyawan baru untuk masuk ke sistem:
1.  **Buka Aplikasi**: Akses alamat URL aplikasi melalui browser HP atau ikon yang sudah diinstal.
2.  **Menu Daftar**: Klik tombol **"Daftar Sekarang"** di halaman login.
3.  **Isi Data**: Masukkan Nama Lengkap, Email Aktif, Nomor WhatsApp, dan NIK (Sesuai KTP).
4.  **Password**: Buat kata sandi yang kuat dan mudah diingat.
5.  **Kirim**: Klik tombol "Daftar".
6.  **PENTING**: Setelah pendaftaran berhasil, Anda **TIDAK BISA** langsung login. Akun Anda akan berstatus `Pending Verification`. Silakan hubungi Admin HR untuk meminta persetujuan akun.

### 2. Aktivasi Pertama Kali (Onboarding)
Setelah Admin menyetujui akun Anda, ikuti langkah ini:
1.  **Login**: Masuk menggunakan Email dan Password yang didaftarkan.
2.  **Lengkapi Onboarding**: Anda akan melihat halaman selamat datang. Sistem akan meminta Anda melengkapi data seperti:
    - Foto Profil (Wajah harus terlihat jelas).
    - Alamat Lengkap.
    - Tanggal Larir, dll.
3.  **Masuk Dashboard**: Setelah data lengkap, Anda akan diarahkan ke Dashboard utama.

### 3. Melakukan Absensi Harian (Clock IN & OUT)
Fitur utama untuk mencatat kehadiran:
1.  **Izin Lokasi**: Pastikan GPS HP aktif dan berikan izin lokasi saat diminta oleh browser/aplikasi.
2.  **Clock IN (Masuk)**:
    - Buka Dashboard. Klik tombol **"CLOCK IN"**.
    - Jika Admin mewajibkan selfie, kamera akan terbuka. Ambil foto wajah Anda.
    - Sistem akan memverifikasi lokasi Anda. Jika diluar radius/zona, absensi akan ditolak.
3.  **Clock OUT (Pulang)**:
    - Klik tombol **"CLOCK OUT"** saat jam kerja berakhir.
    - Pastikan status absensi sudah berubah menjadi "Selesai".

### 4. Mengajukan Cuti & Izin
Jika ingin libur atau sakit:
1.  Buka menu **"LEAVE"** atau **"CUTI"**.
2.  Klik tombol **(+)** atau "Ajukan Baru".
3.  Pilih **Tipe**: (Cuti Tahunan, Sakit, Melahirkan, Izin Penting).
4.  **Tanggal**: Tentukan tanggal mulai dan selesai.
5.  **Lampiran**: Jika sakit, Anda **WAJIB** mengunggah foto Surat Dokter sebagai bukti.
6.  **Submit**: Tunggu hingga Manajer atau Admin memberikan persetujuan melalui notifikasi.

### 5. Koreksi Absensi (Lupa Absen)
Jika Anda lupa melakukan Clock In/Out:
1.  Buka menu **"HISTORY"**.
2.  Klik tombol **"KOREKSI"**.
3.  Pilih tanggal yang terlewat.
4.  Masukkan jam masuk/pulang yang benar dan berikan penjelasan mengapa Anda lupa.
5.  Admin akan meninjau alasan Anda sebelum menyetujuinya.

---

## 🔵 BAGIAN 2: PANDUAN ADMINISTRATOR (ADMIN)

### 1. Menyetujui Akun Baru (Account Approval)
Sebagai filter keamanan agar tidak sembarang orang bisa masuk ke sistem:
1.  Masuk ke menu **"APPROVALS"**.
2.  Klik tab **"Pending Accounts"**.
3.  Anda akan melihat daftar karyawan yang baru mendaftar.
4.  Klik tombol **"SETUJUI"**. Akan muncul popup untuk mengisi data resmi:
    - **ID Karyawan (NIP)**: Masukkan kode pegawai resmi perusahaan.
    - **Role**: Tentukan levelnya (Employee, manager, Admin, atau Driver).
    - **Unit/Departemen**: Pilih departemen tempat karyawan bekerja.
    - **Jabatan**: Pilih posisi jabatan resmi.
5.  Setelah diklik "Simpan", akun karyawan tersebut aktif dan mereka baru bisa login.

### 2. Mengelola Hak Akses (Role Management)
Mengatur siapa boleh melihat menu apa:
1.  Buka menu **"ROLE MANAGEMENT"**.
2.  Pilih Role (misal: `manager`).
3.  Aktifkan atau matikan saklar (switch) untuk navigasi tertentu.
4.  Contoh: Anda bisa mematikan menu "Payroll" untuk level `employee` agar mereka tidak bisa melihat laporan gaji pusat.

### 3. Pengaturan Global (Settings)
Pusat kontrol seluruh aplikasi:
1.  Buka menu **"SETTINGS"**.
2.  **Section Keamanan**: Aktifkan "Persetujuan Akun Wajib" jika ingin pendaftaran manual disaring admin.
3.  **Section Absensi**: Atur radius GPS (misal: 100 meter dari kantor) dan nyalakan "Wajib Selfie" untuk bukti fisik.
4.  **Section Storage**: Atur masa simpan foto. Foto lama akan dihapus otomatis setiap jam 3 subuh untuk menghemat tempat penyimpanan database.

---

## 🛠️ BAGIAN 3: PEMELIHARAAN TEKNIS (MAINTENANCE)

### 1. Menjaga Database Tetap Aktif (Supabase Keep-Alive)
Sistem ini menggunakan Supabase layanan gratis yang akan "istirahat" (*pause*) jika tidak ada aktivitas selama 7 hari.
- Kami sudah memasang **Robot Otomatis (GitHub Action)** yang akan mengirim sinyal ke database setiap 3 hari sekali.
- Robot ini menjaga agar database tidak pernah mati meskipun seluruh karyawan sedang libur/cuti panjang.

### 2. Verifikasi Wajah AI
Fitur ini sedang dalam pengembangan. Untuk saat ini, disarankan menggunakan **"Wajib Selfie"** saja karena lebih stabil di semua jenis HP lama maupun baru.

### 3. Pemindahan Akun ke Perusahaan (Handover)
Jika developer ingin menyerahkan sistem sepenuhnya ke perusahaan:
1.  **Supabase**: Undang email Admin perusahaan sebagai "Owner" di Dashboard Supabase.
2.  **GitHub**: Gunakan fitur "Transfer Repository" di menu Settings GitHub ke akun/organisasi perusahaan.
3.  **Secrets**: Perusahaan wajib memasukkan ulang URL dan Key Supabase di menu "Secrets" GitHub agar robot Keep-Alive tetap berjalan.

---
*Dokumen ini dibuat untuk menjamin kelancaran operasional harian perusahaan.*
