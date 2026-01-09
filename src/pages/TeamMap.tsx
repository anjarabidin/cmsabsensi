import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Navigation, Clock, Search, Map as MapIcon, RefreshCw, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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
    const { user, role } = useAuth();
    const { toast } = useToast();

    const [locations, setLocations] = useState<AttendanceLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    useEffect(() => {
        if (user) fetchLocations();

        // Auto refresh every 5 minutes
        const interval = setInterval(fetchLocations, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    const fetchLocations = async () => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];

            // Fetch attendances for today
            const { data, error } = await supabase
                .from('attendances')
                .select(`
                id, user_id, clock_in, 
                clock_in_latitude, clock_in_longitude, 
                clock_in_location_id,
                profiles:user_id(full_name, avatar_url, position)
            `)
                .eq('date', today)
                .not('clock_in', 'is', null);

            if (error) throw error;

            // Filter those with coordinates
            // @ts-ignore
            const validLocations = data?.filter((item: any) => item.clock_in_latitude && item.clock_in_longitude) || [];
            setLocations(validLocations as unknown as AttendanceLocation[]);
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

    if (role === 'employee') {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <MapIcon className="h-8 w-8 text-slate-300" />
                    </div>
                    <h2 className="text-lg font-bold">Akses Dibatasi</h2>
                    <p className="text-slate-500">Hanya Manager dan HR yang dapat melihat lokasi tim.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                {/* Floating Content */}
                <div className="relative z-10 space-y-6 max-w-[1600px] mx-auto px-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-20 md:px-6">

                    {/* Header Section with Back Button */}
                    <div className="flex items-start gap-3 text-white">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/dashboard')}
                            className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md">Pantau Tim</h1>
                            <p className="text-sm text-blue-50 font-medium opacity-90 mt-0.5">
                                Lokasi clock-in karyawan hari ini ({format(new Date(), 'dd MMM yyyy', { locale: id })}).
                            </p>
                        </div>
                        <Button variant="secondary" onClick={fetchLocations} disabled={loading} className="gap-2 shadow-md bg-white text-blue-600 hover:bg-blue-50 border-none">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            {format(lastUpdated, 'HH:mm')}
                        </Button>
                    </div>

                    {locations.length === 0 && !loading ? (
                        <Card className="bg-slate-50 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                    <MapPin className="h-6 w-6 text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-medium">Belum ada data lokasi hari ini</p>
                                <p className="text-xs text-slate-400 mt-1">Karyawan yang melakukan Clock In akan muncul disini.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {locations.map((loc) => (
                                <Card key={loc.id} className="hover:shadow-md transition-shadow cursor-default group">
                                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                        <Avatar>
                                            <AvatarImage src={loc.profiles.avatar_url || ''} />
                                            <AvatarFallback>{loc.profiles.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 overflow-hidden">
                                            <CardTitle className="text-base truncate" title={loc.profiles.full_name}>
                                                {loc.profiles.full_name}
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground truncate">{loc.profiles.position || 'Karyawan'}</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center text-sm text-slate-600 gap-2">
                                                <Clock className="h-4 w-4 text-blue-500" />
                                                <span>Jam Masuk: <span className="font-semibold">{format(new Date(loc.clock_in), 'HH:mm')}</span></span>
                                            </div>
                                            <div className="flex items-center text-sm text-slate-600 gap-2">
                                                <MapPin className="h-4 w-4 text-red-500" />
                                                <span className="truncate max-w-[200px]">
                                                    {loc.clock_in_latitude?.toFixed(4)}, {loc.clock_in_longitude?.toFixed(4)}
                                                </span>
                                            </div>

                                            <div className="pt-2">
                                                <Button
                                                    className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
                                                    variant="outline"
                                                    onClick={() => openMap(loc.clock_in_latitude!, loc.clock_in_longitude!)}
                                                >
                                                    <Navigation className="mr-2 h-4 w-4" />
                                                    Lihat Peta
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
