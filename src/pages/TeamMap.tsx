import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Navigation, Clock, Search, Map as MapIcon, RefreshCw, ChevronLeft, User } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { GoogleMapsEmbed } from '@/components/GoogleMapsEmbed';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AttendanceLocation = {
    id: string;
    user_id: string;
    clock_in: string;
    clock_in_latitude: number | null;
    clock_in_longitude: number | null;
    clock_in_location_id: string | null;
    profiles: {
        full_name: string;
        avatar_url: string | null;
        position: string | null;
    };
};

export default function TeamMap() {
    const navigate = useNavigate();
    const { user, role, profile } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [locations, setLocations] = useState<AttendanceLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedLocation, setSelectedLocation] = useState<AttendanceLocation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user) fetchLocations();

        // Auto refresh every 5 minutes
        const interval = setInterval(fetchLocations, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, profile]); // Refetch when profile loads (for department filter)

    const fetchLocations = async () => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];

            // Fetch attendances for today
            let query = supabase
                .from('attendances')
                .select(`
                    id, user_id, clock_in, 
                    clock_in_latitude, clock_in_longitude, 
                    clock_in_location_id,
                    profiles:user_id!inner(full_name, avatar_url, position, department_id)
                `)
                .eq('date', today)
                .not('clock_in', 'is', null);

            if (role === 'manager' && profile?.department_id) {
                query = query.eq('profiles.department_id', profile.department_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Filter those with coordinates
            // @ts-ignore
            const validLocations = data?.filter((item: any) => item.clock_in_latitude && item.clock_in_longitude) || [];
            const locs = validLocations as unknown as AttendanceLocation[];
            setLocations(locs);
            if (!selectedLocation && locs.length > 0 && !isMobile) {
                setSelectedLocation(locs[0]);
            }
            setLastUpdated(new Date());

        } catch (error) {
            console.error("Error fetching locations:", error);
            toast({ title: 'Gagal', description: 'Gagal memuat lokasi tim.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const openMap = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    const filteredLocations = locations.filter(l =>
        l.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.profiles.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (role === 'employee') {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <MapIcon className="h-8 w-8 text-slate-300" />
                    </div>
                    <h2 className="text-lg font-bold">Akses Dibatasi</h2>
                    <p className="text-slate-500">Hanya Head unit dan HR yang dapat melihat lokasi tim.</p>
                </div>
            </DashboardLayout>
        );
    }

    // ----------------------------------------------------------------------
    // MOBILE VIEW (PRESERVED)
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // MOBILE VIEW (Revamped & Detailed)
    // ----------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50 pb-24">
                    {/* Header Gradient */}
                    <div className="absolute top-0 left-0 w-full h-[180px] bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 max-w-full mx-auto px-5 pt-8 pt-[calc(2rem+env(safe-area-inset-top))]">
                        {/* Title & Stats */}
                        <div className="flex items-center justify-between gap-2 text-white mb-6">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate('/dashboard')}
                                    className="bg-white/10 text-white hover:bg-white/20 h-10 w-10 rounded-xl backdrop-blur-md"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </Button>
                                <div>
                                    <h1 className="text-xl font-black leading-tight tracking-tight">Pantau Tim</h1>
                                    <p className="text-xs text-blue-100 opacity-90 font-medium">
                                        <span className="font-bold">{locations.length}</span> Staf Hadir
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={fetchLocations}
                                disabled={loading}
                                className="h-9 px-3 shadow-lg bg-white text-blue-700 hover:bg-blue-50 border-none font-bold rounded-xl"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                <span className="text-xs">Refresh</span>
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-6">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                            </div>
                            <Input
                                type="text"
                                placeholder="Cari nama atau jabatan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-12 rounded-2xl border-none shadow-lg bg-white/95 backdrop-blur-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        {/* Content List */}
                        {loading && locations.length === 0 ? (
                            <div className="space-y-3">
                                <div className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />
                                <div className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />
                                <div className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />
                            </div>
                        ) : filteredLocations.length === 0 ? (
                            <Card className="bg-white border-dashed border-2 border-slate-200 shadow-none mt-4">
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <MapPin className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="text-base font-bold text-slate-700">Tidak ada data ditemukan</p>
                                    <p className="text-sm text-slate-400 mt-1">Coba kata kunci lain atau tunggu update.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {filteredLocations.map((loc) => (
                                    <div
                                        key={loc.id}
                                        className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4 relative overflow-hidden"
                                    >
                                        <div className="flex items-start gap-4 reltive z-10">
                                            <Avatar className="h-14 w-14 border-4 border-slate-50 shadow-sm">
                                                <AvatarImage src={loc.profiles.avatar_url || ''} />
                                                <AvatarFallback className="bg-blue-100 text-blue-700 font-black text-lg">
                                                    {loc.profiles.full_name.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex items-start justify-between">
                                                    <h3 className="font-bold text-slate-900 text-base truncate pr-2">
                                                        {loc.profiles.full_name}
                                                    </h3>
                                                    <Badge variant="secondary" className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 border-green-100">
                                                        Hadir
                                                    </Badge>
                                                </div>
                                                <p className="text-xs font-medium text-slate-500 mb-2 truncate">
                                                    {loc.profiles.position || 'Staf'}
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg text-blue-700">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        <span className="text-xs font-bold">{format(new Date(loc.clock_in), 'HH:mm')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-slate-50 flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-10 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50"
                                                onClick={() => {
                                                    const text = `Halo ${loc.profiles.full_name}, posisi anda dimana?`;
                                                    // This is a placeholder, actual implementation would need phone number
                                                    toast({ description: "Fitur Chat WhatsApp akan segera hadir!" });
                                                }}
                                            >
                                                Hubungi
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="flex-1 h-10 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                                                onClick={() => window.open(`https://www.google.com/maps?q=${loc.clock_in_latitude},${loc.clock_in_longitude}`, '_blank')}
                                            >
                                                <Navigation className="h-3.5 w-3.5 mr-2" />
                                                Lihat Peta
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="text-center text-[10px] text-slate-400 font-medium mt-8 mb-4">
                            Data diperbarui: {format(lastUpdated, 'HH:mm:ss')} • Auto-refresh 5 menit
                        </p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // ----------------------------------------------------------------------
    // DESKTOP VIEW (PREMIUM)
    // ----------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-full mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            Pantau Tim
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0 h-6">
                                {locations.length} Orang
                            </Badge>
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">Lokasi real-time staf yang hadir hari ini.</p>
                    </div>
                    <Button variant="outline" onClick={fetchLocations} disabled={loading} className="gap-2 rounded-xl border-slate-200 font-bold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Updated {format(lastUpdated, 'HH:mm')}
                    </Button>
                </div>

                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* LEFT PANEL: LIST */}
                    <Card className="w-[400px] flex flex-col border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
                        <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Cari staf..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                            {loading && locations.length === 0 ? (
                                <div className="p-4 space-y-4">
                                    <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                                    <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                                </div>
                            ) : filteredLocations.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                                    <MapPin className="h-12 w-12 opacity-20 mb-3" />
                                    <p className="font-medium text-sm">Tidak ada data.</p>
                                </div>
                            ) : (
                                filteredLocations.map(loc => (
                                    <div
                                        key={loc.id}
                                        onClick={() => setSelectedLocation(loc)}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border group",
                                            selectedLocation?.id === loc.id
                                                ? "bg-blue-50 border-blue-200 shadow-sm"
                                                : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
                                        )}
                                    >
                                        <div className="relative">
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                <AvatarImage src={loc.profiles.avatar_url || ''} />
                                                <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">{loc.profiles.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-1 -right-1 bg-green-500 h-4 w-4 rounded-full border-2 border-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={cn("text-sm font-bold truncate", selectedLocation?.id === loc.id ? "text-blue-900" : "text-slate-700")}>
                                                {loc.profiles.full_name}
                                            </h4>
                                            <p className="text-xs text-slate-500 truncate mb-1">{loc.profiles.position || 'Staf'}</p>
                                            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(loc.clock_in), 'HH:mm')} • {loc.clock_in_latitude?.toFixed(4)}, {loc.clock_in_longitude?.toFixed(4)}
                                            </div>
                                        </div>
                                        <div className="text-slate-300">
                                            <ChevronLeft className={cn("h-5 w-5 transition-transform", selectedLocation?.id === loc.id ? "rotate-180 text-blue-500" : "")} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* RIGHT PANEL: MAP */}
                    <Card className="flex-1 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white flex flex-col relative bg-slate-50">
                        {selectedLocation ? (
                            <>
                                <div className="absolute inset-0 z-0">
                                    <GoogleMapsEmbed
                                        latitude={Number(selectedLocation.clock_in_latitude)}
                                        longitude={Number(selectedLocation.clock_in_longitude)}
                                        height="100%"
                                        className="w-full h-full"
                                    />
                                    {/* Overlay Gradient */}
                                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
                                </div>

                                <div className="absolute top-6 left-6 z-10">
                                    <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/50 max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Avatar className="h-10 w-10 border border-slate-200">
                                                <AvatarImage src={selectedLocation.profiles.avatar_url || ''} />
                                                <AvatarFallback>{selectedLocation.profiles.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-sm">{selectedLocation.profiles.full_name}</h3>
                                                <p className="text-xs text-slate-500">{selectedLocation.profiles.position}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg">
                                                <Clock className="h-3.5 w-3.5 text-blue-500" />
                                                Clock In: {format(new Date(selectedLocation.clock_in), 'HH:mm')}
                                            </div>
                                            <Button
                                                size="sm"
                                                className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 h-8 text-xs font-bold"
                                                onClick={() => openMap(selectedLocation.clock_in_latitude!, selectedLocation.clock_in_longitude!)}
                                            >
                                                <Navigation className="mr-2 h-3 w-3" />
                                                Buka di Google Maps
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full flex-col text-slate-400">
                                <Search className="h-16 w-16 mb-4 opacity-20" />
                                <p className="text-sm font-medium">Pilih staf untuk melihat lokasi peta.</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
