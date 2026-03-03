import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, Clock, LayoutGrid, Megaphone, Sparkles, Rocket, Calendar } from 'lucide-react';
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
                        Data diri Anda terverifikasi di sini. Pastikan sudah benar.
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
                        <h4 className="font-black text-base">Kartu Presensi</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Pantau status kerja secara <i>real-time</i>. Warna kartu akan berubah otomatis:
                        <span className="block mt-1 font-bold text-blue-600">• Biru: Belum Absen</span>
                        <span className="block font-bold text-green-600">• Hijau: Sudah Masuk</span>
                        <span className="block font-bold text-slate-600">• Abu: Sudah Pulang</span>
                    </p>
                </div>
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="quick-action"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-blue-600">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shadow-sm">
                            <Clock className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Akses Cepat Absen</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Gunakan tombol ini untuk langsung menuju halaman <b>Absensi GPS</b>. Ini adalah cara tercepat untuk memulai hari Anda.
                    </p>
                </div>
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="nav-history"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-purple-600">
                        <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shadow-sm">
                            <Calendar className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Riwayat Kerja</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Lihat kembali catatan kehadiran, keterlambatan, dan lembur Anda selama sebulan terakhir di sini.
                    </p>
                </div>
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="nav-schedule"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shadow-sm">
                            <LayoutGrid className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Agenda & Kegiatan</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Cek jadwal meeting, acara kantor, atau catatan pribadi Anda agar tidak ada yang terlewat.
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
                        Semua pengajuan <b>Cuti</b>, <b>Klaim</b>, <b>Slip Gaji</b>, hingga <b>Album Foto</b> kantor ada dalam satu genggaman.
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
                        <h4 className="font-black text-base">Berita & Artikel</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Update terbaru dari perusahaan dan tips produktivitas harian akan muncul di sini. Tetaplah terinformasi!
                    </p>
                </div>
            ),
            spotlightPadding: 4,
        },
        {
            target: '[data-tour="nav-profile"]',
            content: (
                <div className="space-y-2 text-left p-1">
                    <div className="flex items-center gap-2 text-slate-600">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shadow-sm">
                            <User className="h-4 w-4" />
                        </div>
                        <h4 className="font-black text-base">Manajemen Profil</h4>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Lengkapi <b>Data Kepegawaian</b>, ganti <b>Password</b>, atau daftar <b>Face Recognition</b> di menu ini.
                    </p>
                </div>
            ),
            spotlightPadding: 6,
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-3 px-1 py-4">
                    <div className="relative inline-block">
                        <div className="text-4xl mb-1" style={{ animation: 'float-animation 2.5s ease-in-out infinite' }}>🛡️</div>
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-1">Keamanan Biometrik</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Gunakan <b>Sidik Jari</b> atau <b>Face ID</b> untuk verifikasi absensi yang lebih cepat dan bebas manipulasi.
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
        const checkTourStatus = () => {
            if (!user) return;

            // Check if seen locally only (device-specific)
            const seenLocal = localStorage.getItem(`tour_seen_${user.id}`);

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
                localStorage.setItem(`tour_seen_${user.id}`, 'true');
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
