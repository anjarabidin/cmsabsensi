import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCamera } from '@/hooks/useCamera';
import { useMediaPipeFace } from '@/hooks/useMediaPipeFace';
import { useFaceSystem } from '@/hooks/useFaceSystem';
import {
    Camera,
    Loader2,
    MapPin,
    CheckCircle2,
    AlertCircle,
    X,
    Navigation,
    Signal,
    RefreshCw,
    Scan
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { GoogleMapsEmbed } from '@/components/GoogleMapsEmbed';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmployeeSchedule, Attendance } from '@/types';

export default function QuickAttendancePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [step, setStep] = useState<'idle' | 'processing'>('idle');
    const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Camera hooks
    const { stream, videoRef, startCamera, stopCamera, capturePhoto } = useCamera();
    const { isReady, initialize, detectFace } = useMediaPipeFace();
    const { getDeepDescriptor, computeMatch } = useFaceSystem();

    // State for office validation
    const [officeLocations, setOfficeLocations] = useState<any[]>([]);
    const [nearestOfficeDist, setNearestOfficeDist] = useState<number | null>(null);
    const [isLocationValid, setIsLocationValid] = useState(false);
    const MAX_RADIUS = 100; // 100 meters

    // ... existing states ...

    // Helper functions for distance
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

    // Fetch Office Locations
    useEffect(() => {
        const fetchOffices = async () => {
            const { data } = await supabase.from('office_locations').select('*').eq('is_active', true);
            setOfficeLocations(data || []);
        };
        fetchOffices();
    }, []);

    // Real-time Distance Check
    useEffect(() => {
        if (latitude && longitude) {
            if (officeLocations.length > 0) {
                let minDistance = Infinity;
                for (const office of officeLocations) {
                    const dist = getDistanceFromLatLonInM(latitude, longitude, office.latitude, office.longitude);
                    if (dist < minDistance) minDistance = dist;
                }
                setNearestOfficeDist(minDistance);
                setIsLocationValid(minDistance <= MAX_RADIUS);
            } else {
                // No office defined -> Valid by default but warn
                setNearestOfficeDist(null);
                setIsLocationValid(true);
            }
        }
    }, [latitude, longitude, officeLocations]);

    // Face Recognition States
    const [cameraOpen, setCameraOpen] = useState(false);
    const [faceMatch, setFaceMatch] = useState<number | null>(null);
    const [faceDetected, setFaceDetected] = useState(false);
    const [checkingFace, setCheckingFace] = useState(false);

    // Location Hook
    const { latitude, longitude, accuracy, isMocked, loading: locationChecking, getLocation } = useGeolocation();

    // Initial location fetch
    useEffect(() => {
        getLocation();
    }, [getLocation]);

    // Fix: Attach stream to video element when stream is available
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, videoRef]);

    // Check face match before allowing attendance
    const checkFaceMatch = async (): Promise<boolean> => {
        if (!videoRef.current || !isReady) {
            toast({
                title: 'Sistem Belum Siap',
                description: 'Memuat biometrik...',
                variant: 'destructive'
            });
            return false;
        }

        setCheckingFace(true);

        try {
            // Detect face first dengan MediaPipe
            const result = await detectFace(videoRef.current);
            if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
                setFaceDetected(false);
                toast({ title: 'Wajah Tidak Terdeteksi', variant: 'destructive' });
                return false;
            }

            setFaceDetected(true);

            // Get Deep Descriptor (ResNet-34)
            const currentDescriptor = await getDeepDescriptor(videoRef.current);
            if (!currentDescriptor) {
                toast({ title: 'Gagal memproses ID wajah', variant: 'destructive' });
                return false;
            }

            const { data: faceData, error } = await (supabase
                .from('face_enrollments') as any)
                .select('face_descriptor')
                .eq('user_id', user?.id)
                .eq('is_active', true)
                .maybeSingle();

            if (error || !faceData) {
                toast({ title: 'Belum Registrasi Wajah', variant: 'destructive' });
                return false;
            }

            const registeredDescriptor = new Float32Array(faceData.face_descriptor as any);
            const similarity = computeMatch(currentDescriptor, registeredDescriptor);
            setFaceMatch(similarity);

            const THRESHOLD = 0.55;
            if (similarity < THRESHOLD) {
                toast({
                    title: 'Wajah Tidak Cocok',
                    description: `Kemiripan: ${(similarity * 100).toFixed(0)}%. Mohon daftar ulang wajah.`,
                    variant: 'destructive',
                    duration: 5000
                });
                return false;
            }

            return true;
        } catch (error) {
            console.error('Face match error:', error);
            return false;
        } finally {
            setCheckingFace(false);
        }
    };

    const handleStartCamera = async () => {
        try {
            if (!user) {
                toast({
                    title: 'Error',
                    description: 'User tidak ditemukan',
                    variant: 'destructive'
                });
                return;
            }

            // Show dialog immediately for better UX
            setCameraOpen(true);

            // Run checks and initialization in parallel for speed
            const [faceCheckResult, locationResult, cameraResult, initResult] = await Promise.allSettled([
                // Check face registration
                supabase
                    .from('face_enrollments')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle(),
                // Get location
                getLocation(),
                // Start camera
                startCamera(),
                // Initialize MediaPipe
                initialize()
            ]);

            // Handle face registration check
            if (faceCheckResult.status === 'rejected' ||
                !faceCheckResult.value.data) {
                setCameraOpen(false);
                toast({
                    title: 'Registrasi Wajah Diperlukan',
                    description: 'Anda belum mendaftarkan wajah. Silakan daftar di halaman Profil terlebih dahulu.',
                    variant: 'destructive'
                });
                setTimeout(() => navigate('/profile'), 1500);
                return;
            }

            // Camera and location are already started/fetched in parallel

            const interval = setInterval(async () => {
                const video = videoRef.current;
                if (video && isReady && !checkingFace && video.readyState >= 2) {
                    try {
                        // Detect First
                        const result = await detectFace(video);

                        if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                            setFaceDetected(true);
                            // Only run deep check occasionally or if we need instant feedback
                            // Optimization: Check deep descriptor
                            const descriptor = await getDeepDescriptor(video);

                            if (descriptor && user) {
                                const { data: faceData } = await (supabase
                                    .from('face_enrollments') as any)
                                    .select('face_descriptor')
                                    .eq('user_id', user.id)
                                    .eq('is_active', true)
                                    .maybeSingle();

                                if (faceData) {
                                    const similarity = computeMatch(descriptor, new Float32Array(faceData.face_descriptor as any));
                                    setFaceMatch(similarity);
                                }
                            }
                        } else {
                            setFaceDetected(false);
                            setFaceMatch(0);
                        }
                    } catch (err) {
                        console.error("QuickFace auto check error", err);
                    }
                }
            }, 1000);
            (window as any).quickFaceInterval = interval;
        } catch (error: any) {
            setCameraOpen(false);
            toast({
                title: 'Gagal Membuka Kamera',
                description: error.message || 'Cek izin kamera.',
                variant: 'destructive',
            });
        }
    };

    const handleCapture = async () => {
        const isMatch = await checkFaceMatch();
        if (!isMatch) return;

        try {
            // Manual Canvas Capture with Mirror Fix
            if (!videoRef.current) return;

            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Flip / Mirror
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    setCapturedPhoto(blob);
                    setPhotoPreview(URL.createObjectURL(blob));
                    setStep('processing');
                }
            }, 'image/jpeg', 0.95);

            if ((window as any).quickFaceInterval) {
                clearInterval((window as any).quickFaceInterval);
            }
            stopCamera();
            setCameraOpen(false);
        } catch (error) {
            toast({ title: 'Gagal', description: 'Gagal mengambil foto', variant: 'destructive' });
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if ((window as any).quickFaceInterval) {
                clearInterval((window as any).quickFaceInterval);
            }
        };
    }, []);

    const handleSubmit = async () => {
        if (!user || !capturedPhoto || latitude === null || longitude === null) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Pastikan foto dan lokasi tersedia.',
                variant: 'destructive',
            });
            if (latitude === null) getLocation();
            return;
        }

        // --- DISTANCE VALIDATION ---

        if (isMocked) {
            toast({ title: "Lokasi Tidak Valid", description: "Terdeteksi menggunakan Fake GPS.", variant: "destructive" });
            return;
        }

        if (!isLocationValid) {
            const msg = nearestOfficeDist ? `Jarak: ${Math.round(nearestOfficeDist)}m (Max: ${MAX_RADIUS}m)` : "Lokasi kantor tidak valid.";
            toast({
                title: "Di Luar Jangkauan Kantor",
                description: `Anda harus berada di kantor. ${msg}`,
                variant: "destructive"
            });
            return;
        }
        // ---------------------------

        setSubmitting(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Fetch Today's Schedule
            const { data: scheduleData } = await (supabase
                .from('employee_schedules') as any)
                .select('*, shift:shifts(*)')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            const todaySchedule = scheduleData as EmployeeSchedule | null;

            // Barrier: Day Off
            if (todaySchedule?.is_day_off) {
                toast({
                    title: 'Hari Ini Libur',
                    description: 'Anda tidak memiliki jadwal kerja hari ini.',
                    variant: 'destructive',
                });
                setSubmitting(false);
                return;
            }

            // Check existing attendance
            const { data: existing } = await supabase
                .from('attendances')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            // PREVENT DOUBLE ATTENDANCE / RE-ABSENT
            if (existing && existing.clock_out) {
                toast({
                    title: 'Tugas Selesai!',
                    description: 'Anda sudah melakukan absen pulang hari ini. Tidak perlu absen lagi.',
                    className: "bg-green-600 text-white border-none"
                });
                setSubmitting(false);
                setTimeout(() => navigate('/dashboard'), 2000);
                return;
            }

            const type = !existing ? 'clock_in' : 'clock_out';
            const fileName = `${user.id}/${today}_${type}_${Date.now()}.jpg`;

            // Upload photo
            const { error: uploadError } = await supabase.storage
                .from('attendance-photos')
                .upload(fileName, capturedPhoto);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('attendance-photos')
                .getPublicUrl(fileName);

            const now = new Date();
            let isLate = false;
            let lateMinutes = 0;

            if (type === 'clock_in') {
                let startStr = '08:00:00';
                let tolerance = 15;
                let advance = 30;

                if (todaySchedule?.shift) {
                    startStr = todaySchedule.shift.start_time;
                    tolerance = todaySchedule.shift.tolerance_minutes ?? 15;
                    advance = todaySchedule.shift.clock_in_advance_minutes ?? 30;
                }

                const [h, m, s] = startStr.split(':').map(Number);
                const shiftStart = new Date(now);
                shiftStart.setHours(h, m, s, 0);

                const earliest = new Date(shiftStart.getTime() - (advance * 60000));
                if (now < earliest) {
                    toast({
                        title: 'Terlalu Awal!',
                        description: `Batas awal absen jam ${format(earliest, 'HH:mm')}`,
                        variant: 'destructive',
                    });
                    setSubmitting(false);
                    return;
                }

                const threshold = new Date(shiftStart.getTime() + (tolerance * 60000));
                isLate = now > threshold;
                if (isLate) {
                    lateMinutes = Math.floor((now.getTime() - shiftStart.getTime()) / 60000);
                }

                await supabase.from('attendances').insert({
                    user_id: user.id,
                    date: today,
                    clock_in: now.toISOString(),
                    clock_in_latitude: latitude,
                    clock_in_longitude: longitude,
                    clock_in_photo_url: publicUrl,
                    status: 'present',
                    is_late: isLate,
                    late_minutes: lateMinutes,
                });

                toast({
                    title: isLate ? 'Absen Masuk (Terlambat)' : '✅ Absen Masuk Berhasil!',
                    description: isLate ? `Terlambat ${lateMinutes} menit.` : `Tercatat pada ${format(now, 'HH:mm', { locale: id })}. Mengalihkan ke dashboard...`,
                    className: isLate ? "bg-red-600 text-white border-none" : "bg-green-600 text-white border-none",
                    duration: 3000
                });
            } else {
                const clockInTime = new Date(existing.clock_in);
                const workMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);

                await supabase
                    .from('attendances')
                    .update({
                        clock_out: now.toISOString(),
                        clock_out_latitude: latitude,
                        clock_out_longitude: longitude,
                        clock_out_photo_url: publicUrl,
                        work_hours_minutes: workMinutes,
                    })
                    .eq('id', existing.id);

                toast({
                    title: '✅ Absen Pulang Berhasil!',
                    description: `Total kerja: ${Math.floor(workMinutes / 60)}j ${workMinutes % 60}m. Mengalihkan ke dashboard...`,
                    className: "bg-blue-600 text-white border-none",
                    duration: 3000
                });
            }

            setTimeout(() => navigate('/dashboard'), 2500);
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Gagal Menyimpan Absensi',
                description: error.message || 'Terjadi kesalahan sistem. Cek koneksi Anda.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetake = () => {
        setCapturedPhoto(null);
        setPhotoPreview(null);
        setStep('idle');
    };

    const getGPSStrength = (acc: number | null) => {
        if (!acc) return { text: 'Mencari Sinyal...', color: 'text-slate-500', bg: 'bg-slate-100', bar: 1 };
        if (acc <= 15) return { text: 'Sinyal Kuat', color: 'text-green-600', bg: 'bg-green-50', bar: 4 };
        if (acc <= 30) return { text: 'Sinyal Bagus', color: 'text-blue-600', bg: 'bg-blue-50', bar: 3 };
        if (acc <= 100) return { text: 'Sinyal Cukup', color: 'text-yellow-600', bg: 'bg-yellow-50', bar: 2 };
        return { text: 'Sinyal Lemah', color: 'text-red-500', bg: 'bg-red-50', bar: 1 };
    };

    const gpsStatus = getGPSStrength(accuracy);

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex items-center justify-center p-4 pt-[calc(2rem+env(safe-area-inset-top))]">
                <Card className="w-full max-w-md border-0 shadow-2xl rounded-[32px] overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-slate-100">
                    <CardContent className="p-0">
                        {/* Modern Header with Pulse GPS */}
                        <div className="bg-white p-6 pb-2">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Absen Cepat</h1>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Verifikasi Lokasi & Wajah</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate('/dashboard')}
                                    className="rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="px-6 pb-6 space-y-6">

                            {/* Camera / Action Section - FIRST */}
                            <div className="bg-white rounded-3xl pt-2">
                                {step === 'idle' && (
                                    <div className="text-center">
                                        <Button
                                            onClick={handleStartCamera}
                                            size="lg"
                                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl text-lg font-bold shadow-blue-200 shadow-xl transition-all active:scale-95"
                                            disabled={!latitude || !longitude}
                                        >
                                            {!latitude ? (
                                                <span className="flex items-center gap-2">
                                                    <Loader2 className="h-5 w-5 animate-spin" /> Tunggu Lokasi...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <Camera className="h-6 w-6" /> Buka Kamera
                                                </span>
                                            )}
                                        </Button>
                                        <p className="text-xs text-slate-400 mt-4">Pastikan Anda berada di area kantor untuk presisi terbaik.</p>
                                    </div>
                                )}

                                {step === 'processing' && photoPreview && (
                                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                                        <div className="relative aspect-[3/4] bg-slate-100 rounded-3xl overflow-hidden shadow-inner ring-1 ring-slate-200">
                                            <img
                                                src={photoPreview}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10 text-white">
                                                <p className="text-xs opacity-75">Lokasi Terkunci</p>
                                                <p className="text-sm font-bold flex items-center gap-1">
                                                    <Navigation className="h-3 w-3" /> {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={handleRetake}
                                                className="h-12 rounded-xl font-medium"
                                                disabled={submitting}
                                            >
                                                <RefreshCw className="h-4 w-4 mr-2" /> Ulangi
                                            </Button>
                                            <Button
                                                onClick={handleSubmit}
                                                className="h-12 bg-green-600 hover:bg-green-700 rounded-xl font-bold shadow-lg shadow-green-200"
                                                disabled={submitting}
                                            >
                                                {submitting ? (
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                                )}
                                                {submitting ? 'Proses...' : 'Kirim Absen'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* GPS & Map Section - SECOND */}
                            <div className="relative group rounded-3xl overflow-hidden shadow-lg ring-4 ring-white transition-all transform hover:scale-[1.01]">
                                {latitude && longitude ? (
                                    <div className="relative">
                                        <GoogleMapsEmbed latitude={latitude} longitude={longitude} />

                                        {/* Office Distance Status Overlay */}
                                        <div className="absolute top-2 left-2 right-2 z-10 flex flex-col gap-2">
                                            {officeLocations.length === 0 ? (
                                                <div className="bg-yellow-100/90 backdrop-blur-md p-2 rounded-xl border border-yellow-200 shadow-sm flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                                                    <span className="text-xs font-bold text-yellow-700">Kantor Belum Disetting (Bebas)</span>
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "backdrop-blur-md p-2 rounded-xl border shadow-sm flex items-center justify-between",
                                                    isLocationValid ? "bg-green-100/90 border-green-200" : "bg-red-100/90 border-red-200"
                                                )}>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className={cn("h-4 w-4", isLocationValid ? "text-green-600" : "text-red-600")} />
                                                        <span className={cn("text-xs font-bold", isLocationValid ? "text-green-700" : "text-red-700")}>
                                                            {isLocationValid ? "Dalam Kawasan Kantor" : "Di Luar Jangkauan"}
                                                        </span>
                                                    </div>
                                                    <Badge variant="outline" className={cn("bg-white/50 border-0 text-[10px]", isLocationValid ? "text-green-700" : "text-red-700")}>
                                                        {nearestOfficeDist ? Math.round(nearestOfficeDist) : 0}m / 100m
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>

                                        {/* Overlay Status Bar */}
                                        <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-sm flex items-center justify-between border border-white/50">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shadow-inner", gpsStatus.bg)}>
                                                    <Navigation className={cn("h-5 w-5", gpsStatus.color, accuracy && accuracy > 50 ? "animate-pulse" : "")} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Akurasi GPS</p>
                                                    <div className="flex items-center gap-1">
                                                        <span className={cn("text-sm font-black", gpsStatus.color)}>{accuracy ? Math.round(accuracy) : '-'} Meter</span>
                                                        <Badge variant="secondary" className={cn("text-[8px] h-4 px-1.5", gpsStatus.bg, gpsStatus.color)}>{gpsStatus.text}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Signal Bars */}
                                            <div className="flex items-end gap-0.5 h-4">
                                                {[1, 2, 3, 4].map(i => (
                                                    <div key={i} className={cn("w-1 rounded-t-sm transition-all", i <= gpsStatus.bar ? "bg-green-500" : "bg-slate-200")} style={{ height: `${i * 25}%` }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-[200px] w-full bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                                            <div className="relative bg-white p-3 rounded-full shadow-sm">
                                                <Navigation className="h-6 w-6 text-blue-500 animate-pulse" />
                                            </div>
                                        </div>
                                        <p className="text-xs font-medium animate-pulse">Mencari titik lokasi...</p>
                                    </div>
                                )}
                            </div>

                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Attendance Camera Modal */}
            <Dialog open={cameraOpen} onOpenChange={(open) => {
                if (!open) {
                    if ((window as any).quickFaceInterval) {
                        clearInterval((window as any).quickFaceInterval);
                    }
                    stopCamera();
                    setCameraOpen(false);
                }
            }}>
                <DialogContent className="max-w-md p-0 border-none bg-black text-white gap-0 overflow-hidden rounded-none sm:rounded-[40px] z-[100]">
                    <div className="relative aspect-[3/4] w-full bg-black">
                        {!stream ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                                <div className="h-20 w-20 bg-white/10 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-sm font-black uppercase tracking-[0.2em]">Menyiapkan Biometrik</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Mohon Tunggu</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ transform: 'scaleX(-1)', filter: 'brightness(1.08) contrast(1.05) saturate(1.1)' }}
                                    className="w-full h-full object-cover"
                                />

                                {/* Face Recognition Overlay */}
                                <div className="absolute top-10 inset-x-0 flex flex-col items-center gap-4 z-20">
                                    <div className="flex gap-2">
                                        <Badge
                                            variant={faceDetected ? "default" : "destructive"}
                                            className={cn(
                                                "gap-2 px-3 py-1.5 border-none shadow-lg backdrop-blur-md",
                                                faceDetected ? "bg-green-600/90" : "bg-yellow-600/90"
                                            )}
                                        >
                                            <Scan className={cn("h-3 w-3", faceDetected && "animate-pulse")} />
                                            {faceDetected ? 'Wajah Terdeteksi' : 'Mencari Wajah...'}
                                        </Badge>

                                        <Badge
                                            className={cn(
                                                "px-3 py-1.5 font-black border-none shadow-lg backdrop-blur-md",
                                                (faceMatch || 0) >= 0.55 ? "bg-blue-600/90" : "bg-red-600/90"
                                            )}
                                        >
                                            Match: {((faceMatch || 0) * 100).toFixed(0)}%
                                        </Badge>
                                    </div>
                                </div>

                                {/* Recognition Frame */}
                                <div className="absolute inset-x-12 inset-y-24 border-2 border-dashed border-white/30 rounded-[60px] flex flex-col items-center justify-center">
                                    {!faceDetected && (
                                        <div className="flex flex-col items-center gap-2 animate-pulse">
                                            <div className="h-12 w-12 rounded-full border-2 border-white/20 flex items-center justify-center">
                                                <Scan className="h-6 w-6 text-white/40" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Face Scanning Area</span>
                                        </div>
                                    )}
                                </div>

                                {/* Loading indicator when checking face */}
                                {checkingFace && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-30">
                                        <div className="bg-white rounded-[32px] p-6 flex flex-col items-center gap-4 shadow-2xl animate-in zoom-in duration-300">
                                            <div className="relative h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
                                                <RefreshCw className="h-8 w-8 animate-spin text-white" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">Memverifikasi...</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Camera Actions */}
                        <div className="absolute bottom-10 inset-x-0 flex justify-center items-center gap-12 z-40">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-16 w-16 rounded-full text-white hover:bg-white/20 active:scale-90 transition-transform"
                                onClick={() => {
                                    if ((window as any).quickFaceInterval) {
                                        clearInterval((window as any).quickFaceInterval);
                                    }
                                    stopCamera();
                                    setCameraOpen(false);
                                }}
                            >
                                <X className="h-8 w-8" />
                            </Button>

                            <button
                                onClick={handleCapture}
                                disabled={!stream || checkingFace || !faceDetected || (faceMatch !== null && faceMatch < 0.55)}
                                className={cn(
                                    "h-24 w-24 rounded-full border-4 border-white flex items-center justify-center p-1.5 transition-all duration-300",
                                    (!stream || checkingFace || !faceDetected || (faceMatch !== null && faceMatch < 0.55))
                                        ? "opacity-20 grayscale scale-90"
                                        : "active:scale-95 hover:scale-105"
                                )}
                            >
                                <div className={cn(
                                    "h-full w-full rounded-full transition-colors duration-500",
                                    faceMatch !== null && faceMatch >= 0.55 ? "bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]" : "bg-white"
                                )} />
                            </button>

                            <div className="h-16 w-16 invisible" />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}

