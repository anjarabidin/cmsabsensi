# 🚀 Deployment Guide - Render.com (FREE)

Panduan deploy Python Face Recognition Service ke Render.com - **100% GRATIS** (750 jam/bulan).

---

## 📋 Prerequisites

- ✅ Akun GitHub (sudah ada)
- ✅ Code sudah di-push ke GitHub (sudah)
- ✅ Akun Supabase (sudah ada)
- [ ] Akun Render.com (gratis, buat sekarang)

---

## PART 1: Deploy Python Service ke Render.com

### Step 1: Buat Akun Render

1. Go to **https://render.com**
2. Click **"Get Started"**
3. **Sign up with GitHub** (recommended - auto-connect repo)
4. Authorize Render to access GitHub repositories

### Step 2: Create New Web Service

1. Dari Render Dashboard, click **"New +"** → **"Web Service"**

2. **Connect Repository:**
   - Click **"Connect a repository"**
   - Pilih repository: **`anjarfc27-png/cmsabsensi`**
   - Click **"Connect"**

3. **Configure Service:**

   **Nama:**
   ```
   face-recognition-service
   ```

   **Root Directory:**
   ```
   python-face-service
   ```

   **Environment:**
   ```
   Docker
   ```

   **Region:**
   ```
   Singapore (Southeast Asia)
   ```
   *(Paling dekat dengan Indonesia)*

   **Instance Type:**
   ```
   Free
   ```

4. **Advanced Settings (Expand):**

   **Auto-Deploy:**
   - ✅ Enabled (auto-deploy saat push ke GitHub)

   **Health Check Path:**
   ```
   /health
   ```

5. Click **"Create Web Service"**

### Step 3: Tunggu Build & Deploy

- Build akan memakan waktu **~5-10 menit** (first time)
- Monitor progress di tab **"Logs"**
- Status akan berubah dari **"Building"** → **"Live"** ✅

### Step 4: Get Service URL

Setelah deploy sukses:

1. Copy URL service (akan muncul di atas)
   - Format: `https://face-recognition-service-XXXX.onrender.com`
   
2. **TEST SERVICE:**
   - Buka URL: `https://face-recognition-service-XXXX.onrender.com/health`
   
   **Expected Response:**
   ```json
   {
     "status": "healthy",
     "service": "face-recognition",
     "version": "1.0.0"
   }
   ```

✅ **Python service DONE!**

---

## PART 2: Deploy Supabase Edge Function

### Step 1: Install Supabase CLI

**Windows (PowerShell):**
```powershell
npm install -g supabase
```

**Verify installation:**
```bash
supabase --version
```

### Step 2: Login ke Supabase

```bash
supabase login
```

- Browser akan terbuka
- Login dengan akun Supabase Anda
- Authorize CLI access

### Step 3: Link ke Project

```bash
cd d:\absensi-ceria
supabase link
```

**Pilih project Anda dari list yang muncul.**

Atau, jika tahu project ref:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

*Cara cek project ref:*
- Supabase Dashboard → Settings → API
- Project URL: `https://XXXX.supabase.co`
- `XXXX` = project ref

### Step 4: Set Environment Variable

**Di Supabase Dashboard:**

1. Go to **Edge Functions** (sidebar)
2. Click **"Manage secrets"** atau **"Environment variables"**
3. Add new secret:
   - **Key:** `PYTHON_FACE_SERVICE_URL`
   - **Value:** `https://face-recognition-service-XXXX.onrender.com` (dari Render step 4)
   - ⚠️ **JANGAN ada trailing slash!** ❌ `...com/`
4. Click **"Save"**

### Step 5: Deploy Edge Function

```bash
supabase functions deploy face-recognition
```

**Output yang diharapkan:**
```
Deploying function face-recognition...
Function URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/face-recognition
Deployed successfully!
```

### Step 6: Test Edge Function

**Gunakan curl atau Postman:**

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/face-recognition \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enroll",
    "image": "data:image/jpeg;base64,/9j/..."
  }'
```

*Cara dapat ANON_KEY:*
- Supabase Dashboard → Settings → API
- Copy "anon" key (public key)

**Expected Response:**
```json
{
  "success": true,
  "encoding": [0.123, 0.456, ...],
  "message": "Face enrolled successfully"
}
```

✅ **Edge Function DONE!**

---

## PART 3: Update Frontend (Opsional - Untuk Switch ke Python)

Jika mau langsung pakai Python backend, update komponen registrasi:

### Option A: Update SimpleFaceRegistration.tsx

Replace import di line 11:
```typescript
// OLD - JavaScript face detection
import { useFaceRecognition } from '@/hooks/useFaceRecognition';

