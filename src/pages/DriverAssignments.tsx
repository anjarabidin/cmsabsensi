import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronLeft, Loader2, Plus, Trash2, Users, Car, Search, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Profile } from '@/types';

interface Vehicle {
    id: string;
    plate_number: string;
    brand_model: string;
    color: string | null;
    year: number | null;
    status: string;
}

interface DriverAssignment {
    id: string;
    driver_id: string;
    principal_id: string;
    vehicle_id: string | null;
    vehicle_details: string | null;
    is_active: boolean;
    driver?: Profile;
    principal?: Profile;
    vehicle?: Vehicle;
}

export default function DriverAssignments() {
    const { role, activeRole } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
    const [drivers, setDrivers] = useState<Profile[]>([]);
    const [principals, setPrincipals] = useState<Profile[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedDriver, setSelectedDriver] = useState<string>('');
    const [selectedPrincipal, setSelectedPrincipal] = useState<string>('');
    const [selectedVehicle, setSelectedVehicle] = useState<string>('');

    const canManage = activeRole === 'super_admin' || activeRole === 'admin_hr';

    useEffect(() => {
        if (!canManage && role !== 'super_admin' && role !== 'admin_hr') {
            navigate('/dashboard');
        } else {
            fetchData();
        }
    }, [role, activeRole]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: assignData, error: assignError } = await supabase
                .from('driver_assignments')
                .select(`*, driver:profiles!driver_assignments_driver_id_fkey(*), principal:profiles!driver_assignments_principal_id_fkey(*), vehicle:vehicles(*)`)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (assignError) throw assignError;
            setAssignments(assignData as any || []);

            const { data: driverData } = await supabase
                .from('profiles').select('*').eq('role', 'driver').eq('is_active', true).order('full_name');
            setDrivers(driverData || []);

            const { data: principalData } = await supabase
                .from('profiles').select('*').eq('is_active', true).neq('role', 'driver').order('full_name');
            setPrincipals(principalData || []);

            const { data: vehicleData } = await supabase
                .from('vehicles').select('*').eq('status', 'available').order('plate_number');
            setVehicles(vehicleData || []);
        } catch (error) {
            toast({ title: 'Error', description: 'Gagal memuat data penugasan.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddAssignment = async () => {
        if (!selectedDriver || !selectedPrincipal) {
            toast({ title: 'Data Tidak Lengkap', description: 'Harap pilih Driver dan Pejabat.', variant: 'destructive' });
            return;
        }
        setProcessing(true);
        try {
            const { error } = await supabase.from('driver_assignments').upsert({
                driver_id: selectedDriver,
                principal_id: selectedPrincipal,
                vehicle_id: selectedVehicle || null,
                vehicle_details: null,
                is_active: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'driver_id' });
            if (error) throw error;
            toast({ title: 'Berhasil', description: 'Penugasan disimpan.' });
            setDialogOpen(false);
            resetForm();
            fetchData();
        } catch (error: any) {
            toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteAssignment = async (id: string) => {
        if (!confirm('Hapus penugasan ini?')) return;
        try {
            const { error } = await supabase.from('driver_assignments').delete().eq('id', id);
            if (error) throw error;
            setAssignments(assignments.filter(a => a.id !== id));
            toast({ title: 'Dihapus', description: 'Penugasan dihapus.' });
        } catch (error: any) {
            toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
        }
    };

    const resetForm = () => { setSelectedDriver(''); setSelectedPrincipal(''); setSelectedVehicle(''); };

    const filteredAssignments = assignments.filter(a =>
        a.driver?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.principal?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center min-h-[60vh]">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            </DashboardLayout>
        );
    }

    // ─── MOBILE VIEW ──────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50 pb-28">
                    {/* Gradient Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white pb-8 pt-[calc(1rem+env(safe-area-inset-top))] px-4 rounded-b-[32px] shadow-lg mb-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 -ml-2 h-8 w-8 rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <h1 className="text-lg font-black">Tugas Driver</h1>
                        </div>
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/20 text-center">
                                <p className="text-2xl font-black">{assignments.length}</p>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Penugasan Aktif</p>
                            </div>
                            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/20 text-center">
                                <p className="text-2xl font-black">{drivers.length}</p>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Total Driver</p>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-4 -mt-4 mb-4 relative z-10">
                        <div className="relative bg-white rounded-2xl shadow-lg ring-1 ring-slate-100">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari driver atau pejabat..."
                                className="pl-10 h-12 border-none rounded-2xl bg-transparent focus-visible:ring-0 font-medium"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Cards */}
                    <div className="px-4 space-y-3">
                        {filteredAssignments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                                <Car className="h-12 w-12 text-slate-400 mb-3" />
                                <p className="font-bold text-slate-700">Belum Ada Penugasan</p>
                                <p className="text-xs text-slate-500 mt-1">Tap tombol + untuk menambah penugasan.</p>
                            </div>
                        ) : (
                            filteredAssignments.map(a => (
                                <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Avatar className="h-12 w-12 rounded-2xl border-2 border-blue-50">
                                            <AvatarImage src={a.driver?.avatar_url || ''} />
                                            <AvatarFallback className="bg-blue-600 text-white font-black rounded-2xl">
                                                {a.driver?.full_name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-900 truncate">{a.driver?.full_name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-[10px] font-black text-green-600 uppercase">Aktif</span>
                                                {a.driver?.employee_id && (
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 font-black">{a.driver.employee_id}</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost" size="icon"
                                            onClick={() => handleDeleteAssignment(a.id)}
                                            className="h-8 w-8 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <ArrowRight className="h-3 w-3 text-indigo-400 shrink-0" />
                                        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-xl flex-1 min-w-0">
                                            <Avatar className="h-7 w-7 shrink-0">
                                                <AvatarImage src={a.principal?.avatar_url || ''} />
                                                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px] font-black">
                                                    {a.principal?.full_name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider leading-none">Melayani</p>
                                                <p className="text-xs font-bold text-slate-800 truncate">{a.principal?.full_name}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {(a.vehicle || a.vehicle_details) && (
                                        <div className="flex items-center gap-2 mt-2 pl-5">
                                            <Car className="h-3 w-3 text-slate-400 shrink-0" />
                                            <span className="text-[10px] text-slate-500 font-medium italic truncate">
                                                {a.vehicle ? `${a.vehicle.plate_number} · ${a.vehicle.brand_model}` : a.vehicle_details}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* FAB */}
                    <div className="fixed bottom-24 right-5 z-40">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-lg opacity-30 animate-pulse" />
                        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="relative h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl transition-transform active:scale-95">
                            <Plus className="h-6 w-6" />
                        </Button>
                    </div>
                </div>

                {/* Dialog shared */}
                {renderDialog()}
            </DashboardLayout>
        );
    }

    // ─── DESKTOP VIEW ─────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tugas Driver</h1>
                        <p className="text-slate-500 font-medium mt-1 text-sm">Kelola daftar penugasan driver ke pejabat terkait.</p>
                    </div>
                    <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 px-8 font-black shadow-lg shadow-blue-200 gap-2 transition-all active:scale-95">
                        <Plus className="h-5 w-5" /> Tambah Penugasan
                    </Button>
                </div>

                {/* Stats & Search */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm bg-blue-600 text-white rounded-[24px] overflow-hidden">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 font-black text-[9px] uppercase tracking-widest mb-1">Total Aktif</p>
                                <h3 className="text-2xl font-black">{assignments.length}</h3>
                            </div>
                            <Car className="h-8 w-8 opacity-40" />
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-white rounded-[24px] overflow-hidden ring-1 ring-slate-100">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 font-black text-[9px] uppercase tracking-widest mb-1">Driver Ready</p>
                                <h3 className="text-2xl font-black text-slate-900">{drivers.length}</h3>
                            </div>
                            <Users className="h-8 w-8 text-blue-100" />
                        </CardContent>
                    </Card>
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Cari nama driver atau pejabat..."
                            className="pl-12 h-full rounded-[24px] border-none bg-white shadow-sm ring-1 ring-slate-100 focus-visible:ring-blue-500 font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table */}
                <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[40px] overflow-hidden bg-white ring-1 ring-slate-100/50">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-100">
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Driver</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Melayani (Pejabat)</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredAssignments.length > 0 ? (
                                        filteredAssignments.map(a => (
                                            <tr key={a.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <Avatar className="h-12 w-12 rounded-2xl shadow-sm ring-2 ring-white">
                                                            <AvatarImage src={a.driver?.avatar_url || ''} />
                                                            <AvatarFallback className="bg-blue-50 text-blue-600 font-black">{a.driver?.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-bold text-slate-900 leading-tight">{a.driver?.full_name}</p>
                                                            {a.driver?.employee_id && <Badge variant="outline" className="text-[9px] font-black h-4 px-1 mt-1">{a.driver.employee_id}</Badge>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                                        <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">Aktif</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100/50 group-hover:bg-white transition-colors">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={a.principal?.avatar_url || ''} />
                                                            <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold text-xs">{a.principal?.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-black text-indigo-600/60 uppercase tracking-widest leading-none mb-1">Pejabat:</p>
                                                            <p className="font-bold text-slate-800 text-xs truncate">{a.principal?.full_name}</p>
                                                            {a.vehicle_details && (
                                                                <div className="flex items-center gap-1 mt-1 opacity-60">
                                                                    <Car className="h-2.5 w-2.5" />
                                                                    <span className="text-[10px] font-medium truncate max-w-[150px]">{a.vehicle_details}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAssignment(a.id)} className="h-10 w-10 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 border border-transparent transition-all">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-20 text-center">
                                                <div className="flex flex-col items-center opacity-30">
                                                    <ShieldCheck className="h-16 w-16 mb-4" />
                                                    <h3 className="text-xl font-bold">Data tidak ditemukan</h3>
                                                    <p className="text-sm font-medium">Belum ada penugasan driver yang terdaftar.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {renderDialog()}
            </div>
        </DashboardLayout>
    );

    function renderDialog() {
        return (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="rounded-[40px] sm:max-w-[500px] p-0 border-none shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    {/* Fixed header */}
                    <div className="bg-slate-900 px-8 pt-8 pb-6 text-white relative shrink-0">
                        <div className="absolute top-0 right-0 p-8 opacity-10"><UserCheck size={120} /></div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black tracking-tight mb-1">Tambah Penugasan</DialogTitle>
                            <DialogDescription className="text-slate-400 font-medium text-sm">
                                Pilih driver dan pejabat yang akan dilayani.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {/* Scrollable form body */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Driver</label>
                            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold">
                                    <SelectValue placeholder="-- Pilih driver --" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-slate-100">
                                    {drivers.map(d => (
                                        <SelectItem key={d.id} value={d.id} className="rounded-xl py-2.5">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{d.full_name}</span>
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{d.employee_id || 'Tanpa ID'}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Melayani Pejabat</label>
                            <Select value={selectedPrincipal} onValueChange={setSelectedPrincipal}>
                                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold">
                                    <SelectValue placeholder="-- Pilih pejabat --" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-slate-100">
                                    {principals.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="rounded-xl py-2.5">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{p.full_name}</span>
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{(p as any).position || 'Staff'}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kendaraan (Opsional)</label>
                            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold">
                                    <SelectValue placeholder="-- Pilih kendaraan --" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-slate-100">
                                    {vehicles.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-slate-400 font-medium text-center">
                                            Belum ada kendaraan terdaftar
                                        </div>
                                    ) : (
                                        <>
                                            <SelectItem value="none" className="rounded-xl py-2.5">
                                                <span className="text-slate-400 italic">Tanpa kendaraan</span>
                                            </SelectItem>
                                            {vehicles.map(v => (
                                                <SelectItem key={v.id} value={v.id} className="rounded-xl py-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-black tracking-wide">{v.plate_number}</span>
                                                        <span className="text-[10px] text-slate-500">{v.brand_model}{v.color ? ` · ${v.color}` : ''}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            {vehicles.length === 0 && (
                                <p className="text-[10px] text-amber-600 font-medium">
                                    💡 Tambahkan kendaraan dulu di menu <strong>Kendaraan</strong>.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Fixed footer — always visible */}
                    <div className="shrink-0 px-8 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setDialogOpen(false)}
                            className="h-12 rounded-2xl font-black text-slate-500 flex-1"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleAddAssignment}
                            disabled={processing}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 font-black shadow-lg shadow-blue-200 flex-[2] active:scale-95"
                        >
                            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Simpan Penugasan'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }
}
