# Face Recognition Implementation Plan

## Overview
Implementasi face recognition untuk semua absensi menggunakan face-api.js untuk:
- Face detection real-time
- Face matching dengan database
- Liveness detection (anti-spoofing)
- Mirror video stream untuk UX yang baik

## Architecture

### 1. Face Registration Flow
```
User → Profile → Face Registration
  → Camera opens (video stream with mirror)
  → Detect face
  → Capture multiple angles (front, left, right)
  → Generate face descriptors
  → Save to database (face_encodings table)
```

### 2. Attendance Flow with Face Recognition
```
User → Attendance/QuickAttendance
  → Camera opens (video stream with mirror)
  → Real-time face detection
  → Match against registered face
  → If match > 0.6 threshold → Allow attendance
  → If no match → Show error
  → Capture photo + location
  → Submit attendance
```

## Database Schema

### face_encodings table (already exists)
```sql
- id: uuid
- user_id: uuid (FK to users)
- encoding: jsonb (face descriptor array)
- created_at: timestamp
```

## Components to Create/Update

### 1. useFaceRecognition Hook
**File:** `src/hooks/useFaceRecognition.ts`
**Purpose:** Handle face-api.js initialization and face detection

**Functions:**
- `loadModels()` - Load face-api.js models
- `detectFace(video)` - Detect face in video stream
- `getFaceDescriptor(video)` - Get face encoding
- `compareFaces(descriptor1, descriptor2)` - Compare similarity
- `isFaceInFrame(video)` - Check if face detected

### 2. Enhanced useCamera Hook
**File:** `src/hooks/useCamera.ts` (UPDATE)
**Changes:**
- Add CSS transform for mirror effect on video element
- Better error handling for Android WebView
- Retry mechanism
- Video ready state check

### 3. FaceRegistration Component (UPDATE)
**File:** `src/pages/FaceRegistration.tsx`
**Changes:**
- Use useFaceRecognition hook
- Guide user to capture multiple angles
- Show face detection overlay
- Save face descriptors to database

### 4. Attendance Pages (UPDATE)
**Files:** 
- `src/pages/Attendance.tsx`
- `src/pages/QuickAttendance.tsx`

**Changes:**
- Add face recognition before allowing attendance
- Show real-time face detection feedback
- Match face with database
- Show match confidence score

## Implementation Steps

### Phase 1: Setup & Models (30 min)
- [x] Install face-api.js
- [ ] Download face-api.js models to `public/models/`
- [ ] Create useFaceRecognition hook
- [ ] Test model loading

### Phase 2: Fix Video Stream (30 min)
- [ ] Update useCamera.ts with mirror CSS
- [ ] Add retry mechanism for Android
- [ ] Better error handling
- [ ] Test on browser & Android

### Phase 3: Face Registration (1 hour)
- [ ] Update FaceRegistration.tsx
- [ ] Add face detection overlay
- [ ] Capture multiple angles
- [ ] Save to database
- [ ] Test registration flow

### Phase 4: Attendance Integration (1 hour)
- [ ] Update Attendance.tsx
- [ ] Add real-time face matching
- [ ] Show match feedback
- [ ] Handle no-match scenario
- [ ] Update QuickAttendance.tsx

### Phase 5: Testing & Polish (30 min)
- [ ] Test full flow
- [ ] Handle edge cases
- [ ] Performance optimization
- [ ] Documentation

## Models Required

Download from: https://github.com/justadudewhohacks/face-api.js-models

**Required models:**
1. `tiny_face_detector_model-weights_manifest.json` (lightweight, fast)
2. `face_landmark_68_model-weights_manifest.json` (face landmarks)
3. `face_recognition_model-weights_manifest.json` (face descriptors)

**Place in:** `public/models/`

## Security Considerations

1. **Liveness Detection:**
   - Check for eye blink
   - Check for head movement
   - Random challenge (smile, turn head)

2. **Anti-Spoofing:**
   - Detect if image is from screen
   - Check for depth (if available)
   - Multiple angle verification

3. **Privacy:**
   - Face encodings stored as numbers (not images)
   - Encrypted in database
   - Can be deleted by user

## Performance

- **Model size:** ~6MB total
- **Detection speed:** ~100-200ms per frame
- **Matching speed:** ~10-20ms
- **Memory:** ~50MB

## Browser Compatibility

✅ Chrome/Edge (Desktop & Android)
✅ Safari (iOS 14.3+)
✅ Firefox
⚠️ Android WebView (needs testing)

## Next Steps

1. **Download models** - Manual download required
2. **Create useFaceRecognition hook**
3. **Update useCamera with mirror**
4. **Test on Android**

---

**Status:** Planning Complete
**Ready to implement:** Yes
**Estimated time:** 3-4 hours total
