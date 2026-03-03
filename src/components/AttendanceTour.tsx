import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Target, RefreshCw, MapPin, Camera, CheckCircle2, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export function AttendanceTour() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [run, setRun] = useState(false);

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-center space-y-3 px-1 py-4 animate-in fade-in slide-in-from-bottom duration-500">
                    <div className="h-12 w-12 bg-blue-100/50 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                        <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-1">Panduan Absensi Presisi</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Mari sinkronkan perangkat Anda dengan sistem untuk menjamin absensi <strong>100% Valid</strong> dan terdata.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="gps-indicator"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-green-600">
                        <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center shadow-sm">
                            <Target className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Akurasi GPS</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Indikator harus berwarna <strong className="text-green-600">Hijau</strong>. Jika <span className="text-yellow-600 font-bold">Kuning</span>, artinya sinyal tidak stabil. Sistem akan menolak absensi jika lokasi tidak akurat.
                    </p>
                </div>
            ),
            disableBeacon: true,
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="refresh-gps"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-blue-600">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shadow-sm">
                            <RefreshCw className="h-4 w-4 animate-spin-slow" />
                        </div>
                        <h4 className="font-black text-base">Kalibrasi Sinyal</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Jika lokasi macet atau tidak sesuai, tekan tombol ini untuk memaksa perangkat mencari satelit baru.
                    </p>
                </div>
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="select-office"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shadow-sm">
                            <MapPin className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Zona Kantor</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Pilih lokasi kantor tempat Anda bekerja. Anda hanya bisa absen jika berada dalam <b>Radius 50 Meter</b> dari titik kantor yang dipilih.
                    </p>
                </div>
            ),
            spotlightPadding: 4,
        },
        {
            target: '[data-tour="face-photo"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-purple-600">
                        <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shadow-sm">
                            <Camera className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base italic">Coming Soon!</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Fitur <b>Bukti Foto Wajah</b> gunakan saat akan melakukan presensi.
                        <br />
                        <span className="text-[10px] text-slate-400 font-bold mt-1 block tracking-tight">Pantau terus pembaruan aplikasi! 🚀</span>
                    </p>
                </div>
            ),
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="submit-attendance"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-emerald-600">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shadow-sm">
                            <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Finalisasi</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Tombol akan aktif setelah <b>GPS Terkunci</b> dan Anda berada di <b>Radius Lokasi</b> yang diizinkan.
                    </p>
                </div>
            ),
            spotlightPadding: 16,
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-1 py-4">
                    <div className="h-14 w-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner relative overflow-hidden">
                        <ShieldCheck className="h-7 w-7 text-green-600 relative z-10" />
                        <div className="absolute inset-0 bg-green-100 opacity-20 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-xl text-slate-900 mb-1">Siap Presensi?</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Pastikan Anda berada di lokasi yang aman dan memiliki koneksi internet yang stabil.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
    ];

    useEffect(() => {
        const checkTourStatus = () => {
            if (!user) return;

            // Auto run only if not seen before on this device
            const seenLocal = localStorage.getItem(`tour_attendance_seen_${user.id}`);

            if (!seenLocal) {
                setRun(true);
            }
        };
        checkTourStatus();
    }, [user]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data;

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRun(false);
            if (user) {
                localStorage.setItem(`tour_attendance_seen_${user.id}`, 'true');
            }

            if (status === STATUS.FINISHED) {
                // Celebration
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#059669', '#34d399', '#6ee7b7']
                });

                toast({
                    title: "Siap Absen! 🚀",
                    description: "Silakan lakukan presensi sekarang.",
                    duration: 3000,
                    className: "bg-green-50 border-green-200 text-green-900",
                });
            }
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showSkipButton
            showProgress
            scrollToFirstStep
            disableOverlayClose={true}
            spotlightClicks={false}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#2563eb',
                    zIndex: 10000,
                    overlayColor: 'rgba(15, 23, 42, 0.85)',
                    arrowColor: '#fff',
                    backgroundColor: '#fff',
                    textColor: '#1e293b',
                    width: 280, // Compact width
                },
                tooltip: {
                    borderRadius: '20px', // Smaller radius
                    fontFamily: 'inherit',
                    padding: '20px', // Compact padding
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    border: '1px solid rgba(226, 232, 240, 0.8)'
                },
                buttonNext: {
                    borderRadius: '12px',
                    fontWeight: '900',
                    padding: '10px 18px',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
                    background: 'linear-gradient(to right, #2563eb, #4f46e5)',
                },
                buttonBack: {
                    color: '#94a3b8',
                    marginRight: '10px',
                    fontWeight: '700',
                    fontSize: '12px'
                },
                buttonSkip: {
                    color: '#94a3b8',
                    fontWeight: '700',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                },
                spotlight: {
                    borderRadius: '16px',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.85), 0 0 20px rgba(37, 99, 235, 0.3)'
                },
                progress: {
                    marginRight: '15px',
                    marginTop: '2px'
                }
            }}
        />
    );
}
