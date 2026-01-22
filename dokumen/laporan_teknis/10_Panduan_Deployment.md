# 🚀 Deployment Guide - Python Face Recognition

Panduan lengkap deploy Python Face Recognition Service untuk production.

## Overview

Sistem ini terdiri dari 3 komponen:
1. **Frontend** (React + Capacitor) - Sudah running
2. **Supabase Edge Function** - Proxy/Gateway dengan JWT auth
3. **Python Face Service** - Core face recognition processing

## 📋 Prerequisites

- [x] Akun Supabase (sudah ada)
- [ ] Akun Railway.app / Render.com / Google Cloud (pilih salah satu)
- [ ] Supabase CLI (`npm install -g supabase`)
- [ ] Git repository (sudah ada)

---

## 🐍 STEP 1: Deploy Python Service

### Option A: Railway (RECOMMENDED - Paling Mudah)

1. **Login ke Railway:**
   - Go to https://railway.app
   - Sign in with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Pilih repository `anjarfc27-png/cmsabsensi`
   - Railway akan auto-detect Dockerfile

3. **Configure Service:**
   - Root Directory: `python-face-service`
   - Railway akan auto-build dan deploy
   
4. **Get Service URL:**
   - Setelah deploy sukses, copy URL (e.g., `https://face-service-production.up.railway.app`)
   - **SAVE URL INI**, butuh untuk step selanjutnya

5. **Test Service:**
   ```bash
   curl https://YOUR-RAILWAY-URL.railway.app/health
   ```
   
   Response harus:
   ```json
   {
     "status": "healthy",
     "service": "face-recognition",
     "version": "1.0.0"
   }
   ```

### Option B: Render.com

1. Go to https://render.com
2. "New Web Service"
3. Connect GitHub repo
4. Settings:
   - Name: `face-recognition-service`
   - Root Directory: `python-face-service`
   - Environment: `Docker`
   - Plan: Free
5. Click "Create Web Service"
6. Copy service URL

### Option C: Google Cloud Run (Advanced)

```bash
cd python-face-service

# Build & push
gcloud builds submit --tag gcr.io/PROJECT_ID/face-recognition

# Deploy
gcloud run deploy face-recognition \
  --image gcr.io/PROJECT_ID/face-recognition \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1
```

---

## ☁️ STEP 2: Deploy Supabase Edge Function

### 1. Install Supabase CLI (jika belum)

```bash
npm install -g supabase
```

### 2. Login ke Supabase

```bash
supabase login
```

### 3. Link Project

```bash
cd d:\absensi-ceria
supabase link --project-ref YOUR_PROJECT_REF
```

Cari `YOUR_PROJECT_REF` di Supabase Dashboard → Settings → API → Project URL.
Contoh: jika URL-nya `https://abcdefgh.supabase.co`, maka ref-nya `abcdefgh`

### 4. Set Environment Variable

Di Supabase Dashboard:
- Go to **Edge Functions** → **Settings**
- Add secret:
  - Key: `PYTHON_FACE_SERVICE_URL`
  - Value: `https://YOUR-RAILWAY-URL.railway.app` (dari step 1)

### 5. Deploy Edge Function

```bash
supabase functions deploy face-recognition
```

### 6. Test Edge Function

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/face-recognition \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enroll",
    "image": "data:image/jpeg;base64,/9j/..."
  }'
```

---

## 💻 STEP 3: Update Frontend Configuration

File sudah siap, tidak perlu edit apapun! Frontend akan otomatis call ke Supabase Edge Function.

---

## ✅ STEP 4: Testing End-to-End

### Test 1: Face Registration

1. Buka aplikasi (browser atau APK)
2. Login
3. Go to **Profile** → **Registrasi Wajah**
4. Ambil foto
5. **Check Console (F12)** - Harusnya muncul:
   ```
   ✅ Face enrolled successfully
   Encoding saved to database
   ```

### Test 2: Face Verification

1. Go to **Quick Attendance**
2. Click **Buka Kamera**
3. Sistem akan auto-verify wajah
4. Harusnya muncul confidence score (85%+)

---

## 🐛 Troubleshooting

### Python Service tidak running

**Check logs di Railway:**
- Railway Dashboard → Service → Logs
- Cari error message

**Common issues:**
- Memory limit: Upgrade ke paid plan atau reduce workers
- Build fail: Check Dockerfile syntax

### Edge Function error: "fetch failed"

**Causes:**
1. Python service URL salah
   - Check environment variable `PYTHON_FACE_SERVICE_URL`
   - Pastikan tidak ada trailing slash: ✅ `https://abc.railway.app` ❌ `https://abc.railway.app/`

2. Python service tidak allow CORS
   - Sudah di-handle di `app.py` (flask-cors)

3. Railway service sleep (free tier)
   - First request akan lambat (cold start ~10-15 detik)
   - Solution: Upgrade ke paid plan ($5/month)

### Face tidak terdeteksi

**Causes:**
1. Foto terlalu gelap → Tambah lighting
2. Wajah terlalu kecil → Zoom in
3. Multiple faces → Pastikan hanya 1 wajah

---

## 📊 Monitoring & Maintenance

### Railway Dashboard
- Monitor resource usage
- Check logs real-time
- Set up alerts

### Supabase Dashboard
- Edge Functions → Logs
- Check invocation count
- Monitor errors

---

## 💰 Cost Estimation

### FREE Tier (Development/MVP):
- Railway: 500 hours/month FREE
- Supabase: Unlimited Edge Function invocations (Community plan)
- **Total: $0/month**

### Production (Recommended):
- Railway Hobby: $5/month
- Supabase Pro: $25/month (optional, untuk unlimited everything)
- **Total: $5-30/month**

---

## 🎯 Next Steps

Setelah semua deploy:

1. ✅ Update mobile app untuk rebuild dengan kode terbaru
2. ✅ Test thoroughly di production
3. ✅ Monitor performance & accuracy
4. ✅ Adjust `FACE_MATCH_THRESHOLD` jika perlu (di `app.py`)

---

## 📞 Support

Jika ada masalah saat deployment, screenshot error logs dan tanya ke saya! 🚀
