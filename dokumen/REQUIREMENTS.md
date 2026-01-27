# Software Requirements Specification (SRS)
# Absensi Ceria - Enterprise Attendance System

**Version:** 1.0
**Date:** 27 January 2026
**Status:** Draft / Proposed
**Document ID:** SRS-ABS-2026-001

---

## 1. Pendahuluan

### 1.1 Tujuan
Dokumen ini mendeskripsikan spesifikasi kebutuhan perangkat lunak (Software Requirements Specification) untuk sistem "Absensi Ceria". Dokumen ini bertujuan untuk menjadi acuan teknis dan fungsional bagi tim pengembang, arsitek sistem, dan pemangku kepentingan (stakeholder) dalam proses pengembangan, pengujian, dan validasi sistem akhir.

### 1.2 Cakupan Produk
"Absensi Ceria" adalah platform **Human Resource Information System (HRIS)** subsistem Absensi yang berfokus pada validasi kehadiran presisi tinggi. Sistem ini mengintegrasikan teknologi *hybrid verification* (Geofencing + Biometrik) untuk meminimalisir kecurangan (*fraud*) dalam pencatatan kehadiran karyawan, baik yang bekerja di kantor (WFO) maupun jarak jauh (WFH/Field).

### 1.3 Definisi dan Istilah
*   **SRS**: Software Requirements Specification.
*   **Geofencing**: Teknologi pembatasan area virtual menggunakan koordinat GPS.
*   **Face Mesh / Landmark**: Titik-titik fitur wajah yang diekstraksi oleh algoritma AI (MediaPipe).
*   **Liveness Detection**: Fitur untuk memastikan objek di depan kamera adalah manusia hidup, bukan foto/video.
*   **Euclidean Distance**: Metode pengukuran jarak antara dua data vektor wajah untuk menentukan kemiripan.
*   **Native Biometric**: Sensor sidik jari/wajah bawaan perangkat (Android/iOS).

---

## 2. Deskripsi Umum Sistem

### 2.1 Perspektif Produk
Sistem ini beroperasi sebagai aplikasi berbasis *Client-Server*:
*   **Client (Mobile/PWA)**: Berjalan di perangkat karyawan untuk input data kehadiran.
*   **Web Admin (Dashboard)**: Berjalan di browser desktop untuk manajemen data dan pelaporan.
*   **Backend Services**: Menggunakan arsitektur *Backend-as-a-Service* (Supabase) untuk autentikasi, database, dan penyimpanan file.

### 2.2 Karakteristik Pengguna
| Kelas Pengguna | Deskripsi | Hak Akses |
| :--- | :--- | :--- |
| **Administrator (HR)** | Pengelola sistem HRD profesional. | Akses penuh ke manajemen user, lokasi, jadwal, dan laporan. |
| **Employee (Staff)** | Karyawan perusahaan (WFO/WFH). | Akses terbatas ke menu presensi pribadi, riwayat, dan pengajuan izin. |

### 2.3 Batasan dan Asumsi
1.  **Konektivitas**: Sistem membutuhkan koneksi internet aktif untuk sinkronisasi data (Real-time).
2.  **Perangkat**: Pengguna diasumsikan menggunakan smartphone dengan kamera depan dan fitur GPS yang berfungsi baik.
3.  **Browser**: Aplikasi web optimal pada browser berbasis Chromium (Chrome, Edge).

---

## 3. Spesifikasi Kebutuhan Fungsional (Functional Requirements)

### 3.1 Modul Autentikasi & Keamanan Akun
**ID: FR-AUTH**
*   **FR-AUTH-01 (Login)**: Sistem *harus* memvalidasi kredensial pengguna menggunakan Email/NIK dan Password terenkripsi (bcrypt).
*   **FR-AUTH-02 (Session Management)**: Sistem *harus* mengelola sesi pengguna menggunakan JSON Web Token (JWT) dengan masa berlaku yang ditentukan.
*   **FR-AUTH-03 (Role-Based Access Control)**: Sistem *harus* membatasi akses menu berdasarkan *role* (admin vs employee) secara ketat di sisi *backend* (Row Level Security).

