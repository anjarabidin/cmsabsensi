import { useState, useEffect } from 'react';
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
import { Search, Megaphone, Calendar, ChevronRight } from 'lucide-react';

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
    const { profile } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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

    const filteredAnnouncements = announcements.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto space-y-8 px-4 md:px-0 pt-[calc(1.5rem+env(safe-area-inset-top))] md:pt-8 pb-20">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pusat Informasi</h1>
                        <p className="text-slate-500 mt-1 font-medium">Berita terbaru dan pengumuman perusahaan.</p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Cari berita atau pengumuman..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 bg-white rounded-xl border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                </div>

                {/* Content Grid */}
                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                        ))}
                    </div>
                ) : filteredAnnouncements.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Featured / Latest Item */}
                        {filteredAnnouncements.length > 0 && (
                            <Card className="md:col-span-2 border-none shadow-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-[32px] overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                <CardContent className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row gap-8 items-start">
                                    <div className="flex-1">
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-4 backdrop-blur-sm">
                                            Terbaru
                                        </Badge>
                                        {isAdmin && filteredAnnouncements[0].expires_at && new Date(filteredAnnouncements[0].expires_at) < new Date() && (
                                            <Badge variant="destructive" className="ml-2 mb-4 bg-red-500/80 border-none animate-pulse">
                                                Expired
                                            </Badge>
                                        )}
                                        {isAdmin && !filteredAnnouncements[0].is_active && (
                                            <Badge variant="outline" className="ml-2 mb-4 bg-white/20 text-white border-white/40">
                                                Inactive
                                            </Badge>
                                        )}
                                        <h2 className="text-2xl md:text-4xl font-black mb-4 leading-tight">
                                            {filteredAnnouncements[0].title}
                                        </h2>
                                        <p className="text-blue-100 text-sm md:text-base line-clamp-3 mb-6 leading-relaxed opacity-90">
                                            {filteredAnnouncements[0].content}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-200 uppercase tracking-wider">
                                            <Calendar className="h-4 w-4" />
                                            {format(new Date(filteredAnnouncements[0].created_at), 'd MMMM yyyy', { locale: id })}
                                        </div>
                                    </div>
                                    <div className="hidden md:flex h-12 w-12 rounded-full bg-white/10 items-center justify-center shrink-0">
                                        <Megaphone className="h-6 w-6 text-white" />
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {filteredAnnouncements.slice(1).map((ann) => (
                            <Card key={ann.id} className="border-none shadow-md bg-white rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                <CardHeader className="p-6 pb-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            Info
                                        </Badge>
                                        {isAdmin && ann.expires_at && new Date(ann.expires_at) < new Date() && (
                                            <Badge variant="destructive" className="ml-2 animate-pulse">
                                                Expired
                                            </Badge>
                                        )}
                                        {isAdmin && !ann.is_active && (
                                            <Badge variant="outline" className="ml-2 bg-slate-100">
                                                Inactive
                                            </Badge>
                                        )}
                                        <span className="text-xs text-slate-400 font-medium">
                                            {format(new Date(ann.created_at), 'd MMM yyyy', { locale: id })}
                                        </span>
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors">
                                        {ann.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 pt-2">
                                    <CardDescription className="line-clamp-3 text-slate-500 mb-4 h-[4.5em]">
                                        {ann.content}
                                    </CardDescription>
                                    <Button variant="link" className="p-0 h-auto text-blue-600 font-bold text-xs flex items-center gap-1 hover:no-underline">
                                        Baca Selengkapnya <ChevronRight className="h-3 w-3" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Tidak ada pengumuman</h3>
                        <p className="text-slate-500">Coba kata kunci lain atau kembali lagi nanti.</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
