import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    ChevronLeft, Plus, Trash2, Search, Car, Pencil, Loader2,
    CheckCircle2, Wrench, Hash, Palette, CalendarDays, FileText, Gauge
} from 'lucide-react';

interface Vehicle {
    id: string;
    plate_number: string;
    brand_model: string;
    vehicle_type: string | null;
    year: number | null;
    color: string | null;
    status: 'available' | 'in_use' | 'maintenance';
    last_odometer: number | null;
    is_active: boolean;
    notes: string | null;
    created_at: string;
}

const STATUS_OPTIONS = [
    { value: 'available', label: 'Tersedia', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    { value: 'in_use', label: 'Terpakai', color: 'bg-blue-100 text-blue-700', icon: Car },
    { value: 'maintenance', label: 'Servis', color: 'bg-amber-100 text-amber-700', icon: Wrench },
];

const EMPTY_FORM = { plate_number: '', brand_model: '', year: '', color: '', status: 'available' as const, notes: '' };

export default function Vehicles() {
    const { activeRole, role } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [processing, setProcessing] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const canManage = activeRole === 'super_admin' || activeRole === 'admin_hr' || role === 'super_admin' || role === 'admin_hr';

    useEffect(() => {
        if (!canManage) { navigate('/dashboard'); return; }
        fetchVehicles();
    }, []);

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('vehicles')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setVehicles(data || []);
        } catch {
            toast({ title: 'Error', description: 'Gagal memuat data kendaraan.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const openAdd = () => { setEditingVehicle(null); setForm(EMPTY_FORM); setDialogOpen(true); };
    const openEdit = (v: Vehicle) => {
        setEditingVehicle(v);
        setForm({ plate_number: v.plate_number, brand_model: v.brand_model, year: v.year ? String(v.year) : '', color: v.color || '', status: v.status, notes: v.notes || '' });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.plate_number.trim() || !form.brand_model.trim()) {
            toast({ title: 'Data tidak lengkap', description: 'Plat nomor dan merk/model wajib diisi.', variant: 'destructive' });
            return;
        }
        setProcessing(true);
        try {
            const payload = {
                plate_number: form.plate_number.trim().toUpperCase(),
                brand_model: form.brand_model.trim(),
                year: form.year ? parseInt(form.year) : null,
                color: form.color.trim() || null,
                status: form.status,
                notes: form.notes.trim() || null,
            };
            if (editingVehicle) {
                const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id);
                if (error) throw error;
                toast({ title: '✅ Berhasil', description: 'Data kendaraan diperbarui.' });
            } else {
                const { error } = await supabase.from('vehicles').insert(payload);
                if (error) throw error;
                toast({ title: '✅ Berhasil', description: 'Kendaraan baru ditambahkan.' });
            }
            setDialogOpen(false);
            fetchVehicles();
        } catch (e: any) {
            toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id: string, plateNumber: string) => {
        if (!confirm(`Hapus kendaraan ${plateNumber}?`)) return;
        try {
            const { error } = await supabase.from('vehicles').delete().eq('id', id);
            if (error) throw error;
            setVehicles(prev => prev.filter(v => v.id !== id));
            toast({ title: 'Dihapus', description: 'Kendaraan berhasil dihapus.' });
        } catch (e: any) {
            toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
        }
    };

    const filtered = vehicles.filter(v => {
        const matchSearch = v.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.brand_model.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v.color || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = filterStatus === 'all' || v.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const getStatusInfo = (status: string) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

    const counts = {
        available: vehicles.filter(v => v.status === 'available').length,
        in_use: vehicles.filter(v => v.status === 'in_use').length,
        maintenance: vehicles.filter(v => v.status === 'maintenance').length,
    };

    // ─── DIALOG ───────────────────────────────────────────────────────────────
    const renderDialog = () => (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-[480px] p-0 border-none shadow-2xl rounded-[32px] flex flex-col max-h-[90vh] overflow-hidden">
                <div className="bg-slate-900 px-7 pt-7 pb-5 text-white shrink-0 relative">
                    <div className="absolute top-0 right-0 p-6 opacity-10"><Car size={100} /></div>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black tracking-tight">
                            {editingVehicle ? 'Edit Kendaraan' : 'Tambah Kendaraan'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-sm font-medium">
                            {editingVehicle ? `Perbarui data ${editingVehicle.plate_number}` : 'Daftarkan kendaraan baru ke armada.'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-7 space-y-4">
                    {/* Plat Nomor */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Hash className="h-3 w-3" /> Plat Nomor *</label>
                        <Input
                            placeholder="B 1234 ABC"
                            className="h-11 rounded-xl border-slate-200 bg-slate-50 font-bold uppercase"
                            value={form.plate_number}
                            onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))}
                        />
                    </div>

                    {/* Merk & Model */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Car className="h-3 w-3" /> Merk & Model *</label>
                        <Input
                            placeholder="Toyota Alphard"
                            className="h-11 rounded-xl border-slate-200 bg-slate-50 font-bold"
                            value={form.brand_model}
                            onChange={e => setForm(f => ({ ...f, brand_model: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Tahun */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Tahun</label>
                            <Input
                                placeholder="2022"
                                type="number"
                                min="1990"
                                max="2030"
                                className="h-11 rounded-xl border-slate-200 bg-slate-50 font-bold"
                                value={form.year}
                                onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                            />
                        </div>

                        {/* Warna */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Palette className="h-3 w-3" /> Warna</label>
                            <Input
                                placeholder="Hitam"
                                className="h-11 rounded-xl border-slate-200 bg-slate-50 font-bold"
                                value={form.color}
                                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</label>
                        <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val as any }))}>
                            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                {STATUS_OPTIONS.map(s => (
                                    <SelectItem key={s.value} value={s.value} className="rounded-xl">
                                        <span className="font-bold">{s.label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Catatan */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><FileText className="h-3 w-3" /> Catatan</label>
                        <Input
                            placeholder="Opsional, misal: Kendaraan dinas direktur"
                            className="h-11 rounded-xl border-slate-200 bg-slate-50"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="shrink-0 px-7 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <Button variant="ghost" onClick={() => setDialogOpen(false)} className="h-11 rounded-2xl font-black text-slate-500 flex-1">Batal</Button>
                    <Button onClick={handleSave} disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-11 font-black shadow-lg shadow-blue-200 flex-[2]">
                        {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingVehicle ? 'Simpan Perubahan' : 'Tambah Kendaraan')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );

    // ─── MOBILE VIEW ────────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50 pb-28">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white pb-8 pt-[calc(1rem+env(safe-area-inset-top))] px-4 rounded-b-[32px] shadow-lg">
                        <div className="flex items-center gap-2 mb-5">
                            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20 -ml-2 h-8 w-8 rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <h1 className="text-lg font-black">Kendaraan</h1>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Tersedia', count: counts.available, color: 'bg-green-500/20 border-green-400/30 text-green-300' },
                                { label: 'Terpakai', count: counts.in_use, color: 'bg-blue-500/20 border-blue-400/30 text-blue-300' },
                                { label: 'Servis', count: counts.maintenance, color: 'bg-amber-500/20 border-amber-400/30 text-amber-300' },
                            ].map(s => (
                                <div key={s.label} className={`${s.color} border rounded-2xl p-3 text-center`}>
                                    <p className="text-xl font-black">{s.count}</p>
                                    <p className="text-[9px] font-black uppercase tracking-wider mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-4 -mt-4 mb-4 relative z-10">
                        <div className="relative bg-white rounded-2xl shadow-lg ring-1 ring-slate-100">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Cari plat, merk, warna..." className="pl-10 h-12 border-none rounded-2xl bg-transparent focus-visible:ring-0 font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="px-4 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
                        {['all', 'available', 'in_use', 'maintenance'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`shrink-0 px-4 py-2 rounded-full text-xs font-black transition-all ${filterStatus === s ? 'bg-slate-800 text-white shadow' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>
                                {s === 'all' ? 'Semua' : getStatusInfo(s).label}
                            </button>
                        ))}
                    </div>

                    {/* Cards */}
                    <div className="px-4 space-y-3">
                        {loading ? (
                            [1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" />)
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                                <Car className="h-12 w-12 text-slate-400 mb-2" />
                                <p className="font-bold text-slate-700">Tidak ada kendaraan</p>
                            </div>
                        ) : filtered.map(v => {
                            const st = getStatusInfo(v.status);
                            return (
                                <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                                            <Car className="h-6 w-6 text-slate-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-slate-900">{v.plate_number}</p>
                                                <Badge className={`${st.color} border-none text-[9px] font-black`}>{st.label}</Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium truncate">{v.brand_model}{v.color ? ` · ${v.color}` : ''}{v.year ? ` · ${v.year}` : ''}</p>
                                            {v.last_odometer ? (
                                                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Gauge className="h-3 w-3" />{v.last_odometer.toLocaleString('id-ID')} km
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(v)} className="h-8 w-8 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id, v.plate_number)} className="h-8 w-8 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* FAB */}
                    <div className="fixed bottom-24 right-5 z-40">
                        <div className="absolute inset-0 bg-slate-700 rounded-full blur-lg opacity-30 animate-pulse" />
                        <Button onClick={openAdd} className="relative h-14 w-14 rounded-full bg-slate-800 hover:bg-slate-700 text-white shadow-xl transition-transform active:scale-95">
                            <Plus className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
                {renderDialog()}
            </DashboardLayout>
        );
    }

    // ─── DESKTOP VIEW ───────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="p-8 space-y-6">
                {/* Header */}
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kendaraan</h1>
                        <p className="text-slate-500 font-medium mt-1 text-sm">Kelola armada kendaraan operasional.</p>
                    </div>
                    <Button onClick={openAdd} className="bg-slate-800 hover:bg-slate-700 text-white rounded-2xl h-12 px-7 font-black shadow-lg gap-2">
                        <Plus className="h-5 w-5" /> Tambah Kendaraan
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm bg-slate-800 text-white rounded-[24px]">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-slate-300 font-black text-[9px] uppercase tracking-widest mb-1">Total</p>
                                <h3 className="text-2xl font-black">{vehicles.length}</h3>
                            </div>
                            <Car className="h-8 w-8 opacity-30" />
                        </CardContent>
                    </Card>
                    {STATUS_OPTIONS.map(s => (
                        <Card key={s.value} className="border-none shadow-sm bg-white rounded-[24px] ring-1 ring-slate-100 cursor-pointer hover:-translate-y-0.5 transition-all" onClick={() => setFilterStatus(s.value)}>
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 font-black text-[9px] uppercase tracking-widest mb-1">{s.label}</p>
                                    <h3 className="text-2xl font-black text-slate-900">{counts[s.value as keyof typeof counts]}</h3>
                                </div>
                                <s.icon className="h-7 w-7 text-slate-200" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Search + Filter */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Cari plat nomor, merk, atau warna..." className="pl-11 h-11 rounded-2xl border-slate-200 focus-visible:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'available', 'in_use', 'maintenance'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${filterStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                                {s === 'all' ? 'Semua' : getStatusInfo(s).label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden ring-1 ring-slate-100">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center items-center p-16"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-100">
                                        <th className="px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Plat Nomor</th>
                                        <th className="px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Kendaraan</th>
                                        <th className="px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Warna / Tahun</th>
                                        <th className="px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Odometer</th>
                                        <th className="px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                        <th className="px-7 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className="py-16 text-center">
                                            <div className="flex flex-col items-center opacity-30">
                                                <Car className="h-12 w-12 mb-3" />
                                                <p className="font-bold">Tidak ada kendaraan</p>
                                            </div>
                                        </td></tr>
                                    ) : filtered.map(v => {
                                        const st = getStatusInfo(v.status);
                                        return (
                                            <tr key={v.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-7 py-5">
                                                    <p className="font-black text-slate-900 tracking-wider">{v.plate_number}</p>
                                                </td>
                                                <td className="px-7 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                                            <Car className="h-5 w-5 text-slate-500" />
                                                        </div>
                                                        <p className="font-bold text-slate-800">{v.brand_model}</p>
                                                    </div>
                                                </td>
                                                <td className="px-7 py-5">
                                                    <p className="text-sm text-slate-600 font-medium">{v.color || '—'}{v.year ? ` · ${v.year}` : ''}</p>
                                                </td>
                                                <td className="px-7 py-5">
                                                    {v.last_odometer ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Gauge className="h-4 w-4 text-slate-300" />
                                                            <span className="text-sm font-bold text-slate-700">{v.last_odometer.toLocaleString('id-ID')}</span>
                                                            <span className="text-[10px] text-slate-400">km</span>
                                                        </div>
                                                    ) : <span className="text-slate-300 text-sm">—</span>}
                                                </td>
                                                <td className="px-7 py-5">
                                                    <Badge className={`${st.color} border-none text-[10px] font-black px-2.5`}>{st.label}</Badge>
                                                </td>
                                                <td className="px-7 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)} className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id, v.plate_number)} className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>

                {renderDialog()}
            </div>
        </DashboardLayout>
    );
}
