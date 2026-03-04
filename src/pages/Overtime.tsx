import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { CalendarIcon, Loader2, Timer, ChevronLeft, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/useIsMobile';

interface OvertimeRequest {
    id: string;
    date: string;
    duration_minutes: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
    created_at: string;
}

export default function OvertimePage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [date, setDate] = useState<Date>();
    const [hours, setHours] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState<OvertimeRequest[]>([]);
    const [fetchingRequests, setFetchingRequests] = useState(false);

    useEffect(() => {
        if (user) {
            fetchOvertimeRequests();
        }
    }, [user]);

    const fetchOvertimeRequests = async () => {
        try {
            setFetchingRequests(true);
            const { data, error } = await supabase
                .from('overtime_requests')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching overtime requests:', error);
        } finally {
            setFetchingRequests(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!date || !hours || !reason.trim()) {
            toast({
                title: "Data Tidak Lengkap",
                description: "Mohon lengkapi semua field yang diperlukan.",
                variant: "destructive"
            });
            return;
        }

        const hoursNum = parseFloat(hours);
        if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 12) {
            toast({
                title: "Durasi Tidak Valid",
                description: "Durasi harus antara 0.5 - 12 jam.",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            // Convert hours to minutes
            const durationMinutes = Math.round(hoursNum * 60);

            // Insert overtime request
            const { data: overtimeData, error: overtimeError } = await supabase
                .from('overtime_requests')
                .insert({
                    user_id: user?.id,
                    date: format(date, 'yyyy-MM-dd'),
                    duration_minutes: durationMinutes,
                    reason: reason.trim(),
                    status: 'pending'
                })
                .select()
                .single();

            if (overtimeError) throw overtimeError;

            // Notify HR & Super Admin
            const { data: adminUsers } = await supabase
                .from('profiles')
                .select('id')
                .in('role', ['admin_hr', 'super_admin']);

            if (adminUsers && adminUsers.length > 0) {
                const notifications = adminUsers.map(admin => ({
                    user_id: admin.id,
                    title: 'Pengajuan Lembur Baru',
                    message: `Pengajuan lembur dari staf untuk ${format(date, 'd MMMM yyyy', { locale: id })} (${hoursNum} jam)`,
                    type: 'overtime',
                    link: '/approvals',
                    read: false
                }));

                await supabase.from('notifications').insert(notifications);
            }


            toast({
                title: "Berhasil!",
                description: "Pengajuan lembur Anda telah berhasil dikirim.",
            });

            // Reset form
            setDate(undefined);
            setHours('');
            setReason('');

            // Refresh requests
            fetchOvertimeRequests();
        } catch (error) {
            console.error('Error submitting overtime:', error);
            toast({
                title: "Gagal",
                description: "Terjadi kesalahan saat mengirim pengajuan.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-100 text-green-700 border-green-200">Disetujui</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 border-red-200">Ditolak</Badge>;
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Menunggu</Badge>;
        }
    };

    const isMobile = useIsMobile();
    // -------------------------------------------------------------------------
    // RENDER MOBILE VIEW (Strictly Preserved)
    // -------------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    {/* Background Gradient */}
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8 max-w-6xl mx-auto">
                        {/* Header with Back Button */}
                        <div className="flex items-start gap-3 text-white">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md">Lembur (Overtime)</h1>
                                <p className="text-blue-50 font-medium opacity-90 mt-1 text-xs">Ajukan jam lembur kerja tambahan.</p>
                            </div>
                        </div>

                        <Tabs defaultValue="request" className="space-y-4">
                            <TabsList className="bg-slate-200/50 backdrop-blur-md p-1 rounded-2xl border border-white/20 w-fit">
                                <TabsTrigger
                                    value="request"
                                    className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600 font-bold px-6 rounded-xl transition-all"
                                >
                                    Ajukan Lembur
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
                                        <CardTitle>Form Pengajuan Lembur</CardTitle>
                                        <CardDescription>Catat rencana atau realisasi jam lembur Anda.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Tanggal Lembur *</Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full justify-start text-left font-normal",
                                                                    !date && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            <Calendar
                                                                mode="single"
                                                                selected={date}
                                                                onSelect={setDate}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Durasi (Jam) *</Label>
                                                    <Input
                                                        type="number"
                                                        min="0.5"
                                                        max="12"
                                                        step="0.5"
                                                        placeholder="Contoh: 2.5"
                                                        value={hours}
                                                        onChange={(e) => setHours(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Alasan / Pekerjaan *</Label>
                                                <Textarea
                                                    placeholder="Deskripsi pekerjaan lembur..."
                                                    value={reason}
                                                    onChange={(e) => setReason(e.target.value)}
                                                    className="min-h-[100px]"
                                                />
                                            </div>
                                            <Button type="submit" className="w-full bg-blue-600" disabled={loading}>
                                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                                                Kirim Pengajuan
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="history">
                                {fetchingRequests ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                    </div>
                                ) : requests.length === 0 ? (
                                    <Card className="border-none shadow-md">
                                        <CardContent className="py-12 text-center">
                                            <Timer className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                            <h3 className="font-bold text-slate-900 mb-2">Belum Ada Riwayat</h3>
                                            <p className="text-slate-500">Pengajuan lembur Anda akan muncul di sini.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="space-y-4">
                                        {requests.map((req) => (
                                            <Card key={req.id} className="border-none shadow-sm">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div>
                                                            <h4 className="font-bold text-slate-900">
                                                                {format(new Date(req.date), 'd MMMM yyyy', { locale: id })}
                                                            </h4>
                                                            <p className="text-sm text-slate-500">
                                                                Durasi: {Math.floor(req.duration_minutes / 60)}j {req.duration_minutes % 60}m
                                                            </p>
                                                        </div>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                                                        {req.reason}
                                                    </p>
                                                    {req.status === 'rejected' && req.rejection_reason && (
                                                        <div className="mt-3 bg-red-50 p-3 rounded-lg border border-red-100 flex gap-2">
                                                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                            <div>
                                                                <p className="text-xs font-bold text-red-700">Alasan Penolakan:</p>
                                                                <p className="text-sm text-red-600">{req.rejection_reason}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-slate-400 mt-3">
                                                        Diajukan: {format(new Date(req.created_at), 'd MMM yyyy, HH:mm', { locale: id })}
                                                    </p>
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

    // -------------------------------------------------------------------------
    // RENDER DESKTOP VIEW (Premium Layout)
    // -------------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-8 space-y-8">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Pengajuan Lembur</h1>
                        <p className="text-slate-500 font-medium mt-1">
                            Kelola dan ajukan jam kerja tambahan Anda.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => navigate('/dashboard')}
                        className="rounded-xl border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 font-bold"
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Kembali ke Dashboard
                    </Button>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    {/* LEFT COLUMN: Submission Form */}
                    <div className="col-span-5 space-y-6">
                        <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[28px] overflow-hidden bg-white">
                            <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-500" />
                            <CardHeader>
                                <CardTitle className="text-xl font-bold text-slate-900">Form Pengajuan</CardTitle>
                                <CardDescription>Isi detail rencana lembur Anda di bawah ini.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-slate-700">Tanggal Lembur *</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full h-12 rounded-xl justify-start text-left font-medium border-slate-200",
                                                        !date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-3 h-4 w-4 text-slate-400" />
                                                    {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 rounded-xl shadow-xl">
                                                <Calendar
                                                    mode="single"
                                                    selected={date}
                                                    onSelect={setDate}
                                                    initialFocus
                                                    className="rounded-xl border-none"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-slate-700">Durasi (Jam) *</Label>
                                        <div className="relative">
                                            <Clock className="absolute top-1/2 left-4 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                type="number"
                                                min="0.5"
                                                max="12"
                                                step="0.5"
                                                placeholder="Contoh: 2.5"
                                                value={hours}
                                                onChange={(e) => setHours(e.target.value)}
                                                className="h-12 pl-12 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium px-1">
                                            *Maksimal 12 jam per pengajuan.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-slate-700">Alasan Pekerjaan *</Label>
                                        <Textarea
                                            placeholder="Jelaskan pekerjaan yang akan diselesaikan..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="min-h-[120px] rounded-xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none p-4"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        disabled={loading}
                                    >
                                        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                                        Kirim Pengajuan
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: History List */}
                    <div className="col-span-7 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Riwayat Pengajuan</h2>
                            <Badge variant="outline" className="h-8 px-3 rounded-lg bg-white border-slate-200 text-slate-600">
                                Total: {requests.length}
                            </Badge>
                        </div>

                        {fetchingRequests ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[28px] shadow-sm border border-slate-100">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                                <p className="text-slate-500 font-medium">Memuat riwayat...</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[28px] shadow-sm border border-dashed border-slate-200 text-center">
                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                    <Timer className="h-10 w-10 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Belum Ada Riwayat</h3>
                                <p className="text-slate-500 max-w-xs mx-auto">Riwayat pengajuan lembur Anda akan tampil di sini setelah Anda melakukan pengajuan.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {requests.map((req) => (
                                    <Card key={req.id} className="group border-none shadow-md shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-200/40 rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1">
                                        <CardContent className="p-5 flex items-start gap-4">
                                            {/* Date Box */}
                                            <div className="flex flex-col items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl shrink-0 border border-blue-100 text-blue-700">
                                                <span className="text-xs font-bold uppercase tracking-wider">{format(new Date(req.date), 'MMM', { locale: id })}</span>
                                                <span className="text-2xl font-black leading-none">{format(new Date(req.date), 'dd')}</span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 font-bold px-2 py-0.5 h-6">
                                                                <Clock className="w-3 h-3 mr-1.5" />
                                                                {Math.floor(req.duration_minutes / 60)}j {req.duration_minutes % 60 > 0 && `${req.duration_minutes % 60}m`}
                                                            </Badge>
                                                            <span className="text-xs text-slate-400 font-medium">
                                                                • {format(new Date(req.created_at), 'HH:mm')}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-bold text-slate-900 truncate pr-4">{req.reason}</h4>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                </div>

                                                {req.status === 'rejected' && req.rejection_reason && (
                                                    <div className="mt-3 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-3">
                                                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold text-red-800 mb-0.5">Pengajuan Ditolak</p>
                                                            <p className="text-sm text-red-600 leading-snug">{req.rejection_reason}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
