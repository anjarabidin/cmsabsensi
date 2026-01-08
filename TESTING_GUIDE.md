# 🧪 Testing Guide - Absensi + Payroll System
## Comprehensive Testing Checklist

**Version**: 3.0.0  
**Last Updated**: 6 Januari 2026  
**Status**: Ready for Testing

---

## 📋 Pre-Testing Setup

### 1. Apply Database Migrations

**PENTING**: Jalankan migrations berurutan di Supabase SQL Editor

```sql
-- Step 1: FASE 1 Migration (Compliance Features)
-- Copy-paste isi file: supabase/migrations/20260106042700_fase1_compliance_features.sql
-- Klik RUN

-- Step 2: FASE 2 Migration (Payroll Module)
-- Copy-paste isi file: supabase/migrations/20260106044200_fase2_payroll_module.sql
-- Klik RUN
```

**Verify Migrations:**
```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should include:
-- - leave_balances
-- - overtime_policies
-- - monthly_attendance_summary
-- - employee_salaries
-- - payroll_runs
-- - payroll_details
-- - payroll_adjustments
-- - ptkp_rates
```

### 2. Setup Test Data

**Create Test Users:**
```sql
-- Assign multiple roles untuk testing
-- Edit email sesuai user Anda
-- File: supabase/assign-multiple-roles.sql
```

**Initialize Leave Balance:**
```sql
-- Leave balance akan auto-create saat user pertama kali login
-- Atau manual insert:
INSERT INTO leave_balances (user_id, year, annual_quota, annual_remaining)
VALUES ('user-uuid-here', 2026, 12, 12);
```

**Create Overtime Policy:**
```sql
-- Check if exists
SELECT * FROM overtime_policies WHERE is_default = true;

-- If not exists, insert default:
INSERT INTO overtime_policies (
  name, weekday_hour1_multiplier, weekday_hour2_multiplier, 
  weekday_hour3_plus_multiplier, holiday_hour1_8_multiplier,
  holiday_hour9_10_multiplier, holiday_hour11_plus_multiplier,
  max_hours_per_day, max_hours_per_week, is_default
) VALUES (
  'Default Policy', 1.5, 2.0, 2.0, 2.0, 3.0, 4.0, 4, 14, true
);
```

---

## ✅ FASE 1: Compliance Features Testing

### Test 1.1: Leave Balance Management

**Objective**: Verify leave balance tracking & quota validation

**Steps:**
1. Login sebagai employee
2. Buka **Dashboard**
3. Verify "Saldo Cuti" card muncul
4. Check saldo: Annual (12 hari), Sick (unlimited), Special (varies)

**Expected Results:**
- ✅ Card menampilkan saldo dengan progress bar
- ✅ Warning badge jika saldo <= 3 hari
- ✅ Data akurat dari database

**Test Cases:**
- [ ] Saldo cuti tahunan = 12 hari (fresh user)
- [ ] Progress bar menunjukkan persentase benar
- [ ] Warning muncul jika <= 3 hari

---

### Test 1.2: Leave Request with Quota Validation

**Objective**: Test leave request dengan quota check

**Steps:**
1. Buka **Cuti & Izin**
2. Klik "Ajukan Cuti"
3. Pilih "Cuti Tahunan"
4. Pilih tanggal: 3 hari
5. Isi alasan
6. Submit

**Expected Results:**
- ✅ Form validation berjalan
- ✅ Quota check sebelum submit
- ✅ Request tersimpan dengan status "pending"

**Test Cases:**
- [ ] Submit cuti > saldo → Error "Quota tidak cukup"
- [ ] Submit cuti <= saldo → Success
- [ ] Tanggal lewat → Error "Tanggal tidak valid"
- [ ] Tanggal mulai > tanggal selesai → Error
- [ ] Alasan kosong → Error "Data tidak lengkap"

---

### Test 1.3: Medical Certificate Upload

**Objective**: Test upload surat dokter untuk sick leave > 2 hari

**Steps:**
1. Ajukan "Cuti Sakit"
2. Pilih tanggal: 3 hari (lebih dari 2 hari)
3. Verify field "Surat Dokter" muncul dengan warning
4. Upload file (JPG/PNG/PDF)
5. Submit

**Expected Results:**
- ✅ Field upload muncul otomatis untuk sick > 2 hari
- ✅ Warning "Wajib upload surat dokter" muncul
- ✅ File ter-upload ke Supabase Storage
- ✅ URL tersimpan di database

**Test Cases:**
- [ ] Sick <= 2 hari → Upload field tidak muncul
- [ ] Sick > 2 hari tanpa upload → Error
- [ ] Sick > 2 hari dengan upload → Success
- [ ] File format valid (jpg, png, pdf) → Success
- [ ] File > 5MB → Error (if implemented)

---

### Test 1.4: Overtime Calculation

**Objective**: Test auto-calculate overtime pay sesuai UU

