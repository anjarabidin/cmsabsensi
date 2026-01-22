# Software Requirements Specification (SRS)
## **Duta Mruput Enterprise** - Integrated Human Resource Information System
**Document Version:** 2.1.0 (Enterprise Release)  
**Last Updated:** January 21, 2026  
**Confidentiality:** Internal & Partners Only  

---

## 1. Introduction
**Duta Mruput Enterprise** is a state-of-the-art, mobile-first Human Resource Information System (HRIS) designed to streamline workforce management, attendance tracking, and payroll processing. Built with a "Security-First" and "User-Centric" approach, the platform bridges the gap between secure native mobile applications (APK) and accessible web technologies (PWA), ensuring seamless operation across a diverse ecosystem of devices (Android, iOS, Desktop).

### 1.1 Business Objectives
*   **Eliminate Time Fraud**: Prevent "buddy punching" and location spoofing through multi-layer verification (Biometric + GPS + Device Locking).
*   **Automate Payroll**: Reduce manual calculation errors by integrating attendance data directly with salary formulas.
*   **Decentralize Management**: Empower Unit Managers with approval authorities to reduce HR administrative bottlenecks.
*   **enhance Employee Engagement**: Provide transparent access to slips, history, and company media assets.

---

## 2. Technology Stack & Architecture

### 2.1 Frontend & Mobile Ecosystem
*   **Core Framework**: React 18 with TypeScript (Vite Bundler).
*   **UI/UX Engine**: Tailwind CSS, Shadcn/UI, Lucide React (Modern, Glassmorphism aesthetics).
*   **Hybrid Engine**: Capacitor JS (Bridging Web to Native Android Hardware).
*   **PWA Standard**: Vite Plugin PWA (Offline Support, Service Workers, Asset Caching).
*   **Biometrics**:
    *   **Native (APK)**: Capacitor Native Biometric (Fingerprint/FaceID via OS Hardware).
    *   **PWA/Web**: MediaPipe Face Mesh AI (Client-side TensorFlow.js) for camera-based verification.

### 2.2 Backend & Infrastructure (Serverless)
*   **Database**: PostgreSQL (via Supabase) with strong consistency.
*   **Security Layer**: Row Level Security (RLS) policies enforcing data isolation at the database engine level.
*   **Authentication**: Supabase Auth (JWT) + Custom Biometric Challenges.
*   **Storage**: Supabase Storage Buckets (Images: Attendance, Profile, Reimbursement, Media).
*   **Edge Functions**: Server-side logic for push notifications and complex payroll calculations.
*   **Push Notifications**: OneSignal / FCM Integrated.

---

## 3. Comprehensive Feature Specifications

### 3.1 Authentication & Security Module
*   **Hybrid Biometric Login**:
    *   **Android (APK)**: Utilizes hardware fingerprint sensor for < 1s login.
    *   **iOS/Web (PWA)**: Utilizes AI-powered facial recognition via camera with liveliness checks.
*   **Device Locking (UUID)**: Binds a user account to a specific physical device. Prevents logging in from unauthorized devices.
*   **Session Management**: Secure persistent sessions with auto-refresh mechanism.

### 3.2 Advanced Attendance System
*   **Geo-Fencing 2.0**:
    *   Validates employee coordinates against Office Master Data latitude/longitude.
    *   Configurable radius (default 50m) with strict rejection outside zones.
*   **Anti-Fake GPS**:
    *   Detects mock location providers on Android.
    *   Validates GPS accuracy metrics (>20m accuracy is rejected).
*   **Smart Validation**:
    *   **Clock-In**: Prevents check-in before allowed "Early Window" (e.g., 30 mins before shift).
    *   **Late Logic**: Automatically calculates late minutes based on Shift Tolerance.
    *   **Day-Off Blocking**: Integates with Schedule/Holiday calendar to prevent accidental attendance on off days.
