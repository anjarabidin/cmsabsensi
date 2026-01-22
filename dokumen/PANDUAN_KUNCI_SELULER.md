# 🔒 SISTEM KUNCI TATA LETAK SELULER (MOBILE LOCK SYSTEM)

**Dibuat:** 20 Januari 2026 15:56 WIB  
**Status:** ✅ AKTIF

---

## 🎯 **Tujuan**

Sistem ini **MELINDUNGI tampilan seluler (mobile)** dari perubahan yang Anda lakukan pada tampilan desktop/situs web.

**Mengapa ini penting:**
- Tampilan seluler sudah optimal dan menarik
- Tampilan desktop masih memerlukan banyak penyesuaian
- Anda bisa memperbarui desktop secara BEBAS tanpa merusak tampilan seluler

---

## 📁 **Berkas yang Dibuat**

### 1. **`src/hooks/useIsMobile.ts`** 
Hook untuk mendeteksi perangkat seluler

```tsx
import { useIsMobile } from '@/hooks/useIsMobile';

function MyComponent() {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    // Render tata letak seluler (TERKUNCI)
  } else {
    // Render tata letak desktop (DAPAT DIEDIT)
  }
}
```

### 2. **`src/styles/mobile-locked.css`**
Kelas-kelas CSS yang **TERKUNCI untuk seluler**

**⚠️ JANGAN DISENTUH:** Kelas tanpa awalan `md:`, `lg:`, `xl:`  
**✅ AMAN DIEDIT:** Kelas dengan awalan `md:`, `lg:`, `xl:`

### 3. **`src/index.css`** (Dimodifikasi)
Impor mobile-locked.css - **JANGAN HAPUS IMPOR INI!**

---

## 🔐 **Cara Kerjanya**

### **Seluler (< 768px):**
```css
/* TERKUNCI (LOCKED) - Tidak terpengaruh perubahan desktop */
.mobile-locked-container { /* ... */ }
.mobile-locked-card { /* ... */ }
.mobile-locked-btn-primary { /* ... */ }
```

### **Desktop (≥ 768px):**
```css
/* DAPAT DIEDIT (EDITABLE) - Bebas diubah sesuka hati */
@media (min-width: 768px) {
  .desktop-container { /* Ubah apa saja */ }
  .desktop-card { /* Bebas */ }
}
```

---

## ✅ **AMAN DIEDIT (Desktop)**

Anda **AMAN** untuk mengubah:

1. **Kelas Tailwind dengan breakpoint:**
   ```tsx
   className="md:w-1/2 lg:w-1/3 xl:w-1/4"  // ✅ AMAN
   className="md:p-8 lg:p-12"               // ✅ AMAN
   ```

2. **CSS khusus dalam media query:**
   ```css
   @media (min-width: 768px) {
     /* Apapun di sini AMAN */ /* ✅ AMAN */
   }
   ```

3. **Komponen khusus desktop:**
   ```tsx
   <div className="hidden md:block">
     {/* Tampilan Desktop - Bebas edit */}
   </div>
   ```

---

## ⚠️ **JANGAN DISENTUH (Seluler Dilindungi)**

**JANGAN** ubah:

1. **Kelas dasar (tanpa breakpoint):**
   ```tsx
   className="w-full p-4 rounded-2xl"  // ❌ TERKUNCI
   ```

2. **Kelas terkunci seluler (Mobile-locked classes):**
   ```tsx
   className="mobile-locked-card"      // ❌ TERKUNCI
   className="mobile-locked-btn-primary"  // ❌ TERKUNCI
   ```

3. **Kelas di dalam media query (max-width):**
   ```css
   @media (max-width: 767px) {
     /* Jangan ubah apapun di sini */ /* ❌ TERKUNCI */
   }
   ```

---

## 📱 **Breakpoint**

```tsx
Seluler:  < 768px   (TERKUNCI - Dilindungi)
Tablet:   768px+    (DAPAT DIEDIT)
Desktop:  1024px+   (DAPAT DIEDIT)
Lebar:    1280px+   (DAPAT DIEDIT)
```

---

## 🎨 **Contoh Penggunaan**

### **Contoh 1: Rendering Kondisional**

```tsx
import { useIsMobile } from '@/hooks/useIsMobile';

function MyPage() {
  const isMobile = useIsMobile();

  return (
    <div>
      {isMobile ? (
        /* Tata Letak Seluler - TERKUNCI */
        <div className="mobile-locked-container">
          <h1 className="mobile-locked-title">Judul Seluler</h1>
        </div>
      ) : (
        /* Tata Letak Desktop - DAPAT DIEDIT */
        <div className="desktop-container max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold">Kustomisasi saya!</h1>
        </div>
      )}
    </div>
  );
}
```

### **Contoh 2: Responsif dengan Tailwind**

```tsx
function Card() {
  return (
    /* Dasar seluler (TERKUNCI) + Override Desktop (DAPAT DIEDIT) */
    <div className="
      w-full               
      p-4                  
      rounded-2xl          
      md:w-1/2             
      md:p-8               
      lg:w-1/3             
      xl:rounded-3xl       
    ">
      Konten di sini
    </div>
  );
}
```

