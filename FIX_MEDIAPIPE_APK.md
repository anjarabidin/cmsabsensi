# 🔧 FIX: MediaPipe di APK Android (Capacitor)

## Masalah

**Symptom**: 
- Di desktop browser: MediaPipe berfungsi normal ✅
- Di APK (GitHub Actions build): Stuck di "Kamera aktif", MediaPipe tidak pernah ready ❌

## Root Cause

MediaPipe menggunakan **WASM files** yang di-load dari CDN:
```typescript
const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);
```

### Kenapa Gagal di APK?

1. **WebView Android membatasi akses CDN eksternal**
2. **CORS policy** ketat di mobile WebView
3. **Network timeout** lebih pendek di WebView
4. **CDN latency** tinggi dari dalam APK

### Kenapa Berhasil di Desktop Browser?

- Browser modern tidak ada batasan CORS untuk CDN
- Network lebih stabil
- Developer tools aktif (bypass beberapa policy)

## Solusi ✅

### Bundling Local WASM Files

#### 1. Download WASM Files
```bash
public/
└── wasm/
    ├── vision_wasm_internal.js         (~500KB)
    ├── vision_wasm_internal.wasm       (~8.5MB)
    ├── vision_wasm_nosimd_internal.js  (~500KB)
    └── vision_wasm_nosimd_internal.wasm (~8.5MB)
```

**Total**: ~18MB WASM files

#### 2. Update Hook
```typescript
// BEFORE (CDN - Gagal di APK)
const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);

// AFTER (Local - Bundled di APK)
const vision = await FilesetResolver.forVisionTasks('/wasm');
```

### File yang Diubah

**`src/hooks/useMediaPipeFace.ts`**
- Line 48: CDN path → Local path `/wasm`

**`public/wasm/`** (NEW)
- 4 files WASM MediaPipe

## Cara Kerja

### Build Process
```
1. npm run build
   ↓
2. Vite copies public/ → dist/
   ↓
3. dist/wasm/ berisi WASM files
   ↓
4. npx cap sync android
   ↓
5. Capacitor copies dist/ → android/app/src/main/assets/public/
   ↓
6. APK includes /wasm files
```

### Runtime di APK
```
1. User open app
   ↓
2. Load page from file://android_asset/public/index.html
   ↓
3. MediaPipe init: FilesetResolver.forVisionTasks('/wasm')
   ↓
4. Load WASM from file://android_asset/public/wasm/
   ↓
5. ✅ Success! (No network required)
```

## Impact

### Bundle Size
| Component | Before | After | Difference |
|-----------|--------|-------|------------|
| Model (.task) | 3.7MB | 3.7MB | - |
| WASM files | 0MB (CDN) | 18MB | +18MB |
| **Total APK** | ~35MB | ~53MB | **+18MB** |

### Benefits
✅ **100% Offline** - Tidak perlu internet untuk init  
✅ **Instant Load** - Tidak download WASM, langsung dari disk  
✅ **Reliable** - Tidak ada network error  
✅ **Consistent** - Sama di semua device  

### Trade-offs
⚠️ **APK Size**: +18MB (acceptable untuk production app)  
⚠️ **Build Time**: Sedikit lebih lama (copy 18MB files)  

## Testing

### Desktop Browser
```bash
npm run dev
# Open http://localhost:8080/face-registration
# Should work (loads from public/wasm)
```

### APK
```bash
npm run build
npx cap sync android
# Build APK via GitHub Actions atau manual
# Install & test face registration
# Should work immediately (no CDN delay)
```

## Fallback Strategy

Jika file WASM tidak ditemukan, MediaPipe akan throw error:
```
❌ Failed to load vision_wasm_internal.wasm
```

### Debugging Steps
1. Check browser console (Chrome Remote Debugging)
2. Verify `/wasm/` files exist in APK
3. Check network tab (should be NO network calls for WASM)

## Alternative Solutions (NOT USED)

### 1. Dynamic WASM Download
```typescript
// Download WASM on first launch, cache locally
const wasmPath = await downloadAndCacheWASM();
```
❌ Kompleks, butuh storage permission

### 2. Capacitor Filesystem
```typescript
// Copy WASM to Capacitor.Filesystem
const vision = await FilesetResolver.forVisionTasks(
    Capacitor.convertFileSrc(localPath)
);
```
❌ Path conversion issues, tidak reliable

### 3. CDN with Retry
```typescript
// Retry CDN multiple times
for (let i = 0; i < 3; i++) {
    try {
        await FilesetResolver.forVisionTasks(CDN_URL);
        break;
    } catch {}
}
```
❌ Still network-dependent, slow

## Best Practice

### For Capacitor Apps:
✅ **Bundle critical assets locally** (models, WASM)
✅ **Use public/ folder** for static assets
✅ **Avoid CDN dependencies** for core features
✅ **Test on real device** early

### For Web Apps:
✅ **Use CDN** for automatic updates
✅ **Service Worker caching** for offline
✅ **Lazy load** non-critical assets

## Verification Checklist

Build APK dan verify:
- [x] `/wasm/vision_wasm_internal.wasm` exists in APK
- [x] MediaPipe init berhasil tanpa network
- [x] Face detection berfungsi
- [x] Blink detection berfungsi
- [x] No console errors
- [x] Loading time <3 seconds

## Version Info

- **MediaPipe Tasks Vision**: 0.10.14
- **WASM Files**: vision_wasm_internal (SIMD + non-SIMD)
- **Model**: face_landmarker.task (3.7MB)

## Future Improvements

1. **Lazy Load WASM**: Only download when needed
2. **Compress WASM**: Use Brotli compression
3. **Progressive Loading**: Load SIMD first, fallback to non-SIMD
4. **CDN Fallback**: Try local first, CDN if fails

---

**Status**: ✅ **FIXED & DEPLOYED**
**Impact**: Critical - Enables face recognition in APK
**APK Size Impact**: +18MB (acceptable trade-off)
