# Technical Diagrams & Architecture
# Absensi Ceria System

**Document ID:** ARCH-ABS-2026-001
**Date:** 27 January 2026

---

## 1. Entity Relationship Diagram (ERD)

Diagram ini menggambarkan struktur database dan relasi antar entitas dalam sistem.

```mermaid
erDiagram
    PROFILES ||--o{ ATTENDANCES : "logs"
    PROFILES ||--o{ LEAVES : "requests"
    PROFILES ||--o{ FACE_ENROLLMENTS : "has"
    PROFILES ||--o{ EMPLOYEE_SCHEDULES : "assigned_to"
    
    SHIFTS ||--o{ EMPLOYEE_SCHEDULES : "defines"
    OFFICE_LOCATIONS ||--o{ ATTENDANCES : "at"
    
    PROFILES {
        uuid id PK "References auth.users"
        string email
        string full_name
        string role "admin/employee"
        string avatar_url
        string department
        string job_title
        timestamptz created_at
    }

    OFFICE_LOCATIONS {
        uuid id PK
        string name
        float latitude
        float longitude
        int radius_meters
        string address
        boolean is_active
    }

    SHIFTS {
        uuid id PK
        string name "e.g. Regular 8-5"
        time start_time
        time end_time
        int tolerance_minutes
    }

    EMPLOYEE_SCHEDULES {
        uuid id PK
        uuid user_id FK
        uuid shift_id FK
        date date
        boolean is_day_off
    }

    ATTENDANCES {
        uuid id PK
        uuid user_id FK
        date date
        timestamp clock_in_time
        timestamp clock_out_time
        float clock_in_lat
        float clock_in_long
        string clock_in_photo_url
        string status "present/late/absent"
        boolean is_late
        int late_minutes
        uuid office_location_id FK
    }

    FACE_ENROLLMENTS {
        uuid id PK
        uuid user_id FK
        jsonb face_descriptor "Vector Float Array"
        boolean is_active
        timestamp created_at
    }

    LEAVES {
        uuid id PK
        uuid user_id FK
        string type "cuti/sakit/izin"
        date start_date
        date end_date
        string reason
        string status "pending/approved/rejected"
        string document_url
    }
```

---

## 2. UML Use Case Diagram

Menggambarkan interaksi aktor dengan fungsionalitas utama sistem.

```mermaid
usecaseDiagram
    actor "Karyawan (Staff)" as Staff
    actor "Administrator (HR)" as Admin
    
    package "Absensi Ceria System" {
        usecase "Login / Authentication" as UC1
        usecase "Face Enrollment (Daftar Wajah)" as UC2
        usecase "Absen Masuk (Clock In)" as UC3
        usecase "Absen Pulang (Clock Out)" as UC4
        usecase "Lihat Riwayat Absensi" as UC5
        usecase "Ajukan Izin/Cuti" as UC6
        
        usecase "Kelola Data Pegawai" as UC7
        usecase "Kelola Lokasi Kantor" as UC8
        usecase "Approval Izin" as UC9
        usecase "Laporan & Rekap" as UC10
    }

    Staff --> UC1
    Staff --> UC2
    Staff --> UC3
    Staff --> UC4
    Staff --> UC5
    Staff --> UC6

    Admin --> UC1
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
    
    UC3 ..> UC2 : <<include>> \n(Verifikasi Wajah)
    UC4 ..> UC3 : <<precondition>> \n(Harus sudah masuk)
```

---

## 3. System Flowchart (Alur Absensi Utama)

Alur logika teknis saat pengguna melakukan presensi, mencakup validasi Lokasi dan Biometrik.

```mermaid
flowchart TD
    Start([Mulai]) --> InitGPS[Inisialisasi GPS]
    InitGPS --> CheckGPS{GPS Aktif & Akurat?}
    
    CheckGPS -- Tidak (Akurasi > 50m) --> RetryGPS[Tampilkan Error 'Sinyal Lemah']
    RetryGPS --> InitGPS
    
    CheckGPS -- Ya --> CheckMock{Terdeteksi Fake GPS?}
    CheckMock -- Ya --> BlockApp[Blokir Akses & Log Fraud]
    BlockApp --> End([Selesai])
    
    CheckMock -- Tidak --> GetMode{Mode Kerja?}
    
    GetMode -- WFO (Office) --> CheckRadius{Dalam Radius Kantor?}
    CheckRadius -- Tidak (Jarak > Radius) --> OutBoundary[Tampilkan 'Diluar Jangkauan'] 
    OutBoundary --> End
    
    GetMode -- WFH / Field --> OpenCam[Buka Kamera]
    CheckRadius -- Ya --> OpenCam
    
    OpenCam --> DetectFace[Deteksi Wajah (AI)]
    DetectFace --> MatchFace{Wajah Cocok?}
    
    MatchFace -- Skor < 0.40 --> FailFace[Tolak: Wajah Tidak Dikenali]
    FailFace --> RetryCam[Coba Lagi]
    RetryCam --> DetectFace
    
    MatchFace -- Skor > 0.40 --> Capture[Ambil Foto Bukti]
    Capture --> Upload[Upload Data ke Server]
    
    Upload --> Success[Tampilkan Popup Sukses]
    Success --> End
```

---

## 4. UML Class Diagram (Simplified Architecture)

Menggambarkan struktur kelas/komponen utama di sisi Frontend (React) dan hubungannya.

```mermaid
classDiagram
    class AuthContext {
        +User session
        +login()
        +logout()
        +checkRole()
    }

    class AttendancePage {
        -User user
        -Location currentLocation
        +useEffect(getLocation)
        +handleClockIn()
        +handleClockOut()
    }

    class GeolocationHook {
        +double latitude
        +double longitude
        +double accuracy
        +boolean isMocked
        +getCurrentPosition()
        +watchPosition()
    }

    class FaceService {
        -FaceLandmarker landmarker
        +initialize()
        +detectFace(video)
        +compareFaces(desc1, desc2) : float
    }

    class SupabaseClient {
        +from(table)
        +select()
        +insert()
        +update()
        +storage()
    }

    AttendancePage ..> AuthContext : uses
    AttendancePage ..> GeolocationHook : uses
    AttendancePage ..> FaceService : uses
    AttendancePage ..> SupabaseClient : calls
    
    FaceService --|> MediaPipeLibrary : depends on
```

---

## 5. Deployment Architecture (Topologi)

```mermaid
graph LR
    subgraph Client Device
        MobileApp[Mobile / PWA Client] -- HTTPS / WSS --> EdgeNet
        Camera[Camera Hardware] -.-> MobileApp
        GPS[GPS Receiver] -.-> MobileApp
    end

    subgraph "Cloud Infrastructure"
        EdgeNet[CDN / Edge Network] --> FrontendHost[Vercel Hosting]
        EdgeNet --> API[Supabase API Gateway]
        
        API --> Auth[Auth Service]
        API --> DB[(PostgreSQL Database)]
        API --> Storage[Object Storage (Photos)]
    end
```
