import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Search, Megaphone, Calendar, ChevronRight, Plus, Loader2, Info, Edit, Trash2, MoreVertical, ArrowLeft, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

const months = [
    { v: '01', l: 'Januari' }, { v: '02', l: 'Februari' }, { v: '03', l: 'Maret' },
    { v: '04', l: 'April' }, { v: '05', l: 'Mei' }, { v: '06', l: 'Juni' },
    { v: '07', l: 'Juli' }, { v: '08', l: 'Agustus' }, { v: '09', l: 'September' },
    { v: '10', l: 'Oktober' }, { v: '11', l: 'November' }, { v: '12', l: 'Desember' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
    expires_at?: string;
    deleted_at?: string;
    created_by: string;
    is_active: boolean;
}

export default function InformationPage() {
    const { profile, user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Create/Edit Announcement State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newExpiresAt, setNewExpiresAt] = useState('');
    const [sendNotification, setSendNotification] = useState(true);

    // Filtering State
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'MM'));
    const [selectedYear, setSelectedYear] = useState<string>(format(new Date(), 'yyyy'));

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, title: string } | null>(null);

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin_hr' || profile?.email?.includes('admin');

    useEffect(() => {
        fetchAnnouncements();
    }, [user?.id]);


    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (!isAdmin) {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;
            if (error) throw error;
            setAnnouncements(data || []);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setIsEditing(false);
        setCurrentId(null);
        setNewTitle('');
        setNewContent('');
        setNewExpiresAt('');
        setSendNotification(true);
        setIsCreateOpen(true);
    };

    const handleOpenEdit = (ann: Announcement) => {
        setIsEditing(true);
        setCurrentId(ann.id);
        setNewTitle(ann.title);
        setNewContent(ann.content);
        setNewExpiresAt(ann.expires_at ? ann.expires_at.slice(0, 16) : '');
        setSendNotification(false);
        setIsCreateOpen(true);
    };

    const handleOpenDelete = (ann: Announcement) => {
        setItemToDelete({ id: ann.id, title: ann.title });
        setDeleteOpen(true);
    };

    const handleSaveAnnouncement = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            toast({
                title: "Gagal",
                description: "Judul dan isi pengumuman harus diisi.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSubmitting(true);

            if (isEditing && currentId) {
                const { error } = await supabase
                    .from('announcements')
                    .update({
                        title: newTitle,
                        content: newContent,
                        expires_at: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
                    })
                    .eq('id', currentId);

                if (error) throw error;
                toast({ title: "Berhasil", description: "Pengumuman berhasil diperbarui." });
            } else {
                const { error } = await supabase
                    .rpc('publish_announcement', {
                        p_title: newTitle,
                        p_content: newContent,
                        p_created_by: user?.id,
                        p_send_notification: sendNotification,
                        p_expires_at: newExpiresAt ? new Date(newExpiresAt).toISOString() : null
                    });

                if (error) throw error;
                toast({ title: "Berhasil", description: "Pengumuman berhasil dipublikasikan." });
            }

            await fetchAnnouncements();
            setNewTitle('');
            setNewContent('');
            setNewExpiresAt('');
            setIsCreateOpen(false);
        } catch (error: any) {
            console.error('Error saving announcement:', error);
            toast({ title: "Gagal", description: error.message || "Terjadi kesalahan.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            // Soft delete: set deleted_at instead of hard delete
            const { error } = await supabase
                .from('announcements')
                .update({
                    deleted_at: new Date().toISOString(),
                    is_active: false
                })
                .eq('id', itemToDelete.id);

            if (error) throw error;
            toast({ title: 'Berhasil', description: 'Pengumuman dipindahkan ke riwayat' });
            fetchAnnouncements();
        } catch (e: any) {
            toast({ title: 'Gagal', description: e.message || 'Gagal menghapus pengumuman', variant: 'destructive' });
        } finally {
            setDeleteOpen(false);
            setItemToDelete(null);
        }
    };

    const filteredAnnouncements = announcements.filter(a => {
        const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.content.toLowerCase().includes(searchQuery.toLowerCase());

        const date = new Date(a.created_at);
        const isExpired = a.expires_at ? new Date(a.expires_at) <= new Date() : false;
        const isSoftDeleted = !!a.deleted_at;
        const isActiveState = a.is_active && !isExpired && !isSoftDeleted;

        if (activeTab === 'active') {
            return matchesSearch && isActiveState;
        } else if (activeTab === 'history') {
            const matchesMonth = format(date, 'MM') === selectedMonth;
            const matchesYear = format(date, 'yyyy') === selectedYear;
            return matchesSearch && !isActiveState && matchesMonth && matchesYear;
        }
        return false;
    });

    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50 pb-20">
                    <div className="absolute top-0 left-0 w-full h-[180px] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />
                    <div className="relative z-10 max-w-4xl mx-auto px-4 pt-6 space-y-6">
                        <div className="flex flex-col items-start gap-4 text-white mb-6">
                            <div className="flex items-center gap-4 w-full justify-between">
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => navigate('/dashboard')}
                                        className="text-white hover:bg-white/20 hover:text-white rounded-full h-8 w-8"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </Button>
                                    <h1 className="text-xl font-bold tracking-tight">Pusat Informasi</h1>
                                </div>
                                {isAdmin && (
                                    <Button
                                        onClick={handleOpenCreate}
                                        className="bg-white text-blue-600 hover:bg-white/90 h-8 px-3 rounded-xl font-bold text-xs"
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Buat
                                    </Button>
                                )}
                            </div>
                            <p className="text-blue-100 text-[10px] font-medium opacity-90 leading-relaxed uppercase tracking-widest pl-11">
                                Berita terbaru & pengumuman
                            </p>
                        </div>

                        {/* Mobile Tabs */}
                        <div className="flex flex-col gap-4 -mt-4 mb-6">
                            <div className="flex p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                                <button
                                    onClick={() => setActiveTab('active')}
                                    className={cn(
                                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        activeTab === 'active' ? "bg-white text-blue-600 shadow-lg" : "text-white/70 hover:text-white"
                                    )}
                                >
                                    Aktif
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={cn(
                                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        activeTab === 'history' ? "bg-white text-red-600 shadow-lg" : "text-white/70 hover:text-white"
                                    )}
                                >
                                    Riwayat
                                </button>
                            </div>
                        </div>

                        {activeTab === 'active' || activeTab === 'history' ? (
                            <>
                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map(i => (
                                            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
                                        ))}
                                    </div>
                                ) : filteredAnnouncements.length > 0 ? (
                                    <div className="space-y-4 pb-12">
                                        {filteredAnnouncements.map((ann, idx) => (
                                            <Card key={ann.id} className={cn(
                                                "border-none shadow-sm rounded-2xl overflow-hidden",
                                                idx === 0 ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white" : "bg-white"
                                            )}>
                                                <CardContent className="p-5">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Badge className={cn(
                                                            "text-[9px] px-2 py-0 h-4 border-none",
                                                            idx === 0 && activeTab === 'active' ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                                                        )}>
                                                            {ann.deleted_at ? 'Terhapus' : (ann.expires_at && new Date(ann.expires_at) <= new Date() ? 'Berakhir' : (!ann.is_active ? 'Draft' : (idx === 0 && activeTab === 'active' ? 'Terbaru' : 'Info')))}
                                                        </Badge>
                                                        <span className={cn(
                                                            "text-[10px] font-medium",
                                                            idx === 0 ? "text-blue-100" : "text-slate-400"
                                                        )}>
                                                            {format(new Date(ann.created_at), 'd MMM yyyy', { locale: id })}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-start gap-2">
                                                        <h3 className={cn(
                                                            "font-bold text-sm mb-2 line-clamp-2 flex-1",
                                                            idx === 0 ? "text-white" : "text-slate-800"
                                                        )}>{ann.title}</h3>
                                                        {isAdmin && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 -mr-2 -mt-1", idx === 0 ? "text-blue-200 hover:text-white hover:bg-white/20" : "text-slate-300 hover:text-slate-600")}>
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="rounded-xl">
                                                                    {!ann.deleted_at && (
                                                                        <DropdownMenuItem onClick={() => handleOpenEdit(ann)}>
                                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem onClick={() => handleOpenDelete(ann)} className="text-red-600">
                                                                        <Trash2 className="mr-2 h-4 w-4" /> {ann.deleted_at ? 'Hapus Permanen' : 'Hapus'}
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                    <p className={cn(
                                                        "text-xs line-clamp-2",
                                                        idx === 0 ? "text-blue-50" : "text-slate-500"
                                                    )}>{ann.content}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20">
                                        <Info className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-400 text-sm">Tidak ada pengumuman.</p>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent className="rounded-2xl max-w-[90%]">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Anda yakin ingin menghapus <b>"{itemToDelete?.title}"</b>?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} className="rounded-xl bg-red-600">Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DashboardLayout>
        );
    }

    return (
        <>
            <DashboardLayout>
                <div className="max-w-6xl mx-auto space-y-6 px-3 py-6">
                    {/* Clean Header Area */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
                        <div className="flex items-center gap-5">
                            <div className="h-14 w-14 bg-slate-900 rounded-[20px] flex items-center justify-center shadow-lg shadow-slate-200 uppercase text-white font-black text-xs">
                                INFO
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Pusat Informasi</h1>
                                <div className="flex items-center gap-4 mt-1.5 font-bold uppercase tracking-widest text-[10px]">
                                    <span className="text-slate-400">Total Data: {announcements.length}</span>
                                    <span className="text-blue-600">Terbaru: {announcements.filter(a => new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center p-1 bg-slate-100 rounded-xl mr-2">
                                <button
                                    onClick={() => setActiveTab('active')}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                        activeTab === 'active' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Aktif
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                        activeTab === 'history' ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Riwayat
                                </button>
                            </div>

                            <div className="relative group flex-1 md:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                <Input
                                    placeholder="Cari informasi..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-11 h-12 rounded-2xl border-slate-200 bg-white hover:border-slate-300 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium"
                                />
                            </div>

                            {activeTab === 'history' && (
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="h-12 px-4 rounded-2xl border border-slate-200 bg-white text-xs font-bold focus:ring-4 focus:ring-blue-500/5 outline-none"
                                    >
                                        {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(e.target.value)}
                                        className="h-12 px-4 rounded-2xl border border-slate-200 bg-white text-xs font-bold focus:ring-4 focus:ring-blue-500/5 outline-none"
                                    >
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            )}

                            {isAdmin && (
                                <Button
                                    onClick={handleOpenCreate}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100 h-12 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                >
                                    <Plus className="mr-2 h-5 w-5" />
                                    BUAT
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="md:col-span-8 space-y-6">
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 uppercase tracking-[0.2em] font-black text-[9px] text-slate-400">
                                    <div className="col-span-2">Waktu</div>
                                    <div className="col-span-4">Judul Informasi</div>
                                    <div className="col-span-4">Preview Pesan</div>
                                    <div className="col-span-2 text-right">Opsi</div>
                                </div>

                                <div className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-none" />)
                                    ) : filteredAnnouncements.length > 0 ? (
                                        filteredAnnouncements.map((ann) => (
                                            <div key={ann.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center px-8 py-5 hover:bg-slate-50/80 transition-all group cursor-default">
                                                <div className="col-span-2 flex flex-col">
                                                    <span className="text-xs font-black text-slate-900">{format(new Date(ann.created_at), 'd MMM yyyy')}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{format(new Date(ann.created_at), 'HH:mm')}</span>
                                                </div>
                                                <div className="col-span-4">
                                                    <h3 className="text-sm font-black text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{ann.title}</h3>
                                                    <div className="flex gap-1.5 mt-1">
                                                        {ann.deleted_at && <Badge className="text-[8px] h-4 px-1.5 bg-red-50 text-red-600 border-none">Dihapus</Badge>}
                                                        {ann.expires_at && new Date(ann.expires_at) <= new Date() && <Badge className="text-[8px] h-4 px-1.5 bg-orange-50 text-orange-600 border-none">Berakhir</Badge>}
                                                        {!ann.is_active && !ann.deleted_at && <Badge className="text-[8px] h-4 px-1.5 bg-slate-100 text-slate-400 border-none">Draft</Badge>}
                                                    </div>
                                                </div>
                                                <div className="col-span-4 text-xs text-slate-500 line-clamp-1 italic opacity-60">
                                                    {ann.content}
                                                </div>
                                                <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isAdmin && !ann.deleted_at && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(ann)} className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {isAdmin && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(ann)} className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-20 text-center">
                                            <Info className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Tidak ada pengumuman</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-4 space-y-6">
                            <Card className="border-none shadow-xl shadow-blue-900/5 rounded-[41px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative">
                                <CardContent className="p-10 relative z-10">
                                    <h3 className="font-black text-lg mb-2 tracking-tight">SDM & Staf</h3>
                                    <p className="text-blue-100 text-xs font-medium mb-8 leading-relaxed">
                                        Butuh informasi lebih lanjut? Silakan hubungi tim SDM atau sampaikan melalui unit terkait.
                                    </p>
                                    <Button
                                        variant="secondary"
                                        className="w-full rounded-2xl h-14 font-black uppercase tracking-widest text-xs bg-white text-blue-600 hover:bg-white/90"
                                        onClick={() => navigate('/employees')}
                                    >
                                        Lihat Tim Kami
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[40px] border-none shadow-2xl">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">{isEditing ? 'Update Informasi' : 'Buat Pengumuman Baru'}</DialogTitle>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Publikasikan pesan ke seluruh staff LPK.</p>
                            </div>
                            <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Megaphone className="h-7 w-7 text-blue-400" />
                            </div>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] pl-1">Judul Informasi</Label>
                                <Input
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="h-14 rounded-2xl bg-slate-50 border-slate-200 font-bold focus:bg-white text-slate-900 px-5 focus:ring-8 focus:ring-blue-500/5 transition-all outline-none"
                                    placeholder="Judul yang singkat dan jelas..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] pl-1">Isi Pesan Lengkap</Label>
                                <Textarea
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    className="min-h-[180px] rounded-2xl bg-slate-50 border-slate-200 p-5 resize-none transition-all text-sm leading-relaxed"
                                    placeholder="Detail informasi..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] pl-1">Tampil Sampai (Opsional)</Label>
                                <Input
                                    type="datetime-local"
                                    value={newExpiresAt}
                                    onChange={(e) => setNewExpiresAt(e.target.value)}
                                    className="h-14 rounded-2xl bg-slate-50 border-slate-200 font-bold focus:bg-white text-slate-900 px-5 focus:ring-8 focus:ring-blue-500/5 transition-all outline-none"
                                />
                                <p className="text-[10px] text-slate-400 font-medium pl-1">Jika dikosongkan, pengumuman tampil selamanya.</p>
                            </div>
                            <div className="flex items-center gap-5 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 shadow-inner">
                                <Checkbox
                                    id="notify-modern"
                                    checked={sendNotification}
                                    onCheckedChange={(checked) => setSendNotification(checked as boolean)}
                                    className="h-6 w-6 border-blue-200 data-[state=checked]:bg-blue-600"
                                />
                                <div>
                                    <Label htmlFor="notify-modern" className="text-base font-black text-blue-900 cursor-pointer block leading-none">Broadcasting Notifikasi</Label>
                                    <p className="text-[10px] text-blue-600 font-bold opacity-70 mt-1 uppercase tracking-wider">Kirim ke seluruh perangkat aktif.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 flex gap-4 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="flex-1 h-14 font-black rounded-2xl text-slate-300 hover:bg-white transition-all uppercase tracking-widest text-[10px]">Batal</Button>
                            <Button onClick={handleSaveAnnouncement} disabled={isSubmitting} className="flex-[2] h-14 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-2xl shadow-blue-200 transition-all active:scale-95 uppercase tracking-widest text-[10px]">
                                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : (isEditing ? 'Simpan Update' : 'Publikasikan')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-black">Hapus Pengumuman?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium text-slate-500">
                                Anda yakin ingin menghapus <b>"{itemToDelete?.title}"</b>? Tindakan ini permanen.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6 gap-3">
                            <AlertDialogCancel className="rounded-xl h-12 px-6 font-bold">Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} className="rounded-xl h-12 px-8 bg-red-600 hover:bg-red-700 font-bold text-white shadow-lg">Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DashboardLayout>
        </>
    );
}
