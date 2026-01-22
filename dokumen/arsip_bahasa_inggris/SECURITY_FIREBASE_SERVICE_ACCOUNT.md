# ⚠️ SECURITY WARNING - Firebase Service Account

## NEVER COMMIT THESE FILES TO GIT!

The following files contain **private keys** that give full access to your Firebase project:

- `*firebase-adminsdk*.json`
- `*service-account*.json`
- Any JSON file downloaded from Firebase Console → Service Accounts

## Why is this dangerous?

If someone gets your Service Account JSON file, they can:
- ✅ Send push notifications to all users
- ✅ Read/write Firebase Realtime Database
- ✅ Access Cloud Storage
- ✅ Manage Firebase Authentication
- ✅ **Full admin access to your Firebase project**

## What to do if you accidentally committed it:

### 1. **Immediately revoke the key**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Project Settings → Service Accounts
3. Click "Manage service account permissions"
4. Find the compromised service account
5. Delete it or generate a new key

### 2. **Remove from Git history**
```bash
# Remove file from Git history (use with caution!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch *firebase-adminsdk*.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: This rewrites history!)
git push origin --force --all
```

### 3. **Generate new Service Account**
1. Firebase Console → Service Accounts
2. Generate new private key
3. Update Supabase Edge Function secret
4. Test push notifications

## Proper way to use Service Account:

### ✅ DO:
- Store in Supabase Edge Functions **Secrets** (encrypted)
- Store in environment variables (never in code)
- Add to `.gitignore`
- Keep file locally in secure location
- Use different keys for dev/staging/production

### ❌ DON'T:
- Commit to Git (public or private repos)
- Share via email/Slack/Discord
- Hardcode in source code
- Store in frontend code
- Upload to public cloud storage

## Current Protection:

✅ `.gitignore` already configured to ignore:
```
*firebase-adminsdk*.json
*service-account*.json
firebase-service-account.json
```

✅ Service Account should ONLY exist in:
1. Your local machine (secure location)
2. Supabase Edge Functions Secrets (encrypted)

## Checklist:

- [ ] Service Account JSON downloaded and saved securely
- [ ] File added to `.gitignore`
- [ ] Secret configured in Supabase Edge Functions
- [ ] Original file deleted from project directory
- [ ] Verified file is NOT in Git history: `git log --all --full-history -- "*firebase-adminsdk*.json"`

## Need help?

If you suspect your Service Account has been compromised:
1. **Immediately** revoke the key in Firebase Console
2. Generate a new key
3. Update all services using the old key
4. Monitor Firebase usage for suspicious activity

---

**Remember:** Treat Service Account JSON like a password. Never share it, never commit it! 🔒
