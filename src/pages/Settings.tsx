import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import {
    Loader2, Camera, ChevronLeft, Save, Wifi, Trash2, Info,
    AlertTriangle, RefreshCw, Building2, MapPin, CalendarDays,
    Timer, Bell, Shield, ChevronRight, Check, Settings2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SettingsState {
    require_face_verification: boolean;
    require_selfie_photo: boolean;
    attendance_photo_auto_cleanup: boolean;
    attendance_photo_retention_days: number;
    enable_keepalive_ping: boolean;
    keepalive_interval_minutes: number;
    keepalive_start_hour: number;
    keepalive_end_hour: number;
    company_name: string;
    company_timezone: string;
    company_logo_url: string;
    gps_min_accuracy_meters: number;
    allow_wfh_mode: boolean;
    block_fake_gps: boolean;
    attendance_clock_in_latest_hour: number;
    attendance_clock_in_latest_minute: number;
    overtime_minimum_minutes: number;
    overtime_require_approval: boolean;
    leave_max_days_per_year: number;
    leave_min_notice_days: number;
    leave_require_approval: boolean;
    reminder_enabled: boolean;
    reminder_clockin_minutes_before: number;
    reminder_clockout_minutes_before: number;
    reminder_workdays_only: boolean;
    // Account Approval & Security
    enable_account_approval: boolean;
    account_approval_roles: string;
    max_devices_per_user: number;
}

const DEFAULTS: SettingsState = {
    require_face_verification: false,
    require_selfie_photo: false,
    attendance_photo_auto_cleanup: true,
    attendance_photo_retention_days: 30,
    enable_keepalive_ping: true,
    keepalive_interval_minutes: 4,
    keepalive_start_hour: 6,
    keepalive_end_hour: 22,
    company_name: '',
    company_timezone: 'Asia/Jakarta',
    company_logo_url: '',
    gps_min_accuracy_meters: 50,
    allow_wfh_mode: true,
    block_fake_gps: true,
    attendance_clock_in_latest_hour: 10,
    attendance_clock_in_latest_minute: 0,
    overtime_minimum_minutes: 30,
    overtime_require_approval: true,
    leave_max_days_per_year: 12,
    leave_min_notice_days: 1,
    leave_require_approval: true,
    leave_allow_half_day: true,
    // Notification defaults
    reminder_enabled: true,
    reminder_clockin_minutes_before: 10,
    reminder_clockout_minutes_before: 10,
    reminder_workdays_only: false,
    enable_account_approval: true,
    account_approval_roles: 'super_admin,admin_hr',
    max_devices_per_user: 3,
};

// ─── Nav Sections ─────────────────────────────────────────────────────────────
type SectionId = 'company' | 'attendance' | 'gps' | 'schedule' | 'leave' | 'notification' | 'storage' | 'system';

interface NavSection {
    id: SectionId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
}

const SECTIONS: NavSection[] = [
    { id: 'company', label: 'Perusahaan', icon: Building2, desc: 'Identitas & zona waktu' },
    { id: 'attendance', label: 'Absensi', icon: Camera, desc: 'Kamera & foto kehadiran' },
    { id: 'gps', label: 'Lokasi & GPS', icon: MapPin, desc: 'Validasi posisi karyawan' },
    { id: 'schedule', label: 'Jam & Lembur', icon: Timer, desc: 'Batas jam & lembur' },
    { id: 'leave', label: 'Cuti & Izin', icon: CalendarDays, desc: 'Aturan pengajuan cuti' },
    { id: 'security', label: 'Keamanan', icon: Shield, desc: 'Persetujuan pendaftaran' },
    { id: 'notification', label: 'Notifikasi', icon: Bell, desc: 'Reminder absen masuk/pulang' },
    { id: 'storage', label: 'Penyimpanan', icon: Trash2, desc: 'Retensi & auto-cleanup foto' },
    { id: 'system', label: 'Sistem', icon: Wifi, desc: 'Keep-alive & performa' },
];

// ─── Primitive Controls ───────────────────────────────────────────────────────
const SettingRow = ({
    label, desc, children, danger, warning, tag
}: {
    label: string;
    desc?: string;
    children: React.ReactNode;
    danger?: boolean;
    warning?: string;
    tag?: string;
}) => (
    <div className="group flex items-start justify-between gap-8 py-5 border-b border-slate-100 last:border-0">
        <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
                <span className={cn("text-sm font-semibold", danger ? "text-red-600" : "text-slate-800")}>
                    {label}
                </span>
                {tag && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-blue-50 text-blue-600 border border-blue-100">
                        {tag}
                    </span>
                )}
            </div>
            {desc && <p className="text-[13px] text-slate-400 leading-relaxed max-w-[520px]">{desc}</p>}
            {warning && (
                <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {warning}
                </p>
            )}
        </div>
        <div className="shrink-0 flex items-center">{children}</div>
    </div>
);

