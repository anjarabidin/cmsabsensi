import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCamera } from '@/hooks/useCamera';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
    Camera,
    Loader2,
    MapPin,
    CheckCircle2,
    AlertCircle,
    X,
    Navigation,
    Signal,
    RefreshCw
} from 'lucide-react';
import { Camera as CapCamera } from '@capacitor/camera';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { GoogleMapsEmbed } from '@/components/GoogleMapsEmbed';
import { cn } from '@/lib/utils';

export default function QuickAttendancePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { videoRef, startCamera, stopCamera, capturePhoto } = useCamera();

    const [step, setStep] = useState<'idle' | 'camera' | 'processing'>('idle');
    const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Location Hook
    const { latitude, longitude, accuracy, isMocked, loading: locationChecking, getLocation } = useGeolocation();

    // Initial location fetch
    useEffect(() => {
        getLocation();
    }, [getLocation]);

    const handleStartCamera = async () => {
        try {
            // Attempt to check/request native permissions
            try {
                const cStatus = await CapCamera.checkPermissions();
                if (cStatus.camera !== 'granted') await CapCamera.requestPermissions();

                const gStatus = await CapGeolocation.checkPermissions();
                if (gStatus.location !== 'granted') await CapGeolocation.requestPermissions();
            } catch (e) {
                console.warn('Native permission check failed (likely browser mode):', e);
            }

            await startCamera();
            setStep('camera');
        } catch (error: any) {
            toast({
                title: 'Gagal Membuka Kamera',
                description: error.message || 'Pastikan Anda memberikan izin kamera.',
                variant: 'destructive',
            });
        }
    };

    const handleCapture = async () => {
        try {
            const photo = await capturePhoto();
            setCapturedPhoto(photo);
            setPhotoPreview(URL.createObjectURL(photo));
            stopCamera();
            setStep('processing');
        } catch (error) {
            toast({
                title: 'Gagal Mengambil Foto',
                description: 'Silakan coba lagi.',
                variant: 'destructive',
            });
        }
    };

    const handleSubmit = async () => {
        if (!user || !capturedPhoto || latitude === null || longitude === null) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Pastikan foto dan lokasi tersedia.',
                variant: 'destructive',
            });
            return;
        }

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
                    title: isLate ? 'Absen Masuk (Terlambat)' : 'Absen Masuk Berhasil!',
                    description: isLate ? `Terlambat ${lateMinutes} menit.` : `Tercatat pada ${format(now, 'HH:mm', { locale: id })}`,
                    className: isLate ? "bg-red-600 text-white border-none" : "bg-green-600 text-white border-none"
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
                    title: 'Absen Pulang Berhasil!',
                    description: `Total kerja: ${Math.floor(workMinutes / 60)}j ${workMinutes % 60}m`,
                    className: "bg-blue-600 text-white border-none"
                });
            }

            setTimeout(() => navigate('/dashboard'), 1500);
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
        if (acc <= 15) return { text: 'Sangat Akurat', color: 'text-green-600', bg: 'bg-green-50', bar: 4 };
        if (acc <= 30) return { text: 'Akurat', color: 'text-blue-600', bg: 'bg-blue-50', bar: 3 };
        if (acc <= 100) return { text: 'Cukup', color: 'text-yellow-600', bg: 'bg-yellow-50', bar: 2 };
        return { text: 'Lemah', color: 'text-red-500', bg: 'bg-red-50', bar: 1 };
    };

    const gpsStatus = getGPSStrength(accuracy);

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex items-center justify-center p-4">
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

                                {step === 'camera' && (
                                    <div className="space-y-4">
                                        <div className="relative aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl ring-4 ring-black/5">
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Focus Frame Overlay */}
                                            <div className="absolute inset-0 border-[3px] border-white/20 m-6 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
                                                <div className="w-full flex justify-between">
                                                    <div className="w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-lg" />
                                                    <div className="w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-lg" />
                                                </div>
                                                <div className="w-full flex justify-between">
                                                    <div className="w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-lg" />
                                                    <div className="w-4 h-4 border-b-2 border-r-2 border-white rounded-br-lg" />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-4 left-0 right-0 text-center">
                                                <span className="bg-black/50 text-white/90 text-[10px] px-3 py-1 rounded-full backdrop-blur-sm">
                                                    Pastikan wajah terlihat jelas
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    stopCamera();
                                                    setStep('idle');
                                                }}
                                                className="h-12 rounded-xl border-slate-200 text-slate-600"
                                            >
                                                Batal
                                            </Button>
                                            <Button
                                                onClick={handleCapture}
                                                className="h-12 bg-white text-blue-600 border-2 border-blue-100 hover:bg-blue-50 rounded-xl font-bold"
                                            >
                                                Ambil Foto
                                            </Button>
                                        </div>
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
        </DashboardLayout>
    );
}
