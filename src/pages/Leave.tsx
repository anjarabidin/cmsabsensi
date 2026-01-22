import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { CalendarIcon, Loader2, ChevronLeft, Clock, CheckCircle2, XCircle, Upload, File, X, ChevronRight, Plus, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface LeaveRequest {
    id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    created_at: string;
    rejection_reason?: string;
    attachment_url?: string;
}

export default function LeavePage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [activeTab, setActiveTab] = useState("request");

    const [leaveType, setLeaveType] = useState('');
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
    const [deptName, setDeptName] = useState<string>('');

    // For Desktop Form Dialog
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        if (user) {
            fetchLeaveHistory();
            fetchDeptName();
        }
    }, [user]);

    const fetchDeptName = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('department:departments(name)')
            .eq('id', user?.id)
            .single();
        if (data && data.department && (data.department as any).name) {
            setDeptName((data.department as any).name);
        }
    }

    const fetchLeaveHistory = async () => {
        try {
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeaveHistory((data as LeaveRequest[]) || []);
        } catch (error) {
            console.error('Error fetching leave history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    title: 'File Terlalu Besar',
                    description: 'Ukuran file maksimal 5MB.',
                    variant: 'destructive',
                });
                return;
            }
            setAttachment(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!leaveType || !startDate || !endDate || !reason.trim()) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Mohon isi semua field yang diperlukan.',
                variant: 'destructive',
            });
            return;
        }

        if (endDate < startDate) {
            toast({
                title: 'Tanggal Tidak Valid',
                description: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            let attachmentUrl = null;

            // Upload attachment if exists
            if (attachment) {
                const fileName = `${user?.id}/${Date.now()}_${attachment.name}`;
                const { error: uploadError, data } = await supabase.storage
                    .from('leave-attachments')
                    .upload(fileName, attachment);

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('leave-attachments')
                        .getPublicUrl(fileName);
                    attachmentUrl = publicUrl;
                }
            }

            // HELPER: Calculate Working Days (Excluding Weekends & Public Holidays)
            // Fetch public holidays from database
            const { data: holidaysData } = await supabase
                .from('public_holidays')
                .select('date, is_recurring')
                .gte('date', format(startDate, 'yyyy-MM-dd'))
                .lte('date', format(endDate, 'yyyy-MM-dd'));

            const holidayDates = new Set<string>();

            if (holidaysData) {
                holidaysData.forEach((holiday: any) => {
                    holidayDates.add(holiday.date);
                });
            }

            const calculateWorkingDays = (startDate: Date, endDate: Date) => {
                let count = 0;
                let curDate = new Date(startDate);
                while (curDate <= endDate) {
                    const dayOfWeek = curDate.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0=Sun, 6=Sat
                    const dateStr = format(curDate, 'yyyy-MM-dd');
                    const isHoliday = holidayDates.has(dateStr);

                    if (!isWeekend && !isHoliday) {
                        count++;
                    }
                    curDate.setDate(curDate.getDate() + 1);
                }
                return count;
            };

            const workingDays = calculateWorkingDays(startDate, endDate);

            // Insert leave request (No quota validation - unlimited leave)
            const { error } = await supabase.from('leave_requests').insert({
                user_id: user?.id,
                leave_type: leaveType,
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(endDate, 'yyyy-MM-dd'),
                total_days: workingDays, // Use the smart calculation
                reason: reason.trim(),
                attachment_url: attachmentUrl,
                status: 'pending',
            });

            if (error) throw error;

            toast({
                title: 'Berhasil!',
                description: 'Pengajuan cuti telah dikirim dan menunggu persetujuan.',
            });

            // Reset form
            setLeaveType('');
            setStartDate(undefined);
            setEndDate(undefined);
            setReason('');
            setAttachment(null);
            setDialogOpen(false); // Close dialog if on desktop

            // Refresh history
            fetchLeaveHistory();
            if (!isMobile) setActiveTab('history');
        } catch (error: any) {
            console.error('Error submitting leave:', error);
            toast({
                title: 'Gagal Mengirim',
                description: error.message || 'Terjadi kesalahan saat mengirim pengajuan.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const getLeaveTypeLabel = (type: string) => {
        switch (type) {
            case 'annual': return 'Cuti Tahunan';
            case 'sick': return 'Sakit';
            case 'unpaid': return 'Izin (Unpaid)';
            case 'maternity': return 'Melahirkan';
            case 'paternity': return 'Cuti Ayah';
            default: return type;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-2 py-0.5 font-bold shadow-none hover:bg-green-200 uppercase tracking-wider"><CheckCircle2 className="h-3 w-3 mr-1" />Disetujui</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-2 py-0.5 font-bold shadow-none hover:bg-red-200 uppercase tracking-wider"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
            default:
                return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-2 py-0.5 font-bold shadow-none hover:bg-amber-200 uppercase tracking-wider"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
        }
    };

    // ----------------------------------------------------------------------
    // MOBILE VIEW (PRESERVED)
    // ----------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8 max-w-6xl mx-auto">
                        <div className="flex items-start gap-3 text-white">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md">Cuti & Izin</h1>
                                <p className="text-blue-50 font-medium opacity-90 mt-1 text-xs">Ajukan cuti atau izin ketidakhadiran kerja.</p>
                            </div>
                        </div>

                        <Tabs defaultValue="request" className="space-y-4">
                            <TabsList className="bg-slate-200/50 backdrop-blur-md p-1 rounded-2xl border border-white/20 w-fit">
                                <TabsTrigger
                                    value="request"
                                    className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600 font-bold px-6 rounded-xl transition-all"
                                >
                                    Ajukan Baru
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600 font-bold px-6 rounded-xl transition-all"
                                >
                                    Riwayat
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="request">
                                <Card className="max-w-2xl border-none shadow-lg">
                                    <CardHeader>
                                        <CardTitle>Form Pengajuan Cuti</CardTitle>
                                        <CardDescription>Isi detail pengajuan cuti Anda di bawah ini.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <LeaveForm
                                            leaveType={leaveType} setLeaveType={setLeaveType}
                                            startDate={startDate} setStartDate={setStartDate}
                                            endDate={endDate} setEndDate={setEndDate}
                                            reason={reason} setReason={setReason}
                                            attachment={attachment} setAttachment={setAttachment}
                                            handleFileChange={handleFileChange}
                                            handleSubmit={handleSubmit}
                                            loading={loading}
                                            id={id}
                                            deptName={deptName}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="history">
                                {loadingHistory ? (
                                    <div className="text-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                                    </div>
                                ) : leaveHistory.length === 0 ? (
                                    <Card className="border-none shadow-md">
                                        <CardContent className="p-12 text-center">
                                            <p className="text-slate-500">Belum ada riwayat pengajuan cuti.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="space-y-2">
                                        {leaveHistory.map((req) => (
                                            <Card key={req.id} className="border-none shadow-sm hover:shadow-md transition-all">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h3 className="font-bold text-sm text-slate-900">{getLeaveTypeLabel(req.leave_type)}</h3>
                                                                {getStatusBadge(req.status)}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mb-2">
                                                                {format(new Date(req.start_date), 'd MMM', { locale: id })} - {format(new Date(req.end_date), 'd MMM yyyy', { locale: id })}
                                                            </p>
                                                            <p className="text-xs text-slate-600 line-clamp-2">{req.reason}</p>
                                                            {req.status === 'rejected' && req.rejection_reason && (
                                                                <p className="text-xs text-red-600 mt-1 italic">Ditolak: {req.rejection_reason}</p>
                                                            )}
                                                            {req.attachment_url && (
                                                                <a href={req.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1">
                                                                    <File className="h-3 w-3" />
                                                                    Lihat Lampiran
                                                                </a>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{format(new Date(req.created_at), 'd MMM', { locale: id })}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </DashboardLayout>
        );
    }


    // ----------------------------------------------------------------------
    // DESKTOP VIEW (NEW LAYOUT - Like Corrections)
    // ----------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-8 px-4 py-8 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cuti & Izin</h1>
                        <p className="text-slate-500 text-lg">Kelola pengajuan cuti dan izin ketidakhadiran kerja anda dengan mudah.</p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-start">
                    {/* LEFT COLUMN: Create Form (5 cols) */}
                    <div className="lg:col-span-5 relative">
                        <div className="sticky top-24 space-y-6">
                            <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100">
                                <CardHeader className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-8">
                                    <CardTitle className="flex items-center gap-3 text-xl font-bold">
                                        <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                            <Plus className="h-6 w-6 text-white" />
                                        </div>
                                        Ajukan Cuti Baru
                                    </CardTitle>
                                    <CardDescription className="text-blue-100">
                                        Isi formulir pengajuan cuti dengan lengkap dan jujur.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Jenis Cuti */}
                                        <div className="space-y-2">
                                            <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Jenis Cuti</Label>
                                            <Select value={leaveType} onValueChange={setLeaveType}>
                                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500">
                                                    <SelectValue placeholder="Pilih jenis cuti" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="annual">Cuti Tahunan</SelectItem>
                                                    <SelectItem value="sick">Sakit</SelectItem>
                                                    <SelectItem value="unpaid">Izin (Unpaid)</SelectItem>
                                                    <SelectItem value="maternity">Cuti Melahirkan</SelectItem>
                                                    <SelectItem value="paternity">Cuti Ayah</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Tanggal Mulai & Selesai */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Tanggal Mulai</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-medium h-12 rounded-xl bg-slate-50 border-slate-200", !startDate && "text-muted-foreground")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {startDate ? format(startDate, "dd MMM yy", { locale: id }) : <span>Pilih</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl">
                                                        <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Tanggal Selesai</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-medium h-12 rounded-xl bg-slate-50 border-slate-200", !endDate && "text-muted-foreground")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {endDate ? format(endDate, "dd MMM yy", { locale: id }) : <span>Pilih</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl">
                                                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>

                                        {/* Alasan */}
                                        <div className="space-y-2">
                                            <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Alasan / Keterangan</Label>
                                            <Textarea
                                                placeholder="Jelaskan alasan cuti Anda secara detail..."
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                rows={4}
                                                className="rounded-xl bg-slate-50 border-slate-200 focus:ring-blue-500 resize-none p-4"
                                            />
                                        </div>

                                        {/* Lampiran */}
                                        <div className="space-y-2">
                                            <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Lampiran (Opsional)</Label>
                                            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-8 transition-all bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer relative group text-center">
                                                <Input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                    onChange={handleFileChange}
                                                />
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-colors", attachment ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50")}>
                                                        {attachment ? <CheckCircle2 className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className={cn("text-sm font-bold", attachment ? "text-blue-700" : "text-slate-600")}>
                                                            {attachment ? attachment.name : "Upload Dokumen Pendukung"}
                                                        </p>
                                                        {!attachment && <p className="text-xs text-slate-400">Klik atau drag file ke sini (Max 5MB)</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 text-lg font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                                            {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: History List (7 cols) */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <Card className="rounded-[24px] border-none shadow-md bg-white p-6 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total</p>
                                    <p className="text-2xl font-black text-slate-900">{leaveHistory.length}</p>
                                </div>
                            </Card>
                            <Card className="rounded-[24px] border-none shadow-md bg-white p-6 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <Clock className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Menunggu</p>
                                    <p className="text-2xl font-black text-slate-900">{leaveHistory.filter(l => l.status === 'pending').length}</p>
                                </div>
                            </Card>
                            <Card className="rounded-[24px] border-none shadow-md bg-white p-6 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Disetujui</p>
                                    <p className="text-2xl font-black text-slate-900">{leaveHistory.filter(l => l.status === 'approved').length}</p>
                                </div>
                            </Card>
                        </div>

                        <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white">
                            <CardHeader className="border-b border-slate-100 bg-white px-8 py-6">
                                <CardTitle className="text-lg font-bold text-slate-800">Riwayat Pengajuan</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loadingHistory ? (
                                    <div className="py-20 text-center space-y-3">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                                        <p className="text-slate-500 font-medium">Memuat data...</p>
                                    </div>
                                ) : leaveHistory.length === 0 ? (
                                    <div className="py-24 text-center space-y-4">
                                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FileText className="h-10 w-10 text-slate-300" />
                                        </div>
                                        <h4 className="text-slate-900 font-bold text-lg">Belum Ada Riwayat</h4>
                                        <p className="text-slate-500 max-w-sm mx-auto">
                                            Riwayat pengajuan cuti Anda akan muncul di sini.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {leaveHistory.map((req) => (
                                            <div key={req.id} className="p-6 hover:bg-slate-50 transition-colors flex items-start gap-4 group">
                                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex-shrink-0 flex flex-col items-center justify-center text-slate-500 border border-slate-200">
                                                    <span className="text-xs font-bold uppercase">{format(new Date(req.start_date), 'MMM', { locale: id })}</span>
                                                    <span className="text-xl font-black text-slate-800">{format(new Date(req.start_date), 'dd')}</span>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {getStatusBadge(req.status)}
                                                            <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded-full bg-slate-50">#ID-{req.id.substring(0, 4)}</span>
                                                        </div>
                                                    </div>

                                                    <h3 className="font-bold text-slate-900 mb-1">{getLeaveTypeLabel(req.leave_type)}</h3>

                                                    <p className="text-xs text-slate-500 mb-2">
                                                        {format(new Date(req.start_date), 'd MMM', { locale: id })} - {format(new Date(req.end_date), 'd MMM yyyy', { locale: id })}
                                                    </p>

                                                    <p className="text-sm text-slate-600 bg-slate-50/50 p-3 rounded-xl italic border border-slate-100/50">
                                                        "{req.reason}"
                                                    </p>

                                                    {req.status === 'rejected' && req.rejection_reason && (
                                                        <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg font-medium">
                                                            Ditolak: {req.rejection_reason}
                                                        </p>
                                                    )}
                                                </div>

                                                {req.attachment_url && (
                                                    <a
                                                        href={req.attachment_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                        title="Lihat Lampiran"
                                                    >
                                                        <FileText className="h-5 w-5" />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

// Sub-component for reuse
function LeaveForm({ leaveType, setLeaveType, startDate, setStartDate, endDate, setEndDate, reason, setReason, attachment, setAttachment, handleFileChange, handleSubmit, loading, id, deptName }: any) {
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Approval Info */}
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Dikirim Kepada</Label>
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">M</div>
                    <div>
                        <div className="text-sm font-bold text-slate-700">Manager {deptName || 'Departemen'}</div>
                        <div className="text-[10px] text-slate-400">Perlu Persetujuan</div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Jenis Cuti *</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200">
                        <SelectValue placeholder="Pilih jenis cuti" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                        <SelectItem value="annual">Cuti Tahunan</SelectItem>
                        <SelectItem value="sick">Sakit</SelectItem>
                        <SelectItem value="unpaid">Izin (Unpaid)</SelectItem>
                        <SelectItem value="maternity">Cuti Melahirkan</SelectItem>
                        <SelectItem value="paternity">Cuti Ayah</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal Mulai *</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-11 rounded-xl border-slate-200", !startDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl">
                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="rounded-2xl" />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal Selesai *</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-11 rounded-xl border-slate-200", !endDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl">
                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="rounded-2xl" />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Alasan / Keterangan *</Label>
                <Textarea
                    placeholder="Jelaskan alasan cuti Anda secara detail..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    className="rounded-xl border-slate-200 resize-none"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Lampiran (Opsional)</Label>

                {!attachment ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-blue-400 hover:bg-slate-50 transition-all cursor-pointer group">
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
                            <div className="h-10 w-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <Upload className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-bold text-slate-700">Klik untuk upload file</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">Format: JPG, PNG, PDF (Max 5MB)</p>
                        </label>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                            <File className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-blue-900 truncate">{attachment.name}</p>
                            <p className="text-[10px] text-slate-400">{(attachment.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                            onClick={() => setAttachment(null)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl text-base font-bold shadow-lg shadow-blue-200 transition-all active:scale-95" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Kirim Pengajuan
            </Button>
        </form>
    )
}
