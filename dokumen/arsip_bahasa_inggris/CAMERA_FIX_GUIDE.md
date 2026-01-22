# Perbaikan Kamera - Menggunakan Capacitor Camera Plugin

## Masalah

Kamera tidak bisa capture foto menggunakan `getUserMedia` di Android WebView.

## Solusi

Gunakan **Capacitor Camera Plugin** yang lebih native dan reliable untuk hybrid apps.

## File Yang Sudah Dibuat

✅ `src/utils/capacitorCamera.ts` - Utility untuk Capacitor Camera

## Yang Perlu Dilakukan

### 1. Update `src/pages/Attendance.tsx`

Ganti fungsi `openCamera` (sekitar line 196-222):

```typescript
const openCamera = async () => {
  try {
    // Check if running on native platform
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: 'Kamera Tidak Tersedia',
        description: 'Kamera hanya berfungsi di aplikasi mobile native',
        variant: 'destructive'
      });
      return;
    }

    // Refresh location before taking photo
    await getLocation();

    // Take photo using Capacitor Camera Plugin
    const photoDataUrl = await takePhoto();
    const photoBlob = dataUrlToBlob(photoDataUrl);
    
    setCapturedPhoto(photoBlob);
    setPhotoPreview(photoDataUrl);
    
    toast({
      title: 'Foto Berhasil',
      description: 'Foto berhasil diambil',
    });
  } catch (error: any) {
    console.error('Camera error:', error);
    toast({
      title: 'Gagal',
      description: error.message || 'Gagal mengambil foto',
      variant: 'destructive'
    });
  }
};
```

### 2. Hapus fungsi `handleCapturePhoto` (line 224-234)

Tidak perlu lagi karena foto langsung diambil di `openCamera`.

### 3. Hapus Dialog Kamera (sekitar line 663-719)

Hapus seluruh block:
```tsx
{/* Fullscreen Camera Modal - WhatsApp Style */}
<Dialog open={cameraOpen} onOpenChange={...}>
  ...
</Dialog>
```

### 4. Update tombol "Ambil Foto" (sekitar line 580-589)

Ganti:
```tsx
<div
  onClick={() => setCameraOpen(true)}  // HAPUS INI
  onClick={openCamera}  // GANTI JADI INI
  className="border-2 border-dashed..."
>
```

## Keuntungan Capacitor Camera Plugin

✅ Lebih stabil di Android WebView
✅ Native camera UI (seperti app kamera biasa)
✅ Auto-handle permissions
✅ Support image quality, orientation, dll
✅ Tidak perlu video stream (lebih ringan)

## Testing

1. Build APK baru
2. Install di HP
3. Buka Attendance
4. Klik "Mulai Ambil Foto"
5. ✅ Kamera native terbuka
6. ✅ Ambil foto
7. ✅ Foto muncul di preview

## Catatan

- Kamera hanya bekerja di **native app** (bukan browser)
- Di browser akan muncul pesan "Kamera hanya berfungsi di aplikasi mobile native"
- Untuk development di browser, bisa pakai mock/dummy image

---

**Status:** File utility sudah dibuat, tinggal update Attendance.tsx