const ProSwitch = ({ checked, onChange, colorClass = "data-[state=checked]:bg-slate-900", disabled }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    colorClass?: string;
    disabled?: boolean;
}) => (
    <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={cn("h-6 w-11", colorClass, disabled && "opacity-40 cursor-not-allowed")}
    />
);

const NumField = ({ value, onChange, min, max, suffix, disabled, width = "w-24" }: {
    value: number; onChange: (v: number) => void;
    min?: number; max?: number; suffix?: string;
    disabled?: boolean; width?: string;
}) => (
    <div className="flex items-center gap-2">
        <Input
            type="number" min={min} max={max} value={value} disabled={disabled}
            onChange={e => onChange(Number(e.target.value))}
            className={cn(
                width, "h-9 text-center text-sm font-semibold rounded-lg",
                "border-slate-200 bg-white focus:border-slate-400 focus:ring-0",
                disabled && "opacity-40 cursor-not-allowed"
            )}
        />
        {suffix && <span className="text-sm text-slate-400 font-medium whitespace-nowrap">{suffix}</span>}
    </div>
);

const TimeField = ({ h, m, onH, onM, disabled }: {
    h: number; m: number; onH: (v: number) => void; onM: (v: number) => void; disabled?: boolean;
}) => (
    <div className="flex items-center gap-1">
        <Input type="number" min={0} max={23} value={h} onChange={e => onH(Number(e.target.value))}
            disabled={disabled}
            className="w-16 h-9 text-center text-sm font-semibold rounded-lg border-slate-200 focus:border-slate-400 focus:ring-0 disabled:opacity-40" />
        <span className="text-slate-300 font-bold text-xl leading-none">:</span>
        <Input type="number" min={0} max={59} value={String(m).padStart(2, '0')} onChange={e => onM(Number(e.target.value))}
            disabled={disabled}
            className="w-16 h-9 text-center text-sm font-semibold rounded-lg border-slate-200 focus:border-slate-400 focus:ring-0 disabled:opacity-40" />
        <span className="text-sm text-slate-400 ml-1">WIB</span>
    </div>
);

