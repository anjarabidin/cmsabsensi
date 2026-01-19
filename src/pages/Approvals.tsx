import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    CheckCircle2,
    XCircle,
    FileText,
    MessageSquare,
    ChevronLeft,
    Loader2,
    AlertCircle,
    Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface LeaveRequest {
    id: string;
    user_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    attachment_url?: string;
    total_days?: number;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

interface OvertimeRequest {
    id: string;
    user_id: string;
    date: string;
    duration_minutes: number;
    hours?: number;
    reason: string;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

interface CorrectionRequest {
    id: string;
    user_id: string;
    date: string;
    original_clock_in: string;
    original_clock_out: string;
    corrected_clock_in: string;
    corrected_clock_out: string;
    reason: string;
    proof_url?: string;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

interface ReimbursementRequest {
    id: string;
    user_id: string;
    claim_date: string;
    type: string;
    amount: number;
    description: string;
    attachment_url?: string;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

type RequestType = 'leave' | 'overtime' | 'correction' | 'reimbursement';

export default function ApprovalsPage() {
    const { user, role } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [reimbursementRequests, setReimbursementRequests] = useState<ReimbursementRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const [actionDialog, setActionDialog] = useState<{
        open: boolean;
        type: 'approve' | 'reject' | null;
        requestType: RequestType | null;
        requestId: string | null;
    }>({ open: false, type: null, requestType: null, requestId: null });

    const [attachmentDialog, setAttachmentDialog] = useState<{
        open: boolean;
        url: string | null;
    }>({ open: false, url: null });

    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (user && (role === 'admin_hr' || role === 'manager')) {
            fetchRequests();
        }
    }, [user, role, activeTab]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const statusFilter = activeTab === 'pending' ? 'pending' : ['approved', 'rejected'];

            // Fetch leave requests
            const { data: leaveData, error: leaveError } = await supabase
                .from('leave_requests')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (leaveError) throw leaveError;

            // Fetch overtime requests
            const { data: overtimeData, error: overtimeError } = await supabase
                .from('overtime_requests')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (overtimeError) throw overtimeError;

            // Fetch correction requests
            const { data: correctionData, error: correctionError } = await supabase
                .from('attendance_corrections')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (correctionError) throw correctionError;

            // Fetch reimbursement requests
            const { data: reimbursementData, error: reimbursementError } = await supabase
                .from('reimbursements')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (reimbursementError) throw reimbursementError;

            setLeaveRequests((leaveData as unknown) as LeaveRequest[] || []);
            setOvertimeRequests((overtimeData as unknown) as OvertimeRequest[] || []);
            setCorrectionRequests((correctionData as unknown) as CorrectionRequest[] || []);
            setReimbursementRequests((reimbursementData as unknown) as ReimbursementRequest[] || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast({
                title: 'Gagal Memuat Data',
                description: 'Terjadi kesalahan saat mengambil data permohonan.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (type: 'approve' | 'reject', requestType: RequestType, requestId: string) => {
        setActionDialog({ open: true, type, requestType, requestId });
        setRejectionReason('');
    };

    const confirmAction = async () => {
        if (!actionDialog.type || !actionDialog.requestType || !actionDialog.requestId) return;

        if (actionDialog.type === 'reject' && !rejectionReason.trim()) {
            toast({
                title: 'Alasan Diperlukan',
                description: 'Mohon berikan alasan penolakan.',
                variant: 'destructive',
            });
            return;
        }

        setProcessing(true);
        try {
            let tableName = '';
            if (actionDialog.requestType === 'leave') tableName = 'leave_requests';
            else if (actionDialog.requestType === 'overtime') tableName = 'overtime_requests';
            else if (actionDialog.requestType === 'correction') tableName = 'attendance_corrections';
            else if (actionDialog.requestType === 'reimbursement') tableName = 'reimbursements';

            const newStatus = actionDialog.type === 'approve' ? 'approved' : 'rejected';

            const updateData: any = { status: newStatus };
            if (actionDialog.type === 'reject') {
                updateData.rejection_reason = rejectionReason.trim();
            }

            const { error } = await supabase
                .from(tableName)
                .update(updateData)
                .eq('id', actionDialog.requestId);

            if (error) throw error;

            // Send notification to user
            try {
                let request: any;
                let notifType = '';
                let notifLink = '';
                let typeLabel = '';

                if (actionDialog.requestType === 'leave') {
                    request = leaveRequests.find(r => r.id === actionDialog.requestId);
                    notifType = 'leave_status';
                    notifLink = '/leave';
                    typeLabel = 'cuti';
                } else if (actionDialog.requestType === 'overtime') {
                    request = overtimeRequests.find(r => r.id === actionDialog.requestId);
                    notifType = 'overtime_status';
                    notifLink = '/overtime';
                    typeLabel = 'lembur';
                } else if (actionDialog.requestType === 'correction') {
                    request = correctionRequests.find(r => r.id === actionDialog.requestId);
                    notifType = 'correction_status';
                    notifLink = '/corrections';
                    typeLabel = 'koreksi absensi';
                } else if (actionDialog.requestType === 'reimbursement') {
                    request = reimbursementRequests.find(r => r.id === actionDialog.requestId);
                    notifType = 'reimbursement_status';
                    notifLink = '/reimbursement';
                    typeLabel = 'reimbursement';
                }

                if (request) {
                    const title = actionDialog.type === 'approve' ? 'Permohonan Disetujui' : 'Permohonan Ditolak';
                    const message = actionDialog.type === 'approve'
                        ? `Permohonan ${typeLabel} Anda telah disetujui.`
                        : `Permohonan ${typeLabel} Anda ditolak. Alasan: ${rejectionReason}`;

                    await supabase.from('notifications').insert({
                        user_id: request.user_id,
                        title: title,
                        message: message,
                        type: notifType,
                        link: notifLink,
                        is_read: false
                    });
                }
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            toast({
                title: actionDialog.type === 'approve' ? 'Disetujui!' : 'Ditolak',
                description: `Permohonan telah ${actionDialog.type === 'approve' ? 'disetujui' : 'ditolak'}.`,
            });

            setActionDialog({ open: false, type: null, requestType: null, requestId: null });
            fetchRequests();
        } catch (error) {
            console.error('Error processing request:', error);
            toast({
                title: 'Gagal Memproses',
                description: 'Terjadi kesalahan saat memproses permohonan.',
                variant: 'destructive',
            });
        } finally {
            setProcessing(false);
        }
    };

    const pendingCount = leaveRequests.filter(r => r.status === 'pending').length +
        overtimeRequests.filter(r => r.status === 'pending').length +
        correctionRequests.filter(r => r.status === 'pending').length +
        reimbursementRequests.filter(r => r.status === 'pending').length;

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient */}
                {/* eslint-disable-next-line react/no-unknown-property */}
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
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md">Persetujuan</h1>
                            <p className="text-xs text-blue-50 font-medium opacity-90 mt-0.5">
                                Review & kelola permohonan karyawan
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 backdrop-blur-md p-1 rounded-2xl mb-6 border border-white/20">
                            <TabsTrigger
                                value="pending"
                                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold text-slate-600 rounded-xl relative transition-all"
                            >
                                Menunggu
                                {pendingCount > 0 && (
                                    <Badge className="ml-2 bg-red-500 text-white h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                                        {pendingCount}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold text-slate-600 rounded-xl transition-all"
                            >
                                Riwayat
                            </TabsTrigger>
                        </TabsList>

                        {/* Pending Requests */}
                        <TabsContent value="pending" className="space-y-4">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <>
                                    {leaveRequests.filter(r => r.status === 'pending').length === 0 &&
                                        overtimeRequests.filter(r => r.status === 'pending').length === 0 &&
                                        correctionRequests.filter(r => r.status === 'pending').length === 0 &&
                                        reimbursementRequests.filter(r => r.status === 'pending').length === 0 ? (
                                        <Card className="border-none shadow-md">
                                            <CardContent className="py-12 text-center">
                                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                                <h3 className="font-bold text-slate-900 mb-2">Semua Beres!</h3>
                                                <p className="text-slate-500">Tidak ada permohonan yang menunggu persetujuan.</p>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <div className="space-y-4">
                                            {leaveRequests
                                                .filter(r => r.status === 'pending')
                                                .map(req => (
                                                    <RequestCard
                                                        key={req.id}
                                                        type="leave"
                                                        request={req}
                                                        onApprove={() => handleAction('approve', 'leave', req.id)}
                                                        onReject={() => handleAction('reject', 'leave', req.id)}
                                                        onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                                    />
                                                ))}

                                            {overtimeRequests
                                                .filter(r => r.status === 'pending')
                                                .map(req => (
                                                    <RequestCard
                                                        key={req.id}
                                                        type="overtime"
                                                        request={req}
                                                        onApprove={() => handleAction('approve', 'overtime', req.id)}
                                                        onReject={() => handleAction('reject', 'overtime', req.id)}
                                                        onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                                    />
                                                ))}

                                            {correctionRequests
                                                .filter(r => r.status === 'pending')
                                                .map(req => (
                                                    <RequestCard
                                                        key={req.id}
                                                        type="correction"
                                                        request={req}
                                                        onApprove={() => handleAction('approve', 'correction', req.id)}
                                                        onReject={() => handleAction('reject', 'correction', req.id)}
                                                        onViewAttachment={req.proof_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                                    />
                                                ))}

                                            {reimbursementRequests
                                                .filter(r => r.status === 'pending')
                                                .map(req => (
                                                    <RequestCard
                                                        key={req.id}
                                                        type="reimbursement"
                                                        request={req}
                                                        onApprove={() => handleAction('approve', 'reimbursement', req.id)}
                                                        onReject={() => handleAction('reject', 'reimbursement', req.id)}
                                                        onViewAttachment={req.attachment_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                                    />
                                                ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </TabsContent>

                        {/* History */}
                        <TabsContent value="history" className="space-y-4">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {leaveRequests
                                        .filter(r => r.status !== 'pending')
                                        .map(req => (
                                            <RequestCard
                                                key={req.id}
                                                type="leave"
                                                request={req}
                                                historyMode
                                                onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                            />
                                        ))}

                                    {overtimeRequests
                                        .filter(r => r.status !== 'pending')
                                        .map(req => (
                                            <RequestCard
                                                key={req.id}
                                                type="overtime"
                                                request={req}
                                                historyMode
                                                onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                            />
                                        ))}

                                    {correctionRequests
                                        .filter(r => r.status !== 'pending')
                                        .map(req => (
                                            <RequestCard
                                                key={req.id}
                                                type="correction"
                                                request={req}
                                                historyMode
                                                onViewAttachment={req.proof_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                            />
                                        ))}

                                    {reimbursementRequests
                                        .filter(r => r.status !== 'pending')
                                        .map(req => (
                                            <RequestCard
                                                key={req.id}
                                                type="reimbursement"
                                                request={req}
                                                historyMode
                                                onViewAttachment={req.attachment_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                            />
                                        ))}

                                    {leaveRequests.filter(r => r.status !== 'pending').length === 0 &&
                                        overtimeRequests.filter(r => r.status !== 'pending').length === 0 &&
                                        correctionRequests.filter(r => r.status !== 'pending').length === 0 &&
                                        reimbursementRequests.filter(r => r.status !== 'pending').length === 0 && (
                                            <Card className="border-none shadow-md">
                                                <CardContent className="py-12 text-center">
                                                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                                    <p className="text-slate-500">Belum ada riwayat persetujuan.</p>
                                                </CardContent>
                                            </Card>
                                        )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Action Dialog */}
            <Dialog
                open={actionDialog.open}
                onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, requestType: null, requestId: null })}
            >
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {actionDialog.type === 'approve' ? 'Setujui Permohonan?' : 'Tolak Permohonan?'}
                        </DialogTitle>
                        <DialogDescription>
                            {actionDialog.type === 'approve'
                                ? 'Permohonan akan disetujui dan karyawan akan mendapat notifikasi.'
                                : 'Berikan alasan penolakan untuk karyawan.'}
                        </DialogDescription>
                    </DialogHeader>

                    {actionDialog.type === 'reject' && (
                        <div className="py-4">
                            <Textarea
                                placeholder="Tulis alasan penolakan di sini..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="min-h-[100px] rounded-xl"
                            />
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setActionDialog({ open: false, type: null, requestType: null, requestId: null })}
                            disabled={processing}
                            className="rounded-xl"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={confirmAction}
                            disabled={processing}
                            className={`rounded-xl ${actionDialog.type === 'approve'
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {processing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : actionDialog.type === 'approve' ? (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                            ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                            )}
                            {actionDialog.type === 'approve' ? 'Setujui' : 'Tolak'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Attachment Preview Dialog */}
            <Dialog
                open={attachmentDialog.open}
                onOpenChange={(open) => !open && setAttachmentDialog({ open: false, url: null })}
            >
                <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                    {attachmentDialog.url && (
                        <div className="relative w-full max-h-[85vh] flex flex-col items-center justify-center">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -top-12 right-0 text-white hover:bg-white/20 rounded-full h-10 w-10 z-50 transition-colors"
                                onClick={() => setAttachmentDialog({ open: false, url: null })}
                            >
                                <XCircle className="h-8 w-8" />
                            </Button>

                            <div className="bg-black/80 backdrop-blur-sm rounded-xl overflow-hidden p-1 shadow-2xl relative">
                                {attachmentDialog.url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                    <video
                                        src={attachmentDialog.url}
                                        controls
                                        className="max-w-full max-h-[80vh] rounded-lg"
                                        autoPlay
                                    />
                                ) : (
                                    <img
                                        src={attachmentDialog.url}
                                        alt="Lampiran Bukti"
                                        className="max-w-full max-h-[80vh] object-contain rounded-lg"
                                    />
                                )}
                            </div>

                            <Button
                                variant="outline"
                                className="mt-4 bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-full"
                                onClick={() => window.open(attachmentDialog.url || '', '_blank')}
                            >
                                <Eye className="mr-2 h-4 w-4" />
                                Buka Ukuran Penuh
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}

// Request Card Component
function RequestCard({
    type,
    request,
    onApprove,
    onReject,
    onViewAttachment,
    historyMode = false,
}: {
    type: 'leave' | 'overtime' | 'correction' | 'reimbursement';
    request: any;
    onApprove?: () => void;
    onReject?: () => void;
    onViewAttachment?: (url: string) => void;
    historyMode?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const getTypeLabel = () => {
        if (type === 'leave') return 'Cuti';
        if (type === 'overtime') return 'Lembur';
        if (type === 'correction') return 'Koreksi';
        if (type === 'reimbursement') return 'Reimbursement';
        return type;
    };

    const getLeaveTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            annual: 'Tahunan',
            sick: 'Sakit',
            unpaid: 'Izin',
            maternity: 'Melahirkan',
            paternity: 'Ayah',
            marriage: 'Menikah',
            bereavement: 'Duka'
        };
        return types[type] || type;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-2 h-5">Disetujui</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-2 h-5">Ditolak</Badge>;
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] px-2 h-5">Menunggu</Badge>;
        }
    };

    return (
        <Card className="border shadow-sm overflow-hidden transition-all bg-white hover:shadow-md">
            <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <Avatar className="h-9 w-9 border border-slate-200">
                        <AvatarImage src={request.profiles?.avatar_url} />
                        <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">
                            {request.profiles?.full_name?.substring(0, 2).toUpperCase() || 'UN'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-semibold text-sm text-slate-900 truncate">
                                {request.profiles?.full_name || 'Tanpa Nama'}
                            </h4>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal text-slate-600 hidden sm:inline-flex bg-slate-100">
                                {request.profiles?.departments?.name || 'Umum'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">
                                {type === 'leave' ? getLeaveTypeLabel(request.leave_type) : getTypeLabel()}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="truncate">
                                {type === 'leave'
                                    ? format(new Date(request.start_date), 'd MMM', { locale: id })
                                    : type === 'reimbursement'
                                        ? format(new Date(request.claim_date), 'd MMM', { locale: id })
                                        : format(new Date(request.date), 'd MMM', { locale: id })
                                }
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {getStatusBadge(request.status)}
                    <div className={`p-1 rounded-full transition-colors ${isOpen ? 'bg-slate-100' : ''}`}>
                        <ChevronLeft className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? '-rotate-90' : 'rotate-180'}`} />
                    </div>
                </div>
            </div>

            {/* Accordion Content */}
            {isOpen && (
                <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2">
                    <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">

                        {/* Detail Info Grid */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Departemen</p>
                                <p className="text-xs text-slate-700 font-medium">{request.profiles?.departments?.name || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Posisi</p>
                                <p className="text-xs text-slate-700 font-medium">{request.profiles?.position || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Diajukan Pada</p>
                                <p className="text-xs text-slate-700 font-medium">{format(new Date(request.created_at), 'd MMM yyy, HH:mm', { locale: id })}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Info Tambahan</p>
                                <p className="text-xs text-slate-700 font-medium">
                                    {type === 'leave'
                                        ? `${request.total_days || 1} Hari`
                                        : type === 'overtime'
                                            ? request.duration_minutes ? `${Math.floor(request.duration_minutes / 60)}j ${request.duration_minutes % 60}m` : `${request.hours || 0} Jam`
                                            : type === 'reimbursement'
                                                ? `Rp ${(request.amount || 0).toLocaleString('id-ID')}`
                                                : type === 'correction'
                                                    ? `${request.corrected_clock_in ? format(new Date(request.corrected_clock_in), 'HH:mm') : '-'} s/d ${request.corrected_clock_out ? format(new Date(request.corrected_clock_out), 'HH:mm') : '-'}`
                                                    : '-'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Reason Box */}
                        <div>
                            <p className="text-[11px] text-slate-500 font-medium mb-1.5 ml-1">Alasan Pengajuan:</p>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm text-slate-700 italic relative">
                                <MessageSquare className="absolute top-3 left-3 h-3 w-3 text-slate-300" />
                                <span className="pl-5 block">"{request.reason}"</span>
                            </div>
                        </div>

                        {/* Common Logic for Attachment URL */}
                        {(request.attachment_url || request.proof_url) && (
                            <div>
                                <p className="text-[11px] text-slate-500 font-medium mb-1.5 ml-1">Lampiran Bukti:</p>
                                <div
                                    onClick={() => onViewAttachment?.(request.attachment_url || request.proof_url)}
                                    className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors group cursor-pointer"
                                >
                                    <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-white text-blue-600 transition-colors">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-blue-700">Lihat File Lampiran</p>
                                        <p className="text-[10px] text-blue-500">Klik untuk melihat preview</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Rejection Reason */}
                        {request.status === 'rejected' && request.rejection_reason && (
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex gap-3">
                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-red-700 mb-0.5">Ditolak Karena:</p>
                                    <p className="text-sm text-red-600">{request.rejection_reason}</p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {!historyMode && request.status === 'pending' && (
                            <div className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
                                <Button
                                    onClick={(e) => { e.stopPropagation(); onReject?.(); }}
                                    variant="outline"
                                    className="flex-1 h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                >
                                    Tolak
                                </Button>
                                <Button
                                    onClick={(e) => { e.stopPropagation(); onApprove?.(); }}
                                    className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow"
                                >
                                    Setujui
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}
