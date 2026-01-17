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
import { Search, Megaphone, Calendar, ChevronRight, Plus, Loader2, Send, Info, BellRing, ArrowLeft } from 'lucide-react';
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
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Create Announcement State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [sendNotification, setSendNotification] = useState(true);

    const isAdmin = profile?.role === 'admin_hr' || profile?.email?.includes('admin');

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

            // Client-side filtering for non-admins (even if RLS handles it, it's safer/redundant)
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

    const handleCreateAnnouncement = async () => {
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

            // 1. Call RPC to create announcement and bulk notify
            const { error } = await supabase
                .rpc('publish_announcement', {
                    p_title: newTitle,
                    p_content: newContent,
                    p_created_by: user?.id,
                    p_send_notification: sendNotification
                });

            if (error) throw error;

            // 2. Refresh list
            await fetchAnnouncements();

            // 3. Trigger Notification (if checked)
            if (sendNotification) {
                try {
                    const { error: notifError } = await supabase.functions.invoke('send-push-notification', {
                        body: {
                            title: newTitle,
                            body: newContent,
                            topic: 'all_employees'
                        }
                    });

                    if (notifError) console.warn('Push notification invoke failed:', notifError);
                } catch (e) {
                    console.warn('Failed to invoke notification function:', e);
                }
            }

            toast({ title: "Berhasil", description: "Pengumuman berhasil dipublikasikan." });

            setNewTitle('');
            setNewContent('');
            setIsCreateOpen(false);

        } catch (error: any) {
            console.error('Error creating announcement:', error);
            toast({ title: "Gagal", description: error.message || "Gagal membuat pengumuman.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredAnnouncements = announcements.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50 pb-20">
                {/* Header Curve Theme */}
                <div className="absolute top-0 left-0 w-full h-[180px] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                <div className="relative z-10 max-w-4xl mx-auto px-4 pt-6 space-y-6">

                    {/* Header Content */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 text-white mb-6">
                        <div className="flex items-start gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="text-white hover:bg-white/20 hover:text-white shrink-0 -mt-1 rounded-full h-10 w-10"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight mb-1">Pusat Informasi</h1>
                                <p className="text-blue-100 text-sm font-medium opacity-90 leading-relaxed">
                                    Berita terbaru dan pengumuman perusahaan.
                                </p>
                            </div>
                        </div>

                        {isAdmin && (
                            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-white text-blue-600 hover:bg-white/90 shadow-xl shadow-blue-900/20 px-6 py-6 rounded-2xl font-bold text-base transition-all active:scale-95">
                                        <Plus className="mr-2 h-5 w-5" />
                                        Buat Pengumuman
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold">Buat Pengumuman Baru</DialogTitle>
                                        <DialogDescription>
                                            Pengumuman akan dikirim ke seluruh karyawan.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Judul Pengumuman</Label>
                                            <Input
                                                id="title"
                                                placeholder="Contoh: Perubahan Jam Kerja"
                                                value={newTitle}
                                                onChange={(e) => setNewTitle(e.target.value)}
                                                className="rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="content">Isi Pengumuman</Label>
                                            <Textarea
                                                id="content"
                                                placeholder="Tulis detail pengumuman di sini..."
                                                className="min-h-[120px] rounded-xl"
                                                value={newContent}
                                                onChange={(e) => setNewContent(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl">
                                            <Checkbox
                                                id="notify"
                                                checked={sendNotification}
                                                onCheckedChange={(checked) => setSendNotification(checked as boolean)}
                                            />
                                            <Label htmlFor="notify" className="cursor-pointer text-sm font-medium text-slate-700">Kirim Notifikasi Push ke Semua Karyawan</Label>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-slate-500">Batal</Button>
                                        <Button onClick={handleCreateAnnouncement} disabled={isSubmitting} className="rounded-xl bg-blue-600 font-bold">
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="mr-2 h-4 w-4" /> Publikasikan
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>

                    {/* Floating Search Bar */}
                    <Card className="border-none shadow-xl shadow-blue-900/5 rounded-2xl -mt-4 mb-8 bg-white/95 backdrop-blur-sm z-20">
                        <CardContent className="p-2">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    placeholder="Cari berita atau pengumuman..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-12 h-14 bg-transparent border-none shadow-none focus-visible:ring-0 text-base placeholder:text-slate-400"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content Grid */}
                    {loading ? (
                        <div className="grid gap-6 md:grid-cols-2">
                            {[1, 2, 3, 4].map(i => (
                                <Skeleton key={i} className="h-56 w-full rounded-3xl" />
                            ))}
                        </div>
                    ) : filteredAnnouncements.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Featured / Latest Item */}
                            <Card className="md:col-span-2 border-none shadow-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-[32px] overflow-hidden relative group cursor-pointer hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-white/20 transition-all" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/30 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />

                                <CardContent className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row gap-8 items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Badge className="bg-white/20 text-white border-none backdrop-blur-sm px-3 py-1">
                                                Terbaru
                                            </Badge>
                                            <span className="text-blue-200 text-xs font-medium flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(filteredAnnouncements[0].created_at), 'd MMMM yyyy', { locale: id })}
                                            </span>
                                        </div>

                                        <h2 className="text-2xl md:text-3xl font-black mb-4 leading-tight tracking-tight">
                                            {filteredAnnouncements[0].title}
                                        </h2>
                                        <p className="text-indigo-100 text-sm md:text-base line-clamp-3 mb-6 leading-relaxed opacity-90 font-medium">
                                            {filteredAnnouncements[0].content}
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" className="text-white bg-white/10 hover:bg-white/20 rounded-xl px-4 h-10 font-bold text-xs">
                                                Baca Selengkapnya
                                                <ChevronRight className="ml-1 h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex h-14 w-14 rounded-2xl bg-white/10 border border-white/10 items-center justify-center shrink-0 shadow-inner">
                                        <Megaphone className="h-7 w-7 text-white" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Standard Items */}
                            {filteredAnnouncements.slice(1).map((ann) => (
                                <Card key={ann.id} className="border-none shadow-sm hover:shadow-lg bg-white rounded-3xl overflow-hidden transition-all duration-300 group border border-slate-100">
                                    <CardHeader className="p-6 pb-2">
                                        <div className="flex justify-between items-start mb-3">
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                                Info
                                            </Badge>
                                            <span className="text-xs text-slate-400 font-medium">
                                                {format(new Date(ann.created_at), 'd MMM yyyy', { locale: id })}
                                            </span>
                                        </div>
                                        <CardTitle className="text-lg font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                                            {ann.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 pt-2">
                                        <CardDescription className="line-clamp-3 text-slate-500 mb-4 h-[4.5em] leading-relaxed">
                                            {ann.content}
                                        </CardDescription>
                                        <div className="flex justify-end">
                                            <Button variant="link" className="p-0 h-auto text-blue-600 font-bold text-xs flex items-center gap-1 hover:no-underline group/btn">
                                                Baca Detail <ChevronRight className="h-3 w-3 group-hover/btn:translate-x-1 transition-transform" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Info className="h-10 w-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Belum ada pengumuman</h3>
                            <p className="text-slate-500 mt-2 max-w-xs mx-auto">
                                {searchQuery ? 'Coba kata kunci pencarian lain.' : 'Saat ini belum ada informasi terbaru dari perusahaan.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
