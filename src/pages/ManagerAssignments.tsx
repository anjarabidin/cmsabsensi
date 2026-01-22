import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2, Plus, Trash2, Users, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Profile {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    department_id?: string;
    departments?: { name: string } | null;
}

interface Assignment {
    id: string;
    manager_id: string;
    employee_id: string;
    manager?: Profile;
    employee?: Profile;
}

export default function ManagerAssignments() {
    const { role } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [managers, setManagers] = useState<Profile[]>([]);
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [selectedManager, setSelectedManager] = useState<string>('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

    // Redirect if not admin
    useEffect(() => {
        if (role && role !== 'admin_hr') {
            navigate('/dashboard');
        } else {
            fetchData();
        }
    }, [role]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch assignments
            const { data: assignData, error: assignError } = await supabase
                .from('manager_assignments')
                .select(`
                    *,
                    manager:profiles!manager_assignments_manager_id_fkey(id, full_name, email, avatar_url, department_id, departments(name)),
                    employee:profiles!manager_assignments_employee_id_fkey(id, full_name, email, avatar_url, department_id, departments(name))
                `)
                .order('created_at', { ascending: false });

            if (assignError) throw assignError;
            setAssignments(assignData || []);

            // Fetch all managers
            const { data: managerData, error: managerError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, department_id, departments(name)')
                .eq('role', 'manager')
                .eq('is_active', true)
                .order('full_name');

            if (managerError) throw managerError;
            setManagers(managerData || []);

            // Fetch all employees (non-manager)
            const { data: empData, error: empError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, department_id, departments(name)')
                .eq('role', 'employee')
                .eq('is_active', true)
                .order('full_name');

            if (empError) throw empError;
            setEmployees(empData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast({
                title: 'Gagal Memuat Data',
                description: 'Terjadi kesalahan saat mengambil data.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddAssignments = async () => {
        if (!selectedManager || selectedEmployees.length === 0) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Pilih manager dan minimal 1 karyawan.',
                variant: 'destructive',
            });
            return;
        }

        setProcessing(true);
        try {
            const assignmentsToInsert = selectedEmployees.map(empId => ({
                manager_id: selectedManager,
                employee_id: empId,
            }));

            const { error } = await supabase
                .from('manager_assignments')
                .insert(assignmentsToInsert);

            if (error) throw error;

            toast({
                title: 'Berhasil!',
                description: `${selectedEmployees.length} karyawan berhasil di-assign.`,
            });

            setDialogOpen(false);
            setSelectedManager('');
            setSelectedEmployees([]);
            fetchData();
        } catch (error: any) {
            console.error('Error adding assignments:', error);
            toast({
                title: 'Gagal Menambah',
                description: error.message || 'Terjadi kesalahan saat menambah assignment.',
                variant: 'destructive',
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteAssignment = async (id: string) => {
        if (!confirm('Hapus assignment ini?')) return;

        try {
            const { error } = await supabase
                .from('manager_assignments')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({
                title: 'Berhasil Dihapus',
                description: 'Assignment telah dihapus.',
            });

            fetchData();
        } catch (error) {
            console.error('Error deleting assignment:', error);
            toast({
                title: 'Gagal Menghapus',
                description: 'Terjadi kesalahan saat menghapus assignment.',
                variant: 'destructive',
            });
        }
    };

    const toggleEmployee = (empId: string) => {
        setSelectedEmployees(prev =>
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    // Group assignments by manager
    const groupedAssignments = assignments.reduce((acc, assign) => {
        const managerId = assign.manager_id;
        if (!acc[managerId]) {
            acc[managerId] = {
                manager: assign.manager,
                employees: []
            };
        }
        if (assign.employee) {
            acc[managerId].employees.push(assign.employee);
        }
        return acc;
    }, {} as Record<string, { manager?: Profile; employees: Profile[] }>);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center min-h-screen">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-8 px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="h-10 w-10"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kelola Assignment Manager</h1>
                                <p className="text-slate-500 mt-1">Atur siapa yang menjadi atasan dari karyawan mana.</p>
                            </div>
                        </div>
                    </div>
                    <Button
                        onClick={() => setDialogOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 h-11 px-6 rounded-xl font-bold gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        Tambah Assignment
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <Card className="border-none shadow-md">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Manager</p>
                                <p className="text-2xl font-black text-slate-900">{managers.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-md">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                <UserCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Assignments</p>
                                <p className="text-2xl font-black text-slate-900">{assignments.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-md">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Karyawan</p>
                                <p className="text-2xl font-black text-slate-900">{employees.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Assignments List */}
                <div className="space-y-4">
                    {Object.keys(groupedAssignments).length === 0 ? (
                        <Card className="border-none shadow-md">
                            <CardContent className="py-20 text-center">
                                <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-700">Belum Ada Assignment</h3>
                                <p className="text-slate-500 mt-2">Klik "Tambah Assignment" untuk mulai assign manager ke karyawan.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        Object.entries(groupedAssignments).map(([managerId, data]) => (
                            <Card key={managerId} className="border-none shadow-md">
                                <CardHeader className="bg-slate-50 border-b border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                <AvatarImage src={data.manager?.avatar_url} />
                                                <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">
                                                    {data.manager?.full_name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <CardTitle className="text-lg">{data.manager?.full_name}</CardTitle>
                                                <CardDescription>{data.manager?.email}</CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                            {data.employees.length} Karyawan
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {data.employees.map((emp) => {
                                            const assignment = assignments.find(
                                                a => a.manager_id === managerId && a.employee_id === emp.id
                                            );
                                            return (
                                                <div
                                                    key={emp.id}
                                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all"
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={emp.avatar_url} />
                                                            <AvatarFallback className="bg-slate-200 text-slate-600 text-sm">
                                                                {emp.full_name?.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-900 text-sm truncate">{emp.full_name}</p>
                                                            <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                                                        </div>
                                                    </div>
                                                    {assignment && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteAssignment(assignment.id)}
                                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Add Assignment Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Tambah Assignment Baru</DialogTitle>
                        <DialogDescription>
                            Pilih manager dan karyawan yang akan di-assign.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Select Manager */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Manager</label>
                            <Select value={selectedManager} onValueChange={setSelectedManager}>
                                <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="Pilih manager..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {managers.map(manager => (
                                        <SelectItem key={manager.id} value={manager.id}>
                                            {manager.full_name} - {manager.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Select Employees */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                Karyawan ({selectedEmployees.length} dipilih)
                            </label>
                            <div className="border border-slate-200 rounded-xl p-4 max-h-[300px] overflow-y-auto space-y-2">
                                {employees.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-4">Tidak ada karyawan tersedia</p>
                                ) : (
                                    employees.map(emp => (
                                        <div
                                            key={emp.id}
                                            onClick={() => toggleEmployee(emp.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${selectedEmployees.includes(emp.id)
                                                    ? 'bg-blue-50 border-2 border-blue-200'
                                                    : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                                }`}
                                        >
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={emp.avatar_url} />
                                                <AvatarFallback className="bg-slate-200 text-slate-600 text-sm">
                                                    {emp.full_name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 text-sm truncate">{emp.full_name}</p>
                                                <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                                            </div>
                                            {selectedEmployees.includes(emp.id) && (
                                                <UserCheck className="h-5 w-5 text-blue-600" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            disabled={processing}
                            className="rounded-xl"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleAddAssignments}
                            disabled={processing || !selectedManager || selectedEmployees.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Tambah Assignment
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
