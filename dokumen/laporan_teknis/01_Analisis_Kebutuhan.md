# Analisis dan Spesifikasi Sistem Absensi Modern (Standar Indonesia)

Dokumen ini disusun sebagai acuan pengembangan sistem absensi yang **Enterprise-Grade** dan **Patuh Hukum**, serta efektif sesuai budaya kerja di Indonesia.

## 1. Analisis Kebutuhan Perusahaan Modern

Perusahaan modern di Indonesia menghadapi tantangan dalam menyeimbangkan kepercayaan ("Trust") dan pengawasan ("Control").
*   **Tantangan**: Karyawan bekerja dari mana saja (Hybrid), namun manajemen membutuhkan data akurat untuk penggajian dan evaluasi kinerja.
*   **Masalah Umum**: "Titip Absen", manipulasi lokasi (Fake GPS), manipulasi jam lembur, dan kesulitan pelacakan tim lapangan.
*   **Solusi Sistem**: Sistem berbasis **Mobile First** dengan **Verifikasi Berlapis** (Lokasi + Biometrik + ID Perangkat).

---

## 2. Kategori Fitur Sistem

### Fitur Wajib (Mission Critical)
Fitur ini harus ada agar sistem absensi dianggap valid secara operasional dan legal.

1.  **Geo-Fencing & Geo-Tagging**:
    *   Validasi koordinat GPS saat Clock-in/out.
    *   Batas radius (misal: 100m) untuk status WFO (Kantor).
    *   Perekaman lokasi spesifik untuk WFH/Dinas.
2.  **Biometrik / Bukti Kehadiran**:
    *   Foto Swafoto (dengan penanda waktu server, bukan galeri).
    *   *Face Matching* (teknologi pengenalan wajah untuk validasi).
3.  **Manajemen Shift & Jadwal**:
    *   Dukungan jam kerja Tetap (Misal: 08:00 - 17:00).
    *   Dukungan jam kerja Fleksibel.
4.  **Manajemen Cuti & Izin Berjenjang**:
    *   Hirarki persetujuan (Karyawan -> Supervisor -> HR).
    *   Saldo cuti berkurang otomatis saat disetujui.
5.  **Perhitungan Keterlambatan Real-time**:
    *   Penandaan otomatis status "Terlambat".
    *   Perhitungan durasi keterlambatan.
6.  **Rekapitulasi Dasar**:
    *   Laporan Hari Kerja, Alpa, Sakit, Izin, dan Terlambat.

### Fitur Pendukung (Optional)
Fitur yang meningkatkan pengalaman pengguna namun opsional.

1.  **Deteksi Kehidupan (Liveness Detection)**: Memastikan pengguna hadir secara fisik (bukan foto statis).
2.  **Pelacakan Langsung (Live Tracking)**: Melacak pergerakan real-time (khusus tim sales/kurir).
3.  **Reimbursement/Klaim**: Unggah bukti pengeluaran operasional.
4.  **Pengumuman**: Distribusi informasi HR via aplikasi.

---

## 3. Logika Validasi Berdasarkan Tipe Kerja

Sistem membedakan logika validasi berdasarkan lokasi kerja:

| Tipe Kerja | Logika Validasi Sistem | Syarat Valid |
| :--- | :--- | :--- |
| **WFO (Kantor)** | **Strict Geofence** | Koordinat pengguna harus berada dalam radius yang ditentukan dari lokasi kantor. |
| **WFH (Rumah)** | **Geo-Tagging Only** | Koordinat direkam sebagai bukti, namun tidak dibatasi radius tertentu. Wajib foto. |
| **Dinas Luar** | **Visit Check-in** | Absen di titik lokasi klien/tujuan. Memungkinkan absen masuk berkali-kali (Kunjungan). |

---

## 4. Kepatuhan Legalitas (Compliance)

Sistem `absensi-ceria` mengakomodasi aturan UU Ketenagakerjaan yang berlaku di Indonesia:

1.  **Jam Kerja (UU No 13 Th 2003)**:
    *   Sistem mendukung pengaturan "Jam Kerja Normal".
    *   Kelebihan jam kerja tanpa Surat Perintah Lembur (SPL) tidak otomatis dihitung sebagai lembur berbayar (untuk kontrol anggaran).

2.  **Lembur (Kepmenakertrans)**:
    *   Lembur wajib memiliki perintah/persetujuan.
    *   Implementasi: Fitur "Request Overtime". Pengajuan -> Persetujuan Atasan -> Perhitungan Payroll.

3.  **Sakit & Cuti**:
    *   Sakit lebih dari 2 hari wajib menyertakan surat dokter.
    *   Implementasi: Formulir unggah surat dokter menjadi wajib jika durasi sakit > 2 hari.

4.  **Denda/Potongan**:
    *   Sistem penggajian memisahkan Gaji Pokok dan Tunjangan Kehadiran untuk memfasilitasi potongan keterlambatan yang legal (tanpa memotong gaji pokok).

---

## 5. Alur Penggunaan (User Experience)

### Alur Masuk (Clock In)
1.  **Buka Aplikasi**: Sistem mengambil lokasi GPS & Waktu Server.
2.  **Pengecekan Dashboard**: Sistem membandingkan Lokasi Pengguna vs Lokasi Kantor.
3.  **Validasi**:
    *   Jika WFO & Diluar Radius: Tombol Masuk Dinonaktifkan / Peringatan Muncul.
    *   Jika WFO & Dalam Radius: Tombol Aktif.
4.  **Aksi**: Klik Masuk -> Buka Kamera.
5.  **Ambil Foto**: Pengguna mengambil swafoto.
6.  **Kirim**: Foto + Lokasi + Waktu Server dikirim ke server.
7.  **Umpan Balik**: Status berhasil muncul beserta informasi waktu masuk.

### Alur Lembur
Karyawan mengajukan rencana lembur (Estimasi jam) -> Manajer Menyetujui -> Karyawan Absen Masuk Lembur -> Karyawan Absen Keluar Lembur -> Sistem menghitung finalisasi pembayaran.

---

**Catatan Teknis Pengembang:**
*   Gunakan HTTPS pada lingkungan produksi untuk akses GPS Browser.
*   Simpan foto di penyimpanan berbasis objek (Object Storage).
*   Selalu gunakan Waktu Server (Server-Side Timestamp) untuk semua pencatatan waktu resmi.
