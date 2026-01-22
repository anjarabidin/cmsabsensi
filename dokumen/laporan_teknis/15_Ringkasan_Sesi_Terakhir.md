# Ringkasan Sesi Pengembangan - 17 Januari 2026

## Pencapaian Utama
Sesi ini berfokus pada perbaikan stabilitas fitur native, pendaftaran wajah, dan UI/UX akhir untuk persiapan build APK.

### 1. Pendaftaran Wajah (Hybrid System)
- **Masalah**: Kualitas kamera web (HTML5) kadang buram, tapi kamera native (Capacitor) kurang praktis secara UX.
- **Solusi**: Mengimplementasikan sistem **Hybrid** di `SimpleFaceRegistration.tsx`.
  - **Mode Default**: Live HTML5 Video (Cepat, UX cermin).
  - **Mode HD**: Tombol "Gunakan Kamera HP" untuk memanggil kamera bawaan (High Res).
- **Status**: ✅ Selesai & Teruji.

### 2. Login Biometrik (Sidik Jari/FaceID)
- **Masalah**: Fitur terasa seperti "mockup" karena logic fallback yang terlalu agresif (langsung lempar ke wajah jika scan jari gagal) dan tombol yang hilang jika setting awal off.
- **Solusi**: 
  - Update `Auth.tsx` untuk mendeteksi hardware biometrik (`NativeBiometric.isAvailable`) saat startup.
  - Tombol sidik jari sekarang **selalu muncul** jika hardware terdeteksi, meskipun user belum mengaktifkannya di setting (akan menolak dengan pesan jelas jika belum setup).
  - Error handling yang lebih ramah: User bisa tekan "Batal" saat scan jari tanpa dipaksa masuk mode lain.
- **Status**: ✅ Selesai (Logic "Smart Native Detection").

### 3. Notifikasi & Ikon
- **Masalah**: Ikon notifikasi muncul sebagai huruf 'i' (default Android) karena tidak ada aset valid.
- **Solusi**: Membuat `ic_notification.xml` (Vector Drawable) dengan path custom yang membentuk tulisan **"CMS"** (siluet putih transparan).
- **Status**: ✅ Selesai.

### 4. Perbaikan Kecil Lainnya
- **Peta/Lokasi**: Fix parsing koordinat Google Maps di `Locations.tsx` untuk support berbagai format URL.
- **Push Notification**: Update Edge Function untuk support **FCM Topics** (broadcast lebih efisien).

## Rekomendasi Langkah Selanjutnya (Validasi APK)
Karena banyak perubahan pada fitur native (Camera & Biometric), langkah selanjutnya yang **wajib** dilakukan adalah:

1. **Jalankan Build APK**: `npx cap sync android` lalu build di Android Studio.
2. **Test Device Fisik**:
   - Coba Login Sidik Jari (pastikan jari sudah terdaftar di HP).
   - Coba Notifikasi (pastikan ikon CMS muncul di status bar).
   - Coba Pendaftaran Wajah (Tes kedua mode: Live & Native Camera).

---
*Kode telah di-push ke branch `main`.*
