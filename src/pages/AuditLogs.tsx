
import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ShieldAlert, FileText, Calendar as CalendarIcon, Filter, ChevronLeft, X, RefreshCw, Clock, User, UserCheck, AlertCircle } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

// Placeholder type until we have a real table
interface AuditLog {
    id: string;
    created_at: string;
    changed_by: string; // Updated from user_id to match DB
    action: string;
    table_name: string;
    record_id: string;
    old_data: any;
    new_data: any;
    profiles: {
        full_name: string;
        email: string;
    } | {
        full_name: string;
        email: string;
    }[] | null;

}

export default function AuditLogs() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [tableFilter, setTableFilter] = useState<string>('ALL');
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // 1. Fetch Logs first (without join to avoid FK error)
            const { data: logsData, error: logsError } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100); // Increased limit for better grouping demo

            if (logsError) throw logsError;

            // 2. Extract User IDs
            const userIds = Array.from(new Set((logsData || []).map((log: any) => log.changed_by).filter(Boolean)));

            // 3. Fetch Profiles manually
            let profilesMap: Record<string, any> = {};
            if (userIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', userIds);

                if (!profilesError && profilesData) {
                    profilesMap = profilesData.reduce((acc: any, profile: any) => {
                        acc[profile.id] = profile;
                        return acc;
                    }, {});
                }
            }

            // 4. Combine Data
            const formattedData = (logsData || []).map((item: any) => ({
                ...item,
                profiles: item.changed_by ? profilesMap[item.changed_by] : null
            }));

            setLogs(formattedData as AuditLog[]);
        } catch (error) {
            console.error('Error fetching audit logs:', JSON.stringify(error, null, 2));
        } finally {
            setLoading(false);
        }
    };

    const getProfileName = (log: AuditLog) => {
        if (!log.profiles) return '';
        if (Array.isArray(log.profiles)) return log.profiles[0]?.full_name || '';
        return log.profiles.full_name || '';
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            getProfileName(log).toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.table_name.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
        const matchesTable = tableFilter === 'ALL' || log.table_name === tableFilter;
        const matchesDate = !dateFilter || format(new Date(log.created_at), 'yyyy-MM-dd') === format(dateFilter, 'yyyy-MM-dd');

        return matchesSearch && matchesAction && matchesTable && matchesDate;
    });

    const tableOptions = Array.from(new Set(logs.map(l => l.table_name))).sort();

    const stats = useMemo(() => {
        const total = filteredLogs.length;
        const inserts = filteredLogs.filter(l => l.action === 'INSERT').length;
        const updates = filteredLogs.filter(l => l.action === 'UPDATE').length;
        const deletes = filteredLogs.filter(l => l.action === 'DELETE').length;

        // Find most active table
        const tableCounts: Record<string, number> = {};
        filteredLogs.forEach(l => {
            tableCounts[l.table_name] = (tableCounts[l.table_name] || 0) + 1;
        });
        const mostActiveTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        return { total, inserts, updates, deletes, mostActiveTable };
    }, [filteredLogs]);

    const groupedLogs = filteredLogs.reduce((groups, log) => {
        const date = new Date(log.created_at);
        const dateKey = format(date, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = {
                date: date,
                logs: []
            };
        }
        groups[dateKey].logs.push(log);
        return groups;
    }, {} as Record<string, { date: Date, logs: AuditLog[] }>);

    const isMobile = useIsMobile();

    const getDateLabel = (date: Date) => {
        if (isToday(date)) return 'Hari Ini';
        if (isYesterday(date)) return 'Kemarin';
        return format(date, 'eeee, dd MMMM yyyy', { locale: id });
    };

    return (
        <DashboardLayout>
            <div className={`max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8 min-h-screen pb-24 ${isMobile ? 'pt-[calc(1rem+env(safe-area-inset-top))]' : 'pt-8'}`}>

                {/* Header Section */}
                <div className="flex flex-col gap-4 mb-6">
                    {/* Title Row with Back Button for Mobile */}
                    <div className="flex items-center gap-3">
                        {isMobile && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="-ml-3 h-10 w-10 text-slate-500 hover:text-slate-900"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                        )}
                        <div className="flex-1">
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Audit Logs</h1>
                            <p className="text-slate-500 font-medium text-xs md:text-sm">Riwayat aktivitas sistem & perubahan data.</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchLogs}
                            disabled={loading}
                            className="rounded-xl h-10 border-slate-200 bg-white"
                        >
                            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>

                    {/* Filter Row */}
                    <div className="flex flex-col md:flex-row gap-2 w-full">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari aktivitas..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white h-10 rounded-xl border-slate-200"
                            />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                            <Select value={actionFilter} onValueChange={setActionFilter}>
                                <SelectTrigger className="w-[140px] h-10 rounded-xl bg-white border-slate-200">
                                    <SelectValue placeholder="Semua Aksi" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua Aksi</SelectItem>
                                    <SelectItem value="INSERT">Create (Baru)</SelectItem>
                                    <SelectItem value="UPDATE">Update (Ubah)</SelectItem>
                                    <SelectItem value="DELETE">Delete (Hapus)</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={tableFilter} onValueChange={setTableFilter}>
                                <SelectTrigger className="w-[140px] h-10 rounded-xl bg-white border-slate-200">
                                    <SelectValue placeholder="Semua Tabel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua Tabel</SelectItem>
                                    {tableOptions.map(table => (
                                        <SelectItem key={table} value={table}>{table}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "h-10 rounded-xl justify-start text-left font-normal bg-white border-slate-200 w-[140px]",
                                            !dateFilter && "text-slate-500"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFilter ? format(dateFilter, 'dd MMM', { locale: id }) : <span>Tanggal</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateFilter}
                                        onSelect={setDateFilter}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            {(searchTerm || actionFilter !== 'ALL' || tableFilter !== 'ALL' || dateFilter) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setActionFilter('ALL');
                                        setTableFilter('ALL');
                                        setDateFilter(undefined);
                                    }}
                                    className="h-10 w-10 text-slate-500 hover:text-red-500"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        <Card className="bg-slate-900 text-white border-none shadow-md overflow-hidden relative group rounded-2xl">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform"></div>
                            <CardHeader className="pb-2 p-4">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Aktivitas</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-3xl font-black">{stats.total}</div>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md">+{stats.inserts}</span>
                                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md">~{stats.updates}</span>
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md">-{stats.deletes}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-100 shadow-sm rounded-2xl bg-white hidden sm:block">
                            <CardHeader className="pb-2 p-4">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tabel Terpopuler</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-lg font-black text-slate-700 truncate">{stats.mostActiveTable}</div>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Sering dimodifikasi</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-100 shadow-sm rounded-2xl bg-white hidden lg:block">
                            <CardHeader className="pb-2 p-4">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status Filter</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", actionFilter !== 'ALL' ? "bg-blue-500 animate-pulse" : "bg-slate-300")}></div>
                                    <div className="text-lg font-black text-slate-700">{actionFilter === 'ALL' ? 'Semua Aksi' : actionFilter}</div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Mode tampilan saat ini</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-none shadow-none md:shadow-lg bg-transparent md:bg-white overflow-hidden">
                        {/* <CardHeader is hidden to simplify UI as requested */}
                        <CardContent className="p-0 md:p-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center p-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                                    <p className="text-sm font-medium text-slate-500">Memuat riwayat...</p>
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center">
                                    <ShieldAlert className="h-12 w-12 text-slate-200 mb-2" />
                                    <p className="font-semibold text-slate-900">Tidak ada log ditemukan</p>
                                    <p className="text-sm text-slate-500">Coba ubah filter atau kata kunci pencarian.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {Object.entries(groupedLogs).map(([dateKey, group]) => (
                                        <div key={dateKey} className="space-y-3">
                                            {/* Date Header */}
                                            <div className="flex items-center gap-4">
                                                <div className="h-px flex-1 bg-slate-100"></div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    {getDateLabel(group.date)}
                                                </div>
                                                <div className="h-px flex-1 bg-slate-100"></div>
                                            </div>

                                            {/* Log Items Grid/List */}
                                            <div className="space-y-3">
                                                {group.logs.map((log) => (
                                                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm md:flex md:items-start md:gap-4 md:hover:border-blue-100 transition-colors">
                                                        {/* Avatar & Time */}
                                                        <div className="flex items-center md:items-start gap-3 md:w-48 shrink-0 mb-3 md:mb-0">
                                                            <Avatar className="h-10 w-10 border border-slate-100">
                                                                <AvatarFallback className={cn(
                                                                    "font-bold text-xs",
                                                                    log.action === 'DELETE' ? "bg-red-50 text-red-600" :
                                                                        log.action === 'UPDATE' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                                                                )}>
                                                                    {(Array.isArray(log.profiles) ? log.profiles[0]?.full_name : log.profiles?.full_name)?.substring(0, 2).toUpperCase() || 'SY'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-bold text-sm text-slate-800 line-clamp-1">
                                                                    {(Array.isArray(log.profiles) ? log.profiles[0]?.full_name : log.profiles?.full_name) || 'System'}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 font-medium">{format(new Date(log.created_at), 'HH:mm')}</p>
                                                            </div>
                                                        </div>

                                                        {/* Content Body */}
                                                        <div className="flex-1 space-y-2 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className={cn(
                                                                        "uppercase text-[9px] font-extrabold border-none px-2 py-0.5 tracking-wider rounded-md",
                                                                        log.action === 'DELETE' ? "bg-red-500 text-white shadow-sm" :
                                                                            log.action === 'UPDATE' ? "bg-amber-500 text-white shadow-sm" :
                                                                                "bg-emerald-500 text-white shadow-sm"
                                                                    )}>
                                                                        {log.action === 'UPDATE' ? 'Ubah' : log.action === 'INSERT' ? 'Baru' : 'Hapus'}
                                                                    </Badge>
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                        <TableIcon table={log.table_name} />
                                                                        {log.table_name}
                                                                        <span className="text-slate-200">#</span>
                                                                        <span className="text-slate-300 font-mono text-[9px]">{log.record_id.slice(0, 8)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Detail Preview */}
                                                            <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                                                <LogDetailFormatter log={log} isMobile={true} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}

function TableIcon({ table }: { table: string }) {
    const className = "w-3 h-3";
    if (table === 'profiles') return <User className={className} />;
    if (table.includes('attendance')) return <Clock className={className} />;
    if (table.includes('leave') || table.includes('overtime') || table.includes('reimbursement')) return <FileText className={className} />;
    if (table === 'app_settings') return <Filter className={className} />;
    return <div className="w-1 h-1 rounded-full bg-slate-300"></div>;
}

// MAPPING KOLOM KE BAHASA MANUSIA
const COLUMN_LABELS: Record<string, string> = {
    // Profiles / User Info
    full_name: 'Nama Lengkap',
    email: 'Email',
    phone: 'No. WhatsApp',
    nik: 'NIK',
    department: 'Departemen',
    job_title: 'Jabatan',
    role: 'Role / Hak Akses',
    avatar_url: 'Foto Profil',
    is_active: 'Status Akun',

    // Attendance
    check_in: 'Waktu Masuk',
    check_out: 'Waktu Pulang',
    late_reason: 'Alasan Terlambat',
    status: 'Status',
    work_location: 'Lokasi Kerja',
    rating: 'Rating Harian',

    // Leaves / Cuti
    reason: 'Alasan',
    start_date: 'Tanggal Mulai',
    end_date: 'Tanggal Selesai',
    type: 'Jenis Cuti',
    approved_by: 'Disetujui Oleh',
    rejection_reason: 'Alasan Penolakan',

    // System
    key: 'Kunci Pengaturan',
    value: 'Nilai',
    description: 'Deskripsi',
    app_name: 'Nama Aplikasi',

    // Generic
    name: 'Nama',
    title: 'Judul',
    content: 'Konten',
    image_url: 'URL Gambar',

    // Core Modules
    employee_id: 'ID Staf',
    position: 'Jabatan',
    gender: 'Jenis Kelamin',
    address: 'Alamat',
    date_of_birth: 'Tanggal Lahir',

    // Attendance specific
    clock_in: 'Jam Masuk',
    clock_out: 'Jam Pulang',
    work_mode: 'Mode Kerja',
    latitude: 'Lintang',
    longitude: 'Bujur',

    // Approval specific
    status: 'Status Persetujuan'
};

const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined) return '-';

    // Boolean mapping
    if (typeof value === 'boolean') {
        if (key === 'is_active') return value ? 'Aktif' : 'Nonaktif';
        return value ? 'Ya' : 'Tidak';
    }

    // Role mapping
    if (key === 'role') {
        const roles: Record<string, string> = {
            super_admin: 'Super Admin',
            admin: 'Administrator',
            employee: 'Staf',
            manager: 'Head unit'
        };
        return roles[value] || value;
    }

    // Status mapping (presensi/cuti)
    if (key === 'status') {
        const statuses: Record<string, string> = {
            pending: 'Menunggu',
            approved: 'Disetujui',
            rejected: 'Ditolak',
            present: 'Hadir',
            absent: 'Tidak Hadir',
            late: 'Terlambat',
            leave: 'Cuti',
            permission: 'Izin'
        };
        return statuses[value] || value;
    }

    // Date formatting (ISO strings usually)
    if (typeof value === 'string' && (value.match(/^\d{4}-\d{2}-\d{2}/) || key.includes('date') || key.includes('time') || key === 'check_in' || key === 'check_out')) {
        try {
            return format(new Date(value), 'dd MMM yyyy, HH:mm');
        } catch {
            return value;
        }
    }

    // JSON objects (e.g. coordinates or metadata)
    if (typeof value === 'object') {
        return 'Data Kompleks (Lihat detail)';
    }

    return value.toString();
};


function LogDetailFormatter({ log, isMobile }: { log: AuditLog, isMobile?: boolean }) {
    const ignoredKeys = ['updated_at', 'created_at', 'id', 'record_id', 'user_id', 'company_id', 'tenant_id'];
    let summary = <span className="text-slate-500 text-xs italic">Lihat Detail</span>;
    let changes: { key: string, label: string, old: any, new: any }[] = [];

    // Analyze Changes
    if (log.action === 'UPDATE' && log.old_data && log.new_data) {
        Object.keys(log.new_data).forEach(key => {
            if (ignoredKeys.includes(key)) return;
            // Loose equality check for strings/numbers to avoid "1" vs 1 differences
            if (JSON.stringify(log.new_data[key]) != JSON.stringify(log.old_data[key])) {
                changes.push({
                    key,
                    label: COLUMN_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    old: formatValue(key, log.old_data[key]),
                    new: formatValue(key, log.new_data[key])
                });
            }
        });

        if (changes.length > 0) {
            const items = changes.map(c => c.label).slice(0, 2).join(', ');
            summary = (
                <span className="text-slate-600 font-medium text-xs bg-amber-50 border border-amber-100 px-2 py-1 rounded-md">
                    Ubah {items} {changes.length > 2 ? `(+${changes.length - 2})` : ''}
                </span>
            );
        } else {
            summary = <span className="text-slate-400 italic text-xs">Tidak ada perubahan data fisik</span>;
        }

    } else if (log.action === 'INSERT' && log.new_data) {
        const data = log.new_data;
        const name = data.full_name || data.name || data.title || data.email || data.key || 'Item Baru';
        summary = (
            <span className="text-emerald-700 font-medium text-xs bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                Baru: {formatValue('name', name)}
            </span>
        );
    } else if (log.action === 'DELETE') {
        summary = (
            <span className="text-red-700 font-medium text-xs bg-red-50 border border-red-100 px-2 py-1 rounded-md">
                Menghapus Data
            </span>
        );
    }

    const [showRaw, setShowRaw] = useState(false);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="cursor-pointer hover:opacity-80 transition-opacity w-fit mt-1">
                    {summary}
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white shadow-xl rounded-xl">
                <DialogHeader className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.action === 'DELETE' ? 'bg-red-100 text-red-600' : log.action === 'UPDATE' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {log.action === 'DELETE' ? <ShieldAlert className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-bold text-slate-800">
                                Audit Log Detail
                            </DialogTitle>
                            <DialogDescription className="text-[10px] text-slate-500">
                                {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')} • {(Array.isArray(log.profiles) ? log.profiles[0]?.full_name : log.profiles?.full_name) || 'System'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-0">
                    <div className="p-4 space-y-4">
                        {/* UPDATE Changes */}
                        {log.action === 'UPDATE' && changes.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    {changes.length} Perubahan Terdeteksi
                                </h4>
                                <div className="border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-100">
                                    {changes.map((change, idx) => (
                                        <div key={idx} className="text-xs bg-white">
                                            <div className="bg-slate-50 px-3 py-1.5 font-medium text-slate-700 text-[11px] border-b border-slate-50">
                                                {change.label}
                                            </div>
                                            <div className="grid grid-cols-2 divide-x divide-slate-100">
                                                <div className="p-2 text-slate-500 bg-red-50/20">
                                                    <div className="text-[10px] uppercase text-red-400/70 mb-0.5 font-bold">Lama</div>
                                                    <div className="line-through decoration-red-300 decoration-1 opacity-70 break-all">{change.old}</div>
                                                </div>
                                                <div className="p-2 text-slate-900 bg-emerald-50/20">
                                                    <div className="text-[10px] uppercase text-emerald-600/70 mb-0.5 font-bold">Baru</div>
                                                    <div className="font-medium text-emerald-700 break-all">{change.new}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* INSERT/DELETE Info */}
                        {log.action === 'INSERT' && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-900 text-xs flex items-start gap-2">
                                <FileText className="w-4 h-4 mt-0.5 text-emerald-600" />
                                <div>
                                    <p className="font-bold">Data Baru</p>
                                    <p className="opacity-80">Menambahkan row baru ke tabel <code className="text-[10px] bg-white/50 px-1 rounded">{log.table_name}</code>.</p>
                                </div>
                            </div>
                        )}
                        {log.action === 'DELETE' && (
                            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-900 text-xs flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 mt-0.5 text-red-600" />
                                <div>
                                    <p className="font-bold">Data Dihapus</p>
                                    <p className="opacity-80">Data dihapus permanen dari tabel <code className="text-[10px] bg-white/50 px-1 rounded">{log.table_name}</code>.</p>
                                </div>
                            </div>
                        )}

                        {/* Collapsible Raw Data */}
                        <div className="pt-2 border-t border-slate-50">
                            <button
                                onClick={() => setShowRaw(!showRaw)}
                                className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 px-3 py-1.5 rounded-md w-full justify-center"
                            >
                                {showRaw ? 'Sembunyikan Data Teknis' : 'Tampilkan Data Teknis (JSON)'}
                            </button>

                            {showRaw && (
                                <div className="mt-2 mockup-code bg-slate-900 text-slate-300 rounded-lg text-[10px] overflow-hidden shadow-inner">
                                    <pre className="p-3 overflow-auto max-h-40 scrollbar-thin scrollbar-thumb-slate-700">
                                        <code>{JSON.stringify(log.new_data || log.old_data, null, 2)}</code>
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs bg-white hover:bg-slate-100">Tutup</Button>
                    </DialogTrigger>
                </div>
            </DialogContent>
        </Dialog>
    );
}
