import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronLeft,
    Plus,
    Calendar,
    Trash2,
    Loader2,
    CalendarDays
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface PublicHoliday {
    id: string;
    date: string;
    name: string;
    description: string | null;
    is_recurring: boolean;
    created_at: string;
}

export default function HolidaysPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
    const [loading, setLoading] = useState(true);

    // Form States
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>();
    const [holidayName, setHolidayName] = useState('');
    const [holidayDescription, setHolidayDescription] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [saving, setSaving] = useState(false);

    // Delete States
    const [selectedHoliday, setSelectedHoliday] = useState<PublicHoliday | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('public_holidays')
                .select('*')
                .order('date', { ascending: true });

            if (error) throw error;
            setHolidays((data as PublicHoliday[]) || []);
        } catch (error) {
            console.error('Error fetching holidays:', error);
            toast({
                title: 'Gagal memuat data',
                description: 'Tidak dapat mengambil data hari libur.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedDate || !holidayName.trim()) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Mohon isi tanggal dan nama hari libur.',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('public_holidays')
                .insert({
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    name: holidayName.trim(),
                    description: holidayDescription.trim() || null,
                    is_recurring: isRecurring,
                });

            if (error) throw error;

            toast({
                title: 'Berhasil!',
                description: 'Hari libur telah ditambahkan.',
            });

            // Reset form
            setDialogOpen(false);
            setSelectedDate(undefined);
            setHolidayName('');
            setHolidayDescription('');
            setIsRecurring(false);

            fetchHolidays();
        } catch (error: any) {
            console.error('Error adding holiday:', error);
            toast({
                title: 'Gagal Menambah',
                description: error.message || 'Terjadi kesalahan saat menambah hari libur.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (holiday: PublicHoliday) => {
        setSelectedHoliday(holiday);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedHoliday) return;

        setDeleting(true);
        try {
            const { error } = await supabase
                .from('public_holidays')
                .delete()
                .eq('id', selectedHoliday.id);

            if (error) throw error;

            toast({
                title: 'Berhasil Dihapus',
                description: `Hari libur "${selectedHoliday.name}" telah dihapus.`,
            });

            fetchHolidays();
        } catch (error: any) {
            toast({
                title: 'Gagal Menghapus',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setDeleting(false);
            setIsDeleteDialogOpen(false);
            setSelectedHoliday(null);
        }
    };

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8 max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
                        <div className="flex items-start gap-3">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md flex items-center gap-2">
                                    <CalendarDays className="h-6 w-6" />
                                    Hari Libur Nasional
                                </h1>
                                <p className="text-blue-50 font-medium opacity-90 mt-1 text-xs">Kelola kalender hari libur perusahaan dan nasional.</p>
                            </div>
                        </div>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-white/10 hover:bg-white/20 text-white border-none shadow-none backdrop-blur-sm">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tambah Hari Libur
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>Tambah Hari Libur Baru</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>Tanggal Libur *</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                                    <Calendar className="mr-2 h-4 w-4" />
                                                    {selectedDate ? format(selectedDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <CalendarComponent mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Nama Hari Libur *</Label>
                                        <Input
                                            placeholder="Contoh: Hari Kemerdekaan RI"
                                            value={holidayName}
                                            onChange={(e) => setHolidayName(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Keterangan (Opsional)</Label>
                                        <Input
                                            placeholder="Deskripsi tambahan..."
                                            value={holidayDescription}
                                            onChange={(e) => setHolidayDescription(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="recurring"
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={isRecurring}
                                            onChange={(e) => setIsRecurring(e.target.checked)}
                                        />
                                        <Label htmlFor="recurring" className="text-sm cursor-pointer">
                                            Libur Tahunan (Berulang setiap tahun)
                                        </Label>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleSubmit} disabled={saving} className="w-full md:w-auto rounded-xl">
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Simpan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Content */}
                    <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/95 backdrop-blur-sm overflow-hidden rounded-2xl">
                        <CardHeader className="border-b border-slate-100">
                            <CardTitle className="text-lg">Daftar Hari Libur</CardTitle>
                            <CardDescription>Total {holidays.length} hari libur terdaftar.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-700">Tanggal</TableHead>
                                            <TableHead className="font-bold text-slate-700">Nama Hari Libur</TableHead>
                                            <TableHead className="font-bold text-slate-700">Keterangan</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-center">Tipe</TableHead>
                                            <TableHead className="text-right font-bold text-slate-700">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-48 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                        <p className="text-xs">Memuat data...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : holidays.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-48 text-center text-slate-500 italic">
                                                    Belum ada hari libur yang terdaftar. Klik "Tambah Hari Libur" untuk memulai.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            holidays.map((holiday) => (
                                                <TableRow key={holiday.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex flex-col items-center justify-center text-white shadow-sm">
                                                                <span className="text-[10px] font-bold uppercase">{format(new Date(holiday.date), 'MMM', { locale: id })}</span>
                                                                <span className="text-lg font-black leading-none">{format(new Date(holiday.date), 'd')}</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm text-slate-700">
                                                                    {format(new Date(holiday.date), 'EEEE', { locale: id })}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {format(new Date(holiday.date), 'dd MMMM yyyy', { locale: id })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-bold text-sm text-slate-800">{holiday.name}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-slate-600">{holiday.description || '-'}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {holiday.is_recurring ? (
                                                            <Badge className="bg-purple-100 text-purple-700 border-none px-3 py-1 text-[10px] shadow-none">
                                                                Tahunan
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 px-3 py-1 text-[10px] shadow-none">
                                                                Sekali
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(holiday)}
                                                            className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Hari Libur?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus hari libur <strong>"{selectedHoliday?.name}"</strong> pada tanggal{' '}
                                <strong>{selectedHoliday && format(new Date(selectedHoliday.date), 'dd MMMM yyyy', { locale: id })}</strong>?
                                <br /><br />
                                Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDelete}
                                className="rounded-xl bg-red-600 hover:bg-red-700"
                                disabled={deleting}
                            >
                                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Hapus
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
}
