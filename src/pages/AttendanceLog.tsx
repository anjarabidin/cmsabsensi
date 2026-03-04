
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2,
    Search,
    Calendar as CalendarIcon,
    MapPin,
    Clock,
    Filter,
    RefreshCw,
    Camera,
    User,
    ChevronRight,
    Maximize2,
    X,
    FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AttendanceLogEntry = {
    id: string;
    user_id: string;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    clock_in_photo_url: string | null;
    clock_out_photo_url: string | null;
    work_mode: string;
    status: string;
    notes: string | null;
    profiles: {
        full_name: string;
        employee_id: string | null;
        avatar_url: string | null;
        departments: { name: string } | null;
    };
};

export default function AttendanceLog() {
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AttendanceLogEntry[]>([]);

    // Filters
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [searchQuery, setSearchQuery] = useState('');
    const [modeFilter, setModeFilter] = useState('all');

    // Image Preview
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
    }, [startDate, endDate]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('attendances')
                .select(`
          *,
          profiles:user_id (
            full_name,
            employee_id,
            avatar_url,
            role,
            departments (name)
          )
        `)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })
                .order('clock_in', { ascending: false });

            if (error) throw error;
            setLogs((data as any[]) || []);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const nameMatch = log.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
            const idMatch = log.profiles?.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
            const modeMatch = modeFilter === 'all' || log.work_mode === modeFilter;
            return (nameMatch || idMatch) && modeMatch;
        });
    }, [logs, searchQuery, modeFilter]);

    const groupedLogs = useMemo(() => {
        const groups: Record<string, AttendanceLogEntry[]> = {};
        filteredLogs.forEach(log => {
            const dateStr = log.date;
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(log);
        });

        // Sort dates descending
        return Object.keys(groups)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map(date => ({
                date,
                entries: groups[date]
            }));
    }, [filteredLogs]);

    const getDateLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return 'Hari Ini';
        if (isYesterday(date)) return 'Kemarin';
        return format(date, 'EEEE, d MMMM yyyy', { locale: id });
    };

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    };

    const PhotoCard = ({ log, type }: { log: AttendanceLogEntry, type: 'in' | 'out' }) => {
        const url = type === 'in' ? log.clock_in_photo_url : log.clock_out_photo_url;
        const time = type === 'in' ? log.clock_in : log.clock_out;

        if (!url && !time) return null;

        return (
            <div className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 transition-all hover:shadow-xl hover:-translate-y-1">
                {url ? (
                    <img
                        src={url}
                        alt={`${type === 'in' ? 'Clock In' : 'Clock Out'} photo`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Camera className="h-8 w-8 opacity-20" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span>
                    </div>
                )}

                {/* Overlay Info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge className={cn(
                                "text-[9px] font-black h-4 px-1.5 uppercase border-none",
                                type === 'in' ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
                            )}>
                                {type === 'in' ? 'Masuk' : 'Pulang'}
                            </Badge>
                            <span className="text-[10px] text-white/90 font-mono font-bold">
                                {time ? format(new Date(time), 'HH:mm') : '--:--'}
                            </span>
                        </div>
                        <p className="text-[9px] text-white/70 font-medium truncate">
                            {format(new Date(log.date), 'EEEE, d MMM', { locale: id })}
                        </p>
                    </div>

                    {url && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setPreviewImage(url)}
                        >
                            <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <Camera className="h-8 w-8 text-blue-600" />
                            Log Foto Absensi
                        </h1>
                        <p className="text-slate-500 font-medium text-sm mt-1">Monitoring bukti foto kehadiran karyawan secara real-time.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-600 transition-all font-bold"
                            onClick={fetchLogs}
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Cari Karyawan</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Nama atau ID Karyawan..."
                                        className="pl-10 h-12 rounded-2xl bg-slate-50 border-none shadow-inner"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Dari Tanggal</Label>
                                <Input
                                    type="date"
                                    className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Sampai Tanggal</Label>
                                <Input
                                    type="date"
                                    className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-50">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mode Kerja</Label>
                                <div className="flex gap-2">
                                    {['all', 'wfo', 'wfh', 'field'].map((m) => (
                                        <Button
                                            key={m}
                                            variant={modeFilter === m ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setModeFilter(m)}
                                            className={cn(
                                                "rounded-xl px-4 h-9 text-[10px] font-black uppercase tracking-wider transition-all",
                                                modeFilter === m ? "bg-blue-600 shadow-lg shadow-blue-200" : "border-slate-200 text-slate-500"
                                            )}
                                        >
                                            {m === 'all' ? 'Semua' : m === 'wfo' ? 'WFO' : m === 'wfh' ? 'WFH' : 'Lapangan'}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Log Status */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none font-bold rounded-lg py-1">
                            {filteredLogs.length} Total Record
                        </Badge>
                    </div>
                </div>

                {/* Results Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                        <p className="text-slate-400 font-bold animate-pulse">Menghubungkan ke Storage...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <Card className="border-dashed border-2 border-slate-200 rounded-[32px] bg-slate-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-6">
                                <Camera className="h-10 w-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900">Tidak ada foto ditemukan</h3>
                            <p className="text-slate-500 max-w-xs mt-2">Coba ganti filter tanggal atau cari karyawan lain.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-12">
                        {groupedLogs.map((group) => (
                            <div key={group.date} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4 mb-6 sticky top-0 z-10 py-2 bg-slate-50/80 backdrop-blur-sm -mx-4 px-4 md:mx-0 md:px-0">
                                    <div className="h-10 px-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-3">
                                        <CalendarIcon className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm font-black text-slate-900 tracking-tight">
                                            {getDateLabel(group.date)}
                                        </span>
                                        <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[10px]">
                                            {group.entries.length} Record
                                        </Badge>
                                    </div>
                                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {group.entries.map((log) => (
                                        <Card key={log.id} className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100/50 group hover:ring-blue-200 transition-all flex flex-col">
                                            <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0">
                                                <Avatar className="h-12 w-12 border-2 border-slate-50 ring-2 ring-white rounded-2xl shadow-sm">
                                                    <AvatarImage src={log.profiles?.avatar_url || undefined} />
                                                    <AvatarFallback className="bg-blue-600 text-white font-black text-xs">
                                                        {getInitials(log.profiles?.full_name || 'U')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-black text-slate-900 leading-tight truncate">{log.profiles?.full_name}</h4>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                                                        {log.profiles?.employee_id || 'No ID'} • {log.profiles?.departments?.name || 'No Dept'}
                                                    </p>
                                                </div>
                                            </CardHeader>

                                            <CardContent className="p-4 pt-0 flex-1 space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <PhotoCard log={log} type="in" />
                                                    <PhotoCard log={log} type="out" />
                                                </div>

                                                {log.notes && (
                                                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex gap-2">
                                                        <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                        <p className="text-[11px] text-slate-600 font-medium italic line-clamp-2">
                                                            "{log.notes}"
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {log.work_mode === 'wfo' ? 'Kantor' : log.work_mode === 'wfh' ? 'Rumah' : 'Lapangan'}
                                                    </span>
                                                    <Badge variant="outline" className="h-5 rounded-lg text-[9px] border-slate-200 text-slate-500">
                                                        {log.status.toUpperCase()}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Image Preview Dialog */}
                <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                    <DialogContent className="max-w-3xl p-1 bg-black/95 border-none overflow-hidden rounded-[32px]">
                        <div className="relative w-full h-[80vh] flex items-center justify-center">
                            {previewImage && (
                                <img
                                    src={previewImage}
                                    alt="Full proof"
                                    className="max-w-full max-h-full object-contain"
                                />
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/40 backdrop-blur-md"
                                onClick={() => setPreviewImage(null)}
                            >
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
