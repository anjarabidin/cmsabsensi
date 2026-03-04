import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
    Shield, Users, Search, RefreshCw, Save, ChevronLeft,
    RotateCcw, Check, AlertTriangle, Home, Clock, Calendar,
    Briefcase, BarChart3, DollarSign, FileText, ClipboardCheck,
    MapPin, Navigation, Settings, Newspaper, Camera, StickyNote,
    Bell, Smartphone, User, Car, Fingerprint, UserCheck, ShieldCheck, Mail,
    AlertCircle, CheckCircle2, Activity
} from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────
type AppRole = 'super_admin' | 'admin_hr' | 'manager' | 'employee' | 'driver';

interface UserRow {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    department_name: string | null;
    current_role: AppRole | null;
    pending_role: AppRole | null;
    isDirty: boolean;
    hasCustomPerms: boolean;
}

interface NavItemDef {
    key: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    group: string;
    groupIcon: React.ComponentType<{ className?: string }>;
}

// ─── Master Nav Items Definition ───────────────────────────────────────────
const ALL_NAV_ITEMS: NavItemDef[] = [
    // ── Umum ──────────────────────────────────────────────────────────────────
    { key: 'dashboard', title: 'Dashboard Utama', icon: Home, group: '🏠 Umum', groupIcon: Home },
    { key: 'notifications', title: 'Notifikasi', icon: Bell, group: '🏠 Umum', groupIcon: Home },
    { key: 'profile', title: 'Profil & Pengaturan Akun', icon: User, group: '🏠 Umum', groupIcon: Home },

    // ── Absensi ───────────────────────────────────────────────────────────────
    { key: 'attendance', title: 'Absensi Harian (GPS)', icon: Clock, group: '📋 Absensi', groupIcon: Clock },
    { key: 'quick_attendance', title: 'Absensi Cepat (QR)', icon: Check, group: '📋 Absensi', groupIcon: Clock },
    { key: 'history', title: 'Riwayat Kehadiran', icon: Calendar, group: '📋 Absensi', groupIcon: Clock },
    { key: 'corrections', title: 'Koreksi Absensi', icon: FileText, group: '📋 Absensi', groupIcon: Clock },
    { key: 'leave', title: 'Cuti & Izin', icon: Briefcase, group: '📋 Absensi', groupIcon: Clock },
    { key: 'overtime', title: 'Lembur', icon: Clock, group: '📋 Absensi', groupIcon: Clock },

    // ── Keuangan ──────────────────────────────────────────────────────────────
    { key: 'salary_slips', title: 'Slip Gaji (Lihat)', icon: FileText, group: '💰 Keuangan', groupIcon: DollarSign },
    { key: 'reimbursement', title: 'Reimbursement', icon: DollarSign, group: '💰 Keuangan', groupIcon: DollarSign },
    { key: 'payroll', title: 'Payroll (Kelola Gaji)', icon: DollarSign, group: '💰 Keuangan', groupIcon: DollarSign },
    { key: 'payroll_report', title: 'Laporan Gaji', icon: BarChart3, group: '💰 Keuangan', groupIcon: DollarSign },

    // ── SDM / HR ──────────────────────────────────────────────────────────────
    { key: 'employees', title: 'Data Karyawan', icon: Users, group: '👥 SDM & HR', groupIcon: Users },
    { key: 'shifts', title: 'Jadwal & Shift', icon: Clock, group: '👥 SDM & HR', groupIcon: Users },
    { key: 'holidays', title: 'Hari Libur Nasional', icon: Calendar, group: '👥 SDM & HR', groupIcon: Users },
    { key: 'locations', title: 'Lokasi Kantor/Titik Absen', icon: MapPin, group: '👥 SDM & HR', groupIcon: Users },
    { key: 'team_map', title: 'Pantau Lokasi Tim', icon: Navigation, group: '👥 SDM & HR', groupIcon: Users },
    { key: 'reports', title: 'Laporan Kehadiran', icon: BarChart3, group: '👥 SDM & HR', groupIcon: Users },
    { key: 'attendance_log', title: 'Log Foto Absensi', icon: Camera, group: '👥 SDM & HR', groupIcon: Users },
    { key: 'approvals', title: 'Pusat Persetujuan', icon: ClipboardCheck, group: '👥 SDM & HR', groupIcon: Users },

    // ── Operasional Driver ────────────────────────────────────────────────────
    { key: 'driver_logbook', title: 'Logbook & Catat Perjalanan', icon: Navigation, group: '🚗 Driver', groupIcon: Car },
    { key: 'driver_odometer', title: 'Fitur Odometer (Input & Laporan KM)', icon: Car, group: '🚗 Driver', groupIcon: Car },
    { key: 'driver_receipts', title: 'Foto Nota / Bukti Pengeluaran', icon: Camera, group: '🚗 Driver', groupIcon: Car },
    { key: 'vehicles', title: 'Data Kendaraan (Armada)', icon: Car, group: '🚗 Driver', groupIcon: Car },
    { key: 'driver_assignments', title: 'Penugasan Driver ke Pejabat', icon: UserCheck, group: '🚗 Driver', groupIcon: Car },
    { key: 'driver_reports', title: 'Monitoring & Laporan Driver', icon: ClipboardCheck, group: '🚗 Driver', groupIcon: Car },

    // ── Konten Perusahaan ─────────────────────────────────────────────────────
    { key: 'information', title: 'Berita & Info Perusahaan', icon: Newspaper, group: '📣 Konten', groupIcon: Newspaper },
    { key: 'albums', title: 'Album & Foto Kegiatan', icon: Camera, group: '📣 Konten', groupIcon: Newspaper },
    { key: 'agenda', title: 'Agenda & Jadwal Kegiatan', icon: ClipboardCheck, group: '📣 Konten', groupIcon: Newspaper },
    { key: 'notes', title: 'Catatan Pribadi', icon: StickyNote, group: '📣 Konten', groupIcon: Newspaper },

    // ── Admin & Sistem ────────────────────────────────────────────────────────
    { key: 'settings', title: 'Pengaturan Sistem', icon: Settings, group: '⚙️ Admin', groupIcon: Shield },
    { key: 'audit_logs', title: 'Log Audit Sistem', icon: FileText, group: '⚙️ Admin', groupIcon: Shield },
    { key: 'device_management', title: 'Manajemen Perangkat', icon: Smartphone, group: '⚙️ Admin', groupIcon: Shield },
    { key: 'role_management', title: 'Role & Akses (Halaman ini)', icon: Shield, group: '⚙️ Admin', groupIcon: Shield },
];