// ─── Section Panel ────────────────────────────────────────────────────────────
const SectionPanel = ({ title, desc, children }: {
    title: string; desc: string; children: React.ReactNode;
}) => (
    <div className="space-y-0">
        <div className="pb-6 mb-1 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{desc}</p>
        </div>
        {children}
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Settings() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const isMobile = useIsMobile();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeSection, setActiveSection] = useState<SectionId>('company');
    const [showDetail, setShowDetail] = useState(false);
    const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
    const [pingStatus, setPingStatus] = useState<'idle' | 'pinging' | 'ok' | 'error'>('idle');
    const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const set = <K extends keyof SettingsState>(key: K, val: SettingsState[K]) =>
        setSettings(p => ({ ...p, [key]: val }));

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        const { data } = await supabase.from('app_settings').select('key, value');
        const m: Record<string, any> = {};
        (data || []).forEach(r => { m[r.key] = r.value; });

        const toBool = (v: any, def: boolean): boolean => {
            if (v === undefined || v === null) return def;
            if (typeof v === 'boolean') return v;
            const cleaned = String(v).replace(/^"|"$/g, '').toLowerCase();
            return cleaned === 'true';
        };

        const toString = (v: any, def: string): string => {
            if (v === undefined || v === null) return def;
            return String(v).replace(/^"|"$/g, '');
        };

        const toNum = (v: any, def: number): number => {
            if (v === undefined || v === null) return def;
            const n = Number(String(v).replace(/^"|"$/g, ''));
            return isNaN(n) ? def : n;
        };

        setSettings({
            require_face_verification: toBool(m['require_face_verification'], DEFAULTS.require_face_verification),
            require_selfie_photo: toBool(m['require_selfie_photo'], DEFAULTS.require_selfie_photo),
            attendance_photo_auto_cleanup: toBool(m['attendance_photo_auto_cleanup'], DEFAULTS.attendance_photo_auto_cleanup),
            attendance_photo_retention_days: toNum(m['attendance_photo_retention_days'], DEFAULTS.attendance_photo_retention_days),
            enable_keepalive_ping: toBool(m['enable_keepalive_ping'], DEFAULTS.enable_keepalive_ping),
            keepalive_interval_minutes: toNum(m['keepalive_interval_minutes'], DEFAULTS.keepalive_interval_minutes),
            keepalive_start_hour: toNum(m['keepalive_start_hour'], DEFAULTS.keepalive_start_hour),
            keepalive_end_hour: toNum(m['keepalive_end_hour'], DEFAULTS.keepalive_end_hour),
            company_name: toString(m['company_name'], ''),
            company_timezone: toString(m['company_timezone'], 'Asia/Jakarta'),
            company_logo_url: toString(m['company_logo_url'], ''),
            gps_min_accuracy_meters: toNum(m['gps_min_accuracy_meters'], DEFAULTS.gps_min_accuracy_meters),
            allow_wfh_mode: toBool(m['allow_wfh_mode'], DEFAULTS.allow_wfh_mode),
            block_fake_gps: toBool(m['block_fake_gps'], DEFAULTS.block_fake_gps),
            attendance_clock_in_latest_hour: toNum(m['attendance_clock_in_latest_hour'], DEFAULTS.attendance_clock_in_latest_hour),
            attendance_clock_in_latest_minute: toNum(m['attendance_clock_in_latest_minute'], DEFAULTS.attendance_clock_in_latest_minute),
            overtime_minimum_minutes: toNum(m['overtime_minimum_minutes'], DEFAULTS.overtime_minimum_minutes),
            overtime_require_approval: toBool(m['overtime_require_approval'], DEFAULTS.overtime_require_approval),
            leave_max_days_per_year: toNum(m['leave_max_days_per_year'], DEFAULTS.leave_max_days_per_year),
            leave_min_notice_days: toNum(m['leave_min_notice_days'], DEFAULTS.leave_min_notice_days),
            leave_require_approval: toBool(m['leave_require_approval'], DEFAULTS.leave_require_approval),
            leave_allow_half_day: toBool(m['leave_allow_half_day'], DEFAULTS.leave_allow_half_day),

            reminder_enabled: toBool(m['reminder_enabled'] ?? m['reminder_clock_in_enabled'], DEFAULTS.reminder_enabled),
            reminder_clockin_minutes_before: toNum(m['reminder_clockin_minutes_before'], DEFAULTS.reminder_clockin_minutes_before),
            reminder_clockout_minutes_before: toNum(m['reminder_clockout_minutes_before'], DEFAULTS.reminder_clockout_minutes_before),
            reminder_workdays_only: toBool(m['reminder_workdays_only'] ?? m['reminder_workday_only'], DEFAULTS.reminder_workdays_only),

            enable_account_approval: toBool(m['enable_account_approval'], DEFAULTS.enable_account_approval),
            account_approval_roles: toString(m['account_approval_roles'], DEFAULTS.account_approval_roles),
        });
        setLoading(false);
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    // ── Keep-alive ─────────────────────────────────────────────────────────
    const runPing = useCallback(async () => {
        const h = new Date().getHours();
        if (h < settings.keepalive_start_hour || h >= settings.keepalive_end_hour) return;
        setPingStatus('pinging');
        try { await supabase.from('app_settings').select('key').limit(1); setPingStatus('ok'); }
        catch { setPingStatus('error'); }
    }, [settings.keepalive_start_hour, settings.keepalive_end_hour]);

    useEffect(() => {
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        if (!settings.enable_keepalive_ping) { setPingStatus('idle'); return; }
        keepAliveRef.current = setInterval(runPing, Math.max(1, settings.keepalive_interval_minutes) * 60000);
        return () => { if (keepAliveRef.current) clearInterval(keepAliveRef.current); };
    }, [settings.enable_keepalive_ping, settings.keepalive_interval_minutes, runPing]);

    // ── Save ───────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            for (const [key, value] of Object.entries(settings)) {
                await supabase.from('app_settings').upsert(
                    { key, value, updated_at: new Date().toISOString(), updated_by: user?.id },
                    { onConflict: 'key' }
                );
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            toast({ title: "Pengaturan disimpan", description: "Semua perubahan berhasil diperbarui.", className: "bg-slate-900 text-white border-none" });
        } catch (err: any) {
            toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
        } finally { setSaving(false); }
    };

    if (loading) return (
        <DashboardLayout>
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
        </DashboardLayout>
    );

    // ── Section content map ────────────────────────────────────────────────
    const sectionContent: Record<SectionId, React.ReactNode> = {
        company: (
            <SectionPanel title="Profil Perusahaan" desc="Informasi dasar perusahaan yang tampil di laporan dan aplikasi.">
                <SettingRow label="Nama Perusahaan" desc="Ditampilkan di header laporan, slip gaji, dan notifikasi.">
                    <Input value={settings.company_name} onChange={e => set('company_name', e.target.value)}
                        placeholder="PT Nama Perusahaan"
                        className="w-64 h-9 text-sm rounded-lg border-slate-200 focus:border-slate-400 focus:ring-0" />
                </SettingRow>
                <SettingRow label="Zona Waktu" desc="Digunakan untuk semua perhitungan jam absensi dan pengiriman notifikasi.">
                    <select value={settings.company_timezone} onChange={e => set('company_timezone', e.target.value)}
                        className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 text-sm font-medium bg-white text-slate-700 focus:outline-none focus:border-slate-400 appearance-none cursor-pointer">
                        <option value="Asia/Jakarta">WIB — Asia/Jakarta (UTC+7)</option>
                        <option value="Asia/Makassar">WITA — Asia/Makassar (UTC+8)</option>
                        <option value="Asia/Jayapura">WIT — Asia/Jayapura (UTC+9)</option>
                    </select>
                </SettingRow>
                <SettingRow label="URL Logo" desc="URL gambar logo perusahaan. Kosongkan untuk menggunakan logo default.">
                    <Input value={settings.company_logo_url} onChange={e => set('company_logo_url', e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="w-72 h-9 text-sm rounded-lg border-slate-200 focus:border-slate-400 focus:ring-0" />
                </SettingRow>
            </SectionPanel>
        ),

        attendance: (
            <SectionPanel title="Kamera & Foto Absensi" desc="Atur metode verifikasi identitas saat karyawan melakukan clock in dan clock out.">
                <SettingRow
                    label="Foto Selfie Wajib"
                    desc="Karyawan diwajibkan mengambil foto selfie saat absensi sebagai bukti kehadiran. Tidak memerlukan AI atau enrollment wajah."
                    tag="REKOMENDASI"
                >
                    <ProSwitch checked={settings.require_selfie_photo} onChange={v => set('require_selfie_photo', v)} />
                </SettingRow>
                <SettingRow
                    label="Verifikasi Wajah (AI) (Belum Berfungsi)"
                    desc="Sistem akan mencocokkan wajah karyawan dengan data yang telah didaftarkan sebelumnya menggunakan MediaPipe."
                    warning="Memerlukan enrollment wajah terlebih dahulu di halaman Profil. Dapat mempengaruhi performa di perangkat lama."
                >
                    <ProSwitch checked={settings.require_face_verification} onChange={v => set('require_face_verification', v)} />
                </SettingRow>
            </SectionPanel>
        ),

        gps: (
            <SectionPanel title="Lokasi & GPS" desc="Aturan validasi posisi geografis karyawan pada saat melakukan absensi.">
                <SettingRow label="Akurasi GPS Minimum" desc="Absensi akan ditolak apabila akurasi sinyal GPS lebih rendah dari nilai ini. Nilai lebih kecil berarti lebih ketat.">
                    <NumField value={settings.gps_min_accuracy_meters} onChange={v => set('gps_min_accuracy_meters', v)} min={10} max={500} suffix="meter" />
                </SettingRow>
                <SettingRow label="Izinkan Mode WFH" desc="Karyawan dapat memilih mode Work From Home saat melakukan absensi. Jika dinonaktifkan, semua absensi dianggap WFO.">
                    <ProSwitch checked={settings.allow_wfh_mode} onChange={v => set('allow_wfh_mode', v)} />
                </SettingRow>
                <SettingRow label="Blokir Fake GPS" desc="Absensi akan ditolak secara otomatis apabila sistem mendeteksi penggunaan aplikasi pemalsuan lokasi (mock location)." danger>
                    <ProSwitch checked={settings.block_fake_gps} onChange={v => set('block_fake_gps', v)} colorClass="data-[state=checked]:bg-red-500" />
                </SettingRow>
            </SectionPanel>
        ),

        schedule: (
            <SectionPanel title="Jam Absensi & Lembur" desc="Aturan batas waktu clock in dan perhitungan jam lembur karyawan.">
                <SettingRow label="Batas Akhir Clock In" desc="Karyawan tidak dapat melakukan absen masuk melewati jam ini. Direkomendasikan 2 jam setelah jam masuk normal.">
                    <TimeField h={settings.attendance_clock_in_latest_hour} m={settings.attendance_clock_in_latest_minute}
                        onH={v => set('attendance_clock_in_latest_hour', v)} onM={v => set('attendance_clock_in_latest_minute', v)} />
                </SettingRow>
                <SettingRow label="Minimum Menit Lembur" desc="Durasi minimum kerja melebihi jam pulang yang dihitung sebagai lembur. Kurang dari nilai ini tidak dihitung.">
                    <NumField value={settings.overtime_minimum_minutes} onChange={v => set('overtime_minimum_minutes', v)} min={0} max={120} suffix="menit" />
                </SettingRow>
                <SettingRow label="Lembur Perlu Persetujuan" desc="Karyawan harus mengajukan dan mendapatkan persetujuan lembur dari atasan sebelum bekerja melebihi jam normal.">
                    <ProSwitch checked={settings.overtime_require_approval} onChange={v => set('overtime_require_approval', v)} />
                </SettingRow>
            </SectionPanel>
        ),

        security: (
            <SectionPanel title="Keamanan & Akun" desc="Konfigurasi persetujuan pendaftaran akun baru melalui sistem onboarding.">
                <SettingRow
                    label="Persetujuan Akun Wajib"
                    desc="Apabila diaktifkan, setiap pendaftaran karyawan baru harus disetujui administrator sebelum dapat masuk ke sistem."
                    tag="KEAMANAN"
                >
                    <ProSwitch checked={settings.enable_account_approval} onChange={v => set('enable_account_approval', v)} />
                </SettingRow>
                <SettingRow
                    label="Role Penyetuju"
                    desc="Daftar role yang diizinkan untuk menyetujui pendaftaran (pisahkan dengan koma). Contoh: super_admin,admin_hr"
                    warning="Pastikan setidaknya ada satu role administrasi yang terdaftar."
                >
                    <Input
                        value={settings.account_approval_roles}
                        onChange={e => set('account_approval_roles', e.target.value)}
                        placeholder="super_admin,admin_hr"
                        disabled={!settings.enable_account_approval}
                        className="w-64 h-9 text-sm rounded-lg border-slate-200 focus:border-slate-400 focus:ring-0 disabled:opacity-40"
                    />
                </SettingRow>

                <div className="h-px bg-slate-100 my-4" />

                <SettingRow
                    label="Maksimal Perangkat"
                    desc="Jumlah maksimal browser/HP yang diizinkan login bersamaan untuk satu akun. Disarankan 2 atau 3 agar bisa sinkron HP & Laptop."
                    tag="SECURITY"
                >
                    <NumField
                        value={settings.max_devices_per_user}
                        onChange={v => set('max_devices_per_user', v)}
                        min={1} max={10} suffix="Unit"
                    />
                </SettingRow>
            </SectionPanel>
        ),

        leave: (
            <SectionPanel title="Cuti & Izin" desc="Kebijakan pengajuan dan persetujuan cuti tahunan karyawan.">
                <SettingRow label="Maks Hari Cuti per Tahun" desc="Jumlah maksimum hari cuti tahunan yang dapat diambil oleh setiap karyawan dalam satu tahun kalender.">
                    <NumField value={settings.leave_max_days_per_year} onChange={v => set('leave_max_days_per_year', v)} min={0} max={365} suffix="hari" />
                </SettingRow>
                <SettingRow label="Minimum H- Pengajuan" desc="Pengajuan cuti harus dilakukan minimal berapa hari sebelum tanggal yang diminta. Isi 0 untuk mengizinkan pengajuan mendadak.">
                    <NumField value={settings.leave_min_notice_days} onChange={v => set('leave_min_notice_days', v)} min={0} max={30} suffix="hari sebelum" width="w-16" />
                </SettingRow>
                <SettingRow label="Persetujuan Cuti Wajib" desc="Pengajuan cuti harus mendapatkan persetujuan dari admin atau manajer sebelum dianggap sah dan berlaku.">
                    <ProSwitch checked={settings.leave_require_approval} onChange={v => set('leave_require_approval', v)} />
                </SettingRow>
                <SettingRow label="Izinkan Cuti Setengah Hari" desc="Karyawan dapat mengajukan cuti untuk setengah hari kerja, baik sesi pagi maupun sesi siang.">
                    <ProSwitch checked={settings.leave_allow_half_day} onChange={v => set('leave_allow_half_day', v)} />
                </SettingRow>
            </SectionPanel>
        ),

        notification: (
            <SectionPanel title="Notifikasi & Reminder" desc="Pengaturan pengingat absen otomatis. Reminder dikirim X menit sebelum jam shift masing-masing karyawan, sehingga tidak perlu setting per-orang.">
                <SettingRow label="Aktifkan Pengingat Absensi" desc="Jika dimatikan, tidak ada pengingat clock-in maupun clock-out yang dikirim ke karyawan manapun.">
                    <ProSwitch checked={settings.reminder_enabled} onChange={v => set('reminder_enabled', v)} />
                </SettingRow>
                <SettingRow
                    label="Menit Sebelum Masuk"
                    desc={`Pengingat clock-in dikirim ${settings.reminder_clockin_minutes_before} menit sebelum shift karyawan dimulai.`}
                    warning={settings.reminder_clockin_minutes_before < 5 ? "Nilai terlalu rendah — pengingat mungkin tidak ada waktu untuk diterima." : undefined}
                >
                    <NumField
                        value={settings.reminder_clockin_minutes_before}
                        onChange={v => set('reminder_clockin_minutes_before', v)}
                        min={1} max={60} suffix="menit"
                        disabled={!settings.reminder_enabled}
                    />
                </SettingRow>
                <SettingRow
                    label="Menit Sebelum Pulang"
                    desc={`Pengingat clock-out dikirim ${settings.reminder_clockout_minutes_before} menit sebelum shift karyawan berakhir.`}
                    warning={settings.reminder_clockout_minutes_before < 5 ? "Nilai terlalu rendah — pengingat mungkin tidak ada waktu untuk diterima." : undefined}
                >
                    <NumField
                        value={settings.reminder_clockout_minutes_before}
                        onChange={v => set('reminder_clockout_minutes_before', v)}
                        min={1} max={60} suffix="menit"
                        disabled={!settings.reminder_enabled}
                    />
                </SettingRow>
                <SettingRow label="Hanya Hari Kerja (Senin-Jumat)" desc="Jika aktif, pengingat tidak dikirim di hari Sabtu & Minggu.">
                    <ProSwitch checked={settings.reminder_workdays_only} onChange={v => set('reminder_workdays_only', v)} disabled={!settings.reminder_enabled} />
                </SettingRow>
            </SectionPanel>
        ),

        storage: (
            <SectionPanel title="Retensi & Penyimpanan" desc="Kelola penggunaan storage Supabase dengan menghapus foto absensi yang sudah melewati masa retensi.">
                <SettingRow label="Auto-Hapus Foto Absensi" desc="Foto absensi yang sudah melewati masa retensi akan dihapus otomatis setiap hari pukul 03:00 WIB. URL foto juga akan dihapus dari database.">
                    <ProSwitch checked={settings.attendance_photo_auto_cleanup} onChange={v => set('attendance_photo_auto_cleanup', v)} />
                </SettingRow>
                <SettingRow label="Masa Retensi Foto" desc="Foto absensi akan disimpan selama periode ini sebelum dihapus otomatis. Semakin pendek, semakin hemat storage.">
                    <NumField value={settings.attendance_photo_retention_days} onChange={v => set('attendance_photo_retention_days', v)}
                        min={1} max={365} suffix="hari" disabled={!settings.attendance_photo_auto_cleanup} />
                </SettingRow>
                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Estimasi Penggunaan Storage</p>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Per Foto', value: '~150 KB' },
                            { label: `Retensi ${settings.attendance_photo_retention_days}h × 20 user`, value: `~${Math.round(settings.attendance_photo_retention_days * 150 * 20 / 1024)} MB` },
                            { label: 'Supabase Free Limit', value: '1 GB' },
                        ].map(item => (
                            <div key={item.label} className="space-y-1">
                                <p className="text-[10px] text-slate-400 leading-tight">{item.label}</p>
                                <p className="text-[13px] font-bold text-slate-700">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </SectionPanel>
        ),

        system: (
            <SectionPanel title="Sistem & Performa" desc="Pengaturan teknis untuk menjaga koneksi database dan performa aplikasi.">
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 mb-2">
                    <p className="text-[12px] font-semibold text-amber-800 mb-1">Mengapa Keep-Alive diperlukan?</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                        Supabase free tier akan berhenti merespons (<em>cold start</em>) jika tidak ada aktivitas selama ±5 menit.
                        Keep-alive mengirim query ringan secara berkala untuk mencegah hal ini.
                    </p>
                </div>
                <SettingRow label="Aktifkan Keep-Alive" desc="Kirimkan ping ringan ke database secara berkala selama jam operasional yang ditentukan.">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className={cn("h-1.5 w-1.5 rounded-full",
                                pingStatus === 'ok' ? 'bg-green-500 animate-pulse' :
                                    pingStatus === 'pinging' ? 'bg-blue-400 animate-ping' :
                                        pingStatus === 'error' ? 'bg-red-400' : 'bg-slate-200')} />
                            <span className={cn("text-sm font-medium",
                                pingStatus === 'ok' ? 'text-green-600' : pingStatus === 'error' ? 'text-red-500' : 'text-slate-400')}>
                                {pingStatus === 'ok' ? 'Online' : pingStatus === 'error' ? 'Error' : pingStatus === 'pinging' ? 'Pinging...' : 'Standby'}
                            </span>
                        </div>
                        <ProSwitch checked={settings.enable_keepalive_ping} onChange={v => set('enable_keepalive_ping', v)} colorClass="data-[state=checked]:bg-green-600" />
                    </div>
                </SettingRow>
                <SettingRow label="Interval Ping" desc="Frekuensi pengiriman ping. Direkomendasikan 4 menit agar database tidak sempat memasuki mode idle.">
                    <NumField value={settings.keepalive_interval_minutes} onChange={v => set('keepalive_interval_minutes', v)}
                        min={1} max={10} suffix="menit" disabled={!settings.enable_keepalive_ping} />
                </SettingRow>
                <SettingRow label="Jam Operasional Keep-Alive" desc="Keep-alive hanya aktif dalam rentang jam ini untuk menghemat resource. Di luar jam ini tidak ada ping yang dikirim.">
                    <div className="flex items-center gap-2">
                        <Input type="number" min={0} max={23} value={settings.keepalive_start_hour}
                            onChange={e => set('keepalive_start_hour', Number(e.target.value))}
                            disabled={!settings.enable_keepalive_ping}
                            className="w-16 h-9 text-center text-sm font-semibold rounded-lg border-slate-200 focus:border-slate-400 focus:ring-0 disabled:opacity-40" />
                        <span className="text-slate-300 text-base">—</span>
                        <Input type="number" min={0} max={23} value={settings.keepalive_end_hour}
                            onChange={e => set('keepalive_end_hour', Number(e.target.value))}
                            disabled={!settings.enable_keepalive_ping}
                            className="w-16 h-9 text-center text-sm font-semibold rounded-lg border-slate-200 focus:border-slate-400 focus:ring-0 disabled:opacity-40" />
                        <span className="text-sm text-slate-400">WIB</span>
                        {settings.enable_keepalive_ping && (
                            <Button variant="ghost" size="sm" onClick={runPing}
                                className="h-9 px-4 text-sm rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 ml-1">
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Test
                            </Button>
                        )}
                    </div>
                </SettingRow>
            </SectionPanel>
        ),
    };

    // ── Mobile: section list → detail ────────────────────────────────────────
    if (isMobile) {
        const current = SECTIONS.find(s => s.id === activeSection);
        const goTo = (id: SectionId) => { setActiveSection(id); setShowDetail(true); };

        if (!showDetail) {
            return (
                <DashboardLayout>
                    <div className="min-h-screen bg-slate-50">
                        <div className="bg-white border-b border-slate-100 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2 h-9 w-9 rounded-full text-slate-500">
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h1 className="text-[17px] font-bold text-slate-900">Pengaturan</h1>
                                    <p className="text-[11px] text-slate-400">Konfigurasi sistem</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-4 py-3 space-y-1.5 pb-32">
                            {SECTIONS.map(sec => (
                                <button key={sec.id} onClick={() => goTo(sec.id)}
                                    className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-white rounded-xl border border-slate-100 text-left hover:border-slate-200 active:scale-[0.99] transition-all">
                                    <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                        <sec.icon className="h-[15px] w-[15px] text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold text-slate-800">{sec.label}</p>
                                        <p className="text-[11px] text-slate-400">{sec.desc}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                </DashboardLayout>
            );
        }

        return (
            <DashboardLayout>
                <div className="min-h-screen bg-white">
                    <div className="border-b border-slate-100 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setShowDetail(false)} className="-ml-2 h-9 w-9 rounded-full text-slate-500">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex items-center gap-2.5">
                                {current && <current.icon className="h-4 w-4 text-slate-400" />}
                                <h1 className="text-[15px] font-bold text-slate-900">{current?.label}</h1>
                            </div>
                        </div>
                    </div>
                    <div className="px-5 py-4 pb-36">{sectionContent[activeSection]}</div>
                    <div className="fixed bottom-[72px] left-0 right-0 p-4 bg-white border-t border-slate-100 z-20">
                        <Button onClick={handleSave} disabled={saving}
                            className="w-full h-11 rounded-xl text-[13px] font-semibold bg-slate-900 hover:bg-slate-800">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {saving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // ── Desktop: sidebar + content ────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-50/50 p-6">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 mb-1.5">
                            <Settings2 className="h-4 w-4" />
                            <span>Konfigurasi Sistem</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan</h1>
                    </div>
                    <Button onClick={handleSave} disabled={saving}
                        className={cn(
                            "h-10 px-6 rounded-lg text-sm font-semibold transition-all",
                            saved ? "bg-green-600 hover:bg-green-700" : "bg-slate-900 hover:bg-slate-800"
                        )}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            : saved ? <Check className="h-4 w-4 mr-2" />
                                : <Save className="h-3.5 w-3.5 mr-2" />}
                        {saving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan Perubahan'}
                    </Button>
                </div>

                <div className="flex gap-6 items-start">
                    {/* Sidebar */}
                    <nav className="w-56 shrink-0 sticky top-6 space-y-0.5">
                        {SECTIONS.map(sec => (
                            <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left transition-all",
                                    activeSection === sec.id
                                        ? "bg-white shadow-sm border border-slate-200 font-semibold text-slate-900"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                                )}>
                                <sec.icon className={cn("h-4 w-4 shrink-0",
                                    activeSection === sec.id ? "text-slate-700" : "text-slate-400")} />
                                <span className="text-sm">{sec.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Content Panel */}
                    <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm px-7 py-6">
                        {sectionContent[activeSection]}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
