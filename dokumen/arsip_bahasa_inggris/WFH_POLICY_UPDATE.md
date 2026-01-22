# Update: Kebijakan WFH yang Fleksibel

## Perubahan Terbaru (11 Jan 2026)

Berdasarkan feedback, **validasi lokasi untuk mode WFH telah disederhanakan**:

### ❌ Sebelumnya (Strict):
- WFH harus dari lokasi rumah yang terdaftar
- Validasi radius 100m dari koordinat rumah
- Perlu setup koordinat rumah di database

### ✅ Sekarang (Flexible):
- **WFH bisa dari mana saja** (rumah, kafe, co-working space, dll)
- Hanya validasi **Fake GPS** untuk mencegah manipulasi
- Tidak perlu setup koordinat rumah

---

## Validasi Berdasarkan Work Mode

| Work Mode | Validasi Lokasi | Validasi Fake GPS | Keterangan |
|-----------|----------------|-------------------|------------|
| **WFO** (Work From Office) | ✅ Ya (Radius kantor) | ✅ Ya | Harus di dalam radius kantor yang dipilih |
| **WFH** (Work From Home) | ❌ Tidak | ✅ Ya | Bebas dari mana saja, asal GPS asli |
| **Field** (Dinas Luar) | ❌ Tidak | ✅ Ya | Bebas dari mana saja, asal GPS asli |

---

## Implikasi Perubahan

### Database
- Kolom `home_latitude` dan `home_longitude` di tabel `profiles` **tidak wajib diisi**
- Kolom tersebut bisa digunakan untuk keperluan lain (misal: data alamat saja)

### UI/UX
- Peta tidak menampilkan marker/radius rumah untuk mode WFH
- Pesan error lebih sederhana: hanya "Fake GPS Terdeteksi" jika ada manipulasi

### Keamanan
- Tetap aman karena **Fake GPS detection** tetap aktif
- Sistem tetap mencatat koordinat GPS asli karyawan untuk audit trail
- Admin/Manager bisa cek lokasi absensi di Team Map

---

## Kode yang Diubah

**File:** `src/pages/Attendance.tsx`

```tsx
// Validasi WFH - Simplified
else if (workMode === 'wfh') {
  // For WFH, only check if GPS is mocked (allow work from anywhere)
  if (isMocked) {
    setIsLocationValid(false);
    setLocationErrorMsg("Fake GPS Terdeteksi! Mohon gunakan lokasi asli.");
  } else {
    setIsLocationValid(true);
    setLocationErrorMsg(null);
  }
}
```

---

## Rekomendasi

Meskipun WFH sekarang fleksibel, tetap disarankan untuk:

1. **Monitoring**: Admin/Manager tetap bisa pantau lokasi absensi via Team Map
2. **Kebijakan Perusahaan**: Buat aturan internal tentang WFH (misal: harus dari tempat yang kondusif)
3. **Audit Trail**: Semua koordinat GPS tetap tercatat di database untuk keperluan audit

---

## FAQ

**Q: Apakah karyawan bisa WFH dari luar kota?**  
A: Ya, sistem tidak membatasi. Kebijakan ini diserahkan ke manajemen perusahaan.

**Q: Bagaimana mencegah penyalahgunaan?**  
A: Sistem tetap mencatat GPS asli dan mencegah Fake GPS. Manager bisa monitoring via Team Map.

**Q: Apakah perlu hapus kolom home_latitude/longitude?**  
A: Tidak perlu. Kolom tersebut bisa tetap ada untuk keperluan data alamat atau fitur masa depan.

---

Perubahan ini memberikan **fleksibilitas maksimal** untuk karyawan WFH sambil tetap menjaga **integritas data** melalui Fake GPS detection. 🎯
