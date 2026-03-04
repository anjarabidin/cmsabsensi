import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    ChevronLeft,
    Search,
    MoreVertical,
    UserCheck,
    Loader2,
    Plus,
    Filter,
    Download,
    FileSpreadsheet,
    Building2,
    Briefcase,
    UserCog,
    Mail,
    Phone,
    CreditCard,
    Save,
    UserX,
    Database,
    LayoutGrid,
    Trash2,
    Edit,
    Users
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Profile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { downloadExcel } from '@/utils/csvExport';

import { MasterDataDialog } from '@/components/employees/MasterDataDialog';

export default function EmployeesPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { profile, role } = useAuth();
    const isMobile = useIsMobile();
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [jobPositions, setJobPositions] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Action States
    const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState<Partial<Profile>>({});

    // Master Data State
    const [isMasterDataOpen, setIsMasterDataOpen] = useState(false);
    const [masterTab, setMasterTab] = useState<'departments' | 'positions'>('departments');
    // Removed unused Master Data state variables



    const handleExportExcel = () => {
        const headers = ['No', 'Nama Lengkap', 'ID Staf', 'NIK KTP', 'Email', 'Telepon', 'Departemen', 'Posisi', 'Status Akun'];
        const rows = employees.map((emp, index) => [
            String(index + 1),
            emp.full_name || '-',
            emp.employee_id || '-',
            emp.nik_ktp || '-',
            emp.email || '-',
            emp.phone || '-',
            (emp.department as any)?.name || '-',
            (emp.job_position as any)?.title || emp.position || '-',
            emp.is_active ? 'AKTIF' : 'NON-AKTIF'
        ]);

        downloadExcel(headers, rows, {
            filename: `Daftar_Staf_${format(new Date(), 'dd-MM-yyyy')}`,
            title: 'DAFTAR STAF cms absensi',
            generatedBy: 'Administrator'
        });
        toast({ title: "Berhasil", description: "Data staf berhasil diunduh." });
    };

    useEffect(() => {
        if (role) fetchData();
    }, [role, profile?.department_id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let empQuery = supabase
                .from('profiles')
                .select('*, department:departments(id, name), job_position:job_positions(id, title)');

            if ((role === 'manager' || role === 'employee') && role !== 'super_admin' && profile?.department_id) {
                empQuery = empQuery.eq('department_id', profile.department_id);
            }

            // Hide Admin HR from managers
            if (role === 'manager') {
                empQuery = empQuery.neq('role', 'admin_hr');
            }

            const [empRes, deptRes, jobRes, shiftRes] = await Promise.all([
                empQuery.order('full_name', { ascending: true }),
                supabase.from('departments').select('*').order('name'),
                supabase.from('job_positions').select('*').order('title'),
                (supabase.from('shifts') as any).select('id, name, start_time, end_time, is_default').order('name')
            ]);

            if (empRes.error) throw empRes.error;
            if (deptRes.error) throw deptRes.error;
            if (jobRes.error) throw jobRes.error;

            setEmployees((empRes.data as any) || []);
            setDepartments(deptRes.data || []);
            setJobPositions(jobRes.data || []);
            setShifts(shiftRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast({
                title: 'Gagal memuat data',
                description: 'Tidak dapat mengambil data staf, departemen, atau jabatan.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    // Master Data Handlers removed (moved to component)


    const handleToggleStatus = async (employee: Profile) => {
        setSelectedEmployee(employee);
        setIsDeleteDialogOpen(true);
    };

    const handleEditClick = (employee: Profile) => {
        setSelectedEmployee(employee);
        setEditForm({
            full_name: employee.full_name,
            email: employee.email,
            phone: employee.phone,
            nik_ktp: employee.nik_ktp,
            employee_id: employee.employee_id,
            department_id: employee.department_id,
            job_position_id: employee.job_position_id,
            role: employee.role,
            default_shift_id: (employee as any).default_shift_id ?? null,
        });
        setIsEditOpen(true);
    };

    const confirmToggleStatus = async () => {
        if (!selectedEmployee) return;

        setActionLoading(true);
        try {
            const newStatus = !selectedEmployee.is_active;

            const { error } = await supabase
                .from('profiles')
                .update({ is_active: newStatus })
                .eq('id', selectedEmployee.id);

            if (error) throw error;

            toast({
                title: newStatus ? 'Akun Diaktifkan' : 'Akun Dinonaktifkan',
                description: `Status ${selectedEmployee.full_name} telah diperbarui.`,
                className: newStatus ? 'bg-green-50 text-green-800' : 'bg-slate-800 text-white',
            });

            // Update local state
            setEmployees(employees.map(emp =>
                emp.id === selectedEmployee.id ? { ...emp, is_active: newStatus } : emp
            ));
            fetchData(); // Refresh data to ensure consistency

        } catch (error: any) {
            toast({
                title: 'Gagal memperbarui status',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setActionLoading(false);
            setIsDeleteDialogOpen(false);
            setSelectedEmployee(null);
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedEmployee) return;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    ...editForm,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedEmployee.id);

            if (error) throw error;

            toast({ title: "Berhasil", description: "Data staf berhasil diperbarui." });

            // Refresh Data
            fetchData();
            setIsEditOpen(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const filteredEmployees = employees.filter(employee => {
        if (searchTerm === 'inactive') return !employee.is_active;
        return employee.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.email?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // ----------------------------------------------------------------------
    // MOBILE VIEW (Preserved from original)
    // ----------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    <div className="absolute top-0 left-0 w-full h-[calc(220px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24">
                        {/* Header & Actions */}
                        <div className="flex items-center justify-between text-white mb-2">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 hover:text-white h-8 w-8 rounded-full -ml-2">
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <h1 className="text-lg font-black tracking-tight drop-shadow-sm">SDM & Tim</h1>
                            </div>
                            <div className="flex gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                                        <DropdownMenuLabel>Menu Admin</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => { setMasterTab('departments'); setIsMasterDataOpen(true); }}>
                                            <Database className="mr-2 h-4 w-4" /> Data Master
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleExportExcel}>
                                            <Download className="mr-2 h-4 w-4" /> Unduh Excel
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Stats Grid - Compact 3 Columns */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 text-white flex flex-col items-center justify-center text-center h-20">
                                <Users className="h-4 w-4 opacity-80 mb-1" />
                                <p className="text-xl font-black leading-none">{employees.length}</p>
                                <p className="text-[9px] font-bold opacity-80 uppercase tracking-tighter mt-0.5">Personil</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 text-white flex flex-col items-center justify-center text-center h-20">
                                <UserCheck className="h-4 w-4 opacity-80 text-green-300 mb-1" />
                                <p className="text-xl font-black leading-none">{employees.filter(e => e.is_active).length}</p>
                                <p className="text-[9px] font-bold opacity-80 uppercase tracking-tighter mt-0.5">Aktif</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 text-white flex flex-col items-center justify-center text-center h-20">
                                <Building2 className="h-4 w-4 opacity-80 text-orange-300 mb-1" />
                                <p className="text-xl font-black leading-none">{departments.length}</p>
                                <p className="text-[9px] font-bold opacity-80 uppercase tracking-tighter mt-0.5">Divisi</p>
                            </div>
                        </div>

                        {/* Main Content Card */}
                        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 overflow-hidden min-h-[60vh] flex flex-col">
                            <Tabs defaultValue="list" className="w-full flex flex-col h-full">
                                <div className="p-4 border-b border-slate-100 space-y-4">
                                    <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-xl">
                                        <TabsTrigger value="list" className="rounded-lg font-bold text-xs">Daftar</TabsTrigger>
                                        <TabsTrigger value="structure" className="rounded-lg font-bold text-xs">Struktur</TabsTrigger>
                                    </TabsList>

                                    {/* Search & Filter */}
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Cari nama / email..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-9 bg-slate-50 border-slate-200 rounded-xl text-xs h-10"
                                            />
                                        </div>
                                        <Button variant="outline" size="icon" className="shrink-0 rounded-xl border-slate-200 text-slate-500 h-10 w-10">
                                            <Filter className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <TabsContent value="list" className="flex-1 p-0 m-0 bg-slate-50/30">
                                    <div className="p-4 space-y-3 pb-24">
                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                                <p className="text-xs">Memuat data...</p>
                                            </div>
                                        ) : filteredEmployees.length === 0 ? (
                                            <div className="text-center py-20 text-slate-400">
                                                <p className="text-xs font-bold">Tidak ada data ditemukan</p>
                                            </div>
                                        ) : (
                                            filteredEmployees.map(emp => (
                                                <div key={emp.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 active:scale-[0.98] transition-all" onClick={() => handleEditClick(emp)}>
                                                    <Avatar className="h-12 w-12 border border-slate-100 rounded-2xl">
                                                        <AvatarImage src={emp.avatar_url || ''} />
                                                        <AvatarFallback className="rounded-2xl bg-slate-100 font-bold text-slate-500">{emp.full_name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-bold text-slate-900 truncate">{emp.full_name}</h4>
                                                            <div className="flex items-center gap-2">
                                                                {emp.id !== profile?.id && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 rounded-full text-blue-600 bg-blue-50"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            startCall(emp.id, emp.full_name);
                                                                        }}
                                                                    >
                                                                        <Phone className="h-4 w-4 fill-blue-600" />
                                                                    </Button>
                                                                )}
                                                                {emp.is_active ? (
                                                                    <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] mt-1.5" />
                                                                ) : (
                                                                    <div className="h-2 w-2 rounded-full bg-slate-300 mt-1.5" />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-blue-600 font-semibold truncate mb-1">{(emp as any).job_position?.title || 'Posisi Kosong'}</p>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                                            <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 truncate max-w-[100px]">{(emp as any).department?.name || '-'}</span>
                                                            <span>•</span>
                                                            <span className="truncate flex-1">{emp.email}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="structure" className="flex-1 p-0 m-0 bg-slate-50/30">
                                    <div className="p-4 space-y-6 pb-24">
                                        {/* managers */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Pimpinan (Head unit)</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                {employees.filter(e => e.role === 'manager').map(mgr => (
                                                    <div key={mgr.id} className="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm flex flex-col items-center text-center gap-2" onClick={() => handleEditClick(mgr)}>
                                                        <Avatar className="h-14 w-14 border-4 border-blue-50 relative">
                                                            <AvatarImage src={mgr.avatar_url || ''} />
                                                            <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">{mgr.full_name?.[0]}</AvatarFallback>
                                                            {mgr.id !== profile?.id && (
                                                                <Button
                                                                    size="icon"
                                                                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-blue-600 text-white border-2 border-white"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startCall(mgr.id, mgr.full_name);
                                                                    }}
                                                                >
                                                                    <Phone className="h-3 w-3 fill-white" />
                                                                </Button>
                                                            )}
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-bold text-xs text-slate-900 line-clamp-1">{mgr.full_name}</p>
                                                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tight line-clamp-1">{(mgr as any).job_position?.title}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {employees.filter(e => e.role === 'manager').length === 0 && (
                                                    <div className="col-span-2 py-4 text-center text-[10px] text-slate-400 border border-dashed border-slate-200 rounded-xl">Belum ada Head unit</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Staff */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Tim Staff</h3>
                                            <div className="grid grid-cols-3 gap-2">
                                                {employees.filter(e => e.role === 'employee').map(staff => (
                                                    <div key={staff.id} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-1.5" onClick={() => handleEditClick(staff)}>
                                                        <Avatar className="h-10 w-10 relative">
                                                            <AvatarImage src={staff.avatar_url || ''} />
                                                            <AvatarFallback className="bg-slate-50 text-slate-400 text-xs font-bold">{staff.full_name?.[0]}</AvatarFallback>
                                                            {staff.id !== profile?.id && (
                                                                <Button
                                                                    size="icon"
                                                                    className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-blue-600 text-white border-2 border-white"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startCall(staff.id, staff.full_name);
                                                                    }}
                                                                >
                                                                    <Phone className="h-2.5 w-2.5 fill-white" />
                                                                </Button>
                                                            )}
                                                        </Avatar>
                                                        <p className="font-bold text-[10px] text-slate-700 leading-tight line-clamp-2">{staff.full_name}</p>
                                                        <div className={`h-1.5 w-1.5 rounded-full ${staff.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Confirmation Dialog Mobile */}
                        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                            <AlertDialogContent className="rounded-2xl w-[90%] mx-auto">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Konfirmasi Status</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Ubah status akun <b>{selectedEmployee?.full_name}</b>?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-row gap-2 justify-end">
                                    <AlertDialogCancel className="mt-0 rounded-xl flex-1">Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={confirmToggleStatus}
                                        className={`rounded-xl flex-1 ${selectedEmployee?.is_active ? 'bg-red-600' : 'bg-green-600'}`}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? <Loader2 className="animate-spin" /> : 'Ya, Ubah'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // ----------------------------------------------------------------------
    // DESKTOP VIEW (New Premium Design)
    // ----------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-6 px-6 py-8">
                {/* Desktop Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            {profile?.role === 'manager' ? 'Anggota Tim' : 'Manajemen SDM'}
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">
                            {profile?.role === 'manager'
                                ? 'Kelola data personil dalam tim Anda.'
                                : 'Pusat kontrol data staf dan hak akses sistem.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
                            onClick={() => { setMasterTab('departments'); setIsMasterDataOpen(true); }}
                        >
                            <LayoutGrid className="mr-2 h-4 w-4" />
                            {profile?.role === 'manager' ? 'Lihat Data Master' : 'Kelola Data'}
                        </Button>
                        <Button variant="outline" className="rounded-xl border-slate-200" onClick={handleExportExcel}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> Unduh Excel
                        </Button>

                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-4 gap-6">
                    <Card className="rounded-3xl border-none shadow-sm bg-blue-50/50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500">Total Staf</p>
                                <p className="text-2xl font-black text-slate-900">{employees.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-none shadow-sm bg-green-50/50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                                <UserCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500">Status Aktif</p>
                                <p className="text-2xl font-black text-slate-900">{employees.filter(e => e.is_active).length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card
                        className="rounded-3xl border-none shadow-sm bg-orange-50/50 cursor-pointer hover:bg-orange-100/50 transition-colors group"
                        onClick={() => { setMasterTab('departments'); setIsMasterDataOpen(true); }}
                    >
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500">Departemen</p>
                                <p className="text-2xl font-black text-slate-900">{departments.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card
                        className="rounded-3xl border-none shadow-sm bg-purple-50/50 cursor-pointer hover:bg-purple-100/50 transition-colors group"
                        onClick={() => { setMasterTab('positions'); setIsMasterDataOpen(true); }}
                    >
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                <Briefcase className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500">Posisi/Jabatan</p>
                                <p className="text-2xl font-black text-slate-900">{jobPositions.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-6 min-h-[600px]">
                    <Tabs defaultValue="list" className="w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 px-2 gap-4">
                            <TabsList className="grid w-full md:w-[400px] grid-cols-2 bg-slate-100 p-1 rounded-xl">
                                <TabsTrigger value="list" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Daftar Staf</TabsTrigger>
                                <TabsTrigger value="chart" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Struktur Organisasi</TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Cari nama, nik, atau email..."
                                        className="pl-9 w-full md:w-72 rounded-xl bg-slate-50 border-slate-200"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" size="icon" className="rounded-xl border-slate-200 text-slate-500">
                                    <Filter className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <TabsContent value="list" className="mt-0">
                            <div className="rounded-3xl border border-slate-100 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50/80">
                                        <TableRow>
                                            <TableHead className="pl-6 h-14 font-black text-slate-600 text-xs uppercase tracking-widest">Staf</TableHead>
                                            <TableHead className="h-14 font-black text-slate-600 text-xs uppercase tracking-widest">Jabatan & Divisi</TableHead>
                                            <TableHead className="h-14 font-black text-slate-600 text-xs uppercase tracking-widest">Kontak</TableHead>
                                            <TableHead className="h-14 font-black text-slate-600 text-xs uppercase tracking-widest">Status Akun</TableHead>
                                            <TableHead className="pr-6 h-14 font-black text-slate-600 text-xs uppercase tracking-widest text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                                                        <p className="text-sm font-bold text-slate-400">Sedang memuat data...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredEmployees.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-96 text-center text-slate-400">
                                                    <div className="flex flex-col items-center justify-center gap-4 opacity-50">
                                                        <UserX className="h-16 w-16" />
                                                        <p>Tidak ada staf ditemukan.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredEmployees.map((employee) => {
                                                // STRICT PERMISSION CHECK
                                                const isTargetSuperAdmin = employee.role === 'super_admin';
                                                const amISuperAdmin = role === 'super_admin';

                                                // Rules:
                                                // 1. Super Admin can edit everyone.
                                                // 2. Admin HR can edit everyone EXCEPT Super Admin.
                                                // 3. manager can ONLY edit Employees (not other managers or Admins).
                                                const canEdit = amISuperAdmin ||
                                                    (role === 'admin_hr' && !isTargetSuperAdmin) ||
                                                    (role === 'manager' && employee.role === 'employee');

                                                return (
                                                    <TableRow
                                                        key={employee.id}
                                                        className={`group transition-colors ${canEdit ? 'hover:bg-blue-50/30 cursor-pointer' : 'opacity-75 cursor-not-allowed bg-slate-50/50'}`}
                                                        onClick={() => canEdit && handleEditClick(employee)}
                                                    >
                                                        <TableCell className="pl-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                <Avatar className="h-12 w-12 border-2 border-white shadow-md group-hover:scale-105 transition-transform">
                                                                    <AvatarImage src={employee.avatar_url || ''} />
                                                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm">
                                                                        {employee.full_name?.substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{employee.full_name}</p>
                                                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{employee.nik_ktp || 'Belum ada NIK'}</p>
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {employee.role === 'super_admin' && (
                                                                            <Badge className="bg-slate-900 text-white border-none text-[9px] px-1.5 h-4 hover:bg-slate-800">SUPER ADMIN</Badge>
                                                                        )}
                                                                        {employee.role === 'admin_hr' && (
                                                                            <Badge className="bg-purple-100 text-purple-700 border-none text-[9px] px-1.5 h-4 hover:bg-purple-200">ADMIN HR</Badge>
                                                                        )}
                                                                        {employee.role === 'manager' && (
                                                                            <Badge className="bg-cyan-100 text-cyan-700 border-none text-[9px] px-1.5 h-4 hover:bg-cyan-200">Head unit</Badge>
                                                                        )}
                                                                        {employee.role === 'employee' && (
                                                                            <Badge className="bg-slate-100 text-slate-500 border-none text-[9px] px-1.5 h-4 hover:bg-slate-200">STAFF</Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                                                                    <span className="text-sm font-semibold text-slate-700">{(employee as any).job_position?.title || '-'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                                    <span className="text-xs text-slate-500">{(employee as any).department?.name || '-'}</span>
                                                                </div>
                                                                {(employee as any).default_shift_id && (() => {
                                                                    const ds = shifts.find((s: any) => s.id === (employee as any).default_shift_id);
                                                                    if (!ds) return null;
                                                                    return (
                                                                        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100 border-dashed w-fit">
                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1 leading-none ${ds.is_night_shift
                                                                                ? 'bg-violet-50 text-violet-600 border border-violet-100'
                                                                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                                                }`}>
                                                                                {ds.is_night_shift ? '🌙' : '☀️'} {ds.name}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                                    <Mail className="h-3 w-3 text-slate-400" />
                                                                    {employee.email}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                    <Phone className="h-3 w-3 text-slate-400" />
                                                                    {employee.phone || '-'}
                                                                    {employee.id !== profile?.id && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 rounded-full text-blue-600 hover:bg-blue-100"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                startCall(employee.id, employee.full_name);
                                                                            }}
                                                                        >
                                                                            <Phone className="h-3 w-3 fill-blue-600" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border-0 ${employee.is_active
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-red-50 text-red-600'
                                                                    }`}
                                                            >
                                                                {employee.is_active ? 'AKTIF' : 'NON-AKTIF'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="pr-6 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                {canEdit && (
                                                                    <>
                                                                        <Button
                                                                            variant="secondary"
                                                                            size="icon"
                                                                            className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-blue-100 shadow-sm transition-all"
                                                                            onClick={(e) => { e.stopPropagation(); handleEditClick(employee); }}
                                                                            title="Edit Detail"
                                                                        >
                                                                            <UserCog className="h-4 w-4" />
                                                                        </Button>

                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    <MoreVertical className="h-4 w-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-xl border-slate-100">
                                                                                <DropdownMenuLabel className="text-xs text-slate-400 font-medium">Opsi Staf</DropdownMenuLabel>
                                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(employee); }} className="rounded-xl font-bold py-2.5">
                                                                                    <UserCog className="mr-2 h-4 w-4 text-blue-500" /> Edit Detail
                                                                                </DropdownMenuItem>
                                                                                {(role === 'super_admin' || role === 'admin_hr') && (
                                                                                    <>
                                                                                        <DropdownMenuSeparator />
                                                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleStatus(employee); }} className="rounded-xl font-bold py-2.5 text-red-600 focus:text-red-700 bg-red-50/50">
                                                                                            <UserX className="mr-2 h-4 w-4" /> {employee.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                                                                        </DropdownMenuItem>
                                                                                    </>
                                                                                )}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="chart" className="mt-0">
                            <div className="space-y-12 py-6">
                                {/* Group by Department */}
                                {Object.entries(
                                    employees.reduce((acc, emp) => {
                                        const deptName = (emp as any).department?.name || 'Non-Departmental / Umum';
                                        if (!acc[deptName]) {
                                            acc[deptName] = { managers: [], staff: [] };
                                        }
                                        if (emp.role === 'manager') {
                                            acc[deptName].managers.push(emp);
                                        } else if (emp.role !== 'admin_hr') { // Exclude Admin HR as per original logic
                                            acc[deptName].staff.push(emp);
                                        }
                                        return acc;
                                    }, {} as Record<string, { managers: Profile[], staff: Profile[] }>)
                                ).sort((a, b) => a[0].localeCompare(b[0])).map(([deptName, group]) => (
                                    <div key={deptName} className="space-y-6">

                                        {/* Department Header */}
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">{deptName}</h3>
                                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{group.managers.length + group.staff.length} Personil</p>
                                            </div>
                                            <div className="flex-1 h-px bg-slate-100/80 ml-4" />
                                        </div>

                                        {/* managers Section */}
                                        {group.managers.length > 0 && (
                                            <div className="space-y-3 pl-6">
                                                <h4 className="text-xs font-black text-blue-900/40 uppercase tracking-widest flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                    Pimpinan Unit (Head unit)
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {group.managers.map(mgr => (
                                                        <div key={mgr.id} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer" onClick={() => handleEditClick(mgr)}>
                                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-colors" />
                                                            <div className="flex items-center gap-4 relative z-10">
                                                                <Avatar className="h-16 w-16 border-4 border-white/20 shadow-2xl">
                                                                    <AvatarImage src={mgr.avatar_url || ''} />
                                                                    <AvatarFallback className="bg-white text-blue-600 font-black text-xl">
                                                                        {mgr.full_name?.substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="min-w-0">
                                                                    <p className="font-black text-lg truncate leading-none mb-1">{mgr.full_name}</p>
                                                                    <p className="text-blue-100 text-xs font-bold truncate opacity-80 uppercase tracking-tighter">{(mgr as any).job_position?.title || 'Head unit'}</p>
                                                                    <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-none text-[9px] px-2 h-5 font-black uppercase">UNIT HEAD</Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Staff Section */}
                                        {group.staff.length > 0 && (
                                            <div className="space-y-3 pl-6">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                                                    Anggota Tim (Staff)
                                                </h4>
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                    {group.staff.map(staff => (
                                                        <div key={staff.id} className="bg-white border border-slate-100 rounded-[24px] p-4 shadow-sm hover:shadow-md transition-all group flex flex-col items-center text-center cursor-pointer" onClick={() => handleEditClick(staff)}>
                                                            <Avatar className="h-16 w-16 mb-3 border-2 border-slate-50 group-hover:scale-105 transition-transform">
                                                                <AvatarImage src={staff.avatar_url || ''} />
                                                                <AvatarFallback className="bg-slate-100 text-slate-400 font-black text-lg">
                                                                    {staff.full_name?.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <p className="font-bold text-slate-900 text-sm truncate w-full">{staff.full_name}</p>
                                                            <p className="text-[10px] text-slate-500 font-medium truncate w-full uppercase tracking-tighter mt-0.5">{(staff as any).job_position?.title || 'Staff'}</p>
                                                            <div className="mt-3 flex gap-1">
                                                                <div className={`h-1.5 w-1.5 rounded-full ${staff.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} title={staff.is_active ? "Aktif" : "Non-Aktif"} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Empty State for Department */}
                                        {group.managers.length === 0 && group.staff.length === 0 && (
                                            <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl mx-6">
                                                <p className="text-slate-400 text-xs italic">Belum ada personil di departemen ini.</p>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {employees.length === 0 && (
                                    <div className="text-center py-20">
                                        <p className="text-slate-400 font-bold">Belum ada data staf.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Edit Employee Sheet/Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-2xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Edit Staf</DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium">Perbarui informasi dan hak akses staf.</DialogDescription>
                        </div>
                        <div className="h-12 w-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shadow-sm">
                            <UserCog className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>

                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        <Tabs defaultValue="profile" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl mb-6">
                                <TabsTrigger value="profile" className="rounded-lg font-bold text-xs uppercase tracking-wider">Profil</TabsTrigger>
                                <TabsTrigger value="job" className="rounded-lg font-bold text-xs uppercase tracking-wider">Pekerjaan</TabsTrigger>
                            </TabsList>

                            <TabsContent value="profile" className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</Label>
                                    <Input
                                        value={editForm.full_name || ''}
                                        onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                        className="rounded-xl font-medium"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ID Staf (NIK)</Label>
                                        <Input
                                            value={editForm.employee_id || ''}
                                            onChange={e => setEditForm({ ...editForm, employee_id: e.target.value })}
                                            placeholder="Contoh: 2024001"
                                            className="rounded-xl font-medium font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">NIK KTP (16 Digit)</Label>
                                        <Input
                                            value={editForm.nik_ktp || ''}
                                            onChange={e => setEditForm({ ...editForm, nik_ktp: e.target.value })}
                                            className="rounded-xl font-medium font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</Label>
                                        <Input
                                            value={editForm.email || ''}
                                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                            className="rounded-xl font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">No. Telepon</Label>
                                        <Input
                                            value={editForm.phone || ''}
                                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                            className="rounded-xl font-medium"
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="job" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departemen</Label>
                                        <Select
                                            value={editForm.department_id || ''}
                                            onValueChange={v => setEditForm({ ...editForm, department_id: v })}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Pilih Departemen" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-xl">
                                                {departments.map(d => (
                                                    <SelectItem key={d.id} value={d.id} className="rounded-lg">{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posisi / Jabatan</Label>
                                        <Select
                                            value={editForm.job_position_id || ''}
                                            onValueChange={v => setEditForm({ ...editForm, job_position_id: v })}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Pilih Jabatan" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-xl">
                                                {jobPositions.map(j => (
                                                    <SelectItem key={j.id} value={j.id} className="rounded-lg">{j.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Shift Tetap — per Staf */}
                                <div className="pt-5 border-t border-slate-100">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Shift Tetap</p>
                                            <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                                                Pengingat absen dikirim sesuai shift ini setiap hari kerja.<br />
                                                Tidak perlu isi jadwal bulanan.
                                            </p>
                                        </div>
                                        {(editForm as any).default_shift_id && (
                                            <button
                                                type="button"
                                                onClick={() => setEditForm({ ...editForm, default_shift_id: null } as any)}
                                                className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-red-50 border border-slate-100 hover:border-red-200"
                                            >
                                                Hapus
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 max-h-[240px] overflow-y-auto">
                                        {/* Opsi: Otomatis */}
                                        <button
                                            type="button"
                                            onClick={() => setEditForm({ ...editForm, default_shift_id: null } as any)}
                                            className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-2xl border-2 transition-all duration-150 ${!(editForm as any).default_shift_id
                                                ? 'border-slate-400 bg-slate-50 shadow-sm'
                                                : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${!(editForm as any).default_shift_id
                                                ? 'bg-slate-200'
                                                : 'bg-slate-100 group-hover:bg-slate-200'
                                                }`}>
                                                <span className="text-sm font-black text-slate-500">—</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-700">Otomatis</p>
                                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Ikuti shift default perusahaan</p>
                                            </div>
                                            {!(editForm as any).default_shift_id && (
                                                <div className="h-2.5 w-2.5 rounded-full bg-slate-500 shrink-0" />
                                            )}
                                        </button>

                                        {/* Opsi: per shift */}
                                        {shifts.map((s: any) => {
                                            const selected = (editForm as any).default_shift_id === s.id;
                                            const night = s.is_night_shift;
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, default_shift_id: s.id } as any)}
                                                    className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-2xl border-2 transition-all duration-150 ${selected
                                                        ? night
                                                            ? 'border-violet-400 bg-violet-50 shadow-sm shadow-violet-100'
                                                            : 'border-amber-400 bg-amber-50 shadow-sm shadow-amber-100'
                                                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-base shrink-0 transition-colors ${selected
                                                        ? night ? 'bg-violet-100' : 'bg-amber-100'
                                                        : night ? 'bg-violet-50 group-hover:bg-violet-100' : 'bg-amber-50 group-hover:bg-amber-100'
                                                        }`}>
                                                        {night ? '🌙' : '☀️'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                            <p className={`text-sm font-bold truncate ${selected ? (night ? 'text-violet-900' : 'text-amber-900') : 'text-slate-700'}`}>
                                                                {s.name}
                                                            </p>
                                                            {s.is_default && (
                                                                <span className="inline-flex text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none">
                                                                    Default
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className={`text-[11px] font-mono font-semibold tracking-tight ${selected ? (night ? 'text-violet-500' : 'text-amber-500') : 'text-slate-400'}`}>
                                                            {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)} WIB
                                                        </p>
                                                    </div>
                                                    {selected && (
                                                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${night ? 'bg-violet-500' : 'bg-amber-500'}`} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl font-bold text-slate-500 hover:bg-white">Batal</Button>
                        <Button onClick={handleSaveEdit} disabled={actionLoading} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg shadow-blue-200">
                            {actionLoading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Simpan Perubahan</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reused Confirmation Dialog from Mobile for Consistency */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-slate-900">Konfirmasi Status Akun</AlertDialogTitle>
                        <AlertDialogDescription className="text-base">
                            {selectedEmployee?.is_active ? (
                                <span>
                                    Apakah Anda yakin ingin <strong>menonaktifkan</strong> akun <strong>{selectedEmployee.full_name}</strong>?
                                    <br /><br />
                                    Akun yang dinonaktifkan tidak akan bisa login, namun data riwayat (absensi, cuti, dll) akan <strong>tetap tersimpan</strong>.
                                </span>
                            ) : (
                                <span>
                                    Aktifkan kembali akun <strong>{selectedEmployee?.full_name}</strong>? Pengguna akan dapat login kembali.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl border-slate-200 font-bold">Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmToggleStatus}
                            className={`rounded-xl font-bold shadow-lg ${selectedEmployee?.is_active ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'}`}
                            disabled={actionLoading}
                        >
                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {selectedEmployee?.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Master Data Dialog - Refactored */}
            <MasterDataDialog
                open={isMasterDataOpen}
                onOpenChange={setIsMasterDataOpen}
                onSuccess={fetchData}
                tab={masterTab}
                onTabChange={setMasterTab}
                userRole={profile?.role}
            />
        </DashboardLayout >
    );
}