**Steps:**
1. Buka **Lembur**
2. Klik "Ajukan Lembur"
3. Pilih tanggal: hari ini
4. Input upah per jam: 50000
5. Waktu: 17:00 - 20:00 (3 jam)
6. Uncheck "Hari Libur"
7. Verify estimasi upah lembur muncul

**Expected Results:**
- ✅ Estimasi upah ter-calculate real-time
- ✅ Multiplier ditampilkan (1.5x untuk jam 1-2, 2x untuk jam 3+)
- ✅ Total upah = (50000 × 1.5 × 2) + (50000 × 2 × 1) = 250,000

**Test Cases:**
- [ ] Weekday 3 jam → Multiplier 1.5x (2 jam) + 2x (1 jam)
- [ ] Holiday 3 jam → Multiplier 2x (3 jam)
- [ ] Durasi < 30 menit → Error "Durasi terlalu singkat"
- [ ] Weekday > 4 jam → Error "Maksimal 4 jam"
- [ ] Waktu selesai < waktu mulai → Error
- [ ] Alasan < 10 karakter → Error

---

### Test 1.5: Approval with Auto-Deduct

**Objective**: Test approval yang auto-deduct leave balance

**Steps:**
1. Login sebagai admin_hr atau manager
2. Buka **Persetujuan**
3. Tab "Cuti"
4. Approve leave request (3 hari annual leave)
5. Verify leave balance ter-deduct

**Expected Results:**
- ✅ Status berubah ke "approved"
- ✅ Leave balance berkurang 3 hari
- ✅ Database updated (approved_by, approved_at)

**Test Cases:**
- [ ] Approve annual leave → Balance berkurang
- [ ] Approve sick leave → Sick balance tidak terbatas
- [ ] Reject leave → Balance tidak berubah
- [ ] Approve overtime → Calculated pay tersimpan

---

## ✅ FASE 2: Payroll Module Testing

### Test 2.1: Salary Management

**Objective**: Test input gaji karyawan

**Steps:**
1. Login sebagai admin_hr
2. Buka **Karyawan**
3. Klik dropdown (⋮) pada karyawan
4. Pilih "Atur Gaji"
5. Input:
   - Gaji Pokok: 5,000,000
   - Tunjangan Transport: 500,000
   - Tunjangan Makan: 500,000
   - BPJS Kesehatan: 1% (employee), 4% (employer)
   - PTKP: K/1
6. Save

**Expected Results:**
- ✅ Data tersimpan dengan is_active = true
- ✅ Salary lama di-set is_active = false
- ✅ Gaji kotor ter-calculate otomatis
- ✅ Hourly rate ditampilkan

**Test Cases:**
- [ ] Gaji pokok = 0 → Error
- [ ] Save berhasil → Redirect ke salary history
- [ ] Update salary → Old salary inactive, new active
- [ ] Hourly rate = base_salary / 173

---

### Test 2.2: Payroll Generation

**Objective**: Test generate payroll bulanan

**Steps:**
1. Buka **Payroll Management**
2. Klik "Generate Payroll Baru"
3. Pilih bulan: Desember 2025
4. Klik "Generate Payroll"
5. Wait for processing
6. Verify payroll created

**Expected Results:**
- ✅ Payroll run created dengan status "draft"
- ✅ Payroll details generated untuk semua karyawan dengan salary
- ✅ Totals calculated (gross, deductions, net)
- ✅ Success message dengan jumlah karyawan

**Test Cases:**
- [ ] Generate untuk bulan yang sudah ada → Error
- [ ] Generate untuk bulan baru → Success
- [ ] Karyawan tanpa salary → Skip
- [ ] Karyawan inactive → Skip
- [ ] Total employees benar
- [ ] Total gross/net salary benar

---

### Test 2.3: Payroll Detail & Finalize

**Objective**: Test view payroll detail dan finalize

**Steps:**
1. Klik payroll yang sudah di-generate
2. Verify semua data benar
3. Klik "Finalize Payroll"
4. Confirm dialog
5. Verify status berubah ke "finalized"

**Expected Results:**
- ✅ Table menampilkan breakdown per karyawan
- ✅ Summary cards akurat
- ✅ Status berubah ke "finalized"
- ✅ Data locked (tidak bisa edit)

**Test Cases:**
- [ ] View detail → All columns visible
- [ ] Finalize → Status = finalized
- [ ] Finalized payroll → Button "Mark as Paid" muncul
- [ ] Export Excel → CSV downloaded

---

### Test 2.4: Slip Gaji PDF Generation

**Objective**: Test generate & download slip gaji PDF

**Steps:**
1. Di Payroll Detail (status finalized)
2. Klik "Generate Slip Gaji"
3. Wait for batch processing
4. Verify PDF downloaded untuk semua karyawan
5. Open PDF, check content

**Expected Results:**
- ✅ PDF generated untuk semua karyawan
- ✅ File naming: `slip_gaji_[nama]_[tahun]_[bulan].pdf`
- ✅ PDF content lengkap & formatted
- ✅ All data accurate

