import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Search, Megaphone, Calendar, ChevronRight, Plus, Loader2, Send, Info, BellRing, ArrowLeft, Filter, Clock, LayoutGrid, List, Edit, Trash2, MoreVertical, Save } from 'lucide-react';
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
    expires_at?: string;
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
    const [sendNotification, setSendNotification] = useState(true);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, title: string } | null>(null);

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin_hr' || profile?.email?.includes('admin');

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            // If not admin, only show active and non-expired
            if (!isAdmin) {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;

            if (error) throw error;

            const filteredData = isAdmin ? (data || []) : (data || []).filter(a => {
                if (!a.is_active) return false;
                if (!a.expires_at) return true;
                return new Date(a.expires_at) > new Date();
            });

            setAnnouncements(filteredData);
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
        setSendNotification(true);
        setIsCreateOpen(true);
    };

    const handleOpenEdit = (ann: Announcement) => {
        setIsEditing(true);
        setCurrentId(ann.id);
        setNewTitle(ann.title);
        setNewContent(ann.content);
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
                // UPDATE
                const { error } = await supabase
                    .from('announcements')
                    .update({
                        title: newTitle,
                        content: newContent,
                    })
                    .eq('id', currentId);

                if (error) throw error;
                toast({ title: "Berhasil", description: "Pengumuman berhasil diperbarui." });
            } else {
                // CREATE
                const { error } = await supabase
                    .rpc('publish_announcement', {
                        p_title: newTitle,
                        p_content: newContent,
                        p_created_by: user?.id,
                        p_send_notification: sendNotification
                    });

                if (error) throw error;
                toast({ title: "Berhasil", description: "Pengumuman berhasil dipublikasikan." });
            }

            await fetchAnnouncements();
            setNewTitle('');
            setNewContent('');
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
            const { error } = await supabase.from('announcements').delete().eq('id', itemToDelete.id);
            if (error) throw error;
            toast({ title: 'Berhasil', description: 'Pengumuman dihapus' });
            fetchAnnouncements();
        } catch (e: any) {
            toast({ title: 'Gagal', description: e.message || 'Gagal menghapus pengumuman', variant: 'destructive' });
        } finally {
            setDeleteOpen(false);
            setItemToDelete(null);
        }
    };

    const filteredAnnouncements = announcements.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // =========================================================================
    // MOBILE VIEW (PROTECTED)
    // =========================================================================
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

                        <Card className="border-none shadow-xl shadow-blue-900/5 rounded-2xl -mt-4 mb-8 bg-white/95 backdrop-blur-sm z-20">
                            <CardContent className="p-2">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        placeholder="Cari berita..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-12 h-12 bg-transparent border-none shadow-none focus-visible:ring-0 text-base placeholder:text-slate-400"
                                    />
                                </div>
                            </CardContent>
                        </Card>

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
                                                    idx === 0 ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                                                )}>
                                                    {idx === 0 ? 'Terbaru' : 'Info'}
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
                                                            <DropdownMenuItem onClick={() => handleOpenEdit(ann)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDelete(ann)} className="text-red-600">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Hapus
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
                    </div>
                </div>

                {/* Create Modal for Mobile */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="rounded-t-3xl sm:rounded-3xl border-0">
                        <DialogHeader>
                            <DialogTitle>Pengumuman Baru</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Judul</Label>
                                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="rounded-xl" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Konten</Label>
                                <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} className="rounded-xl min-h-[100px]" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSaveAnnouncement} disabled={isSubmitting} className="w-full bg-blue-600 rounded-xl py-6 font-bold">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditing ? 'Simpan Perubahan' : 'Publikasikan')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

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

    // =========================================================================
    // DESKTOP VIEW (MODERN & EFFICIENT)
    // =========================================================================
    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-6 px-4 py-8">
                {/* Compact Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate('/dashboard')}
                            className="h-10 w-10 rounded-xl border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-all active:scale-95"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Pusat Informasi</h1>
                            <p className="text-xs text-slate-500 mt-1.5 font-medium flex items-center gap-1.5">
                                <BellRing className="h-3 w-3 text-blue-500" />
                                Update terbaru dan pengumuman resmi perusahaan
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                                placeholder="Cari informasi..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 w-64 rounded-xl border-slate-200 bg-white hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
                            />
                        </div>
                        {isAdmin && (
                            <Button
                                onClick={handleOpenCreate}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 h-10 px-5 rounded-xl font-bold transition-all active:scale-95"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Info
                            </Button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="grid lg:grid-cols-3 gap-6">
                        <Skeleton className="lg:col-span-2 h-[450px] rounded-[32px]" />
                        <div className="space-y-6">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-32 rounded-2xl" />
                            ))}
                        </div>
                    </div>
                ) : filteredAnnouncements.length > 0 ? (
                    <div className="grid lg:grid-cols-12 gap-6">
                        {/* LEFT COLUMN: Featured Area (8 cols) */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* Featured Card */}
                            <Card className="border-none shadow-xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white rounded-[32px] overflow-hidden relative group cursor-pointer group transition-all duration-500">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] -mr-40 -mt-40 group-hover:bg-blue-500/20 transition-all duration-500" />
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -ml-32 -mb-32" />

                                <CardContent className="p-8 lg:p-12 relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20">
                                                Berita Teratas
                                            </Badge>
                                            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {format(new Date(filteredAnnouncements[0].created_at), 'd MMMM yyyy', { locale: id })}
                                            </div>
                                        </div>
                                        {isAdmin && (
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(filteredAnnouncements[0])} className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(filteredAnnouncements[0])} className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <h2 className="text-3xl lg:text-4xl font-black mb-6 leading-[1.15] tracking-tight group-hover:text-blue-100 transition-colors">
                                        {filteredAnnouncements[0].title}
                                    </h2>
                                    <p className="text-slate-300 text-base lg:text-lg leading-relaxed mb-8 opacity-80 h-[4.5em] line-clamp-3">
                                        {filteredAnnouncements[0].content}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                                <Megaphone className="h-5 w-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dipublikasikan Oleh</p>
                                                <p className="text-xs font-bold text-white">HR Department</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" className="rounded-xl border-white/20 bg-white/5 hover:bg-white text-white hover:text-slate-900 font-bold border-2 px-6">
                                            Baca Selengkapnya
                                            <ChevronRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Feed Area - Grid of smaller cards */}
                            <div className="grid md:grid-cols-2 gap-4">
                                {filteredAnnouncements.slice(1, 5).map((ann) => (
                                    <Card key={ann.id} className="border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 group rounded-2xl cursor-pointer">
                                        <CardContent className="p-5">
                                            <div className="flex justify-between items-start mb-3">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors text-[9px] font-bold">
                                                    Umum
                                                </Badge>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(ann.created_at), 'd MMM yyyy')}
                                                </div>
                                                {isAdmin && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-1 text-slate-300 hover:text-slate-600">
                                                                <MoreVertical className="h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-xl">
                                                            <DropdownMenuItem onClick={() => handleOpenEdit(ann)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDelete(ann)} className="text-red-600">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 mb-2 transition-colors">
                                                {ann.title}
                                            </h3>
                                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed opacity-80">
                                                {ann.content}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Sidebar (4 cols) */}
                        <div className="lg:col-span-4 space-y-6">
                            {/* Pinned / Archive Section */}
                            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        <CardTitle className="text-sm font-black text-slate-800">Riwayat Berita</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-100">
                                        {filteredAnnouncements.slice(5, 12).map((ann) => (
                                            <div key={ann.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                                    <Calendar className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600">{ann.title}</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{format(new Date(ann.created_at), 'd MMMM yyyy')}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredAnnouncements.length <= 5 && (
                                            <div className="p-8 text-center">
                                                <Info className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                                                <p className="text-xs text-slate-400">Belum ada riwayat berita lain</p>
                                            </div>
                                        )}
                                    </div>
                                    {filteredAnnouncements.length > 5 && (
                                        <div className="p-3 border-t border-slate-100">
                                            <Button variant="ghost" className="w-full h-8 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg">
                                                Lihat Arsip Lengkap
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Summary / Stats Info */}
                            <Card className="border-none shadow-xl bg-blue-600 text-white rounded-3xl p-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 h-24 w-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
                                <h3 className="text-lg font-black mb-1">Stay Informed</h3>
                                <p className="text-xs text-blue-100 opacity-80 mb-6 font-medium">Jangan lewatkan informasi penting untuk seluruh karyawan Ceria.</p>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                                        <span className="text-xs font-bold">Total Informasi</span>
                                        <span className="text-lg font-black">{announcements.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                                        <span className="text-xs font-bold">Minggu Ini</span>
                                        <span className="text-lg font-black">
                                            {announcements.filter(a => new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                                        </span>
                                    </div>
                                </div>
                                <Button className="w-full mt-6 bg-white text-blue-600 hover:bg-blue-50 font-bold rounded-xl h-10 shadow-lg">
                                    Aktifkan Notifikasi
                                </Button>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-24 bg-white rounded-[32px] border-2 border-dashed border-slate-100">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Info className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Belum ada pengumuman</h3>
                        <p className="text-slate-500 mt-2 max-w-xs mx-auto">
                            Saat ini belum ada informasi terbaru dari perusahaan. Silakan cek kembali nanti.
                        </p>
                    </div>
                )}

                {/* Other News Section for Desktop (> 12 items) */}
                {filteredAnnouncements.length > 12 && (
                    <div className="mt-10 pt-10 border-t border-slate-200">
                        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5 text-slate-400" />
                            Arsip Berita & Pengumuman
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {filteredAnnouncements.slice(12).map((ann) => (
                                <Card key={ann.id} className="group border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all rounded-2xl cursor-pointer bg-white">
                                    <CardContent className="p-5 flex flex-col h-full">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(ann.created_at), 'd MMM yyyy')}
                                            </div>
                                            {isAdmin && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-3 -mt-2 text-slate-300 hover:text-slate-600">
                                                            <MoreVertical className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-xl">
                                                        <DropdownMenuItem onClick={() => handleOpenEdit(ann)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleOpenDelete(ann)} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">{ann.title}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed flex-1 opacity-80">{ann.content}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Create Modal Desktop */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="rounded-2xl sm:max-w-[550px] border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-slate-900">{isEditing ? 'Edit Informasi' : 'Buat Informasi Baru'}</DialogTitle>
                            <DialogDescription className="text-sm font-medium">
                                {isEditing ? 'Perbarui detail pengumuman.' : 'Informasi akan dipublikasikan ke seluruh karyawan secara real-time.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400 tracking-wider">Judul Informasi</Label>
                                <Input
                                    placeholder="Masukkan judul yang menarik..."
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400 tracking-wider">Konten / Detail</Label>
                                <Textarea
                                    placeholder="Tulis detail informasi di sini..."
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    className="min-h-[150px] rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all p-4"
                                />
                            </div>
                            <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                <Checkbox
                                    id="notify-desktop"
                                    checked={sendNotification}
                                    onCheckedChange={(checked) => setSendNotification(checked as boolean)}
                                    className="border-blue-400 data-[state=checked]:bg-blue-600"
                                />
                                <Label htmlFor="notify-desktop" className="text-sm font-bold text-blue-900 cursor-pointer">Kirim Notifikasi Push Secara Otomatis</Label>
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-bold text-slate-500 hover:bg-slate-100">Batal</Button>
                            <Button onClick={handleSaveAnnouncement} disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-8 font-black shadow-lg shadow-blue-200">
                                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : (isEditing ? <Save className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />)}
                                {isEditing ? 'Simpan Perubahan' : 'Publikasikan Sekarang'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Desktop */}
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Hapus Pengumuman?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium text-slate-500">
                                Anda yakin ingin menghapus <b>"{itemToDelete?.title}"</b>? Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6 gap-3">
                            <AlertDialogCancel className="rounded-xl font-black text-xs uppercase tracking-widest border-slate-200">Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} className="rounded-xl bg-red-600 hover:bg-red-700 font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-red-100">
                                YA, HAPUS PERMANEN
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
}
