import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Search,
    Filter,
    Car,
    MapPin,
    Clock,
    Receipt,
    Calendar,
    ChevronRight,
    Download,
    History,
    FileText,
    Navigation,
    Fuel,
    CreditCard,
    Zap,
    Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';

interface DriverLog {
    id: string;
    driver_id: string;
    vehicle_id: string;
    start_odometer: number;
    end_odometer: number | null;
    origin: string | null;
    destination: string | null;
    purpose: string | null;
    start_time: string;
    end_time: string | null;
    status: 'in_progress' | 'completed' | 'cancelled';
    driver: {
        full_name: string;
        avatar_url: string | null;
    };
    vehicle: {
        plate_number: string;
        brand_model: string;
    };
}

interface Expense {
    id: string;
    category: string;
    amount: number;
    description: string | null;
    expense_time: string;
    has_receipt: boolean;
    emoney_balance: number | null;
}

export default function DriverReports() {
    const [logs, setLogs] = useState<DriverLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTrip, setSelectedTrip] = useState<DriverLog | null>(null);
    const [tripExpenses, setTripExpenses] = useState<Expense[]>([]);
    const [loadingExpenses, setLoadingExpenses] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('driver_trip_logs')
                .select(`
                    *,
                    driver:driver_id(full_name, avatar_url),
                    vehicle:vehicle_id(plate_number, brand_model)
                `)
                .order('start_time', { ascending: false });

            if (error) throw error;
            setLogs(data as any);
        } catch (error: any) {
            console.error('Error fetching logs:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTripExpenses = async (tripId: string) => {
        setLoadingExpenses(true);
        try {
            const { data, error } = await supabase
                .from('driver_expenses')
                .select('*')
                .eq('trip_id', tripId)
                .order('expense_time', { ascending: false });

            if (error) throw error;
            setTripExpenses(data || []);
        } catch (error: any) {
            console.error('Error fetching expenses:', error.message);
        } finally {
            setLoadingExpenses(false);
        }
    };

    const handleViewTrip = (trip: DriverLog) => {
        setSelectedTrip(trip);
        fetchTripExpenses(trip.id);
    };

    const filteredLogs = logs.filter(log =>
        log.driver?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicle?.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.destination?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getExpenseIcon = (category: string) => {
        switch (category) {
            case 'fuel': return <Fuel className="h-4 w-4" />;
            case 'toll': return <Zap className="h-4 w-4" />;
            case 'topup': return <CreditCard className="h-4 w-4" />;
            case 'emoney_balance': return <Wallet className="h-4 w-4" />;
            default: return <Receipt className="h-4 w-4" />;
        }
    };

    const getExpenseLabel = (category: string) => {
        switch (category) {
            case 'fuel': return 'Bensin';
            case 'toll': return 'Tol';
            case 'topup': return 'Topup';
            case 'emoney_balance': return 'Saldo E-Money';
            default: return 'Lain-lain';
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-6 p-8">
                {/* Header Section */}
                <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 bg-blue-600 rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-blue-100">
                            <History className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Monitoring Driver</h1>
                            <p className="text-sm text-slate-500 font-medium">Pantau aktivitas, logbook, dan pengeluaran driver.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari driver, plat..."
                                className="pl-9 h-12 rounded-2xl border-slate-100 bg-slate-50"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-12 w-12 rounded-2xl p-0 border-slate-100 bg-white">
                            <Filter className="h-5 w-5 text-slate-600" />
                        </Button>
                        <Button className="h-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold px-6">
                            <Download className="h-4 w-4 mr-2" /> Export CSV
                        </Button>
                    </div>
                </div>

                {/* Main Content: List of Trips */}
                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <div className="py-20 text-center">
                            <Clock className="h-10 w-10 text-blue-500 animate-spin mx-auto mb-4" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Memuat Data Perjalanan...</p>
                        </div>
                    ) : filteredLogs.length > 0 ? (
                        filteredLogs.map((log) => (
                            <div
                                key={log.id}
                                onClick={() => handleViewTrip(log)}
                                className="group bg-white rounded-[28px] p-5 border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer flex flex-col md:flex-row md:items-center gap-6"
                            >
                                <div className="flex items-center gap-4 md:w-64 shrink-0">
                                    <Avatar className="h-12 w-12 border-2 border-slate-50">
                                        <AvatarImage src={log.driver?.avatar_url || ''} />
                                        <AvatarFallback className="bg-blue-50 text-blue-600 font-black">
                                            {log.driver?.full_name?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 truncate">{log.driver?.full_name}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</p>
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Kendaraan</p>
                                        <div className="flex items-center gap-1.5">
                                            <Car className="h-3.5 w-3.5 text-blue-500" />
                                            <span className="text-sm font-bold text-slate-700">{log.vehicle?.plate_number}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Tujuan</p>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                            <span className="text-sm font-bold text-slate-700 truncate">{log.destination || '-'}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Waktu</p>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="text-sm font-bold text-slate-700">
                                                {format(new Date(log.start_time), 'HH:mm')}
                                                {log.end_time ? ` - ${format(new Date(log.end_time), 'HH:mm')}` : ' (Live)'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                                        <Badge className={cn(
                                            "h-5 text-[9px] font-black uppercase rounded-full border-none",
                                            log.status === 'in_progress' ? "bg-amber-100 text-amber-700 animate-pulse" :
                                                log.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                        )}>
                                            {log.status === 'in_progress' ? 'Berjalan' :
                                                log.status === 'completed' ? 'Selesai' : 'Batal'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="shrink-0 flex items-center justify-end">
                                    <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                        <ChevronRight className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center bg-white rounded-[32px] border border-dashed border-slate-200">
                            <Navigation className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold">Tidak ada data perjalanan yang ditemukan.</p>
                        </div>
                    )}
                </div>

                {/* Trip Detail Modal */}
                <Dialog open={!!selectedTrip} onOpenChange={open => !open && setSelectedTrip(null)}>
                    <DialogContent className="max-w-2xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                        <div className="bg-slate-900 p-8 text-white relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Car className="h-24 w-24" />
                            </div>
                            <DialogHeader>
                                <div className="flex items-center gap-4 mb-4 text-white text-left">
                                    <Avatar className="h-14 w-14 ring-4 ring-white/10">
                                        <AvatarImage src={selectedTrip?.driver?.avatar_url || ''} />
                                        <AvatarFallback className="bg-blue-600 text-white font-bold">{selectedTrip?.driver?.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-left">
                                        <DialogTitle className="text-xl font-black">{selectedTrip?.driver?.full_name}</DialogTitle>
                                        <DialogDescription className="text-slate-400 font-medium">
                                            Detail Perjalanan {selectedTrip ? format(new Date(selectedTrip.start_time), 'EEEE, d MMMM yyyy', { locale: id }) : ''}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                        </div>

                        <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                            {/* Trip Info Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kendaraan</p>
                                    <p className="font-bold text-slate-900">{selectedTrip?.vehicle?.plate_number} — {selectedTrip?.vehicle?.brand_model}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keperluan</p>
                                    <p className="font-bold text-slate-900">{selectedTrip?.purpose || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Odometer Awal</p>
                                    <p className="font-bold text-slate-900">{selectedTrip?.start_odometer.toLocaleString()} KM</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Odometer Akhir</p>
                                    <p className="font-bold text-slate-900">{selectedTrip?.end_odometer?.toLocaleString() || '-'} KM</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari</p>
                                    <p className="font-bold text-slate-900">{selectedTrip?.origin || 'Lokasi Sekarang'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tujuan</p>
                                    <p className="font-bold text-slate-900 text-emerald-600">{selectedTrip?.destination || '-'}</p>
                                </div>
                            </div>

                            {/* Expenses Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                        <Receipt className="h-4 w-4 text-blue-500" /> Rincian Biaya
                                    </h3>
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                        Rp {tripExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
                                    </span>
                                </div>

                                {loadingExpenses ? (
                                    <div className="flex justify-center p-8">
                                        <Clock className="h-6 w-6 animate-spin text-slate-200" />
                                    </div>
                                ) : tripExpenses.length > 0 ? (
                                    <div className="space-y-2">
                                        {tripExpenses.map(exp => (
                                            <div key={exp.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between group hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                                                        {getExpenseIcon(exp.category)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900">{getExpenseLabel(exp.category)}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 italic">{exp.description || 'Tanpa keterangan'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {/* Foto Nota */}
                                                    {(exp as any).receipt_url ? (
                                                        <a
                                                            href={(exp as any).receipt_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="Lihat foto nota"
                                                            className="shrink-0 relative"
                                                        >
                                                            <img
                                                                src={(exp as any).receipt_url}
                                                                alt="Nota"
                                                                className="h-10 w-10 rounded-xl object-cover border-2 border-blue-200 shadow hover:scale-110 transition-all cursor-zoom-in"
                                                            />
                                                            <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[7px] font-black rounded-full px-1">FOTO</span>
                                                        </a>
                                                    ) : (exp.description || '').includes('[Foto dihapus otomatis') ? (
                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg" title="Foto dihapus otomatis setelah 6 bulan untuk hemat storage">🗑️ Foto expired</span>
                                                    ) : !exp.has_receipt ? (
                                                        <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">No Nota</span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">Ada nota fisik</span>
                                                    )}
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-slate-900">
                                                            {exp.amount > 0 ? `Rp ${exp.amount.toLocaleString()}` : '-'}
                                                        </p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tabular-nums">
                                                            {format(new Date(exp.expense_time), 'HH:mm WIB')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-slate-50 rounded-[24px] border border-dashed border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400">Tidak ada pengeluaran tercatat dalam perjalanan ini.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button
                                onClick={() => setSelectedTrip(null)}
                                className="bg-slate-900 hover:bg-black text-white rounded-2xl px-8 font-black shadow-lg"
                            >
                                Tutup Detail
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
