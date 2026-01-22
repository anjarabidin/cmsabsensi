import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, MapPin, Edit, Trash2, MoreHorizontal, ChevronLeft, Search, Navigation, Globe } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { OfficeLocation } from '@/types';
import { GoogleMapsEmbed } from '@/components/GoogleMapsEmbed';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function LocationsPage() {
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [locations, setLocations] = useState<OfficeLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingLocation, setEditingLocation] = useState<OfficeLocation | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<OfficeLocation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // State untuk form
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        latitude: '',
        longitude: '',
        radius_meters: '100'
    });

    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
        if (role === 'admin_hr') fetchLocations();
    }, [role]);

    // Update selected location when locations change (e.g. after edit)
    useEffect(() => {
        if (selectedLocation && locations.length > 0) {
            const updated = locations.find(l => l.id === selectedLocation.id);
            if (updated) setSelectedLocation(updated);
        }
    }, [locations]);

    const fetchLocations = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('office_locations')
                .select('*')
                .order('name');

            if (error) throw error;
            const locs = (data as OfficeLocation[]) || [];
            setLocations(locs);
            if (!selectedLocation && locs.length > 0 && !isMobile) {
                setSelectedLocation(locs[0]);
            }
        } catch (error: any) {
            toast({
                title: 'Gagal Memuat',
                description: error.message || 'Terjadi kesalahan saat mengambil data.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            address: '',
            latitude: '',
            longitude: '',
            radius_meters: '100'
        });
        setEditingLocation(null);
        setShowMap(false);
    };

    const handleEdit = (location: OfficeLocation) => {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            address: location.address || '',
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            radius_meters: location.radius_meters.toString(),
        });
        setDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus lokasi ini?')) return;

        try {
            const { error } = await supabase.from('office_locations').delete().eq('id', id);
            if (error) throw error;

            toast({ title: 'Berhasil', description: 'Lokasi berhasil dihapus.' });

            // If deleting selected, clear selection
            if (selectedLocation?.id === id) setSelectedLocation(null);

            fetchLocations();
        } catch (error: any) {
            toast({
                title: 'Gagal Menghapus',
                description: error.message,
                variant: 'destructive'
            });
        }
    };

    // Helper untuk parse koordinat dari Google Maps paste
    const parseCoordinates = (input: string) => {
        if (!input) return false;

        // 1. Cek URL Google Maps dengan pola @lat,lng
        const urlMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (urlMatch) {
            applyCoordinates(urlMatch[1], urlMatch[2]);
            return true;
        }

        // 2. Cek URL Google Maps dengan query q=lat,lng
        const queryMatch = input.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (queryMatch) {
            applyCoordinates(queryMatch[1], queryMatch[2]);
            return true;
        }

        // 3. Cek URL Google Maps dengan /lat,lng/
        const pathMatch = input.match(/\/(-?\d+\.\d+),(-?\d+\.\d+)\//);
        if (pathMatch) {
            applyCoordinates(pathMatch[1], pathMatch[2]);
            return true;
        }

        // 4. Cek URL Google Maps dengan 3D format (data=!3m)
        const dataMatch = input.match(/3d(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (dataMatch) {
            applyCoordinates(dataMatch[1], dataMatch[2]);
            return true;
        }

        // 5. Cek format standar Lat, Lng dengan berbagai separator
        const cleaned = input.replace(/lat(itude)?|long(itude)?|lng|lokasi|koordinat|[:=]/gi, ' ').trim();
        const coordRegex = /(-?\d+\.\d+)[\s,;]+(-?\d+\.\d+)/;
        const match = cleaned.match(coordRegex);

        if (match) {
            applyCoordinates(match[1], match[2]);
            return true;
        }

        // 6. Cek format desimal dengan comma
        const decimalRegex = /(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/;
        const decimalMatch = input.match(decimalRegex);

        if (decimalMatch) {
            applyCoordinates(decimalMatch[1], decimalMatch[2]);
            return true;
        }

        return false;
    };

    const applyCoordinates = (lat: string, lng: string) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
        }));

        toast({
            title: '✅ Koordinat Ditemukan',
            description: `Lat: ${lat}, Lng: ${lng}`,
            duration: 2000
        });
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.latitude || !formData.longitude) {
            toast({
                title: 'Data Kurang',
                description: 'Nama lokasi dan koordinat wajib diisi.',
                variant: 'destructive'
            });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                address: formData.address || null,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                radius_meters: parseInt(formData.radius_meters) || 100,
            };

            if (editingLocation) {
                const { error } = await supabase
                    .from('office_locations')
                    .update(payload)
                    .eq('id', editingLocation.id);

                if (error) throw error;
                toast({ title: 'Berhasil', description: 'Lokasi berhasil diperbarui.' });
            } else {
                const { error } = await supabase
                    .from('office_locations')
                    .insert([payload]);

                if (error) throw error;
                toast({ title: 'Berhasil', description: 'Lokasi baru berhasil ditambahkan.' });
            }

            setDialogOpen(false);
            resetForm();
            fetchLocations();
        } catch (error: any) {
            toast({
                title: 'Gagal Menyimpan',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const filteredLocations = locations.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (role !== 'admin_hr') {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                    Anda tidak memiliki akses ke halaman ini.
                </div>
            </DashboardLayout>
        );
    }

    // ----------------------------------------------------------------------
    // MOBILE VIEW (PRESERVED)
    // ----------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    {/* Background Gradient */}
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-6 max-w-7xl mx-auto px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-6">
                        <div className="flex items-start gap-3 text-white pb-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex-1">
                                <h1 className="text-xl font-bold tracking-tight drop-shadow-md">Lokasi Kantor</h1>
                                <p className="text-blue-50 font-medium opacity-90 mt-1 text-xs">Kelola geo-fencing untuk lokasi absensi karyawan.</p>
                            </div>
                            <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg">
                                <Plus className="mr-2 h-4 w-4" />
                                Add
                            </Button>
                        </div>

                        {/* List Card Locations */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <Card key={i} className="overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <Skeleton className="h-5 w-1/2 mb-2" />
                                            <Skeleton className="h-4 w-3/4" />
                                        </CardHeader>
                                        <CardContent>
                                            <Skeleton className="h-[150px] w-full rounded-xl" />
                                        </CardContent>
                                    </Card>
                                ))
                            ) : locations.length === 0 ? (
                                <Card className="col-span-full py-12 flex flex-col items-center justify-center text-center border-dashed">
                                    <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <MapPin className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900">Belum ada lokasi</h3>
                                    <p className="text-sm text-slate-500 max-w-sm mt-1 mb-4">
                                        Tambahkan lokasi kantor untuk memungkinkan karyawan melakukan absensi.
                                    </p>
                                    <Button variant="outline" onClick={() => setDialogOpen(true)}>
                                        Tambah Lokasi Pertama
                                    </Button>
                                </Card>
                            ) : (
                                locations.map((loc) => (
                                    <Card key={loc.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                                        <MapPin className="h-4 w-4 text-blue-600" />
                                                        {loc.name}
                                                    </CardTitle>
                                                    <div className="text-xs text-slate-500 font-medium bg-white px-2 py-1 rounded-md border border-slate-200 w-fit">
                                                        Radius: {loc.radius_meters}m
                                                    </div>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(loc)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(loc.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {/* Mini Map Preview */}
                                            <div className="relative h-[200px] w-full bg-slate-100">
                                                <GoogleMapsEmbed latitude={Number(loc.latitude)} longitude={Number(loc.longitude)} />
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
                                                    <p className="text-xs font-mono opacity-90 truncate">
                                                        {loc.latitude}, {loc.longitude}
                                                    </p>
                                                    {loc.address && (
                                                        <p className="text-xs truncate font-medium mt-0.5">{loc.address}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>

                        {/* Location Dialog (Mobile) */}
                        <LocationDialog
                            open={dialogOpen}
                            onOpenChange={setDialogOpen}
                            editingLocation={editingLocation}
                            formData={formData}
                            setFormData={setFormData}
                            showMap={showMap}
                            setShowMap={setShowMap}
                            handleSubmit={handleSubmit}
                            submitting={submitting}
                            parseCoordinates={parseCoordinates}
                            resetForm={resetForm}
                        />
                    </div>
                </div>
            </DashboardLayout >
        );
    }

    // ----------------------------------------------------------------------
    // DESKTOP VIEW (PREMIUM)
    // ----------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-8 shrink-0">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lokasi Kantor</h1>
                        <p className="text-slate-500 font-medium text-sm">Kelola titik lokasi absensi dan radius geofencing.</p>
                    </div>
                    <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200">
                        <Plus className="mr-2 h-5 w-5" />
                        Tambah Lokasi
                    </Button>
                </div>

                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* LEFT PANEL: LIST */}
                    <Card className="w-1/3 flex flex-col border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Cari lokasi kantor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                            {loading ? (
                                <div className="p-4 space-y-4">
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                </div>
                            ) : filteredLocations.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium">Lokasi tidak ditemukan</p>
                                </div>
                            ) : (
                                filteredLocations.map(loc => (
                                    <div
                                        key={loc.id}
                                        onClick={() => setSelectedLocation(loc)}
                                        className={cn(
                                            "p-4 rounded-xl cursor-pointer transition-all border flex items-center justify-between group",
                                            selectedLocation?.id === loc.id
                                                ? "bg-blue-50 border-blue-200 shadow-sm"
                                                : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                selectedLocation?.id === loc.id ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm"
                                            )}>
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className={cn("text-sm font-bold truncate", selectedLocation?.id === loc.id ? "text-blue-900" : "text-slate-700")}>{loc.name}</h4>
                                                <p className="text-xs text-slate-400 truncate max-w-[150px]">{loc.address || 'Tanpa alamat detail'}</p>
                                            </div>
                                        </div>
                                        <ChevronLeft className={cn("h-4 w-4 transition-transform", selectedLocation?.id === loc.id ? "text-blue-500 rotate-180" : "text-slate-300")} />
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* RIGHT PANEL: DETAILS & MAP */}
                    <Card className="flex-1 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white flex flex-col relative">
                        {selectedLocation ? (
                            <>
                                <div className="absolute top-0 left-0 w-full h-[300px] z-0">
                                    <GoogleMapsEmbed
                                        latitude={Number(selectedLocation.latitude)}
                                        longitude={Number(selectedLocation.longitude)}
                                        height="100%"
                                        className="w-full h-full opacity-90 hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent pointer-events-none" />
                                </div>

                                <div className="relative z-10 flex-1 flex flex-col pt-[220px]">
                                    <div className="px-8 pb-4">
                                        <Card className="border-none shadow-lg bg-white/90 backdrop-blur-md rounded-2xl p-6 flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h2 className="text-2xl font-black text-slate-900">{selectedLocation.name}</h2>
                                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                                                        Radius {selectedLocation.radius_meters}m
                                                    </Badge>
                                                </div>
                                                <p className="text-slate-500 font-medium flex items-center gap-1.5">
                                                    <Navigation className="h-4 w-4" />
                                                    {selectedLocation.latitude}, {selectedLocation.longitude}
                                                </p>
                                                {selectedLocation.address && (
                                                    <p className="text-sm text-slate-400 mt-2 max-w-lg leading-relaxed">{selectedLocation.address}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Button onClick={() => handleEdit(selectedLocation)} variant="outline" className="rounded-xl border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200">
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit Lokasi
                                                </Button>
                                                <Button onClick={() => handleDelete(selectedLocation.id)} variant="ghost" className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Hapus
                                                </Button>
                                            </div>
                                        </Card>
                                    </div>

                                    <div className="flex-1 px-8 pb-8 flex flex-col gap-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                                        <Globe className="h-4 w-4 text-orange-600" />
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-sm">Zona Waktu</span>
                                                </div>
                                                <p className="text-2xl font-black text-slate-800">WIB <span className="text-sm font-medium text-slate-400">(GMT+7)</span></p>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                        <Navigation className="h-4 w-4 text-emerald-600" />
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-sm">Status Geofencing</span>
                                                </div>
                                                <p className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                                                    <span className="relative flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                                    </span>
                                                    Aktif
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl">
                                            <p className="text-slate-400 text-sm font-medium">Statistik kehadiran di lokasi ini akan tampil di sini</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
                                <div className="h-24 w-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6">
                                    <Globe className="h-10 w-10 text-blue-500 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Pilih Lokasi Kantor</h3>
                                <p className="text-slate-500 max-w-md">Pilih salah satu lokasi dari daftar di sebelah kiri untuk melihat detail, mengedit, atau menghapus lokasi.</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Shared Dialog for Desktop */}
                <LocationDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    editingLocation={editingLocation}
                    formData={formData}
                    setFormData={setFormData}
                    showMap={showMap}
                    setShowMap={setShowMap}
                    handleSubmit={handleSubmit}
                    submitting={submitting}
                    parseCoordinates={parseCoordinates}
                    resetForm={resetForm}
                />
            </div>
        </DashboardLayout>
    );
}

// Extracted Dialog Component to keep main file clean and reusable across views
function LocationDialog({
    open, onOpenChange, editingLocation, formData, setFormData, showMap, setShowMap, handleSubmit, submitting, parseCoordinates, resetForm
}: any) {
    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) resetForm();
        }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}</DialogTitle>
                    <DialogDescription>
                        Tentukan koordinat dan radius jangkauan absensi.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-2">
                    <div className="grid gap-2">
                        <Label>Nama Lokasi</Label>
                        <Input
                            placeholder="Contoh: Kantor Pusat"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Alamat (Opsional)</Label>
                        <Textarea
                            placeholder="Alamat lengkap..."
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    {/* Geo Options */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <Label>Koordinat Lokasi</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => setShowMap(!showMap)}
                            >
                                {showMap ? 'Sembunyikan Peta' : 'Lihat Peta Preview'}
                            </Button>
                        </div>

                        {showMap && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <GoogleMapsEmbed
                                    latitude={Number(formData.latitude) || -6.2088}
                                    longitude={Number(formData.longitude) || 106.8456}
                                />
                                <Button
                                    type="button"
                                    variant="link"
                                    className="text-xs w-full mt-1 h-auto p-0 text-blue-600"
                                    onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, '_blank')}
                                >
                                    Buka di Google Maps
                                </Button>
                            </div>
                        )}

                        {/* Quick Parse Input */}
                        <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-2">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Quick Paste</Label>
                            <Input
                                placeholder="Paste URL Google Maps atau Koordinat (cth: -6.2088, 106.8456)"
                                className="bg-white text-xs font-mono"
                                value="" // Always empty to act as a trigger field
                                onChange={(e) => {
                                    // Handle manual typing/paste fallback
                                    const val = e.target.value;
                                    if (parseCoordinates(val)) {
                                        // Parsed successfully
                                    }
                                }}
                                onPaste={(e) => {
                                    // Handle direct paste for better control
                                    e.preventDefault();
                                    const text = e.clipboardData.getData('text');
                                    if (parseCoordinates(text)) {
                                        // Visual feedback handled in applyCoordinates
                                    } else {
                                        // Let toast handle error if needed
                                    }
                                }}
                            />
                            <p className="text-[10px] text-slate-400">
                                Tips: Copy URL lengkap dari Google Maps atau teks koordinat, lalu paste di sini. Sistem otomatis mengenali latitude & longitude.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Latitude</Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Longitude</Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Radius (Meter)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={formData.radius_meters}
                                onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">Meter</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-shrink-0 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
