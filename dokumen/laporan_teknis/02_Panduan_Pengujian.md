# Panduan Pengujian Sistem - Absensi + Payroll

**Versi**: 3.0.0
**Status**: Siap untuk Pengujian (Ready for Testing)

---

## Persiapan Pengujian

### 1. Migrasi Database
Pastikan semua migrasi database telah dijalankan secara berurutan sesuai nomor file di folder `supabase/migrations`.

Verifikasi tabel berikut telah tersedia:
- `leave_balances`
- `overtime_policies`
- `monthly_attendance_summary`
- `employee_salaries`
- `payroll_runs`

### 2. Data Pengujian
Pastikan ada minimal satu akun pengguna untuk setiap peran:
- Karyawan (Staff)
- Manajer
- Admin HR

---

## Skenario Pengujian Fungsional

### A. Fitur Kepatuhan & Cuti

#### Tes 1.1: Manajemen Saldo Cuti
**Tujuan**: Memastikan pelacakan saldo cuti dan validasi kuota berjalan.
- [ ] Login sebagai karyawan, cek apakah kartu "Saldo Cuti" muncul di Dashboard.
- [ ] Pastikan saldo awal Cuti Tahunan adalah 12 hari (untuk pengguna baru).
- [ ] Pastikan muncul peringatan jika saldo menipis (<= 3 hari).

#### Tes 1.2: Pengajuan Cuti dengan Validasi
**Tujuan**: Menguji validasi logika saat pengajuan cuti.
- [ ] Ajukan cuti melebihi saldo -> Harus muncul error "Kuota tidak cukup".
- [ ] Ajukan cuti dengan saldo cukup -> Harus berhasil (status pending).
- [ ] Kosongkan alasan -> Harus muncul error validasi.

#### Tes 1.3: Unggah Surat Dokter
**Tujuan**: Menguji syarat wajib surat dokter.
- [ ] Pilih "Sakit" dengan durasi 1 hari -> Kolom unggah opsional/tidak muncul.
- [ ] Pilih "Sakit" dengan durasi 3 hari -> Kolom unggah surat dokter harus muncul dan wajib diisi.
- [ ] Unggah file (JPG/PDF) -> File harus tersimpan dan dapat diakses.

### B. Fitur Lembur (Overtime)

#### Tes 1.4: Perhitungan Upah Lembur
**Tujuan**: Memastikan perhitungan otomatis sesuai tarif (multiplier).
- [ ] Buka menu Lembur -> Ajukan Lembur.
- [ ] Masukkan jam lembur pada Hari Kerja (misal 3 jam).
- [ ] Pastikan estimasi upah menghitung: (1.5x upah sejam untuk jam pertama) + (2x upah sejam untuk jam berikutnya).
- [ ] Cek validasi: Durasi minimal 30 menit, maksimal 4 jam (untuk hari kerja biasa).

#### Tes 1.5: Persetujuan (Approval)
**Tujuan**: Menguji alur persetujuan manajer.
- [ ] Login sebagai Manajer/Admin.
- [ ] Buka menu Persetujuan.
- [ ] Setujui pengajuan cuti -> Pastikan saldo cuti karyawan berkurang.
- [ ] Tolak pengajuan -> Pastikan saldo cuti kembali/tidak berkurang.

### C. Modul Penggajian (Payroll)

#### Tes 2.1: Manajemen Gaji Karyawan
**Tujuan**: Mengatur komponen gaji.
- [ ] Login sebagai Admin HR -> Menu Karyawan.
- [ ] Edit Karyawan -> Atur Gaji.
- [ ] Masukkan Gaji Pokok, Tunjangan, dan status BPJS.
- [ ] Simpan dan pastikan Gaji Kotor (Gross) terhitung otomatis.

#### Tes 2.2: Generate Payroll Bulanan
**Tujuan**: Membuat laporan penggajian massal.
- [ ] Buka menu Payroll -> Generate Baru.
- [ ] Pilih Bulan/Tahun -> Proses.
- [ ] Pastikan semua karyawan aktif masuk dalam daftar.
- [ ] Pastikan total gaji (Gross, Potongan, Net) terhitung benar.

#### Tes 2.3: Finalisasi & Slip Gaji
**Tujuan**: Mengunci data dan mencetak slip.
- [ ] Klik "Finalize Payroll" -> Status berubah menjadi Final (Data terkunci).
- [ ] Klik "Generate Slip Gaji" -> Unduh PDF.
- [ ] Buka PDF -> Periksa logo perusahaan, detail komponen gaji, dan total penerimaan.

---

## Pengujian UI/UX & Performa

### Tes 3.1: Status Loading
- [ ] Refresh halaman Dashboard -> Pastikan kerangka (skeleton) muncul sebelum data dimuat.
- [ ] Transisi antar halaman harus mulus tanpa pergeseran tata letak yang kasar.

### Tes 3.2: Penanganan Error (Error Handling)
- [ ] Matikan koneksi internet lalu coba akses data -> Harus muncul pesan error yang ramah pengguna.
- [ ] Coba akses halaman yang tidak ada -> Harus diarahkan ke halaman 404 atau Dashboard.

### Tes 3.3: Responsivitas Mobile
- [ ] Buka aplikasi mode tampilan seluler (Mobile View).
- [ ] Cek Menu Navigasi (Sidebar/Bottom Bar).
- [ ] Cek Tabel (apakah bisa di-scroll horizontal).
- [ ] Cek Tombol (ukuran harus cukup besar untuk disentuh jari).

---

## Templat Laporan Bug

Jika menemukan kesalahan, gunakan format berikut untuk melaporkan:

```text
Judul Bug: [Deskripsi singkat]
Tingkat Keparahan: Kritis / Sedang / Rendah

Langkah Reproduksi:
1. Buka halaman ...
2. Klik tombol ...
3. Masukkan data ...

Hasil yang Diharapkan: ...
Hasil Aktual (Error): ...

Perangkat/Browser: ...
```