// NEW - Python backend
import { usePythonFaceRecognition } from '@/hooks/usePythonFaceRecognition';
```

Lalu ganti logic enrollmentnya.

### Option B: Buat Component Baru (Recommended)

Biarkan yang lama, buat component baru `PythonFaceRegistration.tsx` untuk testing dulu.

---

## PART 4: Testing End-to-End

### Test 1: Python Service Health Check

```bash
curl https://face-recognition-service-XXXX.onrender.com/health
```

Expected: `{"status": "healthy"}`

### Test 2: Direct Python Service (Bypass Edge Function)

```bash
curl -X POST https://face-recognition-service-XXXX.onrender.com/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
  }'
```

### Test 3: Via Edge Function (Full Flow)

Dari aplikasi web/mobile:
1. Login
2. Go to Face Registration
3. Ambil foto
4. Check browser console (F12) untuk logs

---

## ⚠️ IMPORTANT: Render.com Free Tier Limitations

### Auto-Sleep Behavior:
- Service akan **sleep** setelah **15 menit** tanpa request
- **Cold start** ~20-30 detik saat bangun dari sleep
- ✅ **Normal** untuk free tier

### Solutions:

**1. Accept Cold Start (Recommended untuk Free):**
- User tunggu 30 detik pertama kali absen setiap hari
- Setelah itu lancar selama masih ada activity

**2. Keep-Alive Ping (Manual):**
Setup cron job untuk ping service setiap 10 menit:
```bash
# Dari aplikasi lain atau PC yang always-on
*/10 * * * * curl https://your-service.onrender.com/health
```

**3. Upgrade ke Paid ($7/month):**
- No sleep
- Instant response
- Worth it jika serious production

---

## 📊 Monitoring & Logs

### Render Dashboard:
- Services → face-recognition-service
- Tab **"Logs"** - Real-time logs
- Tab **"Metrics"** - Resource usage
- Tab **"Events"** - Deploy history

### Supabase Dashboard:
- Edge Functions → face-recognition
- **Logs tab** - Invocation logs
- **Metrics** - Request count, errors

---

## 🐛 Troubleshooting

### Issue: "Service Unavailable" atau 503

**Cause:** Service sedang sleep (cold start)

**Solution:** 
- Tunggu 30 detik, refresh
- First request hari itu akan lambat, subsequent requests fast

---

### Issue: Edge Function timeout

**Cause:** Python service sleep + cold start > 10 detik

**Solution:**
Tambahkan retry logic di frontend:
```typescript
const enrollWithRetry = async (image: Blob, maxRetries = 2) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await enrollFace(image);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
    }
  }
};
```

---

### Issue: Build Failed di Render

**Check Logs:**
1. Render Dashboard → Logs
2. Cari error message

**Common fixes:**
- Pastikan `Dockerfile` ada di `python-face-service/`
- Pastikan `requirements.txt` valid
- Check typo di file names

---

## ✅ Checklist Deployment

- [ ] Render service deployed & running
- [ ] Health check endpoint working (`/health`)
- [ ] Render service URL copied
- [ ] Supabase CLI installed
- [ ] Supabase project linked
- [ ] Environment variable `PYTHON_FACE_SERVICE_URL` set di Supabase
- [ ] Edge function deployed
- [ ] Edge function tested dengan curl
- [ ] Frontend tested (optional)

---

## 🎯 Next Steps

Setelah semua checklist ✅:

1. **Test di aplikasi:**
   - Build APK baru dengan code terbaru
   - Test face registration
   - Test face verification saat absen

2. **Monitor performance:**
   - Check accuracy rate
   - Monitor cold start frequency
   - Adjust threshold jika perlu

3. **Production considerations:**
   - Jika traffic tinggi → Upgrade Render ke paid
   - Jika butuh instant response → Pakai Google Cloud Run
   - Backup plan: Keep JavaScript fallback

---

## 💰 Cost Summary

| Service | Plan | Cost |
|---------|------|------|
| Render.com | Free (750 hrs) | **$0** |
| Supabase Edge Functions | Unlimited (Community) | **$0** |
| **TOTAL** | | **$0/month** ✅ |

---

## 🚀 Ready to Deploy!

Ikuti step by step dari **PART 1** sampai selesai. 

**Estimated time:** 20-30 menit total.

Jika ada masalah, screenshot error dan tanya! 😊
