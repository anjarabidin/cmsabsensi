# MIGRASI: Pengenalan Wajah → Biometrik Sidik Jari

**Status:** Sedang Berjalan  
**Tanggal:** 20 Januari 2026  
**Alasan:** Kesalahan tensor pada pengenalan wajah - migrasi ke autentikasi biometrik perangkat

---

## Ringkasan

Sistem absensi sementara diubah dari **Pengenalan Wajah** menjadi **Autentikasi Sidik Jari/Biometrik** menggunakan Web Authentication API (WebAuthn).

### Ringkasan Perubahan

| Komponen | Status | Perubahan yang Diperlukan |
|-----------|--------|------------------|
| FaceRegistration.tsx | ✅ SELESAI | Diganti dengan halaman "Segera Hadir" |
| biometricAuth.ts | ✅ SELESAI | Utilitas baru telah dibuat |
| Attendance.tsx | ⏳ TERTUNDA | Mengganti pemeriksaan wajah dengan biometrik |
| QuickAttendance.tsx | ⏳ TERTUNDA | Mengganti pemeriksaan wajah dengan biometrik |
| Validasi GPS | ⏳ TERTUNDA | Memperketat radius + pemeriksaan akurasi |

---

## Panduan Implementasi

### 1. Halaman Pendaftaran Wajah (✅ Selesai)
Berkas: `src/pages/FaceRegistration.tsx`
- Mengganti seluruh halaman dengan UI "Segera Hadir"
- Kode asli disimpan dalam komentar
- Pengguna diarahkan untuk menggunakan biometrik sidik jari

### 2. Utilitas Biometrik (✅ Selesai)
Berkas: `src/utils/biometricAuth.ts`
- Membuat autentikasi biometrik berbasis WebAuthn
- Fungsi:
  - `isBiometricAvailable()` - Memeriksa dukungan perangkat
  - `authenticateBiometric()` - Memverifikasi identitas pengguna
  - `promptBiometricForAttendance()` - Perintah absensi cepat

### 3. Halaman Absensi (⏳ Yang Harus Dikerjakan)
Berkas: `src/pages/Attendance.tsx`

**Alur Berbasis Wajah Saat Ini:**
```typescript
// Baris 239-333: checkFaceMatch()
// Baris 335-415: openCamera() dengan pemeriksaan pendaftaran wajah
// Baris 425-457: runDetection() loop untuk deteksi wajah
// Baris 466-518: handleCapturePhoto() dengan verifikasi wajah
```

**Alur Biometrik Baru:**
```typescript
import { promptBiometricForAttendance } from '@/utils/biometricAuth';

// KOMENTARI: Baris 239-333 (fungsi checkFaceMatch)
// KOMENTARI: Baris 83-84 (impor MediaPipe & FaceSystem)
// KOMENTARI: Baris 107-111 (state pengenalan wajah)

// GANTI openCamera() dengan openCameraForPhoto()
const openCameraForPhoto = async () => {
  try {
    if (!user) {
      toast({
        title: 'Kesalahan',
        description: 'User tidak ditemukan',
        variant: 'destructive'
      });
      return;
    }

    setCameraOpen(true);
    await startCamera();
    
    // Mulai lokasi di latar belakang jika belum tersedia
    if (!latitude || !longitude) {
      getLocation();
    }
  } catch (error) {
    setCameraOpen(false);
    const errorMessage = error instanceof Error ? error.message : 'Gagal mengakses kamera';
    toast({
      title: 'Gagal Membuka Kamera',
      description: errorMessage,
      variant: 'destructive',
    });
  }
};

// GANTI handleCapturePhoto()
const handleCapturePhoto = async () => {
  try {
    // PEMERIKSAAN BIOMETRIK TERLEBIH DAHULU
    toast({
      title: 'Verifikasi Identitas',
      description: 'Silakan gunakan sidik jari untuk verifikasi',
    });

    const biometricResult = await promptBiometricForAttendance();
    
    if (!biometricResult.success) {
      toast({
        title: 'Verifikasi Gagal',
        description: biometricResult.error || 'Sidik jari tidak cocok',
        variant: 'destructive'
      });
      return;
    }

    // SUKSES - Ambil foto
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Balik untuk cermin yang benar
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedPhoto(blob);
        setPhotoPreview(URL.createObjectURL(blob));
      }
    }, 'image/jpeg', 0.95);

    stopCamera();
    setCameraOpen(false);

    toast({
      title: '✓ Verifikasi Berhasil',
      description: 'Identitas terverifikasi dengan aman',
      className: 'bg-green-600 text-white',
    });

  } catch (error) {
    console.error('Kesalahan Pengambilan:', error);
    toast({ 
      title: 'Gagal', 
      description: 'Gagal mengambil foto', 
      variant: 'destructive' 
    });
  }
};

// HAPUS: Baris 417-464 (useEffect runDetection - tidak lagi diperlukan)
```

**Perubahan UI:**
```typescript
// Ubah teks tombol dari "Ambil Foto & Verifikasi Wajah" menjadi:
<Button onClick={handleCapturePhoto}>
  <Scan className="mr-2 h-4 w-4" />
  Ambil Foto & Verifikasi Sidik Jari
</Button>
```

### 4. Halaman Absensi Cepat (⏳ Yang Harus Dikerjakan)
Berkas: `src/pages/QuickAttendance.tsx`