*   **Work Modes**:
    *   **(WFO) Work From Office**: Strict Geofencing active.
    *   **(WFH) Work From Home**: Relaxed Geofencing, strict Biometric.
    *   **(Dinas) Field**: GPS recording only, strict Biometric.

### 3.3 Employee & Organization Management
*   **Master Data**: Management of Departments, Job Positions, and Grades (Levels).
*   **Employee Profile**: Comprehensive data storing (NIK, Join Date, Contact, Emergency Info, Bank Details).
*   **Hierarchy Visualization**: Auto-generated Organizational Chart based on Department IDs.
*   **Shift Management**:
    *   Static Shifts (Fixed hours).
    *   Dynamic Scheduling (Rostering).
    *   Support for "Lintas Hari" (Overnight shifts).

### 3.4 Request & Approval Workflow
*   **Types**: Annual Leave (Cuti), Sick Leave (Sakit), Overtime (Lembur), Corrections (Koreksi Absen), Reimbursement.
*   **Workflow**:
    *   Employee submits request with attachments (PDF/IMG).
    *   Manager receives Real-time Push Notification.
    *   Manager Approves/Rejects via Dashboard.
    *   HR (Admin) has override capability.
*   **Quota Management**: Automatic deduction of Annual Leave quota.

### 3.5 Payroll (Gaji) System
*   **Automated Calculation Engine**:
    *   Inputs: Attendance Days, Overtime Hours, Late Deductions (Configurable), Fixed Allowances, Variable Allowances (Uang Makan/Transport).
    *   Output: Net Salary.
*   **Salary Slips**: Generation of encrypted digital salary slips accessible privately by employees.
*   **Export**: Support for payroll recap export for Finance Dept.

### 3.6 Media & Engagement
*   **Duta Mruput Gallery**:
    *   High-fidelity photo/video albums for company events.
    *   Role-based uploading (Manager/HR).
    *   Download capability for employees.

---

## 4. User Roles & Access Control (RBAC)

| Feature / Capability | **Employee** | **Manager / Unit Head** | **Admin HR / Super** |
| :--- | :---: | :---: | :---: |
| **Attendance** | Self Only | Self + View Team | All Employees |
| **Approvals** | Request Only | Approve Team | Override All |
| **Data Visibility** | Self Only | Self + Department Team | Full Access |
| **Master Data** | Read Only | Read Only | Full Control (CRUD) |
| **Payroll Access** | Own Slip | Own Slip | Manage & Generate |
| **Settings** | Basic | Unit Management | System Configuration |

---

## 5. Non-Functional Requirements (NFR)

### 5.1 Performance
*   **Response Time**: Dashboard load time < 1.5 seconds on 4G networks.
*   **Face Verification**: AI processing time < 3 seconds on mid-range devices.
*   **Asset Size**: Initial bundle size optimized (< 3MB) with lazy loading.

### 5.2 Reliability & Availability
*   **Offline Mode (PWA)**: Core assets cached via Service Worker. UI functions in "ReadOnly" mode when offline.
*   **Data Integrity**: Used strict relational constraints (Foreign Keys) to prevent orphan data.

### 5.3 Compatibility
*   **Android**: Native APK support for Android 10+.
*   **iOS**: PWA support for Safari (iOS 15+).
*   **Desktop**: Full layout responsive support for Chrome/Edge/Safari.

---

## 6. Implementation Status (Current Build)

*   [x] **Core Framework & UI Library** (Completed)
*   [x] **Database Schema Migration** (Enterprise V2 Completed)
*   [x] **Auth System (Hybrid Biometric)** (Completed - Face & Fingerprint Active)
*   [x] **Attendance Logic (Geo + FakeGPS)** (Completed & Hardened)
*   [x] **Master Data Management** (Completed)
*   [x] **Payroll Engine** (Beta - Functional)
*   [x] **PWA / Service Workers** (Installed & Configured)
*   [ ] **Advanced Analytics Dashboard** (In Progress)
*   [ ] **Chat / Internal Messaging** (Planned)

---

**Certified for Deployment**  
*Duta Mruput Enterprise Development Team*
