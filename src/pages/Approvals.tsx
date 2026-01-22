
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, Calendar, FileText, ChevronLeft, Filter, Activity, MessageSquare, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

// Type definitions...
interface LeaveRequest {
    id: string;
    user_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
    created_at: string;
    total_days?: number;
    profiles?: any;
    attachment_url?: string;
}

interface OvertimeRequest {
    id: string;
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
    created_at: string;
    hours?: number;
    duration_minutes?: number;
    profiles?: any;
}

interface CorrectionRequest {
    id: string;
    user_id: string;
    date: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
    created_at: string;
    corrected_clock_in?: string;
    corrected_clock_out?: string;
    proof_url?: string;
    profiles?: any;
}

interface ReimbursementRequest {
    id: string;
    user_id: string;
    amount: number;
    category: string;
    reason: string;
    claim_date: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
    created_at: string;
    attachment_url?: string;
    profiles?: any;
}

interface PendingAccount {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role: string;
    department?: { name: string };
    job_position?: { title: string };
    position?: string;
    is_active: boolean;
    created_at: string;
}

type RequestType = 'leave' | 'overtime' | 'correction' | 'reimbursement' | 'account' | null;

export default function Approvals() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [reimbursementRequests, setReimbursementRequests] = useState<ReimbursementRequest[]>([]);
    const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);

    const [actionDialog, setActionDialog] = useState<{
        open: boolean;
        type: 'approve' | 'reject' | null;
        requestType: RequestType;
        requestId: string | null;
    }>({ open: false, type: null, requestType: null, requestId: null });

    const [attachmentDialog, setAttachmentDialog] = useState<{
        open: boolean;
        url: string | null;
    }>({ open: false, url: null });

    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);

    // Role check helper
    const role = profile?.role;
    const isAdmin = role === 'admin_hr';

    useEffect(() => {
        if (user) {
            fetchRequests();
        }
    }, [user, role, activeTab]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const statusFilter = activeTab === 'pending' ? 'pending' : ['approved', 'rejected'];

            // NOTE: We rely heavily on Row Level Security (RLS) policies here.
            // No complex frontend filtering needed anymore.
            // RLS will ensure Manager only sees data from:
            // 1. Their Assigned Employees
            // 2. OR Their Department Members (fallback)

            // Determine if we need department ID for Account Approval Only (since that table is public/profiles)
            let managerDeptId: string | null = null;
            if (role === 'manager' && user?.id) {
                const { data: p } = await supabase.from('profiles').select('department_id').eq('id', user.id).single();
                managerDeptId = p?.department_id;
            }

            // Helper to fetch request tables
            const fetchTable = async (tableName: string) => {
                let query = supabase
                    .from(tableName as any)
                    .select(`*, profiles:user_id(full_name, email, position, avatar_url, department_id, departments(name))`)
                    .order('created_at', { ascending: false });

                // Filter by status only
                if (Array.isArray(statusFilter)) {
                    query = query.in('status', statusFilter);
                } else {
                    query = query.eq('status', statusFilter);
                }

                // FETCH DATA! Let DB handle permissions.
                const { data, error } = await query;
                if (error) throw error;
                return data;
            };

            // Helper for Pending Accounts
            const fetchAccounts = async () => {
                let query = supabase
                    .from('profiles')
                    .select('*, department:departments(name), job_position:job_positions(title)')
                    .eq('is_active', activeTab === 'pending' ? false : true)
                    .order('created_at', { ascending: false });

                // Accounts might still need manual filtering if RLS isn't strict on public profiles table for read
                // But let's assume Manager wants to see pending accounts from their Dept.
                if (role === 'manager' && managerDeptId) {
                    query = query.eq('department_id', managerDeptId);
                }

                const { data, error } = await query;
                if (error) throw error;
                return data;
            };

            // Execute parallel
            const [leaveData, overtimeData, correctionData, reimbursementData, accountsData] = await Promise.all([
                fetchTable('leave_requests'),
                fetchTable('overtime_requests'),
                fetchTable('attendance_corrections'),
                fetchTable('reimbursements'),
                fetchAccounts()
            ]);

            setLeaveRequests((leaveData as unknown) as LeaveRequest[] || []);
            setOvertimeRequests((overtimeData as unknown) as OvertimeRequest[] || []);
            setCorrectionRequests((correctionData as unknown) as CorrectionRequest[] || []);
            setReimbursementRequests((reimbursementData as unknown) as ReimbursementRequest[] || []);
            setPendingAccounts((accountsData as unknown) as PendingAccount[] || []);

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
            if (actionDialog.requestType === 'account') {
                if (actionDialog.type === 'approve') {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ is_active: true })
                        .eq('id', actionDialog.requestId);

                    if (error) throw error;

                    // Send internal notification
                    await supabase.from('notifications').insert({
                        user_id: actionDialog.requestId,
                        title: 'Akun Diaktifkan',
                        message: 'Selamat! Akun Anda telah diaktifkan oleh admin. Silakan login untuk mengakses aplikasi.',
                        type: 'system',
                        is_read: false
                    });
                } else {
                    const { error } = await supabase
                        .from('profiles')
                        .delete()
                        .eq('id', actionDialog.requestId);

                    if (error) throw error;
                }
            } else {
                let tableName = '';
                if (actionDialog.requestType === 'leave') tableName = 'leave_requests';
                else if (actionDialog.requestType === 'overtime') tableName = 'overtime_requests';
                else if (actionDialog.requestType === 'correction') tableName = 'attendance_corrections';
                else if (actionDialog.requestType === 'reimbursement') tableName = 'reimbursements';

                const newStatus = actionDialog.type === 'approve' ? 'approved' : 'rejected';

                const updateData: any = { status: newStatus };
                // Also set who approved it!
                if (actionDialog.type === 'approve' && user?.id) {
                    updateData.approved_by = user.id;
                }

                if (actionDialog.type === 'reject') {
                    updateData.rejection_reason = rejectionReason.trim();
                }

                const { error } = await supabase
                    .from(tableName as any)
                    .update(updateData)
                    .eq('id', actionDialog.requestId);

                if (error) throw error;

                // Send notification logic (Simplified for brevity, similar to before)
                // ...
            }

            // Send notification to user (Simplified block)
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
        reimbursementRequests.filter(r => r.status === 'pending').length +
        pendingAccounts.filter(a => !a.is_active).length;

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient Header - Mobile Only */}
                <div className="md:hidden absolute top-0 left-0 w-full h-[calc(200px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[32px] z-0 shadow-lg" />

                <div className="relative z-10 space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-4 pb-24 max-w-7xl mx-auto">
                    {/* Header Section */}

                    {/* MOBILE HEADER (Curved Gradient) */}
                    <div className="md:hidden">
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
                                <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Persetujuan</h1>
                                <p className="text-xs text-blue-50 font-medium opacity-90">Kelola permohonan & akun</p>
                            </div>
                        </div>
                    </div>

                    {/* DESKTOP HEADER (Compact & Professional) */}
                    <div className="hidden md:flex flex-col gap-6 mb-6 pt-0 relative">
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                    Pusat Persetujuan
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Overview permohonan dan aktivitas karyawan.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/dashboard')}
                                    size="sm"
                                    className="h-9 px-3 rounded-lg border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm group text-sm"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                    Kembali
                                </Button>
                            </div>
                        </div>

                        {/* Desktop Stats (Compact Horizontal Cards) */}
                        <div className="grid grid-cols-4 gap-4 relative z-10">
                            {[
                                {
                                    label: 'Pending',
                                    value: pendingCount,
                                    icon: AlertCircle,
                                    color: 'text-amber-600',
                                    bg: 'bg-amber-50',
                                },
                                {
                                    label: 'Minta Akses',
                                    value: pendingAccounts.filter(a => !a.is_active).length,
                                    icon: CheckCircle2,
                                    color: 'text-purple-600',
                                    bg: 'bg-purple-50',
                                },
                                {
                                    label: 'Total',
                                    value: leaveRequests.length + overtimeRequests.length + correctionRequests.length + reimbursementRequests.length,
                                    icon: FileText,
                                    color: 'text-blue-600',
                                    bg: 'bg-blue-50',
                                },
                                {
                                    label: 'Response',
                                    value: '98%',
                                    icon: Activity,
                                    color: 'text-emerald-600',
                                    bg: 'bg-emerald-50',
                                }
                            ].map((stat, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className={`p-2.5 rounded-lg ${stat.bg} ${stat.color} shrink-0`}>
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{stat.label}</p>
                                        <h3 className="text-xl font-bold text-slate-900 leading-tight">{stat.value}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MOBILE STATS (Hidden on Destkop) */}
                    <div className="grid md:hidden grid-cols-3 gap-2">
                        <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20">
                            <p className="text-[9px] font-bold text-blue-100 uppercase tracking-wider mb-0.5">PENDING</p>
                            <p className="text-xl font-bold text-white leading-none">{pendingCount}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20">
                            <p className="text-[9px] font-bold text-blue-100 uppercase tracking-wider mb-0.5">NEW</p>
                            <p className="text-xl font-bold text-white leading-none">{pendingAccounts.filter(a => !a.is_active).length}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20">
                            <p className="text-[9px] font-bold text-blue-100 uppercase tracking-wider mb-0.5">TOTAL</p>
                            <p className="text-xl font-bold text-white leading-none">
                                {leaveRequests.length + overtimeRequests.length + correctionRequests.length + reimbursementRequests.length}
                            </p>
                        </div>
                    </div>

                    {/* Mobile Tabs Wrapper */}
                    <div className="md:hidden">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-full">
                            <TabsList className="bg-slate-200/50 backdrop-blur-md p-1 rounded-2xl border border-white/20 w-fit mb-4">
                                <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600 font-bold px-6 rounded-xl transition-all">
                                    Menunggu
                                    {pendingCount > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingCount}</span>}
                                </TabsTrigger>
                                <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600 font-bold px-6 rounded-xl transition-all">
                                    Riwayat
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Desktop Tabs Navigation (Premium Segmented Control) */}
                    <div className="hidden md:flex items-center justify-between mb-8 border-b border-slate-100 pb-1">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-auto">
                            <TabsList className="bg-slate-100/80 p-1.5 rounded-xl gap-2 h-auto inline-flex">
                                <TabsTrigger
                                    value="pending"
                                    className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md text-slate-500 font-bold px-8 py-2.5 rounded-lg transition-all text-sm tracking-wide"
                                >
                                    Menunggu Review
                                    {pendingCount > 0 && (
                                        <span className="ml-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ring-2 ring-white">
                                            {pendingCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md text-slate-500 font-bold px-8 py-2.5 rounded-lg transition-all text-sm tracking-wide"
                                >
                                    Riwayat & Arsip
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {/* Optional Filter/Export Tools for Desktop */}
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                                <div className="h-4 w-4 mr-2 bg-slate-200 rounded-full" />
                                Filter
                            </Button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <Tabs value={activeTab} className="w-full"> {/* Controlled by state but rendered directly here to wrap content */}

                        {/* Pending Content */}
                        <TabsContent value="pending" className="space-y-4 md:space-y-8 mt-0">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <>
                                    {pendingCount === 0 ? (
                                        <div className="flex flex-col items-center justify-center w-full min-h-[400px] bg-white rounded-3xl border border-slate-100 shadow-sm text-center p-8">
                                            <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50/50">
                                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Semua Beres!</h3>
                                            <p className="text-slate-500 max-w-sm mx-auto">Tidak ada permohonan yang perlu ditinjau saat ini. Kerja bagus!</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            {/* Account Approvals Section */}
                                            {pendingAccounts.filter(a => !a.is_active).length > 0 && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 px-2">
                                                        <div className="h-8 w-1 bg-purple-500 rounded-full"></div>
                                                        <h3 className="text-lg font-bold text-slate-800">Registrasi Akun Baru</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                        {pendingAccounts
                                                            .filter(a => !a.is_active)
                                                            .map(account => (
                                                                <div key={account.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                                                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                                                                    <div className="flex gap-4">
                                                                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0 text-lg">
                                                                            {account.full_name?.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex justify-between items-start mb-1">
                                                                                <h4 className="font-bold text-slate-900 truncate pr-2 text-base">{account.full_name}</h4>
                                                                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] shrink-0">New</Badge>
                                                                            </div>
                                                                            <p className="text-sm text-slate-500 truncate mb-1">{account.email}</p>
                                                                            <div className="flex flex-wrap gap-2 text-xs text-slate-600 mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                                                <span className="font-medium flex items-center gap-1">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                                                    {account.department?.name || 'No Dept'}
                                                                                </span>
                                                                                <span className="text-slate-300">|</span>
                                                                                <span className="font-medium truncate">{account.job_position?.title || account.position || 'No Pos'}</span>
                                                                            </div>
                                                                            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                                                                                <Button size="sm" variant="outline" onClick={() => handleAction('reject', 'account', account.id)} className="flex-1 h-9 border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">Tolak</Button>
                                                                                <Button size="sm" onClick={() => handleAction('approve', 'account', account.id)} className="flex-1 h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200">Aktifkan</Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* General Requests Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 px-2">
                                                    <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-slate-800">Permohonan Masuk</h3>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6">
                                                    {leaveRequests.filter(r => r.status === 'pending').map(req => (
                                                        <RequestCard key={req.id} type="leave" request={req} onApprove={() => handleAction('approve', 'leave', req.id)} onReject={() => handleAction('reject', 'leave', req.id)} onViewAttachment={(url) => setAttachmentDialog({ open: true, url })} />
                                                    ))}
                                                    {overtimeRequests.filter(r => r.status === 'pending').map(req => (
                                                        <RequestCard key={req.id} type="overtime" request={req} onApprove={() => handleAction('approve', 'overtime', req.id)} onReject={() => handleAction('reject', 'overtime', req.id)} onViewAttachment={(url) => setAttachmentDialog({ open: true, url })} />
                                                    ))}
                                                    {correctionRequests.filter(r => r.status === 'pending').map(req => (
                                                        <RequestCard key={req.id} type="correction" request={req} onApprove={() => handleAction('approve', 'correction', req.id)} onReject={() => handleAction('reject', 'correction', req.id)} onViewAttachment={req.proof_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined} />
                                                    ))}
                                                    {reimbursementRequests.filter(r => r.status === 'pending').map(req => (
                                                        <RequestCard key={req.id} type="reimbursement" request={req} onApprove={() => handleAction('approve', 'reimbursement', req.id)} onReject={() => handleAction('reject', 'reimbursement', req.id)} onViewAttachment={req.attachment_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </TabsContent>

                        {/* History Content */}
                        <TabsContent value="history" className="space-y-4 mt-0">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                    {leaveRequests.filter(r => r.status !== 'pending').map(req => (
                                        <RequestCard key={req.id} type="leave" request={req} historyMode onViewAttachment={(url) => setAttachmentDialog({ open: true, url })} />
                                    ))}
                                    {overtimeRequests.filter(r => r.status !== 'pending').map(req => (
                                        <RequestCard key={req.id} type="overtime" request={req} historyMode onViewAttachment={(url) => setAttachmentDialog({ open: true, url })} />
                                    ))}
                                    {correctionRequests.filter(r => r.status !== 'pending').map(req => (
                                        <RequestCard key={req.id} type="correction" request={req} historyMode onViewAttachment={req.proof_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined} />
                                    ))}
                                    {reimbursementRequests.filter(r => r.status !== 'pending').map(req => (
                                        <RequestCard key={req.id} type="reimbursement" request={req} historyMode onViewAttachment={req.attachment_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined} />
                                    ))}

                                    {/* Empty State */}
                                    {(leaveRequests.filter(r => r.status !== 'pending').length === 0 &&
                                        overtimeRequests.filter(r => r.status !== 'pending').length === 0 &&
                                        correctionRequests.filter(r => r.status !== 'pending').length === 0 &&
                                        reimbursementRequests.filter(r => r.status !== 'pending').length === 0) && (
                                            <div className="col-span-full">
                                                <Card className="border-none shadow-md">
                                                    <CardContent className="py-20 text-center">
                                                        <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                                        <h3 className="text-xl font-bold text-slate-700">Belum Ada Riwayat</h3>
                                                        <p className="text-slate-500 mt-2">Belum ada permohonan yang diproses.</p>
                                                    </CardContent>
                                                </Card>
                                            </div>
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
    // Locale 'id' is already imported at the top level


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