const ALL_ROLES: { value: AppRole; label: string; color: string; bg: string }[] = [
    { value: 'super_admin', label: 'Super Admin', color: 'text-purple-700', bg: 'bg-purple-50 ring-purple-200' },
    { value: 'admin_hr', label: 'Admin HR', color: 'text-blue-700', bg: 'bg-blue-50 ring-blue-200' },
    { value: 'manager', label: 'Manager', color: 'text-green-700', bg: 'bg-green-50 ring-green-200' },
    { value: 'employee', label: 'Karyawan', color: 'text-slate-700', bg: 'bg-slate-50 ring-slate-200' },
    { value: 'driver', label: 'Driver', color: 'text-orange-700', bg: 'bg-orange-50 ring-orange-200' },
];

const GROUP_ORDER = ['🏠 Umum', '📋 Absensi', '💰 Keuangan', '👥 SDM & HR', '🚗 Driver', '📣 Konten', '⚙️ Admin'];

// ─── Role Badge ────────────────────────────────────────────────────────────
const RoleBadge = ({ role }: { role: AppRole | null }) => {
    if (!role) return <Badge variant="outline" className="text-slate-400 font-bold text-[10px]">Tidak Ada Role</Badge>;
    const r = ALL_ROLES.find(x => x.value === role);
    return <Badge className={cn('font-black text-[10px] border-none ring-1', r?.bg, r?.color)}>{r?.label ?? role}</Badge>;
};

