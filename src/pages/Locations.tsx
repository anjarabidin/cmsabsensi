import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, MapPin, Edit, Trash2, MoreHorizontal, ChevronLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { OfficeLocation } from '@/types';
import { GoogleMapsEmbed } from '@/components/GoogleMapsEmbed';
import { Skeleton } from '@/components/ui/skeleton';

export default function LocationsPage() {
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast } = useToast();
    const [locations, setLocations] = useState<OfficeLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingLocation, setEditingLocation] = useState<OfficeLocation | null>(null);

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

    const fetchLocations = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('office_locations')
                .select('*')
                .order('name');

            if (error) throw error;
            setLocations((data as OfficeLocation[]) || []);
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
        // Try to find lat/lng in a Google Maps URL or string
        // Matches typical coordinate patterns: -6.123, 106.123
        const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
        const match = input.match(coordRegex);

        if (match) {
            const lat = match[1];
            const lng = match[2];

            setFormData(prev => ({
                ...prev,
                latitude: lat,
                longitude: lng,
            }));

            toast({
                title: '✅ Koordinat Terdeteksi',
                description: `Lat: ${lat}, Lng: ${lng}`
            });
            return true;
        }

        // Fallback for names labels like "Lat: -6.123 Lng: 106.123"
        const cleaned = input.replace(/lat:|lng:|latitude:|longitude:/gi, '').trim();
        const parts = cleaned.split(/[,\s]+/).filter(p => p);

        if (parts.length >= 2) {
            const latNum = parseFloat(parts[0]);
            const lngNum = parseFloat(parts[1]);

            if (!isNaN(latNum) && !isNaN(lngNum)) {
                setFormData(prev => ({
                    ...prev,
                    latitude: latNum.toFixed(6),
                    longitude: lngNum.toFixed(6),
                }));
                return true;
            }
        }
        return false;
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

    if (role !== 'admin_hr') {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                    Anda tidak memiliki akses ke halaman ini.
                </div>
            </DashboardLayout>
        );
    }

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
                            Tambah Lokasi
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

                    {/* Dialog Editor */}
                    <Dialog open={dialogOpen} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) resetForm();
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
                                            placeholder="Paste koordinat Google Maps (cth: -6.2088, 106.8456)"
                                            className="bg-white text-xs font-mono"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (parseCoordinates(val)) {
                                                    // Auto-clear after a delay so they see the result in the Target fields
                                                    setTimeout(() => { if (e.target) e.target.value = ''; }, 1000);
                                                }
                                            }}
                                            onPaste={(e) => {
                                                const text = e.clipboardData.getData('text');
                                                if (parseCoordinates(text)) {
                                                    // Successfully parsed
                                                }
                                            }}
                                        />
                                        <p className="text-[10px] text-slate-400">
                                            Tips: Copy koordinat atau URL dari Google Maps dan paste di sini untuk auto-fill Latitude & Longitude otomatis.
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
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="button" onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </DashboardLayout>
    );
}
