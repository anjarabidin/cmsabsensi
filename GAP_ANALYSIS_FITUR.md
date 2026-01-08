
# Spesifikasi Fitur Aplikasi Absensi (Gap Analysis) - PT CMS Duta Solusi

Dokumen ini memetakan fitur yang **MASIH KURANG** atau perlu ditambahkan pada sistem `absensi-ceria` saat ini agar menjadi sistem HRIS Enterprise yang lengkap, sesuai analisis kebutuhan dan hukum Indonesia.

## 1. Fitur Karyawan (Employee Self-Service)

### 🔴 A. Koreksi Absensi (Attendance Correction)
*   **Deskripsi:** Karyawan dapat mengajukan revisi jika lupa absen atau ada kendala teknis (mati lampu/HP rusak).
*   **Contoh Penggunaan:** Ahmad lupa *Clock Out* kemarin. Ia mengisi form koreksi jam pulang menjadi 17:00 dengan alasan "Lupa scan karena meeting".
*   **Data:** `request_date`, `corrected_clock_in`, `corrected_clock_out`, `reason`, `attachment_proof`.

### 🔴 B. Reimbursement & Klaim
*   **Deskripsi:** Fitur untuk klaim pengeluaran operasional (Bensin, Parkir, Medis).
*   **Contoh Penggunaan:** Sales mengunggah foto struk parkir dan tol untuk diganti kantor pada akhir bulan.
*   **Data:** `claim_type`, `amount`, `receipt_photo_url`, `description`.

### 🔴 C. Perhitungan Denda Keterlambatan (Live View)
*   **Deskripsi:** Transparansi potongan gaji real-time akibat keterlambatan.
*   **Contoh Penggunaan:** Dashboard menampilkan "Total potongan bulan ini: Rp 50.000" agar karyawan lebih disiplin.
*   **Data:** `late_minutes_total`, `penalty_amount` (calculated).

---

## 2. Fitur Admin HR (Central Control)

### 🔴 A. Shift & Roster Management (Kompleks)
*   **Deskripsi:** Manajemen jadwal kerja yang tidak statis (bukan hanya 9-to-5). Mendukung shift pagi/siang/malam rolling.
*   **Contoh Penggunaan:** HR mengatur jadwal Security: Minggu 1 Shift Pagi, Minggu 2 Shift Malam.
*   **Data:** `shift_master` (name, start_time, end_time), `employee_shift_schedule`.

### 🔴 B. Mass Adjustment (Payroll)
*   **Deskripsi:** Kemampuan mengedit komponen gaji banyak karyawan sekaligus (misal: Bonus THR massal).
*   **Contoh Penggunaan:** Menambahkan komponen "THR 2026" sebesar 1x Gaji Pokok ke semua karyawan aktif.
*   **Data:** `bulk_adjustment_batch`, `target_employee_ids`.

### 🔴 C. Laporan SPT / Pajak PPh 21
*   **Deskripsi:** Generate laporan siap cetak untuk pelaporan pajak bulanan/tahunan (Form 1721-A1).
*   **Contoh Penggunaan:** HR mengunduh CSV format DJP Online setiap tanggal 10.
*   **Data:** `npwp`, `ptkp_code`, `bruto`, `pph21_amount`.

### 🔴 D. Broadcast / Pengumuman
*   **Deskripsi:** Kirim notifikasi massal ke aplikasi karyawan.
*   **Contoh Penggunaan:** "Besok libur cuti bersama, kantor tutup."
*   **Data:** `announcement_title`, `body`, `target_audience`.

---

## 3. Fitur Manager / Atasan (Supervisor)

### 🔴 A. Team Monitoring (Live Map)
*   **Deskripsi:** Peta sebaran lokasi tim saat ini (Terutama untuk Sales/Lapangan).
*   **Contoh Penggunaan:** Manager Sales mengecek apakah tim sales area Jakarta Selatan benar-benar sedang di area tersebut.
*   **Data:** `last_known_location`, `last_update_timestamp`.

### 🔴 B. Delegasi Persetujuan (Approval Delegation)
*   **Deskripsi:** Melimpahkan wewenang approve jika Manager cuti.
*   **Contoh Penggunaan:** Manager IT cuti seminggu, approval cuti staff dialihkan sementara ke Senior Staff.
*   **Data:** `delegate_user_id`, `start_date`, `end_date`.

---

## 4. Fitur Sistem & Keamanan (Security)

### 🔴 A. Device Locking / IMEI Binding
*   **Deskripsi:** Akun karyawan dikunci hanya bisa login di 1 HP yang terdaftar.
*   **Contoh Penggunaan:** Ahmad tidak bisa menyuruh Budi login akunnya di HP Budi untuk titip absen.
*   **Data:** `registered_device_id`, `device_model`.

### 🔴 B. Fake GPS Detection
*   **Deskripsi:** Mendeteksi penggunaan aplikasi "Mock Location".
*   **Contoh Penggunaan:** Jika terdeteksi pakai Fake GPS, sistem menolak Clock In dan mencatat insiden "Fraud Attempt".
*   **Data:** `is_mock_location` flags.

### 🔴 C. Audit Trail (Log Aktivitas)
*   **Deskripsi:** Rekam jejak siapa mengubah data apa.
*   **Contoh Penggunaan:** Mengetahui "Siapa yang mengubah jam masuk karyawan A dari terlambat menjadi tepat waktu?".
*   **Data:** `actor_id`, `action`, `table_affected`, `old_value`, `new_value`.

---

**Rekomendasi Prioritas Pengerjaan (Roadmap):**
1.  **High:** Filter Radius WFO (Sudah diminta utk dikerjakan).
2.  **High:** Device Locking (Anti-Fraud).
3.  **Medium:** Koreksi Absensi (Mengurangi beban admin manual).
4.  **Low:** Reimbursement & Shift Management.