### 3.2 Modul Identifikasi Biometrik (Wajah & Sidik Jari)
**ID: FR-BIO**
Fitur ini adalah inti dari validasi kehadiran untuk mencegah *buddy punching*.

*   **FR-BIO-01 (Face Enrollment)**: 
    *   Sistem *harus* mampu menangkap sampel wajah pengguna dan mengekstraksi menjadi *face descriptor* (vektor numerik).
    *   Sistem *tidak boleh* menyimpan foto sampel wajah mentah untuk pencocokan, melainkan hanya vektor numeriknya (privacy by design).
*   **FR-BIO-02 (Face Verification Logic)**:
    *   Saat absen, sistem *harus* menangkap wajah secara *real-time* dari stream kamera.
    *   Sistem *harus* menghitung skor kemiripan (similarity score) antara wajah yang ditangkap dengan vektor wajah yang terdaftar.
    *   **Ambang Batas (Threshold)**: Sistem *harus* menolak absen jika skor kemiripan di bawah `0.40` (atau nilai konfigurasi yang disepakati).
*   **FR-BIO-03 (Native Fingerprint Auth)**:
    *   Pada perangkat mobile native (APK/IPA), sistem *harus* memanfaatkan API biometrik perangkat keras (Fingerprint Sensor) sebagai opsi verifikasi utama yang lebih cepat.
    *   Jika validasi sidik jari gagal 3x, sistem *harus* mewajibkan verifikasi wajah sebagai *fallback*.
*   **FR-BIO-04 (Anti-Spoofing/Liveness - Planned)**:
    *   Sistem *direncanakan* untuk memiliki deteksi *liveness* pasif (misal: mendeteksi kedipan mata atau gerak mikro) untuk mencegah penggunaan foto statis.

### 3.3 Modul Geolokasi & Validasi Lokasi
**ID: FR-GEO**
*   **FR-GEO-01 (GPS Capture)**: Sistem *harus* mengambil data Latitude, Longitude, dan Accuracy dari API perangkat.
*   **FR-GEO-02 (Accuracy Filter)**: Sistem *harus* menolak data lokasi jika tingkat akurasi (accuracy) > 50 meter (indikasi sinyal buruk/tidak valid).
*   **FR-GEO-03 (Geofencing Calculation)**:
    *   Sistem *harus* menghitung jarak (Haversine Formula) antara posisi pengguna dan titik pusat kantor.
    *   Jika jarak > Radius Kantor (misal: 50m), sistem *harus* memblokir tombol absen (untuk WFO).
*   **FR-GEO-04 (Mock Location Detection)**:
    *   Sistem *harus* mendeteksi flag `isFromMockProvider` pada Android untuk mencegah penggunaan aplikasi *Fake GPS*.

### 3.4 Modul Manajemen Presensi (Transaction)
**ID: FR-ATT**
*   **FR-ATT-01 (Clock-In Rules)**:
    *   Sistem *harus* mencatat waktu server (bukan waktu HP pengguna) untuk mencegah manipulasi jam.
    *   Sistem *harus* menyimpan foto bukti absen (selfie) ke Object Storage.
*   **FR-ATT-02 (Late Detection)**: Sistem *harus* otomatis menandai status "Terlambat" jika waktu masuk > (Jam Masuk Jadwal + Toleransi).
*   **FR-ATT-03 (Clock-Out Confirmation)**: Sistem *harus* menampilkan dialog konfirmasi eksplisit sebelum memproses absen pulang untuk mencegah kesalahan tekan.

---

## 4. Spesifikasi Kebutuhan Non-Fungsional (System Quality Attributes)

