import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useIsMobile } from '@/hooks/useIsMobile';
import { promptBiometricForAttendance } from '@/utils/biometricAuth';
import {
    Loader2,
    MapPin,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { GoogleMapsEmbed } from '@/components/GoogleMapsEmbed';
import { cn } from '@/lib/utils';
import { EmployeeSchedule, Attendance } from '@/types';

export default function QuickAttendancePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { toast } = useToast();

    // 1. Hooks - Call all hooks first at the top
    const { latitude, longitude, accuracy, isMocked, loading: locationChecking, getLocation } = useGeolocation();

    // 2. States
    const [step, setStep] = useState<'idle' | 'processing'>('idle');
    const [submitting, setSubmitting] = useState(false);

    // Office validation states
    const [officeLocations, setOfficeLocations] = useState<any[]>([]);
    const [nearestOfficeDist, setNearestOfficeDist] = useState<number | null>(null);
    const [isLocationValid, setIsLocationValid] = useState(false);

    // GPS VALIDATION - Use database radius instead of hardcoded
    const MIN_GPS_ACCURACY = 50; // Require accuracy better than 50 meters (more realistic)

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

    // Initial location fetch
    useEffect(() => {
        const fetchOffices = async () => {
            try {
                const { data: locationData } = await supabase
                    .from('office_locations')
                    .select('*')
                    .eq('is_active', true);
                setOfficeLocations((locationData as any[]) || []);
            } catch (error) {
                console.error('Error fetching offices:', error);
            }
        };

        fetchOffices();
    }, []);

    // Real-time Distance Check with GPS Accuracy
    useEffect(() => {
        if (latitude !== null && longitude !== null) {
            // GPS ACCURACY CHECK - STRICTER for WFO
            if (accuracy && accuracy > MIN_GPS_ACCURACY) {
                setIsLocationValid(false);
                return;
            }

            if (officeLocations.length > 0) {
                let minDistance = Infinity;
                let isValid = false;
                let validOfficeRadius = null;
                
                for (const office of officeLocations) {
                    const dist = getDistanceFromLatLonInM(latitude, longitude, office.latitude, office.longitude);
                    if (dist < minDistance) minDistance = dist;
                    
                    // Check if within this office's radius
                    if (dist <= office.radius_meters) {
                        isValid = true;
                        validOfficeRadius = office.radius_meters;
                    }
                }
                
                setNearestOfficeDist(minDistance);
                setIsLocationValid(isValid);
            } else {
                setNearestOfficeDist(null);
                setIsLocationValid(true); // Allow if no offices set
            }
        }
    }, [latitude, longitude, officeLocations, accuracy]);

    // Simple submit handler
    const handleSubmit = async () => {
        if (!user || latitude === null || longitude === null) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Pastikan lokasi tersedia.',
                variant: 'destructive',
            });
            return;
        }

        // --- DISTANCE VALIDATION ---
        if (isMocked) {
            toast({ title: "Lokasi Tidak Valid", description: "Terdeteksi menggunakan Fake GPS.", variant: 'destructive' });
            return;
        }

        if (!isLocationValid) {
            // Find the nearest office and its radius for the error message
            let nearestOffice = null;
            let minDistance = Infinity;
            
            for (const office of officeLocations) {
                const dist = getDistanceFromLatLonInM(latitude, longitude, office.latitude, office.longitude);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestOffice = office;
                }
            }
            
            const msg = nearestOffice ? `Jarak: ${Math.round(minDistance)}m (Max: ${nearestOffice.radius_meters}m)` : "Lokasi kantor tidak valid.";
            toast({
                title: "Di Luar Jangkauan Kantor",
                description: `Anda harus berada di kantor. ${msg}`,
                variant: "destructive"
            });
            return;
        }

        try {
            setSubmitting(true);
            setStep('processing');

            const today = format(new Date(), 'yyyy-MM-dd');
            const now = new Date();

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

            const now = new Date();
            let isLate = false;
            let lateMinutes = 0;

            if (type === 'clock_in') {
                let startStr = '08:00:00';
                let tolerance = 15;
                let advance = 30;

                // Check if today's schedule exists
                const { data: scheduleData } = await supabase
                    .from('employee_schedules')
                    .select('*, shifts(*)')
                    .eq('user_id', user.id)
                    .eq('date', today)
                    .maybeSingle();

                const todaySchedule = scheduleData as EmployeeSchedule | null;

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
            setStep('idle');
        }
    };

    const getGPSStrength = (acc: number | null) => {
        if (!acc) return { text: 'Mencari Sinyal...', color: 'text-slate-500', bg: 'bg-slate-100', bar: 1 };
        if (acc <= 15) return { text: 'Sinyal Kuat', color: 'text-green-600', bg: 'bg-green-50', bar: 4 };
        if (acc <= 30) return { text: 'Sinyal Bagus', color: 'text-blue-600', bg: 'bg-blue-50', bar: 3 };
        if (acc <= 100) return { text: 'Sinyal Cukup', color: 'text-yellow-600', bg: 'bg-yellow-50', bar: 2 };
        return { text: 'Sinyal Lemah', color: 'text-red-500', bg: 'bg-red-50', bar: 1 };
    };

    const gpsStatus = getGPSStrength(accuracy);

    // --- DESKTOP BLOCKER ---
    if (!isMobile) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md border-0 shadow-2xl rounded-[32px] overflow-hidden bg-white p-12 text-center space-y-6">
                        <div className="flex justify-center relative">
                            <div className="h-24 w-24 bg-blue-50 rounded-3xl flex items-center justify-center shadow-inner">
                                <AlertCircle className="h-12 w-12 text-blue-600" />
                            </div>
                            <div className="absolute -bottom-2 right-[35%] bg-white rounded-full p-2 shadow-lg border border-red-50">
                                <AlertCircle className="h-6 w-6 text-red-500" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Akses Terbatas</h2>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed">
                                Fitur Absensi Cepat hanya tersedia melalui <span className="text-blue-600 underline">Aplikasi Mobile</span> demi keamanan verifikasi sidik jari.
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard')}
                            className="w-full h-14 bg-slate-900 hover:bg-black rounded-2xl font-bold text-white transition-all"
                        >
                            Kembali ke Beranda
                        </Button>
                    </Card>
                </div>
            </DashboardLayout>
        );
    }

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
                                    <p className="text-xs text-slate-500 font-medium mt-1">Verifikasi Lokasi</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate('/dashboard')}
                                    className="rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500"
                                >
                                    <RefreshCw className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="px-6 pb-6 space-y-6">
                            {/* Simple Submit Section */}
                            <div className="bg-white rounded-3xl pt-2">
                                <div className="text-center">
                                    <Button
                                        onClick={handleSubmit}
                                        size="lg"
                                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl text-lg font-bold shadow-blue-200 shadow-xl transition-all active:scale-95"
                                        disabled={!latitude || !longitude || submitting}
                                    >
                                        {!latitude ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-5 w-5 animate-spin" /> Tunggu Lokasi...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <CheckCircle2 className="h-6 w-6" /> {submitting ? 'Memproses...' : 'ABSEN SEKARANG'}
                                            </span>
                                        )}
                                    </Button>
                                </div>
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
                                                        {nearestOfficeDist ? Math.round(nearestOfficeDist) : 0}m / {officeLocations.find(o => {
                                                            const dist = getDistanceFromLatLonInM(latitude, longitude, o.latitude, o.longitude);
                                                            return dist === nearestOfficeDist;
                                                        })?.radius_meters || 30}m
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>

                                        {/* Overlay Status Bar */}
                                        <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-sm flex items-center justify-between border border-white/50">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shadow-inner", gpsStatus.bg)}>
                                                    <RefreshCw className={cn("h-5 w-5", gpsStatus.color, accuracy && accuracy > 50 ? "animate-pulse" : "")} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Akurasi GPS</p>
                                                    <div className="flex items-center gap-1">
                                                        <span className={cn("text-sm font-black", gpsStatus.color)}>{accuracy ? Math.round(accuracy) : '-'}</span>
                                                        <span className="text-xs text-slate-400">Meter</span>
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
                                                <RefreshCw className="h-6 w-6 text-blue-500 animate-pulse" />
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
