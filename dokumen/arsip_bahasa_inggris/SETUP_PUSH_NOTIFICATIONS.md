# Setup Native Push Notifications - SIMPLIFIED

## ⚠️ SKIP DATABASE SETTINGS SQL!

Jika Anda mendapat error `permission denied to set parameter`, **SKIP** langkah itu. Tidak perlu!

## 🚀 Setup Sederhana (3 Langkah)

### **Step 1: Set Firebase Service Account di Supabase**

1. **Download Service Account JSON** dari Firebase Console:
   - Firebase Console → ⚙️ Settings → Service Accounts
   - "Generate new private key"
   - Save file (di luar project folder!)

2. **Minify JSON:**
   - Buka https://codebeautify.org/jsonminifier
   - Paste JSON → Minify → Copy hasil

3. **Set di Supabase:**
   - Supabase Dashboard → Edge Functions → Secrets
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: (paste minified JSON)
   - Save

### **Step 2: Deploy Edge Function**

```bash
npx supabase functions deploy send-push-notification
```

### **Step 3: Run Migration (Optional)**

```bash
npx supabase db push
```

Atau manual di SQL Editor: run file `supabase/migrations/20260109210000_fcm_push_trigger.sql`

**DONE!** ✅

---

## 📱 Cara Kerja (Simplified)

```
User Login
   ↓
FCM Token Saved to fcm_tokens table
   ↓
Notification Created (via app)
   ↓
App calls Edge Function directly
   ↓
Edge Function sends FCM push
   ↓
📱 Push appears on phone!
```

**Tidak perlu database trigger!** Push notification dikirim langsung dari aplikasi.

---

## 🧪 Test Push Notification

### **Option 1: Via Application**

Buat notifikasi dari aplikasi (misalnya approve leave request), push akan otomatis terkirim.

### **Option 2: Manual Test via Edge Function**

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "USER_ID_HERE",
    "title": "Test Push",
    "body": "Hello from FCM!",
    "data": {}
  }'
```

**Cara mendapatkan ANON_KEY:**
- Supabase Dashboard → Project Settings → API
- Copy **anon** key (public)

---

## 🔧 Troubleshooting

### **Error "permission denied to set parameter"**
- ✅ **SKIP SQL itu!** Tidak perlu dijalankan
- Database settings tidak diperlukan untuk setup ini

### **Push tidak muncul di HP**

1. **Cek FCM token tersimpan:**
   ```sql
   SELECT * FROM fcm_tokens WHERE user_id = 'YOUR_USER_ID';
   ```
   Jika kosong, berarti app belum register FCM token.

2. **Cek Edge Function logs:**
   - Supabase Dashboard → Edge Functions → Logs
   - Lihat apakah ada error saat send push

3. **Cek permission di HP:**
   - Settings → Apps → [App Name] → Notifications → ✅ Enable

4. **Test manual FCM:**
   Gunakan curl di atas untuk test langsung ke Edge Function

### **Error "FIREBASE_SERVICE_ACCOUNT not configured"**
- Pastikan secret sudah di-set di Supabase Edge Functions
- Pastikan value-nya minified JSON (1 line, no newlines)
- Redeploy function: `npx supabase functions deploy send-push-notification`

---

## ✅ Checklist

- [ ] Download Service Account JSON dari Firebase
- [ ] Minify JSON (online tool)
- [ ] Set `FIREBASE_SERVICE_ACCOUNT` secret di Supabase
- [ ] Deploy Edge Function
- [ ] ~~Configure database settings~~ (SKIP!)
- [ ] Test push notification

---

## 📝 Files

- ✅ `supabase/functions/send-push-notification/index.ts` - Edge Function
- ✅ `supabase/migrations/20260109210000_fcm_push_trigger.sql` - Migration (simplified)
- ✅ `android/app/google-services.json` - Firebase config
- ✅ `.gitignore` - Protection for Service Account JSON

---

## 🎯 Summary

**Yang PERLU dilakukan:**
1. Set `FIREBASE_SERVICE_ACCOUNT` secret di Supabase
2. Deploy Edge Function
3. Test!

**Yang TIDAK PERLU:**
- ❌ Database settings SQL (skip jika error permission)
- ❌ Install jq atau tools lain
- ❌ Commit Service Account JSON ke Git

**Cara test:**
- Call Edge Function via curl atau
- Buat notifikasi dari aplikasi

---

**Status:** Ready to deploy! 🚀

Jika masih ada error, cek Edge Function logs di Supabase Dashboard.