### 4.1 Performa (Performance)
*   **NFR-PER-01**: Waktu respons API untuk submisi absen harus < 1000ms pada jaringan 4G.
*   **NFR-PER-02**: Proses deteksi wajah di sisi klien (*client-side processing*) harus selesai dalam < 3 detik untuk menjaga kepuasan pengguna.

### 4.2 Keamanan (Security)
*   **NFR-SEC-01**: Seluruh komunikasi data harus melalui protokol HTTPS (TLS 1.2+).
*   **NFR-SEC-02**: URL foto bukti absen harus bersifat *private* dan hanya bisa diakses menggunakan *Signed URL* dengan durasi terbatas.
*   **NFR-SEC-03**: Password database dan service key tidak boleh terekspos di sisi klien.

### 4.3 Keandalan (Reliability & Availability)
*   **NFR-REL-01**: Sistem harus memiliki *uptime* minimal 99.0% selama jam kerja (07:00 - 18:00 WIB).
*   **NFR-REL-02**: Jika GPS hilang sesaat, sistem harus memberikan pesan error yang informatif ("Searching for GPS..."), bukan crash.

---

## 5. Antarmuka Sistem (System Interfaces)

### 5.1 Antarmuka Pengguna (UI)
*   **Mobile**: Desain *Mobile-First*, tombol aksi utama (Absen Masuk/Pulang) ditempatkan di area bawah layar (Thumb Zone) untuk kemudahan akses satu tangan.
*   **Feedback Visual**: Menggunakan indikator warna (Hijau = Dalam Radius, Merah = Luar Radius) dan Haptic Feedback (Getar) saat sukses.

### 5.2 Antarmuka Perangkat Keras (Hardware Interfaces)
*   **Kamera**: Akses `getUserMedia` atau Native Camera API dengan resolusi minimal 720p.
*   **Geolokasi**: Akses High-Accuracy Location Provider (GPS/GLONASS).

### 5.3 Antarmuka Perangkat Lunak (Software Interfaces)
*   **Database**: PostgreSQL v15+ (via Supabase).
*   **AI Library**: MediaPipe Face Mesh javascript solution.
*   **Maps Provider**: OpenStreetMap Tile Server.

---

## 6. Diagram Alur Data (Data Flow - Simplified)

1.  **Input**: User Stream (Video) + User Location (Lat/Long).
2.  **Process (Client)**:
    *   Extract Face Descriptor from Video.
    *   Compare with Stored Descriptor -> Result: Match/No-Match.
    *   Calculate Distance to Office -> Result: Inside/Outside.
3.  **Transmission**: Send Data {UserID, Time, Loc, Photo, Status} to API.
4.  **Process (Server)**:
    *   Validate Token.
    *   Insert Record to `attendances` table.
    *   Upload Photo to `storage`.
5.  **Output**: JSON Response {success: true, timestamp: "..."}.

---

## 7. Matriks Risiko
| Risiko Teknis | Dampak | Probabilitas | Strategi Mitigasi |
| :--- | :--- | :--- | :--- |
| Kegagalan API Deteksi Wajah | User tidak bisa absen | Rendah | Sediakan tombol "Manual Override" dengan persetujuan Admin (Foto Wajib). |
| Akurasi GPS Buruk (Indoor) | False Negative (Dianggap luar kantor) | Sedang | Perbesar radius toleransi kantor atau gunakan validasi Wi-Fi SSID. |
| Server Downtime saat Jam Sibuk | Data presensi hilang | Rendah | Implementasi antrian lokal (Offline Mode) dan sinkronisasi otomatis saat online. |

---

## 8. Penutup
Dokumen SRS ini mengikat secara teknis lingkup pengembangan fitur. Fitur Biometrik (Wajah & Sidik Jari) dikategorikan sebagai *Core Requirement* yang harus memenuhi standar akurasi industri sebelum dirilis ke lingkungan produksi (Live). Pengembangan akan dilakukan secara bertahap sesuai prioritas modul.
