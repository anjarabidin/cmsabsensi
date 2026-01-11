import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronLeft,
    Search,
    MoreVertical,
    UserX,
    UserCheck,
    Loader2
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Profile } from '@/types';

export default function EmployeesPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Action States
    const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, department:departments(name), job_position:job_positions(title)')
                .order('full_name', { ascending: true });

            if (error) throw error;
            setEmployees((data as any) || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            toast({
                title: 'Gagal memuat data',
                description: 'Tidak dapat mengambil data karyawan.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (employee: Profile) => {
        // Prepare selection for confirmation dialog
        setSelectedEmployee(employee);
        setIsDeleteDialogOpen(true);
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

    const filteredEmployees = employees.filter(employee =>
        employee.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
                        <div className="flex items-start gap-3">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md">Manajemen Karyawan</h1>
                                <p className="text-blue-50 font-medium opacity-90 mt-1 text-xs">Kelola akun dan status aktif seluruh personil.</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/95 backdrop-blur-sm overflow-hidden rounded-2xl">
                        <CardHeader className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pb-4 border-b border-slate-100">
                            <div>
                                <CardTitle className="text-lg">Daftar Personil</CardTitle>
                                <CardDescription>Total {filteredEmployees.length} karyawan ditemukan.</CardDescription>
                            </div>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Cari nama atau email..."
                                    className="pl-9 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-[250px] font-bold text-slate-700">Nama Lengkap</TableHead>
                                            <TableHead className="font-bold text-slate-700">Posisi</TableHead>
                                            <TableHead className="font-bold text-slate-700">Kontak</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-center">Status</TableHead>
                                            <TableHead className="text-right font-bold text-slate-700">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-48 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                        <p className="text-xs">Memuat data...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredEmployees.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-48 text-center text-slate-500 italic">
                                                    Tidak ada data karyawan yang ditemukan.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredEmployees.map((employee) => (
                                                <TableRow key={employee.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${employee.is_active ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-slate-300'}`}>
                                                                {employee.full_name?.charAt(0).toUpperCase() || '?'}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`font-bold text-sm ${!employee.is_active && 'text-slate-400 line-through'}`}>
                                                                    {employee.full_name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {employee.nik_ktp || 'No ID'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-semibold text-slate-700">
                                                                {employee.job_position?.title || employee.position || '-'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500">
                                                                {employee.department?.name || 'Department -'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-xs text-slate-600">{employee.email}</span>
                                                            <span className="text-[10px] text-slate-400">{employee.phone || '-'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {employee.is_active ? (
                                                            <Badge className="bg-green-100 text-green-700 border-none px-3 py-1 text-[10px] shadow-none">
                                                                Aktif
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 px-3 py-1 text-[10px] shadow-none">
                                                                Non-Aktif
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                                                                <DropdownMenuLabel>Aksi Akun</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => navigate(`/profile?id=${employee.id}`)} disabled>
                                                                    Detail Profil (Coming Soon)
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {employee.is_active ? (
                                                                    <DropdownMenuItem onClick={() => handleToggleStatus(employee)} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                                                        <UserX className="mr-2 h-4 w-4" /> Nonaktifkan
                                                                    </DropdownMenuItem>
                                                                ) : (
                                                                    <DropdownMenuItem onClick={() => handleToggleStatus(employee)} className="text-green-600 focus:text-green-700 focus:bg-green-50">
                                                                        <UserCheck className="mr-2 h-4 w-4" /> Aktifkan Kembali
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Confirmation Dialog */}
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Konfirmasi Status Akun</AlertDialogTitle>
                            <AlertDialogDescription>
                                {selectedEmployee?.is_active ? (
                                    <span>
                                        Apakah Anda yakin ingin <strong>menonaktifkan</strong> akun <strong>{selectedEmployee.full_name}</strong>?
                                        <br /><br />
                                        Akun yang dinonaktifkan tidak akan bisa login, namun data riwayat (absensi, cuti, dll) akan <strong>tetap tersimpan</strong> dan tidak dihapus.
                                    </span>
                                ) : (
                                    <span>
                                        Aktifkan kembali akun <strong>{selectedEmployee?.full_name}</strong>? Pengguna akan dapat login kembali.
                                    </span>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmToggleStatus}
                                className={`rounded-xl ${selectedEmployee?.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                                disabled={actionLoading}
                            >
                                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {selectedEmployee?.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
}
