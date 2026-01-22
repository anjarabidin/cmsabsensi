# Rencana Perbaikan Bug & Optimasi UI Duta Mruput

Berikut adalah analisis masalah dan rencana eksekusi (Todo List) untuk mengatasi error dan masalah tampilan yang Anda laporkan.

## 1. Analisis Masalah (Bug Report)

Berdasarkan laporan Anda, berikut adalah masalah kritis yang teridentifikasi:

1.  **Fungsi Absensi**: Gagal dengan pesan generic *"Oops terjadi kesalahan"*. Kemungkinan validasi data lokasi/foto null atau timeout.
2.  **Tampilan (UI/UX) Mobile**:
    *   **Header Turun**: Jarak atas (padding-top) terlalu besar.
    *   **Layout Bergeser/Boros**: Elemen tidak responsif (overflow) dan terlalu banyak ruang kosong (whitespace).
    *   **Layout Shift**: Notifikasi membuat menu bawah "menciut".
3.  **Navigasi**: Tombol *Back* fisik di Android menyebabkan keluar aplikasi (Exit), bukan kembali ke halaman sebelumnya.
4.  **Hardware & Izin**:
    *   Kamera error (Oops).
    *   Izin akses (Location/Camera) belum dikelola dengan baik (Runtime Permissions).

---

## 2. Rencana Teknis (Solution Plan)

### A. Perbaikan Layout & UI (Prioritas Utama)
*   **Fix Header Spacing**: Menghapus `pt-[calc(3.5rem...)]` yang berlebihan. Cukup gunakan `status-bar-height` atau padding minimal. Header akan dibuat *sticky* tapi tidak memakan tempat berlebih.
*   **Compact Mode**: Mengurangi padding dalam *Card* dan *Grid* agar tidak "boros" tempat.
*   **Safe Area**: Memastikan `env(safe-area-inset-top)` hanya diaplikasikan SEKALI di container utama, bukan di setiap elemen.
*   **Fix Notifikasi**: Mengubah posisi *Popover* Notifikasi agar `absolute` dan tidak mendorong layout lain.

### B. Perbaikan Navigasi & Back Button
*   Menambahkan `App.addListener('backButton')` di level aplikasi utama (`App.tsx`).
*   **Logika**:
    *   Jika ada history navigasi -> `router.back()`.
    *   Jika di halaman Login/Dashboard -> Konfirmasi Keluar.

### C. Manajemen Izin (Permissions) & Kamera
*   Membuat *Utility Functions* untuk cek & request permission secara eksplisit *sebelum* membuka fitur Kamera/GPS.
*   Menambahkan *Error Handling* yang spesifik (bukan "Oops" saja, tapi "Izin Kamera Ditolak" dll).

### D. Debugging Absensi
*   Menambahkan log detail saat submit absen gagal.
*   Memastikan koordinat GPS dan Foto sudah valid sebelum tombol kirim aktif.

---

## 3. Daftar Tugas Eksekusi (Todo List)

Saya akan mengerjakan perbaikan ini secara bertahap sesuai urutan berikut:

### Tahap 1: Core System & Navigasi
- [ ] **Refactor `DashboardLayout.tsx`**: Bersihkan padding mobile yang aneh, fix Back Button logic.
- [ ] **Fix `App.tsx`**: Implementasi *Hardware Back Button Listener*.
- [ ] **Update `QuickAttendance.tsx`**:
    - [ ] Tambahkan pengecekan Permission Kamera & Lokasi yang robust.
    - [ ] Perbaiki UI Kamera (layout).
    - [ ] Tambahkan Error Log yang jelas saat gagal submit.

### Tahap 2: UI Overhaul (Perombakan Tampilan)
- [ ] **Refactor `Dashboard.tsx`**:
    - [ ] Hapus padding atas yang berlebihan.
    - [ ] Kecilkan ukuran Card/Grid (Compact Mode).
    - [ ] Rapikan elemen "Boros".
- [ ] **Global UI Check**: Cek halaman detail (Attendance, History) agar headernya konsisten.

### Tahap 3: Finalisasi Mobile
- [ ] Cek ulang `AndroidManifest.xml` (Permissions).
- [ ] Pastikan file APK nanti terbuild dengan konfigurasi baru.

---

**Apakah rencana ini sudah sesuai? Jika setuju, saya akan mulai mengeksekusi Tahap 1 segera.**
