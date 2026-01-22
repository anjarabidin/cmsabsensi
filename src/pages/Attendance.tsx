
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCamera } from '@/hooks/useCamera';
import { useIsMobile } from '@/hooks/useIsMobile';
import { promptBiometricForAttendance } from '@/utils/biometricAuth';
import { format } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { useMediaPipeFace } from '@/hooks/useMediaPipeFace';
import { useFaceSystem } from '@/hooks/useFaceSystem';
import { Attendance, OfficeLocation, WorkMode, EmployeeSchedule } from '@/types';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Loader2, ScanFace } from 'lucide-react';

import AttendanceMobileView from './AttendanceMobileView';
import AttendanceDesktopView from './AttendanceDesktopView';

// Utility to calculate distance between two coordinates in meters (Haversine Formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export default function AttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { latitude, longitude, error: locationError, loading: locationLoading, isMocked, accuracy, getLocation } = useGeolocation();

  // Camera hook
  const { stream, videoRef, startCamera, stopCamera } = useCamera();

  // MediaPipe Hook
  const { initialize, detectFace, getFaceDescriptor, compareFaces } = useMediaPipeFace();

  // Face Enrollment State
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<Float32Array | null>(null);

  // Fix: Attach stream to video element when stream is available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<EmployeeSchedule | null>(null);
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [workMode, setWorkMode] = useState<WorkMode>('wfo');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLocationValid, setIsLocationValid] = useState(true);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);

  // Camera state for photo capture
  const [cameraOpen, setCameraOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // NEW: Face Verification Setting
  const [isFaceRequired, setIsFaceRequired] = useState(true);

  // GPS validation - Use database radius instead of hardcoded
  const MIN_GPS_ACCURACY = 20; // Require accuracy better than 20 meters

  useEffect(() => {
    fetchData();
    // Pre-load MediaPipe if not native (PWA)
    if (!Capacitor.isNativePlatform()) {
      initialize();
    }
    return () => {
      stopCamera();
    };
  }, [user?.id]);

  // ... (keep existing stream attach effect lines 82-94) ...
  useEffect(() => {
    const attachStream = () => {
      if (cameraOpen && stream && videoRef.current) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Error playing video:", e));
        }
      }
    };
    attachStream();
    const timer = setTimeout(attachStream, 150);
    return () => clearTimeout(timer);
  }, [cameraOpen, stream]);

  // Validate Location Logic (keep lines 97-156)
  useEffect(() => {
    // If GPS is not available at all
    if (!latitude || !longitude) {
      setIsLocationValid(false);
      if (locationError) {
        setLocationErrorMsg(locationError);
      } else if (locationLoading) {
        setLocationErrorMsg("Menunggu GPS terkunci...");
      } else {
        setLocationErrorMsg("GPS belum terkunci. Klik 'Perbarui GPS' untuk mencoba lagi.");
      }
      return;
    }

    // GPS ACCURACY CHECK
    if (accuracy && accuracy > MIN_GPS_ACCURACY) {
      setIsLocationValid(false);
      setLocationErrorMsg(`Akurasi GPS tidak cukup (${Math.round(accuracy)}m). Diperlukan akurasi < ${MIN_GPS_ACCURACY}m. Mohon gunakan GPS di area terbuka.`);
      return;
    }

    // GPS is available, now validate based on work mode
    if (workMode === 'wfo' && selectedLocationId && officeLocations.length > 0) {
      const office = officeLocations.find(l => l.id === selectedLocationId);
      if (office) {
        const dist = getDistanceFromLatLonInM(latitude, longitude, office.latitude, office.longitude);
        if (dist > office.radius_meters) {
          setIsLocationValid(false);
          setLocationErrorMsg(`Berada di luar jangkauan kantor (${Math.round(dist)}m). Maksimal ${office.radius_meters}m.`);
        } else if (isMocked) {
          setIsLocationValid(false);
          setLocationErrorMsg("Fake GPS Terdeteksi! Mohon gunakan lokasi asli.");
        } else {
          setIsLocationValid(true);
          setLocationErrorMsg(null);
        }
      } else {
        setIsLocationValid(false);
        setLocationErrorMsg("Pilih lokasi kantor terlebih dahulu.");
      }
    } else if (workMode === 'wfh') {
      if (isMocked) {
        setIsLocationValid(false);
        setLocationErrorMsg("Fake GPS Terdeteksi! Mohon gunakan lokasi asli.");
      } else {
        setIsLocationValid(true);
        setLocationErrorMsg(null);
      }
    } else {
      if (isMocked) {
        setIsLocationValid(false);
        setLocationErrorMsg("Fake GPS Terdeteksi! Mohon gunakan lokasi asli.");
      } else {
        setIsLocationValid(true);
        setLocationErrorMsg(null);
      }
    }
  }, [latitude, longitude, selectedLocationId, workMode, officeLocations, isMocked, locationError, locationLoading, accuracy]);

  const fetchData = async () => {
    try {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch Setting: Face Verification Required?
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'require_face_verification')
        .maybeSingle();

      if (settingData) {
        console.log('App settings raw value:', settingData.value, 'type:', typeof settingData.value);
        console.log('App settings parsed to boolean:', Boolean(settingData.value));
        setIsFaceRequired(Boolean(settingData.value));
      }

      // Fetch Attendance
      const { data: attendanceData } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      setTodayAttendance(attendanceData as Attendance | null);
      setNotes((attendanceData as Attendance | null)?.notes || '');

      // Fetch Schedule
      const { data: scheduleData } = await (supabase
        .from('employee_schedules') as any)
        .select('*, shift:shifts(*)')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      setTodaySchedule(scheduleData as EmployeeSchedule | null);

      // Fetch Office Locations
      const { data: locationData } = await supabase
        .from('office_locations')
        .select('*')
        .eq('is_active', true);
      setOfficeLocations((locationData as OfficeLocation[]) || []);
      if (locationData && locationData.length > 0) {
        setSelectedLocationId(locationData[0].id);
      }

      // Fetch Face Enrollment (For PWA Verification)
      const { data: enrollmentData } = await supabase
        .from('face_enrollments')
        .select('face_descriptor')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (enrollmentData?.face_descriptor) {
        setEnrolledDescriptor(new Float32Array(enrollmentData.face_descriptor as any));
      }

      // Trigger location fetch
      getLocation();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCameraForPhoto = async () => {
    try {
      if (!user) {
        toast({ title: 'Error', description: 'User tidak ditemukan', variant: 'destructive' });
        return;
      }

      // If validation NOT REQUIRED, skip camera
      if (!isFaceRequired) {
        // Bypass logic handled in button click or handleSubmit
        return;
      }

      // Check for day off
      if (todaySchedule?.is_day_off) {
        toast({ title: 'Hari Libur', description: 'Hari ini adalah hari libur.', });
      }

      // PWA: Check enrollment only if Required
      if (isFaceRequired && !Capacitor.isNativePlatform() && !enrolledDescriptor) {
        toast({
          title: 'Wajah Belum Terdaftar',
          description: 'Mohon daftarkan wajah Anda terlebih dahulu di menu Profil.',
          variant: 'destructive',
          duration: 4000
        });
        // Allow opening camera anyway, but they won't pass verification later
      }

      setCameraOpen(true);
      await startCamera();
      if (!latitude || !longitude) getLocation();
    } catch (error) {
      setCameraOpen(false);
      toast({ title: 'Gagal Membuka Kamera', description: 'Pastikan izin kamera diberikan.', variant: 'destructive' });
    }
  };

  // Helper: Perform AI Scan
  const performFaceScan = async (): Promise<boolean> => {
    if (!videoRef.current || !enrolledDescriptor) return false;

    // Quick scan loop (max 10 attempts / 3 seconds)
    const maxAttempts = 15;
    let attempts = 0;

    return new Promise(async (resolve) => {
      const scanInterval = setInterval(async () => {
        attempts++;
        try {
          if (!videoRef.current || videoRef.current.readyState < 2) return;

          const result = await detectFace(videoRef.current);
          if (result) {
            const currentDescriptor = getFaceDescriptor(result);

            if (currentDescriptor) {
              const score = compareFaces(currentDescriptor, enrolledDescriptor);
              console.log("Attendance Face Match:", score);
              if (score > 0.40) { // Threshold
                clearInterval(scanInterval);
                resolve(true);
                return;
              }
            }
          }
        } catch (e) { console.error(e); }

        if (attempts >= maxAttempts) {
          clearInterval(scanInterval);
          resolve(false);
        }
      }, 200);
    });
  };

  const handleCapturePhoto = async () => {
    try {
      setVerifying(true);

      // --- 1. BRANCHING VERIFICATION STRATEGY ---
      if (Capacitor.isNativePlatform()) {
        // NATIVE: Use Fingerprint/System Biometric
        toast({ title: 'Verifikasi Identitas', description: 'Gunakan sidik jari untuk verifikasi', duration: 2000 });
        const biometricResult = await promptBiometricForAttendance();
        if (!biometricResult.success) {
          toast({ title: 'Verifikasi Gagal', description: 'Sidik jari tidak cocok.', variant: 'destructive' });
          setVerifying(false);
          return;
        }
      } else {
        // PWA/WEB: Use Face Recognition via Camera
        // Skip if not required (redundant check but safe)
        if (isFaceRequired) {
          if (!enrolledDescriptor) {
            toast({ title: 'Gagal', description: 'Anda belum mendaftarkan wajah. Silakan ke menu Profil > Registrasi Wajah.', variant: 'destructive' });
            setVerifying(false);
            return;
          }

          toast({ title: 'Memindai Wajah...', description: 'Tahan posisi wajah Anda...', });
          const isFaceValid = await performFaceScan();

          if (!isFaceValid) {
            toast({ title: 'Wajah Tidak Cocok', description: 'Wajah tidak dikenali. Pastikan pencahayaan cukup.', variant: 'destructive' });
            setVerifying(false);
            return;
          }
        }
      }

      // --- 2. CAPTURE PHOTO ---
      if (!videoRef.current) {
        setVerifying(false);
        return;
      }

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setVerifying(false);
        return;
      }
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          setCapturedPhoto(blob);
          setPhotoPreview(URL.createObjectURL(blob));
        }
      }, 'image/jpeg', 0.95);

      stopCamera();
      setCameraOpen(false);
      setVerifying(false);

      toast({
        title: '✓ Verifikasi Berhasil',
        description: Capacitor.isNativePlatform() ? 'Identitas terverifikasi dengan sidik jari' : 'Wajah terverifikasi',
        className: 'bg-green-600 text-white border-none',
        duration: 3000,
      });

    } catch (error) {
      console.error('Capture error:', error);
      toast({ title: 'Gagal', description: 'Terjadi kesalahan sistem', variant: 'destructive' });
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    // 1. Basic Validation
    if (!user || latitude == null || longitude == null) {
      toast({ title: 'Data Kurang', description: 'Pastikan lokasi tersedia.', variant: 'destructive' });
      return;
    }

    // 2. Photo Validation (Conditiona)
    if (isFaceRequired && !capturedPhoto) {
      toast({ title: 'Foto Wajib', description: 'Pastikan Anda telah mengambil foto wajah.', variant: 'destructive' });
      return;
    }

    // Anti Fake GPS Barrier
    if (isMocked) {
      toast({
        title: 'Manipulasi Lokasi Terdeteksi!',
        description: 'Sistem mendeteksi penggunaan Fake GPS. Mohon matikan aplikasi manipulasi lokasi dan gunakan GPS asli perangkat.',
        variant: 'destructive'
      });
      return;
    }

    if (!isLocationValid) {
      toast({ title: 'Lokasi Tidak Valid', description: locationErrorMsg || 'Anda berada di luar jangkauan.', variant: 'destructive' });
      return;
    }

    // Check for Day Off / Holiday Barrier
    if (todaySchedule?.is_day_off) {
      toast({
        title: 'Hari Libur!',
        description: 'Hari ini adalah jadwal libur Anda. Tidak dapat melakukan absensi.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    const type = !todayAttendance ? 'clock_in' : 'clock_out';

    try {
      let publicUrl = null;

      // Only upload if photo exists
      if (capturedPhoto) {
        const fileName = `${user.id}/${format(new Date(), 'yyyy-MM-dd')}_${type}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('attendance-photos').upload(fileName, capturedPhoto);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('attendance-photos').getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      }

      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');

      if (type === 'clock_in') {
        // Determine Shift Start
        let scheduleStartStr = '08:00:00'; // Default fallback
        let toleranceMinutes = 15; // Default tolerance
        let advanceMinutes = 30; // Default advance

        if (todaySchedule?.shift) {
          scheduleStartStr = todaySchedule.shift.start_time;
          toleranceMinutes = todaySchedule.shift.tolerance_minutes ?? 15;
          advanceMinutes = todaySchedule.shift.clock_in_advance_minutes ?? 30;
        }

        // Parse Shift Start to Date
        const [h, m, s] = scheduleStartStr.split(':').map(Number);
        const shiftStartDate = new Date(now);
        shiftStartDate.setHours(h, m, s, 0);

        // Check Early Clock-in Barrier
        const earliestAllowed = new Date(shiftStartDate.getTime() - (advanceMinutes * 60000));
        if (now < earliestAllowed) {
          toast({
            title: 'Terlalu Awal!',
            description: `Anda baru bisa absen masuk jam ${format(earliestAllowed, 'HH:mm')}.`,
            variant: 'destructive'
          });
          setSubmitting(false);
          return;
        }

        // Add tolerance
        const lateThreshold = new Date(shiftStartDate.getTime() + (toleranceMinutes * 60000));

        const isLate = now > lateThreshold;
        const lateMinutes = isLate ? Math.floor((now.getTime() - shiftStartDate.getTime()) / 60000) : 0;

        await supabase.from('attendances').insert({
          user_id: user.id, date: today, clock_in: now.toISOString(),
          clock_in_latitude: latitude, clock_in_longitude: longitude,
          clock_in_photo_url: publicUrl, // NULLABLE in db
          clock_in_location_id: selectedLocationId || null, work_mode: workMode,
          status: 'present', is_late: isLate, late_minutes: lateMinutes, notes: notes.trim() || null
        });

        toast({
          title: isLate ? 'Absen Masuk (Terlambat)' : '✅ Absen Masuk Berhasil!',
          description: isLate ? `Anda terlambat ${lateMinutes} menit.` : 'Absensi masuk tercatat. Data tersimpan dengan aman.',
          variant: isLate ? 'destructive' : 'default',
          duration: 3000
        });
      } else {
        // --- EARLY CLOCK OUT CHECK ---
        let earlyWarningConfirmed = true;
        if (todaySchedule?.shift?.end_time) {
          const [h, m, s] = todaySchedule.shift.end_time.split(':').map(Number);
          const shiftEndDate = new Date(now);
          shiftEndDate.setHours(h, m, s, 0);

          // 1 Hour before logic
          const oneHourBefore = new Date(shiftEndDate.getTime() - (60 * 60000));

          // If now is BEFORE (OneHourBefore), it means way too early
          if (now < oneHourBefore) {
            if (!window.confirm("Ini belum jam pulang, apakah anda yakin ingin melakukan absen pulang?")) {
              setSubmitting(false);
              return;
            }
          }
        }
        // -----------------------------

        const clockInTime = new Date(todayAttendance!.clock_in);
        const workHoursMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);

        await supabase.from('attendances').update({
          clock_out: now.toISOString(), clock_out_latitude: latitude, clock_out_longitude: longitude,
          clock_out_photo_url: publicUrl, clock_out_location_id: selectedLocationId || null,
          work_hours_minutes: workHoursMinutes, notes: notes.trim() || null
        }).eq('id', todayAttendance!.id);

        toast({
          title: '✅ Berhasil Pulang',
          description: 'Absensi pulang tercatat. Terima kasih atas kerja keras Anda hari ini!',
          className: "bg-green-600 text-white border-none",
          duration: 3000
        });
      }

      setCapturedPhoto(null);
      setPhotoPreview(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Gagal', description: 'Terjadi kesalahan sistem.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" /></div></DashboardLayout>;

  // Use props spread to avoid repetition
  const viewProps = {
    user,
    navigate,
    todayAttendance,
    todaySchedule,
    officeLocations,
    latitude,
    longitude,
    locationLoading,
    locationError,
    isLocationValid,
    locationErrorMsg,
    getLocation,
    workMode,
    setWorkMode,
    selectedLocationId,
    setSelectedLocationId,
    notes,
    setNotes,
    loading,
    submitting,
    handleSubmit,
    cameraOpen,
    setCameraOpen,
    videoRef,
    stream,
    stopCamera,
    handleCapturePhoto,
    openCameraForPhoto,
    photoPreview,
    setPhotoPreview,
    capturedPhoto,
    verifying,
    isFaceRequired, // PASS TO VIEW
  };

  if (isMobile) {
    return <AttendanceMobileView {...viewProps} />;
  }

  return <AttendanceDesktopView {...viewProps} />;
}
