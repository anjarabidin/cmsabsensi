# 🔒 MOBILE LOCK - QUICK REFERENCE

## ✅ SAFE TO EDIT (Desktop)
```tsx
// Tailwind with breakpoints - AMAN
className="md:w-1/2 lg:p-8 xl:text-4xl"

// Desktop-only sections - AMAN  
<div className="hidden md:block">Desktop content</div>

// CSS media queries - AMAN
@media (min-width: 768px) { /* Custom styles */ }
```

## ❌ DON'T TOUCH (Mobile)
```tsx
// Base classes - TERKUNCI
className="w-full p-4 rounded-2xl"

// Mobile-locked classes - TERKUNCI
className="mobile-locked-card"

// Mobile media queries - TERKUNCI
@media (max-width: 767px) { /* DON'T EDIT */ }
```

## 📱 Breakpoints
- **Mobile:** < 768px (LOCKED)
- **Desktop:** ≥ 768px (EDITABLE)

## 🎯 Simple Rule
**Prefix dengan `md:`, `lg:`, `xl:` = AMAN**  
**Tanpa prefix = TERKUNCI**

---
Read full guide: `MOBILE_LOCK_GUIDE.md`