**Perubahan serupa dengan Attendance.tsx, namun disederhanakan:**
- Hapus impor MediaPipe dan FaceSystem
- Hapus fungsi `checkFaceMatch()` (baris 120-185)
- Hapus loop deteksi wajah (baris 269-301)
- Ganti pemeriksaan wajah di `handleCapture()` dengan perintah biometrik

**Perbedaan Utama:** Absensi Cepat hanya untuk WFO, jadi validasi GPS harus LEBIH KETAT.

### 5. Memperketat Validasi GPS (⏳ Yang Harus Dikerjakan)

**Pengaturan Saat Ini:**
```typescript
const MAX_RADIUS_M = 100; // 100 meter
```

**Pengaturan Baru yang Lebih Ketat:**
```typescript
// Di Attendance.tsx
const MAX_RADIUS_M = 50; // Dikurangi menjadi 50 meter untuk WFO
const MIN_GPS_ACCURACY = 20; // Memerlukan akurasi lebih baik dari 20 meter

// Di QuickAttendance.tsx (bahkan lebih ketat)
const MAX_RADIUS = 30; // Hanya 30 meter untuk absensi cepat
const MIN_GPS_ACCURACY = 15; // Memerlukan akurasi lebih baik dari 15 meter
```

**Tambahkan Pemeriksaan Akurasi:**
```typescript
// Di hook useGeolocation atau logika validasi
if (accuracy && accuracy > MIN_GPS_ACCURACY) {
  setIsLocationValid(false);
  setLocationErrorMsg(`Akurasi GPS tidak cukup (${Math.round(accuracy)}m). Diperlukan < ${MIN_GPS_ACCURACY}m.`);
  return;
}
```

**Peningkatan Anti-Mock GPS:**
```typescript
// Pemeriksaan yang ada di Attendance.tsx baris 536
if (isMocked) {
  toast({
    title: 'Fake GPS Terdeteksi!',
    description: 'Sistem mendeteksi manipulasi lokasi. Mohon gunakan GPS asli.',
    variant: 'destructive'
  });
  
  // LOG KE TABEL KEAMANAN
  await supabase.from('security_violations').insert({
    user_id: user.id,
    violation_type: 'fake_gps_detected',
    timestamp: new Date().toISOString(),
    latitude,
    longitude
  });
  
  return;
}
```

---

## Daftar Periksa Pengujian

### Autentikasi Biometrik
- [ ] Uji pada perangkat Android (Sidik Jari)
- [ ] Uji pada perangkat iOS (Touch ID/Face ID)
- [ ] Uji pada desktop (Windows Hello / Touch ID)
- [ ] Uji alur pembatalan biometrik
- [ ] Uji dengan biometrik yang belum terdaftar

### Validasi GPS
- [ ] Uji di dalam radius (seharusnya berhasil)
- [ ] Uji di luar radius (seharusnya gagal)
- [ ] Uji dengan akurasi GPS yang buruk (seharusnya gagal)
- [ ] Uji dengan aplikasi GPS palsu (seharusnya terdeteksi dan gagal)
- [ ] Uji mode WFH (seharusnya mengizinkan lokasi mana pun)

### Alur Absensi
- [ ] Masuk (Clock in) dengan biometrik
- [ ] Keluar (Clock out) dengan biometrik
- [ ] Pengambilan foto berfungsi dengan benar
- [ ] Cermin kamera dikoreksi
- [ ] Pesan kesalahan jelas

---

## Rencana Rollback

Jika autentikasi biometrik mengalami masalah:

1. Uncomment kode pengenalan wajah di `FaceRegistration.tsx` (baris dipertahankan)
2. Kembalikan `Attendance.tsx` dan `QuickAttendance.tsx` ke riwayat Git
3. Jalankan: `git checkout HEAD -- src/pages/Attendance.tsx src/pages/QuickAttendance.tsx src/pages/FaceRegistration.tsx`

---

## Catatan untuk Pengembang

### Mengapa WebAuthn?
- **Biometrik Asli**: Menggunakan pemindai sidik jari/wajah bawaan perangkat
- **Tanpa Model ML**: Tidak ada kesalahan tensor, ukuran bundle lebih kecil
- **Aman**: Kunci pribadi tidak pernah meninggalkan perangkat
- **Lintas Platform**: Bekerja di Android, iOS, Windows, macOS

### Batasan
- **Wajib HTTPS**: Tidak akan bekerja pada HTTP (localhost adalah pengecualian)
- **Dukungan Browser**: Memerlukan browser modern (Chrome 67+, Safari 14+)
- **Pendaftaran**: Pengguna harus sudah mendaftarkan biometrik di perangkat mereka
- **Fallback**: Mungkin memerlukan fallback PIN/kata sandi untuk perangkat tanpa biometrik

### Peningkatan Masa Depan
1. Aktifkan kembali pengenalan wajah ketika masalah tensor teratasi
2. Implementasikan mode hibrida: biometrik ATAU wajah (pilihan pengguna)
3. Tambahkan absensi kode QR sebagai opsi cadangan
4. Implementasikan biometrik suara untuk absensi hands-free

---

**Terakhir Diperbarui:** 20 Januari 2026 15:20 WIB  
**Diperbarui Oleh:** Asisten AI Antigravity  
**Status:** Implementasi sedang berlangsung...
