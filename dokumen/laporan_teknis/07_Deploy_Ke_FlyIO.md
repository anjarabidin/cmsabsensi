# 🚀 Deployment Guide - Fly.io (100% FREE, No Credit Card)

Fly.io memberikan **3 shared-CPU VMs gratis** tanpa perlu kartu kredit sama sekali.

---

## Step 1: Install Fly CLI

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Verify:**
```bash
fly version
```

---

## Step 2: Sign Up & Auth

```bash
fly auth signup
```

- Buka browser → Sign up with **GitHub** (recommended)
- **TIDAK PERLU** kartu kredit! ✅
- Email verification → Done

```bash
fly auth login
```

---

## Step 3: Deploy Python Service

```bash
cd d:\absensi-ceria\python-face-service
```

**Create fly.toml:**
```bash
fly launch
```

**Configuration (Interactive):**
- **App name:** `face-recognition-service` (atau nama lain)
- **Region:** Singapore (sin)
- **Would you like to set up a Postgresql database?** → **No**
- **Would you like to set up an Upstash Redis database?** → **No**
- **Would you like to deploy now?** → **Yes**

Fly akan:
- Auto-detect Dockerfile ✅
- Build & push image
- Deploy ke cloud
- Generate URL: `https://face-recognition-service.fly.dev`

**Wait for deployment (~5-10 menit)**

---

## Step 4: Verify Deployment

```bash
fly status
```

**Test health endpoint:**
```bash
curl https://face-recognition-service.fly.dev/health
```

Expected:
```json
{
  "status": "healthy",
  "service": "face-recognition",
  "version": "1.0.0"
}
```

✅ **Service is LIVE!**

---

## Step 5: Scale (Optional - Keep FREE)

Pastikan hanya 1 instance (free tier):
```bash
fly scale count 1
```

Check resources:
```bash
fly scale show
```

---

## Step 6: Get Service URL

```bash
fly info
```

Copy **Hostname**: `face-recognition-service.fly.dev`

Full URL: `https://face-recognition-service.fly.dev`

---

## Step 7: Set di Supabase Edge Function

Di Supabase Dashboard:
- Edge Functions → Secrets
- Add:
  - Key: `PYTHON_FACE_SERVICE_URL`
  - Value: `https://face-recognition-service.fly.dev`

Deploy Edge Function:
```bash
cd d:\absensi-ceria
supabase functions deploy face-recognition
```

---

## ✅ DONE!

**Monitoring:**
```bash
# View logs
fly logs

# Check status
fly status

# Dashboard
fly dashboard
```

**Free Tier Limits:**
- 3 shared-CPU VMs (kami pakai 1 saja)
- 256MB RAM per VM (cukup untuk Python service)
- 160GB bandwidth/month
- Always-on, NO SLEEP ✅

---

## Troubleshooting

**Build fails:**
```bash
# Check logs
fly logs

# Rebuild
fly deploy --remote-only
```

**Service offline:**
```bash
fly status
fly restart
```

---

## Cost: $0/month ✅

Fly.io FREE tier permanent, tidak expire, tidak butuh upgrade.
