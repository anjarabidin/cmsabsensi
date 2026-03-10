import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    User, Clock, LayoutGrid, Megaphone, Sparkles, Rocket, Calendar,
    BarChart3, Bell, Shield
} from 'lucide-react';
import confetti from 'canvas-confetti';

// ─── Shared tooltip style factory ────────────────────────────────────────────
const tip = (
    icon: React.ReactNode,
    iconBg: string,
    title: string,
    desc: React.ReactNode
) => (
    <div className="space-y-2 text-left p-1">
        <div className={`flex items-center gap-2 ${iconBg.replace('bg-', 'text-').replace('-50', '-600')}`}>
            <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center shadow-sm`}>
                {icon}
            </div>
            <h4 className="font-black text-base">{title}</h4>
        </div>
        <p className="text-slate-600 text-xs leading-relaxed">{desc}</p>
    </div>
);

export function DashboardTour() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [run, setRun] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        setIsDesktop(window.innerWidth >= 1024);
    }, []);

    // ─── MOBILE Steps ──────────────────────────────────────────────────────────
    const mobileSteps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-center space-y-3 px-1 py-2">
                    <div className="relative inline-block">
                        <div className="text-4xl mb-1" style={{ animation: 'float-animation 3s ease-in-out infinite' }}>👋</div>
                        <div className="absolute -top-1 -right-1 animate-pulse">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-1 leading-tight">
                            Halo, {profile?.full_name?.split(' ')[0] || 'Rekan'}!
                        </h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Selamat datang di <strong>CMS Absensi</strong>. Mari kami tunjukkan fitur-fitur utamanya.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="profile-header"]',
            content: tip(
                <User className="h-4 w-4" />, 'bg-blue-50',
                'Identitas Digital',
                'Salam dan foto profil Anda ditampilkan di sini. Tap untuk melihat detail akun.'
            ),
            disableBeacon: true,
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="attendance-card"]',
            content: tip(
                <Clock className="h-4 w-4" />, 'bg-amber-50',
                'Kartu Presensi',
                <>
                    Pantau status kerja <i>real-time</i>. Warna berubah otomatis:
                    <span className="block mt-1 font-bold text-blue-600">• Biru: Belum Absen</span>
                    <span className="block font-bold text-orange-600">• Orange: Sudah Masuk</span>
                    <span className="block font-bold text-green-600">• Hijau: Sudah Pulang</span>
                </>
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="quick-action"]',
            content: tip(
                <Clock className="h-4 w-4" />, 'bg-blue-50',
                'Akses Cepat Absen',
                'Tombol ini membawa Anda langsung ke Absensi GPS — cara tercepat memulai hari kerja.'
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="nav-history"]',
            content: tip(
                <Calendar className="h-4 w-4" />, 'bg-purple-50',
                'Riwayat Kerja',
                'Lihat catatan kehadiran, keterlambatan, dan lembur Anda sebulan terakhir.'
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="nav-schedule"]',
            content: tip(
                <LayoutGrid className="h-4 w-4" />, 'bg-indigo-50',
                'Agenda & Kegiatan',
                'Cek jadwal meeting dan acara kantor agar tidak ada yang terlewat.'
            ),
            spotlightPadding: 6,
        },
        {
            target: '[data-tour="main-menu-grid"]',
            content: tip(
                <LayoutGrid className="h-4 w-4" />, 'bg-indigo-50',
                'Pusat Layanan HR',
                <>Semua pengajuan <b>Cuti</b>, <b>Klaim</b>, <b>Slip Gaji</b>, hingga <b>Album Foto</b> kantor ada di sini.</>
            ),
            spotlightPadding: 10,
        },
        {
            target: '[data-tour="news-feed"]',
            content: tip(
                <Megaphone className="h-4 w-4" />, 'bg-pink-50',
                'Berita & Artikel',
                'Update terbaru dari perusahaan dan tips produktivitas harian ditampilkan di sini.'
            ),
            spotlightPadding: 4,
        },
        {
            target: '[data-tour="nav-profile"]',
            content: tip(
                <User className="h-4 w-4" />, 'bg-slate-50',
                'Manajemen Profil',
                <>Lengkapi <b>Data Kepegawaian</b>, ganti <b>Password</b>, atau daftar <b>Face Recognition</b> di menu ini.</>
            ),
            spotlightPadding: 6,
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-3 px-1 py-4">
                    <div className="text-4xl mb-1" style={{ animation: 'float-animation 2.5s ease-in-out infinite' }}>🛡️</div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-1">Keamanan Biometrik</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Gunakan <b>Sidik Jari</b> atau <b>Face ID</b> untuk verifikasi absensi yang lebih cepat dan aman.
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
                    <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                        <Rocket className="h-7 w-7 text-blue-600 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-xl text-slate-900 mb-1">Siap Beraksi?</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">Mari raih produktivitas maksimal mulai hari ini!</p>
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

    // ─── DESKTOP Steps ─────────────────────────────────────────────────────────
    const desktopSteps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-2 py-3">
                    <div className="relative inline-block">
                        <div className="text-5xl mb-2" style={{ animation: 'float-animation 3s ease-in-out infinite' }}>👋</div>
                        <div className="absolute -top-1 -right-1 animate-pulse">
                            <Sparkles className="h-5 w-5 text-amber-400" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-2xl text-slate-900 mb-2 leading-tight">
                            Halo, {profile?.full_name?.split(' ')[0] || 'Rekan'}!
                        </h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium">
                            Selamat datang di <strong>CMS Absensi Desktop</strong>. Kami akan tunjukkan fitur-fitur utama di tampilan ini.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="desktop-header"]',
            content: tip(
                <User className="h-4 w-4" />, 'bg-blue-50',
                'Header Selamat Datang',
                <>Salam personal, tanggal hari ini, dan tombol <b>Refresh</b> data absensi tersedia di area ini.</>
            ),
            placement: 'bottom',
            disableBeacon: true,
            spotlightPadding: 10,
        },
        {
            target: '[data-tour="attendance-card"]',
            content: tip(
                <Clock className="h-4 w-4" />, 'bg-amber-50',
                'Kartu Status Absensi',
                <>
                    Hero card besar ini menampilkan status kerja Anda <i>real-time</i>. Warnanya berubah otomatis:
                    <span className="block mt-1.5 font-bold text-blue-600">🔵 Biru — Belum Absen</span>
                    <span className="block font-bold text-orange-500">🟠 Orange — Sudah Clock-In</span>
                    <span className="block font-bold text-emerald-600">🟢 Hijau — Sudah Clock-Out</span>
                </>
            ),
            placement: 'bottom',
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="desktop-stats"]',
            content: tip(
                <BarChart3 className="h-4 w-4" />, 'bg-indigo-50',
                'Statistik Bulanan',
                <>
                    Empat kartu ini merangkum performa Anda: <b>Hadir</b>, <b>Terlambat</b>, <b>Cuti/Izin</b>, dan <b>Lembur</b>.
                    Admin melihat ringkasan keseluruhan tim secara real-time.
                </>
            ),
            placement: 'top',
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="desktop-chart"]',
            content: tip(
                <BarChart3 className="h-4 w-4" />, 'bg-cyan-50',
                'Grafik Kehadiran',
                'Visualisasi tren absensi bulan berjalan — lihat pola kehadiran Anda dalam satu pandangan.'
            ),
            placement: 'top',
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="desktop-announcements"]',
            content: tip(
                <Megaphone className="h-4 w-4" />, 'bg-orange-50',
                'Pengumuman Perusahaan',
                'Widget sidebar ini menampilkan pengumuman terbaru dari manajemen. Klik untuk membaca detail lengkap.'
            ),
            placement: 'left',
            spotlightPadding: 8,
        },
        {
            target: '[data-tour="desktop-agenda-widget"]',
            content: tip(
                <Calendar className="h-4 w-4" />, 'bg-indigo-50',
                'Agenda Hari Ini',
                'Ringkasan jadwal rapat dan kegiatan yang berlangsung hari ini. Klik untuk navigasi ke halaman Agenda lengkap.'
            ),
            placement: 'left',
            spotlightPadding: 8,
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-3 px-2 py-4">
                    <div className="text-4xl mb-1" style={{ animation: 'float-animation 2.5s ease-in-out infinite' }}>🛡️</div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-1">Keamanan & Biometrik</h3>
                        <p className="text-slate-500 leading-relaxed text-xs font-medium">
                            Di menu <b>Profil</b>, Anda bisa mengaktifkan <b>Fingerprint</b>, mengubah <b>Password</b>, atau mendaftarkan <b>Face Recognition</b>.
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
                <div className="text-center space-y-4 px-2 py-4">
                    <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
                        <Rocket className="h-8 w-8 text-white animate-bounce" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-2xl text-slate-900 mb-1">Dashboard Siap! 🎉</h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium">
                            Anda sudah mengenal seluruh fitur utama. Selamat bekerja dan semangat produktif!
                        </p>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 w-full" />
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
    ];

    const steps = isDesktop ? desktopSteps : mobileSteps;

    useEffect(() => {
        const checkTourStatus = () => {
            if (!user) return;
            const seenLocal = localStorage.getItem(`tour_seen_${user.id}`);
            if (!seenLocal) {
                // Small delay for DOM to be ready
                setTimeout(() => setRun(true), 800);
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
                confetti({
                    particleCount: 200,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#2563eb', '#4f46e5', '#818cf8', '#ffffff', '#60a5fa']
                });

                toast({
                    title: '🎓 Anda Sudah Menguasai Dashboard!',
                    description: 'Selamat datang di tim digital kami. Semangat!',
                    duration: 4000,
                });
            }
        }
    };

    const tooltipWidth = isDesktop ? 340 : 280;

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
                    overlayColor: 'rgba(15, 23, 42, 0.80)',
                    arrowColor: '#fff',
                    backgroundColor: '#fff',
                    textColor: '#1e293b',
                    width: tooltipWidth,
                },
                tooltip: {
                    borderRadius: '24px',
                    fontFamily: 'inherit',
                    padding: '22px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(226, 232, 240, 0.6)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                },
                buttonNext: {
                    borderRadius: '14px',
                    fontWeight: '900',
                    padding: '10px 20px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                },
                buttonBack: {
                    color: '#94a3b8',
                    marginRight: '10px',
                    fontWeight: '700',
                    fontSize: '12px',
                },
                buttonSkip: {
                    color: '#94a3b8',
                    fontWeight: '700',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                },
                spotlight: {
                    borderRadius: '20px',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.80), 0 0 0 3px rgba(37, 99, 235, 0.4)',
                },
                progress: {
                    marginRight: '15px',
                    marginTop: '2px',
                },
            }}
        />
    );
}
