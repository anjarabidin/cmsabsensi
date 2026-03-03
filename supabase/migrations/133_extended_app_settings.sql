-- Migration 133: Tambah pengaturan sistem lanjutan (FIXED - value as jsonb)
-- Profil Perusahaan, GPS, Cuti, Reminder, Lembur

-- ─── 1. PROFIL PERUSAHAAN ────────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description) VALUES
    ('company_name',     '"PT Contoh Perusahaan"', 'Nama perusahaan yang tampil di laporan dan header aplikasi.'),
    ('company_timezone', '"Asia/Jakarta"',          'Zona waktu operasional. Pilihan: Asia/Jakarta (WIB), Asia/Makassar (WITA), Asia/Jayapura (WIT).'),
    ('company_logo_url', '""',                      'URL logo perusahaan. Kosongkan untuk pakai default.')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. GPS & VALIDASI LOKASI ────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description) VALUES
    ('gps_min_accuracy_meters', '50',   'Akurasi GPS minimum yang diterima (meter). Misal: 50 = harus akurat ≤50m. Nilai lebih besar = lebih longgar.'),
    ('allow_wfh_mode',          'true', 'Izinkan karyawan memilih mode WFH saat absensi. Jika mati, semua harus WFO.'),
    ('block_fake_gps',          'true', 'Blokir absensi jika terdeteksi menggunakan aplikasi fake GPS/mock location.')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. ATURAN JAM ABSENSI & LEMBUR ─────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description) VALUES
    ('attendance_clock_in_latest_hour',   '10',   'Batas jam terakhir clock in diterima (WIB). Lewat jam ini tidak bisa absen masuk. Default: 10 (jam 10:00).'),
    ('attendance_clock_in_latest_minute', '0',    'Menit untuk batas jam terakhir clock in. Misal jam 10:30 = hour=10, minute=30.'),
    ('overtime_minimum_minutes',          '30',   'Minimal berapa menit di luar jam kerja untuk dihitung sebagai lembur. Default: 30 menit.'),
    ('overtime_require_approval',         'true', 'Lembur harus diajukan dan disetujui sebelumnya. Jika mati, langsung tercatat otomatis.')
ON CONFLICT (key) DO NOTHING;

-- ─── 4. ATURAN CUTI & IZIN ───────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description) VALUES
    ('leave_max_days_per_year',    '12',   'Jumlah maksimal hari cuti yang bisa diambil karyawan per tahun. Default: 12 hari.'),
    ('leave_min_notice_days',      '1',    'Minimal berapa hari sebelumnya pengajuan cuti harus dibuat. 0 = bisa mendadak, 1 = harus H-1.'),
    ('leave_require_approval',     'true', 'Cuti harus disetujui admin/manajer sebelum dianggap sah. Jika mati, langsung approved otomatis.'),
    ('leave_allow_half_day',       'true', 'Izinkan pengajuan cuti setengah hari (cuti pagi atau cuti siang).')
ON CONFLICT (key) DO NOTHING;

-- ─── 5. NOTIFIKASI & REMINDER ────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description) VALUES
    ('reminder_clock_in_enabled',  'true', 'Kirim push notification reminder absen masuk ke karyawan.'),
    ('reminder_clock_in_hour',     '7',    'Jam reminder absen masuk dikirim (WIB). Default: 07 (07:00).'),
    ('reminder_clock_in_minute',   '45',   'Menit reminder absen masuk. Misal 07:45 = hour=7, minute=45.'),
    ('reminder_clock_out_enabled', 'true', 'Kirim push notification reminder absen pulang ke karyawan.'),
    ('reminder_clock_out_hour',    '17',   'Jam reminder absen pulang dikirim (WIB). Default: 17 (17:00).'),
    ('reminder_clock_out_minute',  '0',    'Menit reminder absen pulang. Misal 17:00 = hour=17, minute=0.'),
    ('reminder_workday_only',      'true', 'Reminder hanya dikirim di hari kerja (Senin–Jumat). Jika mati, dikirim setiap hari.')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload config';
