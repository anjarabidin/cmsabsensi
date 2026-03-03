import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, Clock, LayoutGrid, Megaphone, Sparkles, Rocket } from 'lucide-react';
import confetti from 'canvas-confetti';

export function DashboardTour() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [run, setRun] = useState(false);

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-center space-y-3 px-1 py-2 animate-in fade-in zoom-in duration-500">
                    <div className="relative inline-block">
                        <div className="text-4xl mb-1" style={{ animation: 'float-animation 3s ease-in-out infinite' }}>👋</div>
                        <div className="absolute -top-1 -right-1 transform transition-transform animate-pulse">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-1 leading-tight">
                            Halo, {profile?.full_name?.split(' ')[0] || 'Rekan'}!
                        </h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Selamat datang di <strong>Duta Mruput Enterprise</strong>. Mari kami tunjukkan fitur cerdas untuk hari Anda.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="profile-header"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-blue-600">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shadow-sm">
                            <User className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Identitas Digital</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Data diri Anda terverifikasi di sini. Pastikan <strong>Employee ID</strong> dan <strong>Supervisor</strong> sudah benar.
                    </p>
                </div>
            ),
            disableBeacon: true,
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="attendance-card"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-amber-600">
                        <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shadow-sm">
                            <Clock className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Status Kehadiran</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Pantau status kerja secara <i>real-time</i>. Warna kartu akan berubah otomatis mengikuti aktivitas absen Anda.
                    </p>
                </div>
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="main-menu-grid"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shadow-sm">
                            <LayoutGrid className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Pusat Layanan HR</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Mulai dari <b>Absensi GPS</b>, pengajuan <b>Cuti/Lembur</b>, hingga catatan harian dan laporan ada di sini.
                    </p>
                </div>
            ),
            spotlightPadding: 10,
        },
        {
            target: '[data-tour="news-feed"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-pink-600">
                        <div className="h-8 w-8 rounded-lg bg-pink-50 flex items-center justify-center shadow-sm">
                            <Megaphone className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Informasi Terbaru</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Jangan sampai ketinggalan update penting dari perusahaan. Semua berita akan tampil di sini.
                    </p>
                </div>
            ),
            spotlightPadding: 4,
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-3 px-1 py-4">
                    <div className="relative inline-block">
                        <div className="text-4xl mb-1" style={{ animation: 'float-animation 2.5s ease-in-out infinite' }}>🛡️</div>
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-1">Biometrik</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Gunakan <b>Sidik Jari</b> atau <b>Face ID</b> untuk login yang lebih instan dan aman.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-1 py-4">
                    <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner relative">
                        <Rocket className="h-7 w-7 text-blue-600 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-xl text-slate-900 mb-1">Siap Beraksi?</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Mari raih produktivitas maksimal mulai hari ini!
                        </p>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 w-full animate-in slide-in-from-left duration-1000" />
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
    ];

    useEffect(() => {
        const checkTourStatus = async () => {
            if (!user || !profile) return;

            // Check if seen in localStorage or profile
            const seenLocal = localStorage.getItem(`tour_seen_${user.id}`);
            const seenProfile = profile.has_seen_tour;

            if (!seenLocal && !seenProfile) {
                setRun(true);
            }
        };

        checkTourStatus();
    }, [user, profile]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data;

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRun(false);
            if (user) {
                localStorage.setItem(`tour_seen_${user.id}`, 'true');

                await supabase
                    .from('profiles')
                    .update({ has_seen_tour: true })
                    .eq('id', user.id);
            }

            if (status === STATUS.FINISHED) {
                // PREMIUM CELEBRATION
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#2563eb', '#4f46e5', '#818cf8', '#ffffff']
                });

                toast({
                    title: "Status: Ahli Dashboard 🎓",
                    description: "Selamat datang di tim digital kami!",
                    duration: 3000,
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
                    width: 280,
                },
                tooltip: {
                    borderRadius: '20px',
                    fontFamily: 'inherit',
                    padding: '20px',
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
