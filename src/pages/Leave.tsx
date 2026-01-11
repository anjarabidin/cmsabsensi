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
import { CalendarIcon, Loader2, ChevronLeft, Clock, CheckCircle2, XCircle, Upload, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

    const [leaveType, setLeaveType] = useState('');
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);

    useEffect(() => {
        if (user) {
            fetchLeaveHistory();
        }
    }, [user]);

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

            // Insert leave request
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

            // Refresh history
            fetchLeaveHistory();
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
            case 'annual': return 'Tahunan';
            case 'sick': return 'Sakit';
            case 'unpaid': return 'Izin';
            case 'maternity': return 'Melahirkan';
            case 'paternity': return 'Ayah';
            default: return type;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-2 py-0"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Disetujui</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-2 py-0"><XCircle className="h-2.5 w-2.5 mr-0.5" />Ditolak</Badge>;
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] px-2 py-0"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>;
        }
    };

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
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Jenis Cuti *</Label>
                                            <Select value={leaveType} onValueChange={setLeaveType}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih jenis cuti" />
                                                </SelectTrigger>
                                                <SelectContent>
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
                                                <Label>Tanggal Mulai *</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {startDate ? format(startDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0">
                                                        <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Tanggal Selesai *</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {endDate ? format(endDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0">
                                                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Alasan / Keterangan *</Label>
                                            <Textarea
                                                placeholder="Jelaskan alasan cuti Anda..."
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                rows={3}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Lampiran (Opsional)</Label>
                                            <p className="text-xs text-slate-500">Upload surat keterangan dokter, undangan, dll. (Max 5MB)</p>

                                            {!attachment ? (
                                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-blue-400 transition-colors cursor-pointer">
                                                    <input
                                                        type="file"
                                                        id="file-upload"
                                                        className="hidden"
                                                        accept="image/*,.pdf"
                                                        onChange={handleFileChange}
                                                    />
                                                    <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
                                                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                                                        <p className="text-sm font-medium text-slate-600">Klik untuk upload file</p>
                                                        <p className="text-xs text-slate-400 mt-1">JPG, PNG, PDF</p>
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                                    <File className="h-5 w-5 text-blue-600" />
                                                    <span className="text-sm font-medium text-blue-900 flex-1 truncate">{attachment.name}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => setAttachment(null)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Kirim Pengajuan
                                        </Button>
                                    </form>
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
