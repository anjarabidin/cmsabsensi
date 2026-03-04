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
import { ChevronLeft, Loader2, Plus, Trash2, Users, UserCheck, Zap, ShieldCheck, Mail, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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

export default function managerAssignments() {
    const { role, activeRole } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [managers, setmanagers] = useState<Profile[]>([]);
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [selectedmanager, setSelectedmanager] = useState<string>('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

    const canManage = activeRole === 'super_admin' || activeRole === 'admin_hr';

    useEffect(() => {
        if (!canManage && role !== 'admin_hr' && role !== 'super_admin') {
            navigate('/dashboard');
        } else {
            fetchData();
        }
    }, [role, activeRole]);

    const fetchData = async () => {
        setLoading(true);
        try {
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

            const { data: managerData, error: managerError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, department_id, departments(name)')
                .eq('role', 'manager')
                .eq('is_active', true)
                .order('full_name');

            if (managerError) throw managerError;
            setmanagers(managerData || []);

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
            toast({ title: 'Gagal Memuat Data', description: 'Terjadi kesalahan saat mengambil data.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const toggleEmployee = (id: string) => {
        setSelectedEmployees(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const handleAutoAssign = async () => {
        const confirmMsg = "Otomatis memasangkan Head unit dengan Staf di Departemen yang sama? Lanjutkan?";
        if (!confirm(confirmMsg)) return;

        setProcessing(true);
        try {
            const newAssignments: {
                manager_id: string; employee_id: string
            }[] = [];
            let count = 0;

            managers.forEach(mgr => {
                if (!mgr.department_id) return;
                const departmentStaff = employees.filter(emp => emp.department_id === mgr.department_id);
                departmentStaff.forEach(staff => {
                    const exists = assignments.some(a => a.manager_id === mgr.id && a.employee_id === staff.id);
                    const queued = newAssignments.some(a => a.manager_id === mgr.id && a.employee_id === staff.id);
                    if (!exists && !queued) {
                        newAssignments.push({ manager_id: mgr.id, employee_id: staff.id });
                        count++;
                    }
                });
            });

            if (count === 0) {
                toast({ title: "Sudah Optimal", description: "Tidak ditemukan pasangan baru." });
                return;
            }

            const { error } = await supabase.from('manager_assignments').insert(newAssignments);
            if (error) throw error;

            toast({ title: "Berhasil", description: `${count} koneksi baru dibuat!`, className: "bg-green-600 text-white border-none" });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleAddAssignments = async () => {
        if (!selectedmanager || selectedEmployees.length === 0) {
            toast({ title: 'Tidak Lengkap', description: 'Pilih Head unit dan bawahan.', variant: 'destructive' });
            return;
        }

        setProcessing(true);
        try {
            const assignmentsToInsert = selectedEmployees.map(empId => ({
                manager_id: selectedmanager,
                employee_id: empId,
            }));

            const { error } = await supabase.from('manager_assignments').insert(assignmentsToInsert);
            if (error) throw error;

            toast({ title: 'Berhasil!', description: `${selectedEmployees.length} bawahan ditambahkan.` });
            setDialogOpen(false);
            setSelectedmanager('');
            setSelectedEmployees([]);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteAssignment = async (id: string) => {
        if (!confirm('Hapus assignment ini?')) return;
        try {
            const { error } = await supabase.from('manager_assignments').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Berhasil', description: 'Assignment dihapus.' });
            fetchData();
        } catch (error) {
            toast({ title: 'Gagal', description: 'Gagal menghapus.', variant: 'destructive' });
        }
    };

    const groupedAssignments = assignments.reduce((acc, assign) => {
        const managerId = assign.manager_id;
        if (!acc[managerId]) {
            acc[managerId] = { manager: assign.manager, employees: [] };
        }
        if (assign.employee) {
            acc[managerId].employees.push({ ...assign.employee, assignmentId: assign.id });
        }
        return acc;
    }, {} as Record<string, { manager?: Profile; employees: (Profile & { assignmentId: string })[] }>);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center min-h-[60vh]">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-8 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Peta Head unit</h1>
                        <p className="text-slate-500 font-medium mt-1">Struktur hirarki Head unit dan bawahan.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={handleAutoAssign}
                            className="rounded-2xl h-11 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all border-2"
                        >
                            <Zap className="h-4 w-4 mr-2 text-amber-500 fill-amber-500" />
                            Auto Assign
                        </Button>
                        <Button
                            onClick={() => setDialogOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-11 px-6 font-black shadow-lg shadow-blue-200 gap-2"
                        >
                            <Plus className="h-5 w-5" />
                            Tambah Head unit
                        </Button>
                    </div>
                </div>

                {/* Desktop Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Object.keys(groupedAssignments).length === 0 ? (
                        <div className="col-span-full py-20 text-center opacity-40">
                            <ShieldCheck className="h-16 w-16 mx-auto mb-4" />
                            <h3 className="text-xl font-bold">Belum Ada Struktur Terdaftar</h3>
                            <p className="text-sm font-medium">Klik 'Tambah Head unit' untuk mulai memetakan hirarki.</p>
                        </div>
                    ) : (
                        Object.entries(groupedAssignments).map(([managerId, data]) => (
                            <Card key={managerId} className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100/50 flex flex-col transition-all hover:scale-[1.01]">
                                <CardHeader className="bg-slate-900 text-white p-6 pb-8 relative">
                                    <div className="absolute top-0 right-0 p-6 opacity-10">
                                        <Users size={80} />
                                    </div>
                                    <div className="flex items-center gap-4 relative z-10">
                                        <Avatar className="h-14 w-14 border-4 border-white/10 shadow-lg bg-slate-800">
                                            <AvatarImage src={data.manager?.avatar_url} />
                                            <AvatarFallback className="bg-blue-600 text-white font-black">
                                                {data.manager?.full_name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-black tracking-tight truncate leading-tight">{data.manager?.full_name}</h3>
                                            <div className="flex items-center gap-1.5 mt-1 opacity-70">
                                                <Mail className="h-3 w-3" />
                                                <span className="text-[10px] truncate font-medium">{data.manager?.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 pb-2 -mt-4 bg-white rounded-t-[32px] flex-1 relative z-20">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tim Terdaftar:</p>
                                        <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[10px]">
                                            {data.employees.length} ORANG
                                        </Badge>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {data.employees.map((emp) => (
                                            <div key={emp.id} className="group flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-md transition-all">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <Avatar className="h-9 w-9 border border-white">
                                                        <AvatarImage src={emp.avatar_url} />
                                                        <AvatarFallback className="bg-slate-200 text-slate-600 text-[10px] font-bold">
                                                            {emp.full_name?.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="truncate">
                                                        <p className="text-xs font-bold text-slate-800 truncate leading-none mb-1">{emp.full_name}</p>
                                                        <div className="flex items-center gap-1 opacity-60">
                                                            <Building2 className="h-2.5 w-2.5" />
                                                            <span className="text-[9px] font-medium truncate italic">{emp.departments?.name || 'Staff Luar'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteAssignment(emp.assignmentId)}
                                                    className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                                <div className="p-4 bg-slate-50/50 border-t border-slate-50 mt-auto">
                                    <Button variant="ghost" className="w-full h-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 rounded-xl" onClick={() => { setSelectedmanager(managerId); setDialogOpen(true); }}>
                                        + Tambah Anggota Tim (Head unit)
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Dialog Form */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="rounded-[40px] sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                        <div className="bg-slate-900 p-8 text-white relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <UserCheck size={120} />
                            </div>
                            <DialogHeader>
                                <DialogTitle className="text-3xl font-black tracking-tight mb-2">Assign Head unit</DialogTitle>
                                <DialogDescription className="text-slate-400 font-medium">
                                    Hubungkan atasan dengan satu atau lebih bawahan.
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Pilih Head unit</label>
                                <Select value={selectedmanager} onValueChange={setSelectedmanager}>
                                    <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-slate-50 font-bold">
                                        <SelectValue placeholder="-- Pilih Head unit --" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl shadow-2xl border-slate-100">
                                        {managers.map(manager => (
                                            <SelectItem key={manager.id} value={manager.id} className="rounded-xl py-3 cursor-pointer">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{manager.full_name}</span>
                                                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{manager.departments?.name || 'Staff'}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Bawahan ({selectedEmployees.length})</label>
                                    <button onClick={() => setSelectedEmployees([])} className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Reset</button>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {employees.map(emp => (
                                        <div
                                            key={emp.id}
                                            onClick={() => toggleEmployee(emp.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                                selectedEmployees.includes(emp.id)
                                                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
                                                    : "bg-slate-50 border-transparent hover:border-slate-200 text-slate-800"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors",
                                                selectedEmployees.includes(emp.id) ? "bg-white border-white" : "border-slate-300 bg-white"
                                            )}>
                                                {selectedEmployees.includes(emp.id) && <UserCheck className="h-3 w-3 text-blue-600" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-xs truncate leading-none">{emp.full_name}</p>
                                                <p className={cn("text-[9px] font-medium mt-1 truncate opacity-70", selectedEmployees.includes(emp.id) ? "text-blue-50" : "text-slate-500 uppercase")}>
                                                    {emp.departments?.name || 'UMUM'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="h-12 rounded-2xl font-black text-slate-500 flex-1">Batal</Button>
                            <Button
                                onClick={handleAddAssignments}
                                disabled={processing || !selectedmanager || selectedEmployees.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 px-8 font-black shadow-lg shadow-blue-200 flex-[2] transition-all active:scale-95"
                            >
                                {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simpan Hirarki"}
                            </Button>
                        </div>
                    </DialogContent >
                </Dialog >
            </div >
        </DashboardLayout >
    );
}
