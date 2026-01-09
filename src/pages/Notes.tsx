
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    Plus,
    ChevronLeft,
    Clock,
    Trash2,
    CheckCircle2,
    Circle,
    Bell,
    BellOff,
    StickyNote,
    Calendar,
    MoreVertical
} from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PersonalReminder {
    id: string;
    title: string;
    description: string;
    remind_at: string;
    is_completed: boolean;
    is_notified: boolean;
    created_at: string;
}

export default function NotesPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [reminders, setReminders] = useState<PersonalReminder[]>([]);

    // Create Note State
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        title: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '' // Kosongkan secara default agar opsional
    });

    useEffect(() => {
        if (user) fetchReminders();
    }, [user]);

    const fetchReminders = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('personal_reminders' as any)
                .select('*')
                .eq('user_id', user?.id)
                .order('remind_at', { ascending: true });

            if (error) throw error;
            setReminders(data || []);
        } catch (error) {
            console.error(error);
            toast({ title: 'Gagal memuat catatan', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNote = async () => {
        if (!form.title) {
            toast({ title: 'Judul catatan tidak boleh kosong', variant: 'destructive' });
            return;
        }

        try {
            setSaving(true);

            // Konstruksi remindAt hanya jika waktu diisi
            const remindAt = form.time ? `${form.date}T${form.time}:00` : null;

            const { error } = await supabase.from('personal_reminders' as any).insert({
                user_id: user?.id,
                title: form.title,
                description: form.description,
                remind_at: remindAt,
                is_completed: false,
                is_notified: false
            });

            if (error) throw error;

            toast({ title: 'Catatan berhasil disimpan' });
            setOpen(false);
            setForm({
                title: '',
                description: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                time: ''
            });
            fetchReminders();
        } catch (error) {
            console.error(error);
            toast({ title: 'Gagal menyimpan catatan', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const toggleComplete = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('personal_reminders' as any)
                .update({ is_completed: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: !currentStatus } : r));
        } catch (error) {
            toast({ title: 'Gagal memperbarui status', variant: 'destructive' });
        }
    };

    const deleteNote = async (id: string) => {
        try {
            const { error } = await supabase
                .from('personal_reminders' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            setReminders(prev => prev.filter(r => r.id !== id));
            toast({ title: 'Catatan dihapus' });
        } catch (error) {
            toast({ title: 'Gagal menghapus catatan', variant: 'destructive' });
        }
    };

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient Header - Consistent with Agenda/Dashboard */}
                <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[32px] z-0 shadow-lg" />

                <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8">
                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-white">
                        <div className="flex items-start gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md leading-none mb-1.5">Catatan & Pengingat</h1>
                                <p className="text-xs text-blue-50 font-medium opacity-90">Kelola catatan pribadi dan pengingat kegiatan Anda</p>
                            </div>
                        </div>

                        <Button
                            onClick={() => setOpen(true)}
                            className="bg-white hover:bg-white/90 text-blue-700 border-none shadow-lg font-bold transition-all active:scale-95 text-xs gap-2 rounded-xl"
                        >
                            <Plus className="h-4 w-4" />
                            Tambah Catatan
                        </Button>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <Card key={i} className="border-none shadow-md rounded-2xl overflow-hidden h-48">
                                    <div className="p-5 h-full flex flex-col justify-between">
                                        <div className="space-y-3">
                                            <Skeleton className="h-5 w-3/4 rounded-full" />
                                            <Skeleton className="h-3 w-full rounded-full" />
                                            <Skeleton className="h-3 w-2/3 rounded-full" />
                                        </div>
                                        <Skeleton className="h-8 w-24 rounded-xl" />
                                    </div>
                                </Card>
                            ))
                        ) : reminders.length === 0 ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 mb-6">
                                    <StickyNote className="h-16 w-16 text-blue-100" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Belum Ada Catatan</h3>
                                <p className="text-sm text-slate-400 max-w-xs font-medium">Buat pengingat agar tidak ada agenda penting yang terlewatkan.</p>
                            </div>
                        ) : (
                            reminders.map((r) => {
                                const isExpired = isAfter(new Date(), parseISO(r.remind_at)) && !r.is_completed;
                                return (
                                    <Card
                                        key={r.id}
                                        className={cn(
                                            "border-none shadow-sm border border-slate-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-md group",
                                            r.is_completed ? "bg-slate-50/80 opacity-60" : "bg-white"
                                        )}
                                    >
                                        <CardContent className="p-0">
                                            <div className="p-5">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div
                                                        onClick={() => toggleComplete(r.id, r.is_completed)}
                                                        className={cn(
                                                            "h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer transition-all border",
                                                            r.is_completed ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-400 border-blue-100 group-hover:bg-blue-600 group-hover:text-white"
                                                        )}
                                                    >
                                                        {r.is_completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteNote(r.id)}
                                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8 rounded-lg"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                <h3 className={cn(
                                                    "text-base font-bold tracking-tight mb-2 line-clamp-2",
                                                    r.is_completed ? "text-slate-400 line-through" : "text-slate-800"
                                                )}>
                                                    {r.title}
                                                </h3>

                                                <p className={cn(
                                                    "text-xs font-medium mb-5 line-clamp-3",
                                                    r.is_completed ? "text-slate-400" : "text-slate-500"
                                                )}>
                                                    {r.description || 'Tidak ada deskripsi.'}
                                                </p>

                                                <div className="flex items-center justify-between mt-auto">
                                                    <div className={cn(
                                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider",
                                                        r.remind_at ? (isExpired ? "bg-red-50 text-red-600" : (r.is_completed ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600")) : "bg-slate-50 text-slate-400"
                                                    )}>
                                                        <Clock className="h-3 w-3" />
                                                        {r.remind_at ? format(parseISO(r.remind_at), 'dd MMM, HH:mm', { locale: id }) : 'Tanpa Pengingat'}
                                                    </div>

                                                    {r.is_notified ? (
                                                        <div className="text-emerald-500 bg-emerald-50 p-1 rounded-lg border border-emerald-100" title="Notifikasi telah dikirim">
                                                            <Bell className="h-3.5 w-3.5" />
                                                        </div>
                                                    ) : (
                                                        !r.is_completed && <div className="text-slate-300" title="Menunggu waktu pengingat">
                                                            <BellOff className="h-3.5 w-3.5" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Create Note Dialog */}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="rounded-3xl sm:max-w-[425px] border-none shadow-2xl p-0 overflow-hidden">
                        <div className="bg-gradient-to-br from-blue-600 to-cyan-500 p-6 text-white relative">
                            <DialogTitle className="text-xl font-bold mb-1">Tambah Catatan</DialogTitle>
                            <DialogDescription className="text-blue-50 text-xs opacity-90">Buat pengingat kegiatan pribadi Anda.</DialogDescription>
                        </div>

                        <div className="p-6 space-y-5 bg-white">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Judul Kegiatan</Label>
                                <Input
                                    placeholder="Masukkan judul kegiatan..."
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="h-11 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4 font-bold text-slate-700 transition-all text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Keterangan (Opsional)</Label>
                                <Textarea
                                    placeholder="Masukkan detail catatan atau keterangan tambahan..."
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4 py-3 min-h-[100px] font-medium text-slate-600 transition-all text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Tanggal</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="date"
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                            className="h-10 rounded-xl border-slate-100 bg-slate-50 pl-10 pr-4 font-bold text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Waktu Pengingat (Opsional)</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="time"
                                            value={form.time}
                                            onChange={e => setForm({ ...form, time: e.target.value })}
                                            className="h-10 rounded-xl border-slate-100 bg-slate-50 pl-10 pr-4 font-bold text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 pt-0 bg-white">
                            <div className="flex w-full gap-3">
                                <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl font-bold text-slate-500 hover:bg-slate-50 text-xs">Batal</Button>
                                <Button
                                    onClick={handleCreateNote}
                                    disabled={saving}
                                    className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all text-xs"
                                >
                                    {saving ? 'Menyimpan...' : 'Simpan Catatan'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
