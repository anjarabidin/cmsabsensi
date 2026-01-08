# Analisis dan Spesifikasi Sistem Absensi Modern (Standar Indonesia)

Dokumen ini disusun untuk PT CMS Duta Solusi sebagai acuan pengembangan sistem absensi yang **Enterprise-Grade**, **Legal-Compliant**, dan **Efektif** sesuai budaya kerja di Indonesia.

## 1. Analisis Kebutuhan Perusahaan Modern di Indonesia

Perusahaan modern di Indonesia (terutama pasca-pandemi) menghadapi tantangan "Trust vs Control".
*   **Tantangan:** Karyawan bekerja dari mana saja (Hybrid), namun manajemen membutuhkan data akurat untuk penggajian dan evaluasi kinerja.
*   **Masalah Umum:** "Titip Absen", Fake GPS, manipulasi jam lembur, dan kesulitan tracking tim sales/lapangan.
*   **Solusi:** Sistem harus berbasis **Mobile First** dengan **Multi-Layer Verification** (Lokasi + Biometrik + Device ID).

---

## 2. Pembedaan Fitur WAJIB vs OPSIONAL

Untuk memastikan sistem berjalan efisien namun tidak *bloated*, berikut pembedaannya:

### ✅ Fitur WAJIB (Mission Critical)
Fitur ini **HARUS** ada agar sistem absensi dianggap valid secara operasional dan legal.

1.  **Geo-Fencing & Geo-Tagging:**
    *   Validasi koordinat GPS saat Clock-in/out.
    *   Batas radius (misal: 100m) untuk status WFO.
    *   Perekaman lokasi *exact* untuk WFH/Dinas.
2.  **Biometrik / Bukti Kehadiran:**
    *   Foto Selfie (dengan timestamp server, bukan galeri).
    *   *Face Matching* (opsional tapi sangat disarankan untuk level enterprise).
3.  **Manajemen Shift & Jadwal:**
    *   Support jam kerja *Fixed* (08:00 - 17:00).
    *   Support *Flexible* (Total jam kerja per hari).
4.  **Manajemen Cuti & Izin (Approval Tier):**
    *   Hirarki persetujuan (Karyawan -> SPV -> HR).
    *   Saldo cuti otomatis berkurang.
5.  **Perhitungan Keterlambatan Real-time:**
    *   Otomatis flag "Terlambat" jika > jam masuk.
    *   Menghitung durasi telat (untuk denda/potongan).
6.  **Rekapitulasi Gaji (Basic):**
    *   Hari kerja, Alpa, Sakit, Izin, Terlambat.

### ⭕ Fitur OPSIONAL (Value Adder)
Fitur ini meningkatkan UX dan efisiensi, namun sistem bisa berjalan tanpanya.

1.  **Liveness Detection:** Meminta user berkedip/menengok untuk memastikan bukan foto statis.
2.  **Live Tracking:** Melacak pergerakan real-time (khusus sales/kurir). *Note: Isu privasi tinggi.*
3.  **Reimbursement/Klaim:** Upload struk bensin/makan.
4.  **Pengumuman/Blast News:** Info HR via aplikasi.
5.  **Early Clock-out Warning:** Notifikasi jika pulang sebelum waktunya.

---

## 3. Penyesuaian Budaya Kerja (WFO / WFH / Dinas)

Sistem harus membedakan logika validasi berdasarkan tipe kerja:

| Tipe Kerja | Logika Validasi Sistem | Syarat Valid |
| :--- | :--- | :--- |
| **WFO (Kantor)** | **Strict Geofence** | Koordinat user harus berada dalam radius X meter dari koordinat kantor pusat/cabang. |
| **WFH (Rumah)** | **Geo-Tagging Only** | Koordinat direkam sebagai bukti, tapi **TIDAK** dibatasi radius tertentu. Wajib menyalakan kamera. |
| **Dinas Luar** | **Visit Check-in** | Absen di titik lokasi klien. Memungkinkan multiple check-in dalam sehari (Kunjungan). |

---

## 4. Aspek Legalitas Indonesia (Compliance)

Sistem `absensi-ceria` saat ini harus mengakomodasi aturan UU Ketenagakerjaan & UU Cipta Kerja:

1.  **Jam Kerja (UU No 13 Th 2003, Pasal 77):**
    *   7 jam/hari (6 hari kerja) atau 8 jam/hari (5 hari kerja).
    *   **Implementasi:** Sistem harus bisa setting "Jam Kerja Normal". Kelebihan jam tanpa SPL **TIDAK** otomatis dihitung lembur (untuk kontrol budget).

2.  **Lembur (Kepmenakertrans No. 102/MEN/VI/2004):**
    *   Lembur WAJIB ada perintah tertulis/digital (SPL - Surat Perintah Lembur).
    *   **Implementasi:** Fitur "Request Overtime" di aplikasi. User request -> atasan approve -> baru dihitung di Payroll. **Jangan auto-calculate lembur hanya karena clock-out telat.**

3.  **Sakit & Cuti:**
    *   Sakit > 2 hari wajib surat dokter.
    *   Cuti Tahunan minimal 12 hari setelah 1 tahun kerja.
    *   **Implementasi:** Form upload surat dokter wajib (mandatory field) jika tipe izin = Sakit.

4.  **Denda/Potongan (Peraturan Perusahaan):**
    *   Legal memotong tunjangan kehadiran (bukan Gaji Pokok) karena keterlambatan.
    *   **Implementasi:** Payroll module harus memisahkan Gaji Pokok vs Tunjangan Kehadiran agar potongan keterlambatan legal.

---

## 5. Rekomendasi Flow Absensi yang Efisien

Berikut adalah alur UX yang direkomendasikan untuk aplikasi PT CMS Duta Solusi:

### Flow Masuk (Clock In) - < 10 Detik
1.  **Buka App:** Auto-fetch lokasi GPS & Server Time (Anti Client-Side Manipulation).
2.  **Dashboard Cek:** Sistem membandingkan Lokasi User vs Lokasi Kantor (WFO) atau Lokasi Bebas (WFH).
3.  **Validasi:**
    *   *Jika WFO & Diluar Radius:* Tombol Clock In **Disable** / Muncul Peringatan "Jauh dari lokasi".
    *   *Jika WFO & Dalam Radius:* Tombol Aktif.
4.  **Action:** Klik Clock In -> Buka Kamera (Mini View/Bottom Sheet).
5.  **Capture:** User ambil foto.
6.  **Submit:** Foto + Lokasi + Jam Server dikirim.
7.  **Feedback:** Muncul status "Berhasil Masuk - 08:05 (Terlambat 5 menit)".

### Flow Lembur (Overtime)
*   **Strict Flow:** Karyawan **Request** SPL (Estimasi jam) -> Manager **Approve** -> Karyawan **Clock In Lembur** -> Karyawan **Clock Out Lembur** -> Sistem menghitung finalisasi pembayaran.

---

**Catatan Teknis untuk Developer:**
*   Pastikan `npm run dev` menggunakan HTTPS atau localhost untuk akses Geolocation API browser.
*   Simpan foto di *Object Storage* (Supabase Storage) dengan path terstruktur: `YEAR/MONTH/USER_ID/DATE_TYPE.jpg`.
*   Gunakan `Server-Side Timestamp` untuk semua transaksi waktu, jangan pernah percaya jam di HP user.
