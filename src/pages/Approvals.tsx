
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, Calendar, FileText, ChevronLeft, Filter, Activity, MessageSquare, Eye, Download, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { AppRole } from '@/types';
import { downloadExcel } from '@/utils/csvExport';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    const { user, profile, activeRole } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [pendingFilter, setPendingFilter] = useState<'all' | 'accounts' | 'requests'>('all');
    const [filterType, setFilterType] = useState<string>('all');

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

    // Registration Approval Form State
    const [regForm, setRegForm] = useState({
        role: 'employee' as AppRole,
        department_id: '',
        job_position_id: '',
        employee_id: ''
    });

    const [departments, setDepartments] = useState<any[]>([]);
    const [jobPositions, setJobPositions] = useState<any[]>([]);

    useEffect(() => {
        const fetchMaster = async () => {
            const [d, p] = await Promise.all([
                supabase.from('departments').select('*').order('name'),
                supabase.from('job_positions').select('*').order('title')
            ]);
            setDepartments(d.data || []);
            setJobPositions(p.data || []);
        };
        fetchMaster();
    }, []);

    const [attachmentDialog, setAttachmentDialog] = useState<{
        open: boolean;
        url: string | null;
    }>({ open: false, url: null });

    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [allowedApprovalRoles, setAllowedApprovalRoles] = useState<string[]>(['super_admin', 'admin_hr']);
    const [allowedApprovalUsers, setAllowedApprovalUsers] = useState<string[]>([]);
    const [approvalEnabled, setApprovalEnabled] = useState(true);

    // Role check helper
    const role = activeRole || (profile?.role as string);
    const canApproveAccounts = allowedApprovalRoles.includes(role) || allowedApprovalUsers.includes(user?.id || '');
    const canApproveRequests = role === 'super_admin' || role === 'admin_hr' || role === 'manager';
    const isAdmin = role === 'super_admin' || role === 'admin_hr';

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('app_settings')
                .select('key, value')
                .in('key', ['account_approval_roles', 'account_approval_users', 'enable_account_approval']);

            const roles = data?.find(s => s.key === 'account_approval_roles')?.value || 'super_admin,admin_hr';
            const users = data?.find(s => s.key === 'account_approval_users')?.value || '';
            const enabled = data?.find(s => s.key === 'enable_account_approval')?.value || 'true';

            setAllowedApprovalRoles(roles.split(',').filter(Boolean));
            setAllowedApprovalUsers(users.split(',').filter(Boolean));
            setApprovalEnabled(enabled === 'true');
        };

        if (user) {
            fetchSettings();
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
                if (!canApproveAccounts || !approvalEnabled) return [];

                let query = supabase
                    .from('profiles')
                    .select('*, department:departments(name), job_position:job_positions(title)')
                    .eq('is_active', activeTab === 'pending' ? false : true)
                    .order('created_at', { ascending: false });

                // If specialized role like manager, still limit to their dept if needed
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
                    const activatedUser = pendingAccounts.find(a => a.id === actionDialog.requestId);
                    const userName = activatedUser?.full_name || 'Karyawan';

                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            is_active: true,
                            role: regForm.role,
                            department_id: regForm.department_id || null,
                            job_position_id: regForm.job_position_id || null,
                            employee_id: regForm.employee_id || null
                        })
                        .eq('id', actionDialog.requestId);

                    if (error) throw error;

                    // Push Notification for activation
                    await supabase.functions.invoke('send-push-notification', {
                        body: {
                            userId: actionDialog.requestId,
                            title: "Akun Aktif! 🔓",
                            body: `Akun dengan nama ${userName} sudah aktif. Silakan login sekarang.`,
                            data: { type: 'activation' }
                        }
                    });

                    // Send internal notification
                    await supabase.from('notifications').insert({
                        user_id: actionDialog.requestId,
                        title: 'Akun Diaktifkan',
                        message: `Selamat! Akun Anda (nama: ${userName}) telah diaktifkan oleh admin. Silakan login untuk mengakses aplikasi.`,
                        type: 'system',
                        read: false
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
                        read: false
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

    // Combine all history items for easier filtering/exporting
    const allHistory = [
        ...leaveRequests.filter(r => r.status !== 'pending').map(r => ({ ...r, type: 'leave', sortDate: r.created_at })),
        ...overtimeRequests.filter(r => r.status !== 'pending').map(r => ({ ...r, type: 'overtime', sortDate: r.created_at })),
        ...correctionRequests.filter(r => r.status !== 'pending').map(r => ({ ...r, type: 'correction', sortDate: r.created_at })),
        ...reimbursementRequests.filter(r => r.status !== 'pending').map(r => ({ ...r, type: 'reimbursement', sortDate: r.created_at }))
    ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

    const filteredHistory = allHistory.filter(item => {
        if (filterType === 'all') return true;
        return item.type === filterType;
    });

    const handleExportHistory = async () => {
        const headers = ['No', 'Status', 'Karyawan', 'Tipe', 'Tanggal Pengajuan', 'Alasan/Keterangan', 'Catatan Penolakan'];
        const rows = filteredHistory.map((req, index) => [
            String(index + 1),
            req.status === 'approved' ? '✅ DISETUJUI' : '❌ DITOLAK',
            req.profiles?.full_name || '-',
            req.type === 'leave' ? `Cuti (${(req as any).leave_type})` : req.type === 'overtime' ? 'Lembur' : req.type === 'correction' ? 'Koreksi' : 'Klaim',
            format(new Date(req.created_at), 'dd/MM/yyyy HH:mm', { locale: id }),
            req.reason || '-',
            req.rejection_reason || '-'
        ]);

        await downloadExcel(headers, [headers, ...rows], {
            filename: `Laporan_Approval_${format(new Date(), 'dd-MM-yyyy')}`,
            title: 'LAPORAN RIWAYAT PERSETUJUAN',
            generatedBy: profile?.full_name || 'System'
        });
        toast({ title: "Berhasil", description: "Laporan berhasil diunduh." });
    };

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
                                    label: 'Menunggu',
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
                                    label: 'Respon',
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

                    {/* Mobile Stats (Hidden on Destkop) */}
                    <div className="grid md:hidden grid-cols-3 gap-2">
                        <button
                            onClick={() => { setActiveTab('pending'); setPendingFilter('all'); }}
                            className="bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20 text-left"
                        >
                            <p className="text-[9px] font-bold text-blue-100 uppercase tracking-wider mb-0.5">MENUNGGU</p>
                            <p className="text-xl font-bold text-white leading-none">{pendingCount}</p>
                        </button>
                        <button
                            onClick={() => { setActiveTab('pending'); setPendingFilter('accounts'); }}
                            className="bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20 text-left"
                        >
                            <p className="text-[9px] font-bold text-blue-100 uppercase tracking-wider mb-0.5">AKUN BARU</p>
                            <p className="text-xl font-bold text-white leading-none">{pendingAccounts.filter(a => !a.is_active).length}</p>
                        </button>
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

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-auto">
                        <TabsList className="bg-slate-100/80 p-1.5 rounded-xl gap-2 h-auto inline-flex">
                            <TabsTrigger
                                value="pending"
                                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md text-slate-500 font-bold px-8 py-2.5 rounded-lg transition-all text-sm tracking-wide"
                            >
                                Persetujuan Menunggu
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

                    {/* Filter & Export Tools */}
                    <div className="flex gap-2">
                        {activeTab === 'pending' && (
                            <div className="flex bg-slate-100 p-1 rounded-xl h-10">
                                {[
                                    { id: 'all', label: 'Semua' },
                                    { id: 'accounts', label: 'Akun Baru' },
                                    { id: 'requests', label: 'Izin & Cuti' }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setPendingFilter(f.id as any)}
                                        className={cn(
                                            "px-4 h-full rounded-lg text-xs font-bold transition-all",
                                            pendingFilter === f.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {activeTab === 'history' && (
                            <>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 text-slate-600 font-bold bg-white hover:bg-slate-50">
                                            <Filter className="h-4 w-4 mr-2" />
                                            {filterType === 'all' ? 'Semua Tipe' :
                                                filterType === 'leave' ? 'Cuti' :
                                                    filterType === 'overtime' ? 'Lembur' :
                                                        filterType === 'correction' ? 'Koreksi' : 'Klaim'}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl w-48 shadow-xl border-slate-100">
                                        <DropdownMenuItem onClick={() => setFilterType('all')} className="font-medium py-2">Semua Tipe</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setFilterType('leave')} className="font-medium py-2">Cuti</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFilterType('overtime')} className="font-medium py-2">Lembur</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFilterType('correction')} className="font-medium py-2">Koreksi Absen</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFilterType('reimbursement')} className="font-medium py-2">Klaim / Reimburse</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExportHistory}
                                    className="h-10 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50 bg-white"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Unduh Laporan
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Main Content Area */}
                    <Tabs value={activeTab} className="w-full"> {/* Controlled by state but rendered directly here to wrap content */}
                        {/* Pending Content */}
                        <TabsContent value="pending" className="space-y-4 md:space-y-8 mt-0">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                                </div>
                            ) : pendingCount === 0 ? (
                                <div className="flex flex-col items-center justify-center w-full min-h-[400px] bg-white rounded-3xl border border-slate-100 shadow-sm text-center p-8">
                                    <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50/50">
                                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Semua Beres!</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto">Tidak ada permohonan yang perlu ditinjau saat ini. Kerja bagus!</p>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {/* Account Approvals Section */}
                                    {canApproveAccounts && approvalEnabled && (pendingFilter === 'all' || pendingFilter === 'accounts') && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-1 bg-purple-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-slate-800">Registrasi Akun Baru</h3>
                                                    <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-100">
                                                        {pendingAccounts.filter(a => !a.is_active).length} Antrian
                                                    </Badge>
                                                </div>
                                            </div>

                                            {pendingAccounts.filter(a => !a.is_active).length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2">
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
                                            ) : (
                                                <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center">
                                                    <p className="text-xs font-bold text-slate-400">Tidak ada pengajuan akun baru saat ini.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* General Requests Section */}
                                    {canApproveRequests && (pendingFilter === 'all' || pendingFilter === 'requests') && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-slate-800">Permohonan Izin & Operasional</h3>
                                                    <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-100">
                                                        {leaveRequests.filter(r => r.status === 'pending').length +
                                                            overtimeRequests.filter(r => r.status === 'pending').length +
                                                            correctionRequests.filter(r => r.status === 'pending').length +
                                                            reimbursementRequests.filter(r => r.status === 'pending').length} Permohonan
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="bg-transparent md:bg-white md:rounded-3xl md:border md:border-slate-200 overflow-hidden md:shadow-sm">
                                                {/* Desktop Table View */}
                                                <div className="hidden md:block overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-wider text-xs font-bold text-slate-500">
                                                            <tr>
                                                                <th className="px-6 py-4">Karyawan</th>
                                                                <th className="px-6 py-4">Tipe</th>
                                                                <th className="px-6 py-4">Tanggal & Waktu</th>
                                                                <th className="px-6 py-4">Alasan</th>
                                                                <th className="px-6 py-4 text-right">Aksi</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {[
                                                                ...leaveRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'leave', sortDate: r.created_at })),
                                                                ...overtimeRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'overtime', sortDate: r.date })),
                                                                ...correctionRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'correction', sortDate: r.date })),
                                                                ...reimbursementRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'reimbursement', sortDate: r.claim_date }))
                                                            ]
                                                                .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
                                                                .map((req: any) => (
                                                                    <tr key={`${req.type}-${req.id}`} className="hover:bg-slate-50/50 transition-colors">
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex items-center gap-3">
                                                                                <Avatar className="h-10 w-10 border border-slate-100">
                                                                                    <AvatarImage src={req.profiles?.avatar_url} />
                                                                                    <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-xs">
                                                                                        {req.profiles?.full_name?.substring(0, 2).toUpperCase()}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <div>
                                                                                    <p className="font-bold text-slate-900">{req.profiles?.full_name}</p>
                                                                                    <p className="text-xs text-slate-500">{req.profiles?.position || 'Karyawan'}</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <Badge variant="secondary" className={`capitalize font-bold border-0 ${req.type === 'leave' ? 'bg-orange-100 text-orange-700' :
                                                                                req.type === 'overtime' ? 'bg-purple-100 text-purple-700' :
                                                                                    req.type === 'correction' ? 'bg-blue-100 text-blue-700' :
                                                                                        'bg-green-100 text-green-700'
                                                                                }`}>
                                                                                {req.type === 'leave' ? 'Cuti' : req.type === 'overtime' ? 'Lembur' : req.type === 'correction' ? 'Koreksi' : 'Klaim'}
                                                                            </Badge>
                                                                            {req.type === 'leave' && <p className="text-[10px] text-slate-500 mt-1 capitalize">{req.leave_type}</p>}
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                                                <Calendar className="h-4 w-4 text-slate-400" />
                                                                                {req.start_date ? format(new Date(req.start_date), 'dd MMM yyyy', { locale: id }) : format(new Date(req.date || req.claim_date), 'dd MMM yyyy', { locale: id })}
                                                                            </div>
                                                                            {req.end_date && <p className="text-xs text-slate-500 mt-0.5 ml-6">s/d {format(new Date(req.end_date), 'dd MMM yyyy', { locale: id })}</p>}
                                                                            {req.hours && <p className="text-xs text-slate-500 mt-0.5 ml-6">{req.hours} Jam ({req.start_time} - {req.end_time})</p>}
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <div className="min-w-[250px] whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                                                                {req.reason}
                                                                            </div>
                                                                            {(req.attachment_url || req.proof_url) && (
                                                                                <Button variant="link" size="sm" onClick={() => setAttachmentDialog({ open: true, url: req.attachment_url || req.proof_url })} className="h-auto p-0 text-xs text-blue-600 mt-1">
                                                                                    Lihat Lampiran
                                                                                </Button>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <div className="flex justify-end gap-2">
                                                                                <Button size="sm" variant="outline" onClick={() => handleAction('reject', req.type as any, req.id)} className="h-8 w-24 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors">
                                                                                    Tolak
                                                                                </Button>
                                                                                <Button size="sm" onClick={() => handleAction('approve', req.type as any, req.id)} className="h-8 w-24 bg-green-600 hover:bg-green-700 text-white shadow-green-200 font-bold">
                                                                                    Setujui
                                                                                </Button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Mobile Card View */}
                                                <div className="md:hidden space-y-4">
                                                    {[
                                                        ...leaveRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'leave', sortDate: r.created_at })),
                                                        ...overtimeRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'overtime', sortDate: r.date })),
                                                        ...correctionRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'correction', sortDate: r.date })),
                                                        ...reimbursementRequests.filter(r => r.status === 'pending').map(r => ({ ...r, type: 'reimbursement', sortDate: r.claim_date }))
                                                    ]
                                                        .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
                                                        .map((req: any) => (
                                                            <div key={`${req.type}-${req.id}`} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar className="h-10 w-10 border border-slate-100">
                                                                            <AvatarImage src={req.profiles?.avatar_url} />
                                                                            <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-xs uppercase">
                                                                                {req.profiles?.full_name?.substring(0, 2)}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <div>
                                                                            <p className="font-bold text-slate-900 text-sm">{req.profiles?.full_name}</p>
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{req.profiles?.position || 'Karyawan'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <Badge variant="secondary" className={`capitalize font-black text-[10px] border-0 py-1 px-3 rounded-full ${req.type === 'leave' ? 'bg-orange-50 text-orange-600' :
                                                                        req.type === 'overtime' ? 'bg-purple-50 text-purple-600' :
                                                                            req.type === 'correction' ? 'bg-blue-50 text-blue-600' :
                                                                                'bg-green-50 text-green-600'
                                                                        }`}>
                                                                        {req.type === 'leave' ? 'Cuti' : req.type === 'overtime' ? 'Lembur' : req.type === 'correction' ? 'Koreksi' : 'Klaim'}
                                                                    </Badge>
                                                                </div>

                                                                <div className="bg-slate-50/80 p-4 rounded-xl space-y-2 border border-slate-100">
                                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                                        {req.start_date ? format(new Date(req.start_date), 'dd MMM yyyy', { locale: id }) : format(new Date(req.date || req.claim_date), 'dd MMM yyyy', { locale: id })}
                                                                        {req.end_date && <span className="text-slate-300 mx-1">→</span>}
                                                                        {req.end_date && format(new Date(req.end_date), 'dd MMM yyyy', { locale: id })}
                                                                    </div>
                                                                    <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-2">"{req.reason}"</p>
                                                                    {(req.attachment_url || req.proof_url) && (
                                                                        <Button variant="link" size="sm" onClick={() => setAttachmentDialog({ open: true, url: req.attachment_url || req.proof_url })} className="h-auto p-0 text-[11px] font-bold text-blue-600">
                                                                            Lihat Lampiran Bukti
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" variant="outline" onClick={() => handleAction('reject', req.type as any, req.id)} className="flex-1 h-10 border-slate-200 text-slate-700 font-bold rounded-xl active:bg-red-50">
                                                                        Tolak
                                                                    </Button>
                                                                    <Button size="sm" onClick={() => handleAction('approve', req.type as any, req.id)} className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition-all">
                                                                        Setujui
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="space-y-4 mt-0">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <div className="bg-transparent md:bg-white md:rounded-3xl md:border md:border-slate-200 overflow-hidden md:shadow-sm">
                                    {/* Desktop History View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-wider text-xs font-bold text-slate-500">
                                                <tr>
                                                    <th className="px-6 py-4">Karyawan</th>
                                                    <th className="px-6 py-4">Tipe</th>
                                                    <th className="px-6 py-4">Tanggal & Waktu</th>
                                                    <th className="px-6 py-4 text-center">Status</th>
                                                    <th className="px-6 py-4">Keterangan</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredHistory.map((req: any) => (
                                                    <tr key={`${req.type}-${req.id}`} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-10 w-10 border border-slate-100">
                                                                    <AvatarImage src={req.profiles?.avatar_url} />
                                                                    <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-xs uppercase">
                                                                        {req.profiles?.full_name?.substring(0, 2)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="font-bold text-slate-900">{req.profiles?.full_name}</p>
                                                                    <p className="text-xs text-slate-500">{req.profiles?.position || 'Karyawan'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <Badge variant="secondary" className={`capitalize font-bold border-0 ${req.type === 'leave' ? 'bg-orange-100 text-orange-700' :
                                                                req.type === 'overtime' ? 'bg-purple-100 text-purple-700' :
                                                                    req.type === 'correction' ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-green-100 text-green-700'
                                                                }`}>
                                                                {req.type === 'leave' ? 'Cuti' : req.type === 'overtime' ? 'Lembur' : req.type === 'correction' ? 'Koreksi' : 'Klaim'}
                                                            </Badge>
                                                            {req.type === 'leave' && <p className="text-[10px] text-slate-500 mt-1 capitalize">{(req as any).leave_type}</p>}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                                <Calendar className="h-4 w-4 text-slate-400" />
                                                                {req.start_date ? format(new Date(req.start_date), 'dd MMM yyyy', { locale: id }) : format(new Date(req.date || req.claim_date), 'dd MMM yyyy', { locale: id })}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-0.5 ml-6">Diajukan: {format(new Date(req.created_at), 'dd MMM HH:mm', { locale: id })}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {req.status === 'approved' ? (
                                                                <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-200 shadow-sm font-bold">
                                                                    <CheckCircle2 className="mr-1 h-3 w-3" /> Disetujui
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200 shadow-sm font-bold">
                                                                    <XCircle className="mr-1 h-3 w-3" /> Ditolak
                                                                </Badge>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="min-w-[250px] whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                                                {req.reason}
                                                            </div>
                                                            {req.status === 'rejected' && req.rejection_reason && (
                                                                <div className="text-xs text-red-600 mt-1 italic flex items-start gap-1">
                                                                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                                                    <span>{req.rejection_reason}</span>
                                                                </div>
                                                            )}
                                                            {(req.attachment_url || req.proof_url) && (
                                                                <Button variant="link" size="sm" onClick={() => setAttachmentDialog({ open: true, url: req.attachment_url || req.proof_url })} className="h-auto p-0 text-xs text-blue-600 mt-1 font-bold">
                                                                    Lihat Lampiran
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile History Card View */}
                                    <div className="md:hidden space-y-4">
                                        {filteredHistory.map((req: any) => (
                                            <div key={`${req.type}-${req.id}`} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="secondary" className={`capitalize font-black text-[10px] border-0 py-1 px-3 rounded-full ${req.type === 'leave' ? 'bg-orange-50 text-orange-600' :
                                                        req.type === 'overtime' ? 'bg-purple-50 text-purple-600' :
                                                            req.type === 'correction' ? 'bg-blue-50 text-blue-600' :
                                                                'bg-green-50 text-green-600'
                                                        }`}>
                                                        {req.type === 'leave' ? 'Cuti' : req.type === 'overtime' ? 'Lembur' : req.type === 'correction' ? 'Koreksi' : 'Klaim'}
                                                    </Badge>
                                                    {req.status === 'approved' ? (
                                                        <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase">
                                                            <CheckCircle2 className="h-3 w-3" /> Approved
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-red-600 text-[10px] font-black uppercase">
                                                            <XCircle className="h-3 w-3" /> Rejected
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-slate-100">
                                                        <AvatarImage src={req.profiles?.avatar_url} />
                                                        <AvatarFallback className="bg-slate-100 text-slate-500 font-bold text-xs uppercase">
                                                            {req.profiles?.full_name?.substring(0, 2)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">{req.profiles?.full_name}</p>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                            <Calendar className="h-3 w-3" />
                                                            {req.start_date ? format(new Date(req.start_date), 'dd MMM yyyy', { locale: id }) : format(new Date(req.date || req.claim_date), 'dd MMM yyyy', { locale: id })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                                                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 italic mb-1">"{req.reason}"</p>
                                                    {req.status === 'rejected' && req.rejection_reason && (
                                                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Alasan: {req.rejection_reason}
                                                        </p>
                                                    )}
                                                </div>

                                                {(req.attachment_url || req.proof_url) && (
                                                    <Button variant="link" size="sm" onClick={() => setAttachmentDialog({ open: true, url: req.attachment_url || req.proof_url })} className="h-auto p-0 text-[10px] text-blue-600 font-bold">
                                                        Lihat Lampiran Bukti
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {filteredHistory.length === 0 && (
                                        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 md:border-none">
                                            <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                                            <h3 className="text-lg font-bold text-slate-700">Belum Ada Riwayat</h3>
                                            <p className="text-sm">
                                                {filterType === 'all'
                                                    ? 'Belum ada permohonan yang diproses.'
                                                    : `Belum ada riwayat untuk tipe ${filterType}.`
                                                }
                                            </p>
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
                <DialogContent className="rounded-3xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {actionDialog.type === 'approve' ? (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    {actionDialog.requestType === 'account' ? 'Lengkapi Data & Aktifkan' : 'Konfirmasi Persetujuan'}
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-5 w-5 text-red-600" />
                                    Konfirmasi Penolakan
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {actionDialog.type === 'approve'
                                ? (actionDialog.requestType === 'account'
                                    ? 'Tentukan role dan penempatan untuk akun baru ini.'
                                    : 'Apakah Anda yakin ingin menyetujui permohonan ini?')
                                : 'Berikan alasan mengapa permohonan ini ditolak.'}
                        </DialogDescription>
                    </DialogHeader>

                    {actionDialog.type === 'approve' && actionDialog.requestType === 'account' && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Role Akun</label>
                                    <Select value={regForm.role} onValueChange={(v: any) => setRegForm({ ...regForm, role: v })}>
                                        <SelectTrigger className="rounded-xl h-11">
                                            <SelectValue placeholder="Pilih Role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="employee">Staff</SelectItem>
                                            <SelectItem value="manager">Head Unit</SelectItem>
                                            <SelectItem value="admin_hr">Admin HR</SelectItem>
                                            <SelectItem value="super_admin">Super Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ID Karyawan</label>
                                    <Input
                                        placeholder="CMS-001"
                                        className="rounded-xl h-11"
                                        value={regForm.employee_id}
                                        onChange={(e) => setRegForm({ ...regForm, employee_id: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Departemen / Unit</label>
                                <Select value={regForm.department_id} onValueChange={(v) => setRegForm({ ...regForm, department_id: v })}>
                                    <SelectTrigger className="rounded-xl h-11">
                                        <SelectValue placeholder="Pilih Departemen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jabatan / Posisi</label>
                                <Select value={regForm.job_position_id} onValueChange={(v) => setRegForm({ ...regForm, job_position_id: v })}>
                                    <SelectTrigger className="rounded-xl h-11">
                                        <SelectValue placeholder="Pilih Jabatan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {jobPositions
                                            .filter(p => !regForm.department_id || p.department_id === regForm.department_id)
                                            .map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {actionDialog.type === 'reject' && (
                        <div className="py-4">
                            <Textarea
                                placeholder="Tulis alasan penolakan di sini..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="min-h-[100px] rounded-2xl border-slate-200 focus:ring-red-100"
                            />
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setActionDialog({ open: false, type: null, requestType: null, requestId: null })}
                            disabled={processing}
                            className="rounded-xl font-bold"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={confirmAction}
                            disabled={processing}
                            className={cn(
                                "rounded-xl font-bold px-8 shadow-lg transition-all",
                                actionDialog.type === 'approve' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                            )}
                        >
                            {processing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : actionDialog.type === 'approve' ? (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                            ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                            )}
                            {actionDialog.requestType === 'account' && actionDialog.type === 'approve' ? 'Aktifkan Akun' : (actionDialog.type === 'approve' ? 'Setujui' : 'Tolak')}
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

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'approved':
                return {
                    card: 'bg-white border-green-200 hover:border-green-300 hover:shadow-green-100/50',
                    leftStrip: 'bg-green-500',
                    badge: 'bg-green-100 text-green-700 border-green-200'
                };
            case 'rejected':
                return {
                    card: 'bg-red-50/30 border-red-200 hover:border-red-300 hover:shadow-red-100/50',
                    leftStrip: 'bg-red-500',
                    badge: 'bg-red-100 text-red-700 border-red-200'
                };
            default:
                return {
                    card: 'bg-white border-slate-200 hover:border-blue-300',
                    leftStrip: 'bg-slate-300',
                    badge: 'bg-amber-100 text-amber-700 border-amber-200'
                };
        }
    };

    const styles = getStatusStyles(request.status);

    return (
        <Card className={`border shadow-sm overflow-hidden transition-all hover:shadow-md relative group ${styles.card}`}>
            {/* Status Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.leftStrip}`} />

            <div
                className="p-4 pl-5 flex items-center justify-between cursor-pointer transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <Avatar className={`h-10 w-10 border-2 ${request.status === 'approved' ? 'border-green-100' : request.status === 'rejected' ? 'border-red-100' : 'border-slate-100'}`}>
                        <AvatarImage src={request.profiles?.avatar_url} />
                        <AvatarFallback className={`${request.status === 'approved' ? 'bg-green-50 text-green-600' : request.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'} text-xs font-bold`}>
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
                <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 ml-1">
                    <div className="border-t border-slate-100/50 pt-3 mt-1 space-y-3">

                        {/* Detail Info Grid */}
                        <div className={`grid grid-cols-2 gap-3 p-2 rounded-lg border ${request.status === 'rejected' ? 'bg-white/50 border-red-100' : 'bg-slate-50/50 border-slate-100'}`}>
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