**PDF Content Checklist:**
- [ ] Company header "CMS DUTA SOLUSI"
- [ ] Employee info (nama, ID, jabatan)
- [ ] Attendance summary table
- [ ] Salary components table
- [ ] Deductions table
- [ ] Net salary highlighted
- [ ] Footer dengan timestamp

**Individual Download:**
- [ ] Klik icon download di table row
- [ ] PDF downloaded untuk 1 karyawan
- [ ] Content sama dengan batch

---

### Test 2.5: Mark as Paid

**Objective**: Test mark payroll as paid

**Steps:**
1. Di Payroll Detail (status finalized)
2. Klik "Mark as Paid"
3. Confirm dialog
4. Verify status berubah

**Expected Results:**
- ✅ Status payroll run = "paid"
- ✅ All payroll details payment_status = "paid"
- ✅ paid_at timestamp recorded
- ✅ Badge berubah warna hijau

---

## ✅ FASE 3A: UI/UX & Error Handling

### Test 3.1: Loading States

**Objective**: Test skeleton loaders

**Steps:**
1. Clear browser cache
2. Refresh Dashboard
3. Observe loading state
4. Wait for data load

**Expected Results:**
- ✅ DashboardSkeleton muncul saat loading
- ✅ Smooth transition ke actual content
- ✅ No layout shift

**Test Cases:**
- [ ] Dashboard → DashboardSkeleton
- [ ] History → TableSkeleton
- [ ] All pages → Proper loading states

---

### Test 3.2: Form Validation

**Objective**: Test all form validations

**Leave Page:**
- [ ] Empty fields → Error "Data tidak lengkap"
- [ ] Past date → Error "Tanggal tidak valid"
- [ ] Start > End → Error "Tanggal tidak valid"
- [ ] Quota exceeded → Error "Quota tidak cukup"
- [ ] Sick > 2 days no cert → Error

**Overtime Page:**
- [ ] Empty fields → Error
- [ ] Reason < 10 chars → Error "Alasan terlalu singkat"
- [ ] Duration < 30 min → Error "Durasi terlalu singkat"
- [ ] Weekday > 4 hours → Error "Maksimal 4 jam"
- [ ] End < Start → Error "Waktu tidak valid"

---

### Test 3.3: Error Handling

**Objective**: Test ErrorBoundary

**Steps:**
1. Trigger error (e.g., access undefined property)
2. Verify ErrorBoundary catches it
3. Click "Refresh Halaman"

**Expected Results:**
- ✅ Error UI muncul (tidak crash)
- ✅ Friendly error message
- ✅ Refresh button works

---

### Test 3.4: Empty States

**Objective**: Test EmptyState components

**Steps:**
1. Login sebagai user baru (no data)
2. Visit History page
3. Visit Employees page (as admin)

**Expected Results:**
- ✅ EmptyState dengan icon & message
- ✅ Helpful description
- ✅ No broken UI

---

### Test 3.5: Animations

**Objective**: Test smooth animations

**Checklist:**
- [ ] Dashboard fade-in animation
- [ ] Card hover effects (lift & shadow)
- [ ] Button press animation
- [ ] Smooth page transitions
- [ ] Toast notifications slide-in

---

## 🌐 Cross-Browser Testing

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (if Mac available)

### Mobile Browsers
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Firefox Mobile

**Test:**
- Responsive layout
- Touch interactions
- Form inputs
- PDF download

---

## 📱 Responsive Testing

### Breakpoints
- [ ] Mobile (320px - 768px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (1024px+)

**Test Each:**
- Navigation menu
- Tables (horizontal scroll)
- Forms (stacked layout)
- Cards (grid responsive)
- Buttons (touch-friendly 44px min)

---

## ♿ Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter to activate buttons
- [ ] Esc to close dialogs
- [ ] Arrow keys in dropdowns

### Screen Reader
- [ ] ARIA labels present
- [ ] Form labels associated
- [ ] Error messages announced
- [ ] Focus indicators visible

### Color Contrast
- [ ] Text readable (WCAG AA)
- [ ] Focus indicators visible
- [ ] Error states clear

---

## 🐛 Bug Reporting Template

```markdown
**Bug Title**: [Short description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:

**Actual Result**:

**Screenshots**: (if applicable)

**Browser/Device**: 

**Additional Notes**:
```

---

## ✅ Sign-Off Checklist

### Functional Testing
- [ ] All FASE 1 features working
- [ ] All FASE 2 features working
- [ ] All FASE 3A features working
- [ ] No critical bugs

### Performance
- [ ] Page load < 3 seconds
- [ ] No memory leaks
- [ ] Smooth animations (60fps)

### Security
- [ ] RLS policies working
- [ ] File upload validated
- [ ] SQL injection protected

### Documentation
- [ ] README updated
- [ ] User manual created
- [ ] Admin guide created

---

## 📞 Support

**Issues**: Report di GitHub Issues  
**Questions**: Contact IT Team  
**Emergency**: [Emergency contact]

---

**Happy Testing! 🎉**