// ─── Main Component ─────────────────────────────────────────────────────────
export default function RoleManagement() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'approvals'>('users');
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<UserRow[]>([]);
    const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [savingUsers, setSavingUsers] = useState<Set<string>>(new Set());

    // Approval Settings State
    const [approvalSettings, setApprovalSettings] = useState({
        enabled: true,
        roles: ['super_admin', 'admin_hr'] as AppRole[],
        users: [] as string[]
    });
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
    const [loadingPerms, setLoadingPerms] = useState(true);
    const [savingPerms, setSavingPerms] = useState(false);
    const [selectedPermRole, setSelectedPermRole] = useState<AppRole>('super_admin');

    const [selectedUserForPerms, setSelectedUserForPerms] = useState<UserRow | null>(null);
    const [userSpecificPerms, setUserSpecificPerms] = useState<Record<string, boolean>>({});
    const [loadingUserPerms, setLoadingUserPerms] = useState(false);
    const [savingUserPerms, setSavingUserPerms] = useState(false);

    // ── Fetch users ──────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const [profilesRes, rolesRes, customPermsRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, email, avatar_url, role, department:department_id(name)').eq('is_active', true).order('full_name'),
                supabase.from('user_roles').select('user_id, role'),
                supabase.from('user_nav_permissions').select('user_id')
            ]);

            const roleMap: Record<string, AppRole> = {};
            (rolesRes.data || []).forEach(r => { roleMap[r.user_id] = r.role as AppRole; });

            const customPermsSet = new Set((customPermsRes.data || []).map(x => x.user_id));

            const rows: UserRow[] = (profilesRes.data || []).map(p => {
                const role = roleMap[p.id] || (p.role as AppRole) || null;
                return {
                    id: p.id,
                    full_name: p.full_name || '-',
                    email: p.email || '-',
                    avatar_url: p.avatar_url,
                    department_name: (p.department as any)?.name ?? null,
                    current_role: role,
                    pending_role: role,
                    isDirty: false,
                    hasCustomPerms: customPermsSet.has(p.id)
                };
            });

            const counts: Record<string, number> = {};
            rows.forEach(r => {
                if (r.current_role) {
                    counts[r.current_role] = (counts[r.current_role] || 0) + 1;
                }
            });
            setRoleCounts(counts);

            setUsers(rows);
        } catch (e) {
            toast({ title: 'Gagal memuat data pengguna', variant: 'destructive' });
        } finally {
            setLoadingUsers(false);
        }
    }, [toast]);

    // ── Fetch permissions ────────────────────────────────────────────────────
    const fetchPermissions = useCallback(async () => {
        setLoadingPerms(true);
        try {
            const { data, error } = await supabase.from('role_nav_permissions').select('*');
            if (error) throw error;
            const map: Record<string, Record<string, boolean>> = {};
            (data || []).forEach(row => {
                if (!map[row.role]) map[row.role] = {};
                map[row.role][row.nav_key] = row.is_enabled;
            });
            setPermissions(map);
        } catch (e) {
            toast({ title: 'Gagal memuat izin menu', variant: 'destructive' });
        } finally {
            setLoadingPerms(false);
        }
    }, [toast]);

    // ── Fetch user specific perms ──────────────────────────────────────────
    const fetchUserSpecificPerms = async (userId: string) => {
        setLoadingUserPerms(true);
        try {
            const { data, error } = await supabase.from('user_nav_permissions').select('*').eq('user_id', userId);
            if (error) throw error;
            const map: Record<string, boolean> = {};
            (data || []).forEach(row => { map[row.nav_key] = row.is_enabled; });
            setUserSpecificPerms(map);
        } catch {
            toast({ title: 'Gagal memuat izin khusus user', variant: 'destructive' });
        } finally {
            setLoadingUserPerms(false);
        }
    };

    // ── Save user specific perms ─────────────────────────────────────────────
    const saveUserSpecificPerms = async (userId: string) => {
        setSavingUserPerms(true);
        try {
            // 1. Delete existing for this user (to handle resets)
            await supabase.from('user_nav_permissions').delete().eq('user_id', userId);

            // 2. Insert only overridden ones
            const insertData = Object.entries(userSpecificPerms).map(([key, val]) => ({
                user_id: userId,
                nav_key: key,
                is_enabled: val
            }));

            if (insertData.length > 0) {
                const { error } = await supabase.from('user_nav_permissions').insert(insertData);
                if (error) throw error;
            }

            toast({ title: '✅ Izin individu berhasil disimpan', description: 'Perubahan akan aktif saat user refresh/login ulang.' });
            setSelectedUserForPerms(null);
        } catch (e: any) {
            toast({ title: 'Gagal menyimpan izin', description: e.message, variant: 'destructive' });
        } finally {
            setSavingUserPerms(false);
        }
    };

    // ── Fetch Approval Settings ──────────────────────────────────────────────
    const fetchApprovalSettings = useCallback(async () => {
        setLoadingSettings(true);
        try {
            const { data } = await supabase.from('app_settings')
                .select('key, value')
                .in('key', ['enable_account_approval', 'account_approval_roles', 'account_approval_users']);

            const m: Record<string, string> = {};
            data?.forEach(r => { m[r.key] = r.value; });

            setApprovalSettings({
                enabled: m['enable_account_approval'] === 'true',
                roles: (m['account_approval_roles'] || 'super_admin,admin_hr').split(',').filter(Boolean) as AppRole[],
                users: (m['account_approval_users'] || '').split(',').filter(Boolean)
            });
        } catch (e) {
            console.error('Error fetching approval settings:', e);
        } finally {
            setLoadingSettings(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchPermissions();
        fetchApprovalSettings();
    }, [fetchUsers, fetchPermissions, fetchApprovalSettings]);

    // ── Save Approval Settings ───────────────────────────────────────────────
    const handleSaveApprovalSettings = async () => {
        setSavingSettings(true);
        try {
            const { error } = await supabase.from('app_settings').upsert([
                { key: 'enable_account_approval', value: approvalSettings.enabled.toString(), updated_at: new Date().toISOString() },
                { key: 'account_approval_roles', value: approvalSettings.roles.join(','), updated_at: new Date().toISOString() },
                { key: 'account_approval_users', value: approvalSettings.users.join(','), updated_at: new Date().toISOString() }
            ]);
            if (error) throw error;
            toast({ title: '✅ Pengaturan persetujuan disimpan', description: 'Aturan verifikasi akun baru telah diperbarui.' });
        } catch (e: any) {
            toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
        } finally {
            setSavingSettings(false);
        }
    };

    // ── Save single user role ────────────────────────────────────────────────
    const handleSaveUserRole = async (userId: string, newRole: AppRole | null) => {
        setSavingUsers(prev => new Set(prev).add(userId));
        try {
            // Update profiles.role only — the DB trigger sync_profile_role_to_user_roles
            // will automatically keep user_roles in sync (runs as SECURITY DEFINER).
            const { error: pError } = await supabase.from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (pError) throw pError;

            setUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, current_role: newRole, pending_role: newRole, isDirty: false } : u
            ));
            toast({ title: '✅ Role berhasil disimpan', description: 'Perubahan berlaku saat user login ulang.' });
        } catch (e: any) {
            toast({ title: 'Gagal menyimpan role', description: e.message, variant: 'destructive' });
        } finally {
            setSavingUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
        }
    };

    // ── Toggle permission ────────────────────────────────────────────────────
    const togglePermission = (role: AppRole, navKey: string) => {
        setPermissions(prev => ({
            ...prev,
            [role]: { ...(prev[role] || {}), [navKey]: !prev[role]?.[navKey] }
        }));
    };

    // ── Save all permissions for selected role ───────────────────────────────
    const handleSavePermissions = async () => {
        setSavingPerms(true);
        try {
            const rolePerms = permissions[selectedPermRole] || {};
            const upsertData = ALL_NAV_ITEMS.map(item => ({
                role: selectedPermRole,
                nav_key: item.key,
                is_enabled: rolePerms[item.key] ?? false,
            }));
            const { error } = await supabase.from('role_nav_permissions').upsert(upsertData, { onConflict: 'role,nav_key' });
            if (error) throw error;
            toast({ title: '✅ Izin menu disimpan', description: `Pengaturan akses untuk role ${ALL_ROLES.find(r => r.value === selectedPermRole)?.label} berhasil diperbarui. Berlaku saat user login ulang.` });
        } catch (e: any) {
            toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
        } finally {
            setSavingPerms(false);
        }
    };

    // ── Reset permissions to default ──────────────────────────────────────────
    const handleResetToDefault = async () => {
        try {
            const { data } = await supabase.from('role_nav_permissions').select('*').eq('role', selectedPermRole);
            const map: Record<string, boolean> = {};
            (data || []).forEach(row => { map[row.nav_key] = row.is_enabled; });
            setPermissions(prev => ({ ...prev, [selectedPermRole]: map }));
            toast({ title: 'Data diperbarui dari database' });
        } catch {
            toast({ title: 'Gagal mereset', variant: 'destructive' });
        }
    };

    // ── Filtered users ────────────────────────────────────────────────────────
    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.department_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── Groups for permission matrix ──────────────────────────────────────────
    const groupedNavItems = GROUP_ORDER.map(groupName => ({
        name: groupName,
        icon: ALL_NAV_ITEMS.find(i => i.group === groupName)?.groupIcon ?? Home,
        items: ALL_NAV_ITEMS.filter(i => i.group === groupName),
    })).filter(g => g.items.length > 0);

    const currentRoleInfo = ALL_ROLES.find(r => r.value === selectedPermRole);
    const dirtyUsers = users.filter(u => u.isDirty);

    return (
        <DashboardLayout>
            <div className={cn('max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8 min-h-screen pb-24', isMobile ? 'pt-[calc(1.5rem+env(safe-area-inset-top))]' : 'pt-8')}>

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    {isMobile && (
                        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="-ml-2 h-10 w-10 text-slate-500">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                    )}
                    <div className="flex items-center gap-4 flex-1">
                        <div className="h-14 w-14 rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-xl shadow-purple-200">
                            <Shield className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Manajemen Role & Akses</h1>
                            <p className="text-sm text-slate-500 font-medium mt-0.5">Kelola peran pengguna dan izin menu sidebar</p>
                        </div>
                    </div>
                </div>

                {/* Role Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                    {ALL_ROLES.map(r => (
                        <button
                            key={r.value}
                            onClick={() => { setActiveTab('permissions'); setSelectedPermRole(r.value); }}
                            className={cn('p-4 rounded-3xl ring-2 text-left transition-all hover:-translate-y-1 hover:shadow-lg', r.bg)}
                        >
                            <div className={cn('text-3xl font-black', r.color)}>{roleCounts[r.value] || 0}</div>
                            <div className={cn('text-[11px] font-black uppercase tracking-wide mt-1', r.color)}>{r.label}</div>
                        </button>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-6 w-fit">
                    {[
                        { id: 'users' as const, label: 'Pengguna & Role', icon: Users },
                        { id: 'permissions' as const, label: 'Izin Menu', icon: Shield },
                        { id: 'approvals' as const, label: 'Alur Persetujuan', icon: ShieldCheck },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
                                activeTab === tab.id
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB 1: Pengguna & Role ─────────────────────────────────────── */}
                {activeTab === 'users' && (
                    <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden ring-1 ring-slate-100">
                        <CardHeader className="border-b border-slate-50 p-6">
                            <div className="flex items-center justify-between gap-4">
                                <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <Users className="h-5 w-5 text-blue-500" />
                                    Daftar Pengguna
                                    {dirtyUsers.length > 0 && (
                                        <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[10px]">
                                            {dirtyUsers.length} perubahan pending
                                        </Badge>
                                    )}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Cari nama, email, dept..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="pl-9 h-10 rounded-xl border-slate-200 w-56"
                                        />
                                    </div>
                                    <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loadingUsers} className="h-10 w-10 rounded-xl border-slate-200">
                                        <RefreshCw className={cn('h-4 w-4', loadingUsers && 'animate-spin')} />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loadingUsers ? (
                                <div className="flex flex-col items-center justify-center p-16">
                                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                                    <p className="text-sm font-bold text-slate-400">Memuat data pengguna...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {filteredUsers.map(user => (
                                        <div
                                            key={user.id}
                                            className={cn('flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors group', user.isDirty && 'bg-amber-50/50')}
                                        >
                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0 group-hover:scale-110 transition-transform">
                                                <AvatarImage src={user.avatar_url || ''} />
                                                <AvatarFallback className="bg-blue-50 text-blue-600 font-bold text-sm">
                                                    {user.full_name.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap text-left">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{user.full_name}</p>
                                                    <RoleBadge role={user.current_role} />
                                                    {user.isDirty && <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px]">BELUM DISIMPAN</Badge>}
                                                    {user.hasCustomPerms && <Badge className="bg-purple-100 text-purple-700 border-none font-black text-[9px] flex items-center gap-1"><Fingerprint className="h-2.5 w-2.5" /> IZIN KHUSUS AKTIF</Badge>}
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium truncate">{user.email}{user.department_name ? ` · ${user.department_name}` : ''}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "h-9 px-3 rounded-xl font-black text-[10px] gap-1.5 uppercase transition-all",
                                                        user.hasCustomPerms ? "bg-purple-50 text-purple-600 hover:bg-purple-100" : "text-slate-400 hover:bg-slate-100"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedUserForPerms(user);
                                                        fetchUserSpecificPerms(user.id);
                                                    }}
                                                >
                                                    <Shield className="h-3 w-3" />
                                                    {isMobile ? "Izin" : "Atur Izin Menu"}
                                                </Button>
                                                <Select
                                                    value={user.pending_role ?? ''}
                                                    onValueChange={val => {
                                                        const newRole = val as AppRole;
                                                        setUsers(prev => prev.map(u =>
                                                            u.id === user.id
                                                                ? { ...u, pending_role: newRole, isDirty: newRole !== u.current_role }
                                                                : u
                                                        ));
                                                    }}
                                                >
                                                    <SelectTrigger className="w-36 h-9 rounded-xl border-slate-200 text-xs font-bold">
                                                        <SelectValue placeholder="Pilih role..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ALL_ROLES.map(r => (
                                                            <SelectItem key={r.value} value={r.value} className="font-bold text-xs">
                                                                {r.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {user.isDirty && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveUserRole(user.id, user.pending_role)}
                                                        disabled={savingUsers.has(user.id)}
                                                        className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs px-4"
                                                    >
                                                        {savingUsers.has(user.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" />Simpan</>}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <div className="p-12 text-center">
                                            <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                            <p className="font-bold text-slate-400">Tidak ditemukan</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ── TAB 3: Alur Persetujuan ─────────────────────────────────────── */}
                {activeTab === 'approvals' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden ring-1 ring-slate-100">
                            <CardHeader className="p-8 pb-4">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                                        <UserCheck className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-black text-slate-900 leading-tight">Persetujuan Akun Baru</CardTitle>
                                        <CardDescription className="text-sm font-medium text-slate-500">Atur siapa yang berhak memverifikasi karyawan baru saat mendaftar.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 pt-4 space-y-8">
                                {/* Toggle Master */}
                                <div className="flex items-center justify-between gap-6 p-6 rounded-3xl bg-slate-50 border border-slate-100">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-slate-900">Aktifkan Verifikasi Registrasi</p>
                                        <p className="text-xs text-slate-500 font-medium">Jika aktif, akun baru bersatus &quot;Non-Aktif&quot; sampai disetujui admin.</p>
                                    </div>
                                    <Switch
                                        checked={approvalSettings.enabled}
                                        onCheckedChange={v => setApprovalSettings(p => ({ ...p, enabled: v }))}
                                        className="shadow-sm"
                                    />
                                </div>

                                {/* Role Selection */}
                                <div className={cn("space-y-4 transition-all", !approvalSettings.enabled && "opacity-40 grayscale pointer-events-none")}>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Peran yang Berhak Menyetujui</p>
                                    <div className="grid gap-3">
                                        {ALL_ROLES.filter(r => r.value !== 'employee' && r.value !== 'driver').map(r => (
                                            <button
                                                key={r.value}
                                                onClick={() => {
                                                    const current = approvalSettings.roles;
                                                    const updated = current.includes(r.value)
                                                        ? current.filter(x => x !== r.value)
                                                        : [...current, r.value];
                                                    setApprovalSettings(p => ({ ...p, roles: updated }));
                                                }}
                                                className={cn(
                                                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                                                    approvalSettings.roles.includes(r.value)
                                                        ? "border-blue-600 bg-blue-50/50"
                                                        : "border-slate-100 hover:border-slate-200 bg-white"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", r.bg)}>
                                                        <Shield className={cn("h-4 w-4", r.color)} />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-800">{r.label}</span>
                                                </div>
                                                {approvalSettings.roles.includes(r.value) ? (
                                                    <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                                        <Check className="h-3 w-3 text-white" />
                                                    </div>
                                                ) : (
                                                    <div className="h-5 w-5 rounded-full border-2 border-slate-200" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Specific Users Selection */}
                                <div className={cn("space-y-4 transition-all pt-4 border-t border-slate-100", !approvalSettings.enabled && "opacity-40 grayscale pointer-events-none")}>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Pengguna Khusus (ID tertunjuk)</p>

                                    <div className="space-y-3">
                                        {/* Search to add user */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Ketik nama untuk menambah peninjau khusus..."
                                                className="pl-9 h-11 rounded-2xl border-slate-200"
                                                onChange={(e) => {
                                                    const term = e.target.value.toLowerCase();
                                                    if (term.length < 2) return;
                                                    // This is handled by listing results below if we want, but for now let's just show active list
                                                }}
                                            />
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {approvalSettings.users.map(uid => {
                                                const u = users.find(x => x.id === uid);
                                                return (
                                                    <Badge key={uid} className="bg-white border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl flex items-center gap-2 group">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={u?.avatar_url || ''} />
                                                            <AvatarFallback className="text-[8px]">{u?.full_name.slice(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-bold text-xs">{u?.full_name || uid.slice(0, 8)}</span>
                                                        <button
                                                            onClick={() => setApprovalSettings(p => ({ ...p, users: p.users.filter(x => x !== uid) }))}
                                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <AlertCircle className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })}
                                        </div>

                                        <div className="bg-slate-50 rounded-2xl p-2 max-h-40 overflow-y-auto border border-slate-100 divide-y divide-slate-100">
                                            <p className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Saran Pengguna (Klik untuk Tambah)</p>
                                            {users
                                                .filter(u => !approvalSettings.users.includes(u.id))
                                                .filter(u => !approvalSettings.roles.includes(u.current_role as any)) // Only show if not already covered by role
                                                .slice(0, 5)
                                                .map(u => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => setApprovalSettings(p => ({ ...p, users: [...p.users, u.id] }))}
                                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white transition-colors text-left"
                                                    >
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={u.avatar_url || ''} />
                                                            <AvatarFallback className="text-[8px]">{u.full_name.slice(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 truncate">{u.full_name}</p>
                                                            <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                                        </div>
                                                        <CheckCircle2 className="h-4 w-4 text-slate-200 group-hover:text-blue-500" />
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Button
                                        onClick={handleSaveApprovalSettings}
                                        disabled={savingSettings || loadingSettings}
                                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200 font-bold"
                                    >
                                        {savingSettings ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 mr-3" />}
                                        Simpan Konfigurasi Persetujuan
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Integration Info */}
                        <div className="p-6 rounded-[28px] bg-amber-50 border border-amber-100 flex gap-4">
                            <Mail className="h-6 w-6 text-amber-600 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-sm font-black text-amber-900">Catatan Penting</p>
                                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                    Pengguna terpilih akan berhak menyetujui akun baru.
                                    <strong> Agar menu muncul di sidebar mereka:</strong> Pergi ke tab <strong>Kelola User</strong>, klik <strong>Izin Menu</strong> pada user tersebut, dan aktifkan <strong>"Pusat Persetujuan"</strong>.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'permissions' && (
                    <div className="space-y-6">
                        {/* Role selector + save bar */}
                        <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] ring-1 ring-slate-100">
                            <CardContent className="p-4 flex flex-wrap items-center gap-3">
                                <div className="flex gap-2 flex-wrap flex-1">
                                    {ALL_ROLES.map(r => (
                                        <button
                                            key={r.value}
                                            onClick={() => setSelectedPermRole(r.value)}
                                            className={cn(
                                                'px-4 py-2 rounded-2xl text-xs font-black transition-all ring-2',
                                                selectedPermRole === r.value ? cn(r.bg, r.color) : 'bg-white text-slate-400 ring-slate-200 hover:ring-slate-300'
                                            )}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleResetToDefault} className="h-9 rounded-xl border-slate-200 font-bold text-xs text-slate-600">
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset dari DB
                                    </Button>
                                    <Button size="sm" onClick={handleSavePermissions} disabled={savingPerms} className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs">
                                        {savingPerms ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" />Simpan Izin</>}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info banner */}
                        <div className={cn('flex items-start gap-3 p-4 rounded-2xl ring-1 text-sm', currentRoleInfo?.bg, currentRoleInfo?.color)} style={{ ringColor: 'currentColor' }}>
                            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-black">Mengatur izin untuk: {currentRoleInfo?.label}</p>
                                <p className="font-medium opacity-80 text-xs mt-0.5">Perubahan baru berlaku ketika pengguna login ulang. Toggle &quot;ON&quot; = menu muncul di sidebar.</p>
                            </div>
                        </div>

                        {/* Permission matrix per group */}
                        {loadingPerms ? (
                            <div className="flex flex-col items-center justify-center p-16">
                                <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                                <p className="text-sm font-bold text-slate-400">Memuat izin menu...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {groupedNavItems.map(group => {
                                    const enabledCount = group.items.filter(item => permissions[selectedPermRole]?.[item.key] ?? false).length;
                                    return (
                                        <Card key={group.name} className="border-none shadow-lg shadow-slate-200/30 rounded-[28px] overflow-hidden ring-1 ring-slate-100">
                                            <CardHeader className="p-5 pb-0 border-b border-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center">
                                                            <group.icon className="h-4 w-4 text-slate-500" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-sm font-black text-slate-900">{group.name}</CardTitle>
                                                            <p className="text-[11px] text-slate-400 font-medium">{enabledCount}/{group.items.length} menu aktif</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="text-[11px] font-black text-blue-600 hover:underline"
                                                        onClick={() => {
                                                            const allOn = group.items.every(item => permissions[selectedPermRole]?.[item.key]);
                                                            setPermissions(prev => {
                                                                const updated = { ...(prev[selectedPermRole] || {}) };
                                                                group.items.forEach(item => { updated[item.key] = !allOn; });
                                                                return { ...prev, [selectedPermRole]: updated };
                                                            });
                                                        }}
                                                    >
                                                        {group.items.every(item => permissions[selectedPermRole]?.[item.key]) ? 'Matikan Semua' : 'Aktifkan Semua'}
                                                    </button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                {group.items.map((item, idx) => {
                                                    const isEnabled = permissions[selectedPermRole]?.[item.key] ?? false;
                                                    return (
                                                        <div
                                                            key={item.key}
                                                            className={cn('flex items-center gap-4 px-5 py-4 transition-colors', idx !== group.items.length - 1 && 'border-b border-slate-50', isEnabled ? 'bg-white' : 'bg-slate-50/30')}
                                                        >
                                                            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center transition-all shrink-0', isEnabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400')}>
                                                                <item.icon className="h-4 w-4" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className={cn('text-sm font-bold', isEnabled ? 'text-slate-900' : 'text-slate-400')}>{item.title}</p>
                                                                <p className="text-[11px] text-slate-400 font-mono">{item.key}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={cn('text-[10px] font-black uppercase tracking-wider', isEnabled ? 'text-blue-600' : 'text-slate-400')}>
                                                                    {isEnabled ? 'Aktif' : 'Nonaktif'}
                                                                </span>
                                                                <Switch
                                                                    checked={isEnabled}
                                                                    onCheckedChange={() => togglePermission(selectedPermRole, item.key)}
                                                                    className="data-[state=checked]:bg-blue-600"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {/* ── USER PERMISSION MODAL ─────────────────────────────────────── */}
                <Dialog open={!!selectedUserForPerms} onOpenChange={open => !open && setSelectedUserForPerms(null)}>
                    <DialogContent className="max-w-2xl rounded-[32px] p-0 border-none shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="bg-slate-900 p-8 text-white relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Shield className="h-24 w-24" />
                            </div>
                            <DialogHeader>
                                <div className="flex items-center gap-4 mb-2 text-white text-left">
                                    <Avatar className="h-14 w-14 ring-4 ring-white/10">
                                        <AvatarImage src={selectedUserForPerms?.avatar_url || ''} />
                                        <AvatarFallback className="bg-blue-600 text-white font-bold">{selectedUserForPerms?.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <DialogTitle className="text-xl font-black">{selectedUserForPerms?.full_name}</DialogTitle>
                                        <DialogDescription className="text-slate-400 font-medium whitespace-normal">
                                            Atur izin khusus (override) untuk individu ini. Izin khusus akan mengabaikan pengaturan role bawaan.
                                        </DialogDescription>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <RoleBadge role={selectedUserForPerms?.current_role ?? null} />
                                </div>
                            </DialogHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {loadingUserPerms ? (
                                <div className="flex flex-col items-center justify-center p-12">
                                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                                    <p className="text-sm font-bold text-slate-400">Memuat izin khusus...</p>
                                </div>
                            ) : (
                                groupedNavItems.map(group => (
                                    <div key={group.name} className="space-y-3">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                                            <group.icon className="h-3 w-3" /> {group.name}
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2">
                                            {group.items.map(item => {
                                                const roleDefault = permissions[selectedUserForPerms?.current_role || 'employee']?.[item.key] ?? false;
                                                const userSetting = userSpecificPerms[item.key];
                                                const isOverridden = userSetting !== undefined;
                                                const activeStatus = isOverridden ? userSetting : roleDefault;

                                                return (
                                                    <div key={item.key} className={cn('flex items-center justify-between p-3 rounded-2xl transition-all border', activeStatus ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent')}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', activeStatus ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500')}>
                                                                <item.icon className="h-4 w-4" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className={cn('text-xs font-bold leading-none', activeStatus ? 'text-slate-900' : 'text-slate-400')}>{item.title}</p>
                                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                                    <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-tighter px-1 lg:h-4 h-3.5', roleDefault ? 'text-green-600 border-green-100' : 'text-slate-400 border-slate-100')}>
                                                                        Role: {roleDefault ? 'ON' : 'OFF'}
                                                                    </Badge>
                                                                    {isOverridden && (
                                                                        <Badge className="bg-purple-100 text-purple-700 border-none text-[9px] font-black uppercase tracking-tighter px-1 lg:h-4 h-3.5">
                                                                            OVERRIDE
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {isOverridden && (
                                                                <button
                                                                    className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors"
                                                                    onClick={() => {
                                                                        const updated = { ...userSpecificPerms };
                                                                        delete updated[item.key];
                                                                        setUserSpecificPerms(updated);
                                                                    }}
                                                                >
                                                                    RESET
                                                                </button>
                                                            )}
                                                            <Switch
                                                                checked={activeStatus}
                                                                onCheckedChange={(val) => {
                                                                    setUserSpecificPerms(prev => ({ ...prev, [item.key]: val }));
                                                                }}
                                                                className="data-[state=checked]:bg-blue-600 scale-90"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                            <Button variant="ghost" onClick={() => setSelectedUserForPerms(null)} className="rounded-2xl font-bold text-slate-500">
                                Batal
                            </Button>
                            <Button
                                onClick={() => saveUserSpecificPerms(selectedUserForPerms!.id)}
                                disabled={savingUserPerms}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 font-black shadow-lg shadow-blue-200"
                            >
                                {savingUserPerms ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