### **Contoh 3: Menggunakan Kelas Terkunci**

```tsx
function AttendanceCard() {
  return (
    <div className="mobile-locked-card md:shadow-2xl lg:max-w-2xl">
      {/* Seluler: menggunakan gaya mobile-locked-card */}
      {/* Desktop: menambahkan shadow-2xl dan max-w-2xl */}
      
      <button className="mobile-locked-btn-primary md:w-auto lg:px-12">
        {/* Seluler: Tombol lebar penuh */}
        {/* Desktop: Lebar otomatis dengan padding ekstra */}
        Kirim
      </button>
    </div>
  );
}
```

---

## 🚀 **Pengujian**

### **Uji Proteksi Seluler:**

1. Buka DevTools (F12)
2. Aktifkan Toolbar Perangkat (Ctrl+Shift+M)
3. Pilih "iPhone 12 Pro" atau yang serupa
4. Tata letak harus terlihat SEMPURNA
5. Sekarang edit CSS desktop
6. Refresh tampilan seluler
7. **Seluler TIDAK BOLEH berubah!** ✅

### **Uji Kebebasan Desktop:**

1. Tampilan Desktop (> 768px)
2. Edit kelas `md:`, `lg:`, `xl:` apa saja
3. Seluler **TIDAK BOLEH terpengaruh**
4. Desktop **HARUS berubah** ✅

---

## 📋 **Tersedia Kelas Terkunci**

### **Kontainer:**
- `mobile-locked-container`
- `mobile-locked-card`
- `mobile-locked-padding`
- `mobile-locked-section-gap`

### **Navigasi:**
- `mobile-locked-nav`
- `mobile-locked-header`
- `mobile-locked-header-content`

### **Tombol:**
- `mobile-locked-btn-primary`
- `mobile-locked-btn-secondary`

### **Formulir:**
- `mobile-locked-input`
- `mobile-locked-label`

### **Overlay:**
- `mobile-locked-modal`
- `mobile-locked-modal-content`
- `mobile-locked-camera`
- `mobile-locked-camera-video`

### **Tipografi:**
- `mobile-locked-title`
- `mobile-locked-subtitle`
- `mobile-locked-body`

### **Utilitas:**
- `mobile-hidden` (sembunyikan di seluler)
- `desktop-hidden` (sembunyikan di desktop)
- `responsive-padding`
- `responsive-text-xs/sm/base/lg/xl`

---

## 🛡️ **Paksa Tata Letak Seluler (Darurat)**

Jika ada masalah, gunakan kelas ini pada elemen root:

```tsx
<div className="force-mobile-layout">
  {/* Ini akan MEMAKSA tata letak seluler pada perangkat seluler */}
  {/* Gunakan HANYA jika ada yang rusak */}
</div>
```

---

## ⚡ **Perintah Cepat**

### **Tambahkan konten khusus seluler:**
```tsx
<div className="desktop-hidden">
  Hanya seluler
</div>
```

### **Tambahkan konten khusus desktop:**
```tsx
<div className="mobile-hidden">
  Hanya Desktop
</div>
```

### **Konten hibrida:**
```tsx
<h1 className="text-xl md:text-3xl lg:text-5xl">
  {/* Seluler: text-xl */}
  {/* Tablet: text-3xl */}
  {/* Desktop: text-5xl */}
  Judul Responsif
</h1>
```

---

## 🔄 **Rollback**

Jika ingin menonaktifkan perlindungan:

1. **Hapus impor:**
   ```css
   /* Di src/index.css - COMMENT OUT: */
   /* @import './styles/mobile-locked.css'; */
   ```

2. **Hapus berkas:**
   - `src/hooks/useIsMobile.ts`
   - `src/styles/mobile-locked.css`

3. **Mulai ulang server dev:**
   ```bash
   npm run dev
   ```

---

## 📝 **Ringkasan Aturan**

### ✅ **LAKUKAN:**
- Edit apa saja dengan awalan `md:`, `lg:`, `xl:`
- Tambahkan komponen baru khusus desktop
- Ubah tata letak desktop dengan bebas
- Uji di seluler setelah perubahan desktop

### ❌ **JANGAN:**
- Edit kelas dasar (tanpa breakpoint) 
- Sentuh kelas `mobile-locked-*`
- Modifikasi CSS di dalam `@media (max-width: 767px)`
- Hapus impor mobile-locked.css

---

## 🎯 **Tujuan Tercapai**

✅ Tata letak seluler DILINDUNGI  
✅ Tata letak desktop DAPAT DIEDIT  
✅ Tidak ada perubahan yang merusak saat memperbarui desktop  
✅ Mudah digunakan dan dipelihara  
✅ Terdokumentasi dengan baik  

---

**Status:** 🟢 **AKTIF & MELINDUNGI**  
**Terakhir Diperbarui:** 20 Januari 2026 15:56 WIB  
**Dipelihara Oleh:** Asisten AI Antigravity
