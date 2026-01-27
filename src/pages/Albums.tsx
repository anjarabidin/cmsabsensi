import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Search,
    Image as ImageIcon,
    Video,
    MoreVertical,
    FolderOpen,
    Calendar,
    Users,
    Eye,
    Trash2,
    ChevronRight,
    Globe,
    Loader2,
    Camera,
    ChevronLeft
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Album } from '@/types';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AlbumsPage() {
    const { profile, activeRole } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    const [albums, setAlbums] = useState<Album[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newAlbumTitle, setNewAlbumTitle] = useState('');
    const [newAlbumDesc, setNewAlbumDesc] = useState('');
    const [newAlbumVisibility, setNewAlbumVisibility] = useState<'public' | 'department'>('public');
    const [creating, setCreating] = useState(false);

    const canManage = activeRole === 'super_admin' || activeRole === 'admin_hr' || activeRole === 'manager';

    useEffect(() => {
        fetchAlbums();
    }, [profile]);

    const fetchAlbums = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('albums')
                .select(`
          *,
          department:department_id(name),
          items:album_items(id, file_type, file_url)
        `)
                .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            setAlbums(data || []);
        } catch (error) {
            console.error('Error fetching albums:', error);
            toast({
                title: 'Gagal memuat album',
                description: 'Silakan refresh halaman.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAlbum = async () => {
        if (!newAlbumTitle.trim()) return;

        try {
            setCreating(true);
            const { data, error } = await supabase
                .from('albums')
                .insert({
                    title: newAlbumTitle,
                    description: newAlbumDesc,
                    visibility: newAlbumVisibility,
                    created_by: profile?.id,
                    department_id: newAlbumVisibility === 'department' ? profile?.department_id : null
                })
                .select()
                .single();

            if (error) throw error;

            toast({
                title: 'Berhasil',
                description: 'Album baru telah dibuat.',
            });

            setIsCreateOpen(false);
            setNewAlbumTitle('');
            setNewAlbumDesc('');
            fetchAlbums();

            // Navigate to detail for uploading images
            navigate(`/albums/${data.id}`);
        } catch (error) {
            console.error('Error creating album:', error);
            toast({
                title: 'Gagal membuat album',
                description: 'Pastikan data valid.',
                variant: 'destructive',
            });
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteAlbum = async (id: string) => {
        if (!confirm('Hapus album ini beserta seluruh isinya?')) return;

        try {
            const { error } = await supabase
                .from('albums')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setAlbums(albums.filter(a => a.id !== id));
            toast({ title: 'Berhasil', description: 'Album telah dihapus.' });
        } catch (error) {
            toast({ title: 'Gagal', description: 'Gagal menghapus album.', variant: 'destructive' });
        }
    };

    const filteredAlbums = albums.filter(album =>
        album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        album.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // MOBILE VIEW
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    {/* Background Gradient Header */}
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[32px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24">
                        {/* Header Section */}
                        <div className="flex flex-col gap-4 text-white">
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
                                    <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Album Kenangan</h1>
                                    <p className="text-xs text-blue-50 font-medium opacity-90">Koleksi foto & video kegiatan perusahaan</p>
                                </div>
                            </div>

                            {canManage && (
                                <Button
                                    onClick={() => setIsCreateOpen(true)}
                                    className="bg-white hover:bg-white/90 text-blue-700 border-none shadow-lg font-bold transition-all active:scale-95 text-xs gap-2 rounded-xl w-full"
                                >
                                    <Plus className="h-4 w-4" />
                                    Buat Album Baru
                                </Button>
                            )}
                        </div>

                        {/* Search Bar */}
                        <div className="bg-white rounded-2xl shadow-lg p-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Cari album..."
                                    className="pl-10 border-0 bg-transparent focus-visible:ring-0 h-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Content Section - Google Drive Style Grid */}
                        {loading ? (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="bg-slate-100 rounded-2xl h-[180px] animate-pulse" />
                                ))}
                            </div>
                        ) : filteredAlbums.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                {filteredAlbums.map((album) => {
                                    const photoCount = album.items?.filter(item => item.file_type === 'photo').length || 0;
                                    const videoCount = album.items?.filter(item => item.file_type === 'video').length || 0;
                                    const coverImage = album.items?.find(item => item.file_type === 'photo')?.file_url;

                                    return (
                                        <Card
                                            key={album.id}
                                            className="group relative border-none bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer"
                                            onClick={() => navigate(`/albums/${album.id}`)}
                                        >
                                            <CardContent className="p-0">
                                                {/* Cover Image - Compact */}
                                                <div className="relative aspect-square overflow-hidden bg-slate-50">
                                                    {coverImage ? (
                                                        <img
                                                            src={coverImage}
                                                            alt={album.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                                            <ImageIcon className="h-12 w-12 opacity-30" />
                                                        </div>
                                                    )}

                                                    {/* Badge Overlay - Compact */}
                                                    <div className="absolute top-2 left-2">
                                                        <Badge className={cn(
                                                            "bg-white/90 backdrop-blur-md text-[8px] font-bold px-1.5 py-0.5 border-none shadow-sm",
                                                            album.visibility === 'public' ? "text-blue-600" : "text-amber-600"
                                                        )}>
                                                            {album.visibility === 'public' ? (
                                                                <Globe className="h-2 w-2" />
                                                            ) : (
                                                                <Users className="h-2 w-2" />
                                                            )}
                                                        </Badge>
                                                    </div>

                                                    {/* Menu Dropdown - Compact */}
                                                    {canManage && (
                                                        <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md border-none">
                                                                        <MoreVertical className="h-3 w-3" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="rounded-xl border-none shadow-xl p-1">
                                                                    <DropdownMenuItem
                                                                        className="rounded-lg text-red-600 focus:text-red-700 focus:bg-red-50 font-bold text-xs"
                                                                        onClick={() => handleDeleteAlbum(album.id)}
                                                                    >
                                                                        <Trash2 className="h-3 w-3 mr-1.5" /> Hapus
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    )}

                                                    {/* Count Badge - Bottom */}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex gap-2 text-white text-[10px] font-bold">
                                                        <div className="flex items-center gap-1">
                                                            <ImageIcon className="h-3 w-3" />
                                                            <span>{photoCount}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Video className="h-3 w-3" />
                                                            <span>{videoCount}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Album Info - Compact */}
                                                <div className="p-3">
                                                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mb-1">{album.title}</h3>
                                                    <p className="text-[10px] text-slate-400 line-clamp-1">
                                                        {format(new Date(album.created_at), 'd MMM yyyy', { locale: idLocale })}
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                                    <FolderOpen className="h-10 w-10 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Album Masih Kosong</h3>
                                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                                    {canManage ? 'Buat album pertama untuk menyimpan kenangan perusahaan' : 'Belum ada album yang tersedia'}
                                </p>
                                {canManage && (
                                    <Button
                                        onClick={() => setIsCreateOpen(true)}
                                        className="rounded-xl h-10 px-6 bg-blue-600 hover:bg-blue-700 shadow-lg font-bold text-sm gap-2 mt-4"
                                    >
                                        <Plus className="h-4 w-4" /> Buat Album
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Create Album Dialog */}
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogContent className="rounded-3xl sm:max-w-[425px] p-6 border-none shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold">Buat Album Baru</DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    Kelompokkan foto dan video sesuai kategori acara.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700">Nama Album</label>
                                    <Input
                                        placeholder="Misal: Outing Kantor 2026"
                                        value={newAlbumTitle}
                                        onChange={(e) => setNewAlbumTitle(e.target.value)}
                                        className="rounded-xl h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700">Deskripsi</label>
                                    <Input
                                        placeholder="Detail acara..."
                                        value={newAlbumDesc}
                                        onChange={(e) => setNewAlbumDesc(e.target.value)}
                                        className="rounded-xl h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700">Visibilitas</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setNewAlbumVisibility('public')}
                                            className={cn(
                                                "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold text-xs",
                                                newAlbumVisibility === 'public'
                                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                                    : "border-slate-200 bg-slate-50 text-slate-500"
                                            )}
                                        >
                                            <Globe className="h-3 w-3" /> Publik
                                        </button>
                                        <button
                                            onClick={() => setNewAlbumVisibility('department')}
                                            className={cn(
                                                "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold text-xs",
                                                newAlbumVisibility === 'department'
                                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                                    : "border-slate-200 bg-slate-50 text-slate-500"
                                            )}
                                        >
                                            <Users className="h-3 w-3" /> Tim
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="rounded-xl font-bold"
                                >
                                    Batal
                                </Button>
                                <Button
                                    onClick={handleCreateAlbum}
                                    disabled={creating || !newAlbumTitle.trim()}
                                    className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-6"
                                >
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Buat
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        );
    }

    // DESKTOP VIEW
    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                <Camera className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900">Album Kenangan</h1>
                        </div>
                        <p className="text-slate-500 font-medium ml-15">Koleksi foto & video kegiatan perusahaan</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                                placeholder="Cari album..."
                                className="pl-11 h-12 w-[280px] rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {canManage && (
                            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 gap-2 font-bold transition-all hover:scale-105 active:scale-95">
                                        <Plus className="h-5 w-5" /> Buat Album
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-[32px] sm:max-w-[425px] p-8 border-none shadow-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-black tracking-tight">Buat Album Baru</DialogTitle>
                                        <DialogDescription className="font-medium text-slate-500 mt-2">
                                            Kelompokkan foto dan video sesuai kategori acara atau proyek.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-6 py-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Nama Album</label>
                                            <Input
                                                placeholder="Misal: Outing Kantor 2026 atau Project A"
                                                value={newAlbumTitle}
                                                onChange={(e) => setNewAlbumTitle(e.target.value)}
                                                className="rounded-xl h-12 border-slate-200"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Deskripsi Singkat</label>
                                            <Input
                                                placeholder="Detail acara atau keterangan lainnya"
                                                value={newAlbumDesc}
                                                onChange={(e) => setNewAlbumDesc(e.target.value)}
                                                className="rounded-xl h-12 border-slate-200"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Visibilitas</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => setNewAlbumVisibility('public')}
                                                    className={cn(
                                                        "flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all font-bold text-sm",
                                                        newAlbumVisibility === 'public'
                                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                                            : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100"
                                                    )}
                                                >
                                                    <Globe className="h-4 w-4" /> Publik
                                                </button>
                                                <button
                                                    onClick={() => setNewAlbumVisibility('department')}
                                                    className={cn(
                                                        "flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all font-bold text-sm",
                                                        newAlbumVisibility === 'department'
                                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                                            : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100"
                                                    )}
                                                >
                                                    <Users className="h-4 w-4" /> Tim Internal
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter className="mt-4">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setIsCreateOpen(false)}
                                            className="rounded-xl font-bold"
                                        >
                                            Batal
                                        </Button>
                                        <Button
                                            onClick={handleCreateAlbum}
                                            disabled={creating || !newAlbumTitle.trim()}
                                            className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-8 shadow-lg shadow-blue-200"
                                        >
                                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Buat Sekarang
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                {/* Categories / Tabs Placeholder */}
                <div className="flex gap-2 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit border border-slate-200/50">
                    <Button variant="ghost" className="rounded-xl bg-white text-blue-600 shadow-sm font-bold px-6 border border-slate-100">Semua Album</Button>
                    <Button variant="ghost" className="rounded-xl text-slate-500 hover:text-slate-700 font-bold px-6">Publik</Button>
                    <Button variant="ghost" className="rounded-xl text-slate-500 hover:text-slate-700 font-bold px-6">Departemen Saya</Button>
                </div>

                {/* Content Section */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-slate-100 rounded-[32px] h-[320px] animate-pulse" />
                        ))}
                    </div>
                ) : filteredAlbums.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {filteredAlbums.map((album) => {
                            const photoCount = album.items?.filter(item => item.file_type === 'photo').length || 0;
                            const videoCount = album.items?.filter(item => item.file_type === 'video').length || 0;
                            const coverImage = album.items?.find(item => item.file_type === 'photo')?.file_url;

                            return (
                                <Card
                                    key={album.id}
                                    className="group relative border-none bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] transition-all duration-500 hover:-translate-y-2 overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-100"
                                    onClick={() => navigate(`/albums/${album.id}`)}
                                >
                                    <CardContent className="p-0 flex flex-col h-full">
                                        {/* Cover Image Area */}
                                        <div className="relative aspect-[4/3] overflow-hidden bg-slate-50 group">
                                            {coverImage ? (
                                                <img
                                                    src={coverImage}
                                                    alt={album.title}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                                                    <ImageIcon className="h-16 w-16 opacity-30 group-hover:scale-110 transition-transform" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Belum Ada Media</span>
                                                </div>
                                            )}

                                            {/* Badge Visibilitas Overlay */}
                                            <div className="absolute top-5 left-5 z-20">
                                                <Badge className={cn(
                                                    "bg-white/90 backdrop-blur-md text-[10px] font-black uppercase tracking-wider px-3 py-1 border-none shadow-sm",
                                                    album.visibility === 'public' ? "text-blue-600" : "text-amber-600"
                                                )}>
                                                    {album.visibility === 'public' ? (
                                                        <div className="flex items-center gap-1.5"><Globe className="h-2.5 w-2.5" /> Publik</div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5"><Users className="h-2.5 w-2.5" /> Tim</div>
                                                    )}
                                                </Badge>
                                            </div>

                                            {/* Dropdown Menu Overlay */}
                                            {canManage && (
                                                <div className="absolute top-5 right-5 z-20" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md border-none">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-xl border-none shadow-2xl p-2 min-w-[160px]">
                                                            <DropdownMenuItem
                                                                className="rounded-lg text-red-600 focus:text-red-700 focus:bg-red-50 font-bold gap-2"
                                                                onClick={() => handleDeleteAlbum(album.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" /> Hapus Album
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            )}

                                            {/* Count Overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between translate-y-2 group-hover:translate-y-0 transition-transform duration-500 opacity-0 group-hover:opacity-100">
                                                <div className="flex gap-4">
                                                    <div className="flex items-center gap-2 text-white">
                                                        <ImageIcon className="h-4 w-4 opacity-70" />
                                                        <span className="text-sm font-black">{photoCount}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Video className="h-4 w-4 opacity-70" />
                                                        <span className="text-sm font-black">{videoCount}</span>
                                                    </div>
                                                </div>
                                                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md text-white">
                                                    <ChevronRight className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Album Content */}
                                        <div className="p-7 space-y-3">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">{album.title}</h3>
                                                <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-2">
                                                    {format(new Date(album.created_at), 'd MMMM yyyy', { locale: idLocale })}
                                                    {album.department && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span className="text-blue-500 uppercase tracking-widest">{album.department.name}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                            <p className="text-sm font-medium text-slate-500 line-clamp-2 leading-relaxed min-h-[40px]">
                                                {album.description || 'Tidak ada deskripsi untuk album ini.'}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 space-y-6 text-center animate-in fade-in slide-in-from-bottom-5 duration-700">
                        <div className="h-32 w-32 bg-slate-100 rounded-[48px] flex items-center justify-center">
                            <FolderOpen className="h-16 w-16 text-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Album Masih Kosong</h3>
                            <p className="text-slate-500 font-medium text-lg max-w-md mx-auto">Mulai abadikan momen berharga perusahaan dengan membuat album pertama Anda hari ini.</p>
                        </div>
                        {canManage && (
                            <Button
                                onClick={() => setIsCreateOpen(true)}
                                className="rounded-2xl h-14 px-10 bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 font-black text-lg gap-2 mt-4"
                            >
                                <Plus className="h-6 w-6" /> Buat Album Sekarang
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
