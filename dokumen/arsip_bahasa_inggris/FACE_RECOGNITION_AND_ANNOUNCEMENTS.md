# Update: Face Recognition & Announcements

## Perubahan Terbaru (11 Jan 2026 - Part 2)

### 1. Simple Face Registration (Mirip Pinjol)
Menggantikan implementasi face-api.js kompleks dengan pendekatan yang lebih sederhana dan reliable:
- Menggunakan **Capacitor Camera** untuk selfie
- Upload foto ke Supabase Storage (`face-images`)
- Simpan URL foto di tabel `face_enrollments`
- UI step-by-step yang user-friendly (Intro -> Capture -> Upload -> Success)
- **Keuntungan**: Lebih cepat, minim error model loading, bekerja offline-first (untuk capture).

### 2. Fitur Pengumuman & Notifikasi
Admin HR sekarang bisa membuat pengumuman yang langsung mengirim notifikasi ke semua karyawan:
- **UI**: Tombol "Buat Pengumuman" di halaman Pusat Informasi
- **Input**: Judul, Konten, Checkbox "Kirim Notifikasi"
- **Backend**: Menggunakan RPC `publish_announcement` untuk:
  - Insert data pengumuman
  - Bulk insert notifikasi ke SEMUA karyawan aktif (muncul di lonceng)
- **Push Notification**: Sistem mencoba invoke Edge Function (jika ada) untuk notifikasi HP

---

## Database Migrations Baru

### `20260111232724_create_face_enrollments.sql`
- Tabel `face_enrollments`: Menyimpan data pendaftaran wajah
- Bucket `face-images`: Storage untuk foto wajah
- RLS Policies: User hanya bisa kelola data sendiri, Admin HR bisa baca semua

### `20260111233029_create_publish_announcement_rpc.sql`
- Function `publish_announcement`:
  - Transactional insert untuk announcement
  - Otomatis generate notifikasi untuk ribuan karyawan sekaligus (efisien)

---

## Cara Update
1. Jalankan migration database:
   ```bash
   supabase db push
   ```
2. Aplikasi sudah siap digunakan!

---

## Catatan Teknis
- **Face Recognition**: Saat ini validasi masih di level "sudah punya foto wajah". Untuk validasi pencocokan (matching) saat absensi, bisa ditambahkan logic membandingkan foto baru dengan foto enrollment menggunakan layanan AI/ML di backend, atau library sisi klien jika device kuat.
- **Notifikasi**: Pastikan user mengizinkan notifikasi di browser/HP untuk mendapat alert real-time.
