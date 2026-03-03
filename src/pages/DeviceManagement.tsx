
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
    Smartphone,
    Trash2,
    Search,
    RefreshCw,
    User,
    ShieldAlert,
    ChevronLeft,
    Info,
    ExternalLink,
    Laptop,
    Monitor,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

interface UserDevice {
    id: string;
    user_id: string;
    device_id: string;
    device_name: string;
    last_login: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        avatar_url: string | null;
        department?: {
            name: string;
        };
    };
}

export default function DeviceManagement() {
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [devices, setDevices] = useState<UserDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        setLoading(true);
        try {
            // 1. Fetch devices
            const { data: devicesData, error: devicesError } = await supabase
                .from('user_devices')
                .select('*')
                .order('last_login', { ascending: false });

            if (devicesError) throw devicesError;

            // 2. Fetch profiles for these users
            const userIds = (devicesData || []).map(d => d.user_id);

            let profilesMap: Record<string, any> = {};
            if (userIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select(`
                        id,
                        full_name,
                        email,
                        avatar_url,
                        department:department_id(name)
                    `)
                    .in('id', userIds);

                if (!profilesError && profilesData) {
                    profilesMap = profilesData.reduce((acc: any, profile: any) => {
                        acc[profile.id] = profile;
                        return acc;
                    }, {});
                }
            }

            // 3. Combine data
            const combinedData = (devicesData || []).map(device => ({
                ...device,
                profiles: profilesMap[device.user_id] || { full_name: 'Unknown User', email: '-' }
            }));

            setDevices(combinedData as UserDevice[]);
        } catch (error: any) {
            console.error('Detailed Error in fetchDevices:', error);
            const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            toast({
                title: 'Gagal memuat data',
                description: `Error: ${errorMsg}`,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResetDevice = async () => {
        if (!selectedDevice) return;

        try {
            console.log('🔄 Attempting to reset device:', selectedDevice.id, 'for user:', selectedDevice.user_id);

            // Try deleting by primary key first
            const { error } = await supabase
                .from('user_devices')
                .delete()
                .eq('id', selectedDevice.id);

            if (error) {
                console.error('❌ Delete error by ID:', error);

                // Fallback: Try deleting all devices for this user (Bulk reset)
                const { error: fallbackError } = await supabase
                    .from('user_devices')
                    .delete()
                    .eq('user_id', selectedDevice.user_id);

                if (fallbackError) throw fallbackError;

                toast({
                    title: 'Reset Total Berhasil',
                    description: `Semua perangkat untuk ${selectedDevice.profiles.full_name} telah dibersihkan.`,
                });
            } else {
                toast({
                    title: 'Berhasil Reset Perangkat',
                    description: `Kunci perangkat spesifik untuk ${selectedDevice.profiles.full_name} telah dilepas.`,
                });
            }

            // Refresh data
            await fetchDevices();
            setResetDialogOpen(false);
            setSelectedDevice(null);
        } catch (error: any) {
            console.error('Critical Error resetting device:', error);
            toast({
                title: 'Gagal reset perangkat',
                description: error.message || 'Terjadi kesalahan pada server database.',
                variant: 'destructive',
            });
        }
    };

    const filteredDevices = devices.filter(device =>
        device.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.device_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getDeviceIcon = (ua: string) => {
        const userAgent = ua.toLowerCase();
        if (userAgent.includes('mobi')) return <Smartphone className="h-4 w-4" />;
        if (userAgent.includes('tablet')) return <Laptop className="h-4 w-4" />;
        return <Monitor className="h-4 w-4" />;
    };

    const parseUserAgent = (ua: string) => {
        if (!ua) return 'Perangkat Tidak Diketahui';

        // Quick parse for better display
        if (ua.includes('iPhone')) return 'Apple iPhone';
        if (ua.includes('Android')) {
            const match = ua.match(/Android\s([0-9\.]+)/);
            const model = ua.match(/\;\s([^;]+)\sBuild/);
            return `Android ${match ? match[1] : ''} ${model ? model[1] : 'Device'}`;
        }
        if (ua.includes('Windows')) return 'Windows PC';
        if (ua.includes('Macintosh')) return 'MacBook / iMac';
        if (ua.includes('Linux')) return 'Linux PC';

        return ua.length > 30 ? ua.substring(0, 30) + '...' : ua;
    };

    return (
        <DashboardLayout>
            <div className={`max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8 min-h-screen pb-24 ${isMobile ? 'pt-[calc(1.5rem+env(safe-area-inset-top))]' : 'pt-8'}`}>

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        {isMobile && (
                            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="-ml-2 h-10 w-10 text-slate-500">
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                        )}
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Manajemen Perangkat</h1>
                            <p className="text-slate-500 font-medium text-xs md:text-sm">Kelola keamanan akun yang terkunci pada perangkat tertentu.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari karyawan atau email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-11 rounded-xl border-slate-200 bg-white"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchDevices}
                            disabled={loading}
                            className="h-11 w-11 rounded-xl bg-white border-slate-200 text-slate-500"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Warning Alert */}
                <Card className="bg-blue-50 border-blue-100 shadow-none mb-8 rounded-[24px]">
                    <CardContent className="p-4 flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <ShieldAlert className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-blue-900">Tentang Fitur Device Lock</p>
                            <p className="text-xs text-blue-700 leading-relaxed mt-1">
                                Sistem secara otomatis mengunci akun karyawan pada satu browser/perangkat saat pertama kali login.
                                Gunakan fitur <b>Reset</b> jika karyawan ingin mengganti HP atau browser akses.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Devices List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100">
                            <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                            <p className="text-sm font-bold text-slate-400">Memuat riwayat perangkat...</p>
                        </div>
                    ) : filteredDevices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 text-center">
                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-200">
                                <Smartphone className="h-8 w-8" />
                            </div>
                            <p className="text-lg font-black text-slate-900">Tidak ada perangkat terdaftar</p>
                            <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2">Belum ada karyawan yang melakukan login atau tidak ditemukan hasil pencarian.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredDevices.map((device) => (
                                <Card key={device.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-[28px] overflow-hidden bg-white ring-1 ring-slate-100 flex flex-col">
                                    <CardHeader className="p-5 pb-0 flex flex-row items-center gap-4">
                                        <Avatar className="h-12 w-12 border-2 border-slate-50">
                                            <AvatarImage src={device.profiles.avatar_url || ''} />
                                            <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">
                                                {device.profiles.full_name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <CardTitle className="text-base font-black text-slate-900 truncate">{device.profiles.full_name}</CardTitle>
                                            <CardDescription className="text-xs font-medium text-slate-400 truncate">{device.profiles.email}</CardDescription>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-5 flex-1">
                                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                                        {getDeviceIcon(device.device_name)}
                                                    </div>
                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[140px]">
                                                        {parseUserAgent(device.device_name)}
                                                    </span>
                                                </div>
                                                <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none text-[9px] font-black">
                                                    AKTIF
                                                </Badge>
                                            </div>

                                            <div className="h-px bg-slate-200/50" />

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Pertama Kali</p>
                                                    <p className="text-[11px] font-bold text-slate-600">
                                                        {device.created_at ? (
                                                            (() => {
                                                                const date = new Date(device.created_at);
                                                                return isNaN(date.getTime()) ? '-' : format(date, 'd MMM yyyy');
                                                            })()
                                                        ) : '-'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Login Terakhir</p>
                                                    <p className="text-[11px] font-bold text-slate-600">
                                                        {device.last_login ? (
                                                            (() => {
                                                                const date = new Date(device.last_login);
                                                                return isNaN(date.getTime()) ? '-' : format(date, 'HH:mm - d MMM');
                                                            })()
                                                        ) : '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                                <Info className="h-3 w-3" />
                                                <span className="truncate">ID: {device.device_id?.substring(0, 8) || 'N/A'}...</span>
                                            </div>
                                        </div>
                                    </CardContent>

                                    <div className="p-5 pt-0 mt-auto">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedDevice(device);
                                                setResetDialogOpen(true);
                                            }}
                                            className="w-full h-10 rounded-xl border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors font-bold text-xs"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            LAPASKAN KUNCI PERANGKAT
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Confirmation Dialog */}
                <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-8 max-w-sm">
                        <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
                            <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-2">
                                <ShieldAlert className="h-10 w-10 text-red-500 animate-pulse" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Lepas Kunci?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium text-slate-500 leading-relaxed">
                                Tindakan ini akan menghapus jejak perangkat akun <b>{selectedDevice?.profiles.full_name}</b>.
                                Sistem akan mengizinkan karyawan ini login dari perangkat/browser baru mana pun.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-col gap-3 mt-8">
                            <AlertDialogAction
                                onClick={handleResetDevice}
                                className="h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold w-full"
                            >
                                YA, RESET SEKARANG
                            </AlertDialogAction>
                            <AlertDialogCancel className="h-12 rounded-2xl border-none bg-slate-100 hover:bg-slate-200 font-bold text-slate-500 w-full m-0">
                                BATALKAN
                            </AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </DashboardLayout>
    );
}
