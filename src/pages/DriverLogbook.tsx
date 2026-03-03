import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Car,
    MapPin,
    Clock,
    ChevronRight,
    History,
    Plus,
    Navigation,
    CheckCircle2,
    AlertCircle,
    Smartphone,
    Fuel,
    Receipt,
    Wallet,
    Camera,
    Trash2,
    DollarSign,
    CreditCard,
    Zap
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Vehicle {
    id: string;
    plate_number: string;
    brand_model: string;
    last_odometer: number;
}

interface TripLog {
    id: string;
    vehicle_id: string;
    start_odometer: number;
    end_odometer: number | null;
    origin: string | null;
    destination: string | null;
    purpose: string | null;
    start_time: string;
    end_time: string | null;
    status: 'in_progress' | 'completed' | 'cancelled';
    vehicles?: Vehicle;
}

interface Expense {
    id: string;
    category: 'fuel' | 'toll' | 'topup' | 'emoney_balance' | 'misc';
    amount: number;
    description: string | null;
    receipt_url: string | null;
    emoney_balance: number | null;
    expense_time: string;
    has_receipt: boolean;
}

export default function DriverLogbook() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [activeTrip, setActiveTrip] = useState<TripLog | null>(null);
    const [history, setHistory] = useState<TripLog[]>([]);
    const [loading, setLoading] = useState(true);

    const { navPermissions } = useAuth();
    const odometerEnabled = navPermissions['driver_odometer'] || false;

    // Form states
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [startKm, setStartKm] = useState('');
    const [endKm, setEndKm] = useState('');
    const [destination, setDestination] = useState('');
    const [purpose, setPurpose] = useState('');

    useEffect(() => {
        if (user?.id) {
            fetchData();
        }
    }, [user?.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch active trip
            const { data: activeData } = await supabase
                .from('driver_trip_logs')
                .select('*, vehicles(*)')
                .eq('driver_id', user?.id)
                .eq('status', 'in_progress')
                .maybeSingle();

            setActiveTrip(activeData as any);

            // 2. Fetch history (limit 10)
            const { data: historyData } = await supabase
                .from('driver_trip_logs')
                .select('*, vehicles(*)')
                .eq('driver_id', user?.id)
                .eq('status', 'completed')
                .order('end_time', { ascending: false })
                .limit(10);

            setHistory(historyData as any);

            // 3. Fetch all active vehicles
            const { data: vehicleData } = await supabase
                .from('vehicles')
                .select('*')
                .eq('is_active', true);

            setVehicles(vehicleData || []);

            if (vehicleData && vehicleData.length > 0) {
                setSelectedVehicleId(vehicleData[0].id);
                setStartKm(vehicleData[0].last_odometer.toString());
            }

        } catch (error: any) {
            toast({
                title: 'Error memuat data',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleStartTrip = async () => {
        if (!selectedVehicleId) {
            toast({ title: "Data tidak lengkap", description: "Pilih kendaraan terlebih dahulu", variant: "destructive" });
            return;
        }
        if (odometerEnabled && !startKm) {
            toast({ title: "Data tidak lengkap", description: "Isi KM awal", variant: "destructive" });
            return;
        }

        try {
            const { error } = await supabase
                .from('driver_trip_logs')
                .insert({
                    driver_id: user?.id,
                    vehicle_id: selectedVehicleId,
                    start_odometer: parseInt(startKm),
                    status: 'in_progress'
                });

            if (error) throw error;

            toast({ title: "Perjalanan Dimulai", description: "Hati-hati di jalan!" });
            fetchData();
        } catch (error: any) {
            toast({ title: "Gagal memulai", description: error.message, variant: "destructive" });
        }
    };

    const handleEndTrip = async () => {
        if (!activeTrip) return;
        if (!destination) {
            toast({ title: "Data tidak lengkap", description: "Isi tujuan akhir perjalanan", variant: "destructive" });
            return;
        }
        if (odometerEnabled) {
            if (!endKm) {
                toast({ title: "Data tidak lengkap", description: "Isi KM akhir", variant: "destructive" });
                return;
            }
            if (parseInt(endKm) <= activeTrip.start_odometer) {
                toast({ title: "KM Akhir tidak valid", description: "KM Akhir harus lebih besar dari KM Awal", variant: "destructive" });
                return;
            }
        }

        try {
            const { error } = await supabase
                .from('driver_trip_logs')
                .update({
                    end_odometer: odometerEnabled ? parseInt(endKm) : null,
                    destination,
                    purpose,
                    end_time: new Date().toISOString(),
                    status: 'completed'
                })
                .eq('id', activeTrip.id);

            if (error) throw error;

            toast({ title: "Perjalanan Selesai", description: "Logbook telah diperbarui" });
            // Reset form
            setEndKm('');
            setDestination('');
            setPurpose('');
            fetchData();
        } catch (error: any) {
            toast({ title: "Gagal mengakhiri", description: error.message, variant: "destructive" });
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-md mx-auto space-y-6 pb-20">
                <div className="flex items-center gap-3 px-4 pt-4">
                    <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <Navigation className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 leading-tight">Logbook Driver</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Digital Trip Record</p>
                    </div>
                </div>

                {/* ACTIVE TRIP SECTION */}
                {activeTrip ? (
                    <div className="px-4">
                        <Card className="border-none shadow-2xl shadow-blue-200/50 rounded-[32px] overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Car className="h-5 w-5 opacity-80" />
                                        <span className="text-sm font-black uppercase tracking-widest">Sedang Berjalan</span>
                                    </div>
                                    <Badge className="bg-white/20 text-white border-0 animate-pulse">LIVE</Badge>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-blue-100 opacity-70">Kendaraan</p>
                                    <h2 className="text-2xl font-black">{activeTrip.vehicles?.plate_number}</h2>
                                    <p className="text-sm font-bold text-blue-100">{activeTrip.vehicles?.brand_model}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                                        <p className="text-[10px] uppercase font-black text-blue-100 opacity-70 mb-1">Mulai Perjalanan</p>
                                        <p className="text-lg font-black">{format(new Date(activeTrip.start_time), 'HH:mm')}</p>
                                    </div>
                                    {odometerEnabled && (
                                        <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                                            <p className="text-[10px] uppercase font-black text-blue-100 opacity-70 mb-1">KM Awal</p>
                                            <p className="text-lg font-black">{activeTrip.start_odometer.toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 pt-4 bg-white rounded-[24px] p-6 text-slate-900">
                                    <div className="space-y-2">
                                        <Label htmlFor="destination" className="text-xs font-black uppercase text-slate-400">Tujuan Akhir</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="destination"
                                                placeholder="Contoh: Kantor Pusat, Bandara..."
                                                className="pl-9 h-12 rounded-xl border-slate-100 bg-slate-50 focus:ring-blue-500"
                                                value={destination}
                                                onChange={(e) => setDestination(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {odometerEnabled && (
                                        <div className="space-y-2">
                                            <Label htmlFor="endKm" className="text-xs font-black uppercase text-slate-400">Odometer Akhir (KM)</Label>
                                            <div className="relative">
                                                <History className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                                <Input
                                                    id="endKm"
                                                    type="number"
                                                    placeholder="Masukkan nilai KM terakhir"
                                                    className="pl-9 h-12 rounded-xl border-slate-100 bg-slate-50 focus:ring-blue-500"
                                                    value={endKm}
                                                    onChange={(e) => setEndKm(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="purpose" className="text-xs font-black uppercase text-slate-400">Keperluan (Opsional)</Label>
                                        <Input
                                            id="purpose"
                                            placeholder="Contoh: Antar Direksi, Service..."
                                            className="h-12 rounded-xl border-slate-100 bg-slate-50 focus:ring-blue-500"
                                            value={purpose}
                                            onChange={(e) => setPurpose(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                                        onClick={handleEndTrip}
                                    >
                                        <CheckCircle2 className="h-5 w-5" /> AKHIRI PERJALANAN
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    /* START TRIP SECTION */
                    <div className="px-4">
                        <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100">
                            <CardHeader className="p-6 pb-0">
                                <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-blue-600" /> Mulai Tugas Baru
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-400">Pilih Kendaraan</Label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {vehicles.length > 0 ? (
                                            vehicles.map((v) => (
                                                <div
                                                    key={v.id}
                                                    onClick={() => {
                                                        setSelectedVehicleId(v.id);
                                                        setStartKm(v.last_odometer.toString());
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                                        selectedVehicleId === v.id
                                                            ? "border-blue-500 bg-blue-50/50"
                                                            : "border-slate-50 bg-slate-50 hover:border-slate-200"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                                        selectedVehicleId === v.id ? "bg-blue-600 text-white" : "bg-white text-slate-400"
                                                    )}>
                                                        <Car className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-black text-slate-800">{v.plate_number}</h4>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">{v.brand_model}</p>
                                                    </div>
                                                    {odometerEnabled && (
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">Terakhir</p>
                                                            <p className="text-xs font-black text-slate-900">{v.last_odometer.toLocaleString()} KM</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-6 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                                <p className="text-sm font-bold text-slate-500">Tidak ada kendaraan terdaftar</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {odometerEnabled && (
                                    <div className="space-y-2">
                                        <Label htmlFor="startKm" className="text-xs font-black uppercase text-slate-400">KM Awal (Odometer)</Label>
                                        <Input
                                            id="startKm"
                                            type="number"
                                            placeholder="Nilai KM saaat ini"
                                            className="h-12 rounded-xl border-slate-100 bg-slate-50 font-black text-lg"
                                            value={startKm}
                                            onChange={(e) => setStartKm(e.target.value)}
                                        />
                                        <p className="text-[10px] font-medium text-slate-400">Pastikan angka sesuai dengan odometer asli kendaraan.</p>
                                    </div>
                                )}

                                <Button
                                    className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-base shadow-xl transition-all active:scale-95"
                                    onClick={handleStartTrip}
                                    disabled={vehicles.length === 0}
                                >
                                    MULAI JALAN SEKARANG
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* TRIP HISTORY SECTION */}
                <div className="px-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <History className="h-4 w-4 text-slate-400" /> Riwayat Perjalanan
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400">Tampilkan 10 Terakhir</span>
                    </div>

                    <div className="space-y-3">
                        {history.length > 0 ? (
                            history.map((trip) => (
                                <div key={trip.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-all">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 border border-slate-100">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="text-xs font-black text-slate-800 truncate pr-2">{trip.destination || 'Tanpa Tujuan'}</h4>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tabular-nums">
                                                {trip.end_time ? format(new Date(trip.end_time), 'd MMM') : ''}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                            <Car className="h-3 w-3" />
                                            <span>{trip.vehicles?.plate_number}</span>
                                            {odometerEnabled && trip.end_odometer && (
                                                <>
                                                    <span>•</span>
                                                    <Clock className="h-3 w-3 ml-1" />
                                                    <span>{Math.round((trip.end_odometer - trip.start_odometer))} KM</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300 mt-2" />
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                                <p className="text-xs font-bold text-slate-400">Belum ada riwayat perjalanan</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
