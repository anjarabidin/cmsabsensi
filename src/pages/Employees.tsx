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
        const headers = ['No', 'Nama Lengkap', 'ID Karyawan', 'NIK KTP', 'Email', 'Telepon', 'Departemen', 'Posisi', 'Status Akun'];
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
            filename: `Daftar_Karyawan_${format(new Date(), 'dd-MM-yyyy')}`,
            title: 'DAFTAR KARYAWAN cms absensi',
            generatedBy: 'Administrator'
        });
        toast({ title: "Berhasil", description: "Data karyawan berhasil diunduh." });
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

            // Hide Admin HR from Managers
            if (role === 'manager') {
                empQuery = empQuery.neq('role', 'admin_hr');
            }

            const [empRes, deptRes, jobRes] = await Promise.all([
                empQuery.order('full_name', { ascending: true }),
                supabase.from('departments').select('*').order('name'),
                supabase.from('job_positions').select('*').order('title')
            ]);

            if (empRes.error) throw empRes.error;
            if (deptRes.error) throw deptRes.error;
            if (jobRes.error) throw jobRes.error;

            setEmployees((empRes.data as any) || []);
            setDepartments(deptRes.data || []);
            setJobPositions(jobRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast({
                title: 'Gagal memuat data',
                description: 'Tidak dapat mengambil data karyawan, departemen, atau jabatan.',
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
            role: employee.role
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

            toast({ title: "Berhasil", description: "Data karyawan berhasil diperbarui." });

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
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-br from-blue-600 to-indigo-600 rounded-b-[40px] z-0 shadow-lg" />

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

                        {/* Stats Scroll */}
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar snap-x">
                            <div className="snap-center shrink-0 w-36 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-white flex flex-col justify-between h-24">
                                <Users className="h-5 w-5 opacity-80" />
                                <div>
                                    <p className="text-2xl font-black">{employees.length}</p>
                                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Total Personil</p>
                                </div>
                            </div>
                            <div className="snap-center shrink-0 w-36 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-white flex flex-col justify-between h-24">
                                <UserCheck className="h-5 w-5 opacity-80 text-green-300" />
                                <div>
                                    <p className="text-2xl font-black">{employees.filter(e => e.is_active).length}</p>
                                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Akun Aktif</p>
                                </div>
                            </div>
                            <div className="snap-center shrink-0 w-36 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-white flex flex-col justify-between h-24">
                                <Building2 className="h-5 w-5 opacity-80 text-orange-300" />
                                <div>
                                    <p className="text-2xl font-black">{departments.length}</p>
                                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Departemen</p>
                                </div>
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
                                                            {emp.is_active ? (
                                                                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] mt-1.5" />
                                                            ) : (
                                                                <div className="h-2 w-2 rounded-full bg-slate-300 mt-1.5" />
                                                            )}
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
                                        {/* Managers */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Pimpinan (Manager)</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                {employees.filter(e => e.role === 'manager').map(mgr => (
                                                    <div key={mgr.id} className="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm flex flex-col items-center text-center gap-2" onClick={() => handleEditClick(mgr)}>
                                                        <Avatar className="h-14 w-14 border-4 border-blue-50">
                                                            <AvatarImage src={mgr.avatar_url || ''} />
                                                            <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">{mgr.full_name?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-bold text-xs text-slate-900 line-clamp-1">{mgr.full_name}</p>
                                                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tight line-clamp-1">{(mgr as any).job_position?.title}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {employees.filter(e => e.role === 'manager').length === 0 && (
                                                    <div className="col-span-2 py-4 text-center text-[10px] text-slate-400 border border-dashed border-slate-200 rounded-xl">Belum ada manager</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Staff */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Tim Staff</h3>
                                            <div className="grid grid-cols-3 gap-2">
                                                {employees.filter(e => e.role === 'employee').map(staff => (
                                                    <div key={staff.id} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-1.5" onClick={() => handleEditClick(staff)}>
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={staff.avatar_url || ''} />
                                                            <AvatarFallback className="bg-slate-50 text-slate-400 text-xs font-bold">{staff.full_name?.[0]}</AvatarFallback>
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
                                : 'Pusat kontrol data karyawan dan hak akses sistem.'}
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
                        <Button
                            variant="secondary"
                            onClick={() => navigate('/approvals')}
                            className="bg-amber-100/50 hover:bg-amber-100 text-amber-700 rounded-xl font-bold border border-amber-200"
                        >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Konfirmasi Pendaftaran
                            {employees.filter(e => !e.is_active).length > 0 && (
                                <Badge className="ml-2 bg-amber-500 hover:bg-amber-600 text-white border-0 h-5 px-1.5 min-w-[20px]">{employees.filter(e => !e.is_active).length}</Badge>
                            )}
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
                                <p className="text-sm font-bold text-slate-500">Total Karyawan</p>
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
                                <TabsTrigger value="list" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Daftar Karyawan</TabsTrigger>
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
                                            <TableHead className="pl-6 h-14 font-black text-slate-600 text-xs uppercase tracking-widest">Karyawan</TableHead>
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
                                                        <p>Tidak ada karyawan ditemukan.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredEmployees.map((employee) => (
                                                <TableRow key={employee.id} className="group hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => handleEditClick(employee)}>
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
                                                                {employee.role === 'admin_hr' && profile?.role !== 'manager' && (
                                                                    <Badge className="mt-1 bg-purple-100 text-purple-700 border-none text-[9px] px-1.5 h-4">ADMIN</Badge>
                                                                )}
                                                                {employee.role === 'super_admin' && (
                                                                    <Badge className="mt-1 bg-slate-800 text-white border-none text-[9px] px-1.5 h-4">SUPER ADMIN</Badge>
                                                                )}
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
                                                            {(role === 'super_admin' || role === 'admin_hr' || (role === 'manager' && employee.role === 'employee')) && (
                                                                (employee.role !== 'super_admin' || role === 'super_admin') && (
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
                                                                                <DropdownMenuLabel className="text-xs text-slate-400 font-medium">Opsi Karyawan</DropdownMenuLabel>
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
                                                                )
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="chart" className="mt-0">
                            <div className="space-y-8 py-4">
                                {/* Leaders Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 px-2">
                                        <div className="h-1 w-8 bg-blue-600 rounded-full" />
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Pimpinan Unit (Manager)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {employees.filter(e => e.role === 'manager').map(mgr => (
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
                                                        <p className="text-blue-100 text-xs font-bold truncate opacity-80 uppercase tracking-tighter">{(mgr as any).job_position?.title || 'Manager'}</p>
                                                        <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-none text-[9px] px-2 h-5 font-black uppercase">UNIT HEAD</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {employees.filter(e => e.role === 'manager').length === 0 && (
                                            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-[32px]">
                                                <p className="text-slate-400 font-medium italic">Belum ada manajer yang terdaftar di unit ini.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Team Members Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 px-2">
                                        <div className="h-1 w-8 bg-slate-300 rounded-full" />
                                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Anggota Tim (Staff)</h3>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {employees.filter(e => e.role !== 'manager' && e.role !== 'admin_hr').map(staff => (
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
                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Aktif" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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
                            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Edit Karyawan</DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium">Perbarui informasi dan hak akses karyawan.</DialogDescription>
                        </div>
                        <div className="h-12 w-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shadow-sm">
                            <UserCog className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>

                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        <Tabs defaultValue="profile" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl mb-6">
                                <TabsTrigger value="profile" className="rounded-lg font-bold text-xs uppercase tracking-wider">Profil</TabsTrigger>
                                <TabsTrigger value="job" className="rounded-lg font-bold text-xs uppercase tracking-wider">Pekerjaan</TabsTrigger>
                                <TabsTrigger value="account" className="rounded-lg font-bold text-xs uppercase tracking-wider">Akun</TabsTrigger>
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
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ID Karyawan (NIK)</Label>
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
                            </TabsContent>

                            <TabsContent value="account" className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role Akses</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(() => {
                                            const availableRoles = ['employee', 'manager', 'admin_hr'];
                                            if (profile?.role === 'super_admin') {
                                                availableRoles.push('super_admin');
                                            }
                                            return availableRoles.map((role) => (
                                                <div
                                                    key={role}
                                                    onClick={() => setEditForm({ ...editForm, role: role as any })}
                                                    className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all ${editForm.role === role
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                        : 'border-slate-100 bg-white text-slate-500 hover:border-blue-200'
                                                        }`}
                                                >
                                                    <p className="text-xs font-black uppercase">{role.replace('_', ' ')}</p>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2">
                                        * <b>Employee</b>: Akses standar (Absen, Cuti). <br />
                                        * <b>Manager</b>: Approval cuti tim, melihat laporan. <br />
                                        * <b>Admin HR</b>: Akses penuh sistem (Pengaturan, Data Karyawan, Gaji).
                                    </p>
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
