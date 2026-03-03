import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
    Bell,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronLeft,
    UserPlus,
    MailOpen,
    Trash2,
    Search,
    Filter,
    X,
    FilterX
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'leave' | 'overtime' | 'payroll' | 'system' | 'onboarding';
    read: boolean;
    created_at: string;
    link?: string;
}

import { useIsMobile } from '@/hooks/useIsMobile';

export default function NotificationsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterRead, setFilterRead] = useState<'all' | 'unread'>('all');

    useEffect(() => {
        if (user?.id) {
            fetchNotifications();
        }
    }, [user?.id]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user?.id)
                .eq('read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            toast({ title: "Semua notifikasi ditandai telah dibaca" });
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== id));
            toast({ title: "Notifikasi dihapus" });
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const deleteAllNotifications = async () => {
        if (!confirm('Hapus semua notifikasi? Tindakan ini tidak bisa dibatalkan.')) return;
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user?.id);
            if (error) throw error;
            setNotifications([]);
            toast({ title: 'Semua notifikasi dihapus' });
        } catch {
            toast({ title: 'Gagal', description: 'Tidak dapat menghapus notifikasi', variant: 'destructive' });
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'leave': return <Clock className="h-5 w-5 text-amber-500" />;
            case 'overtime': return <Clock className="h-5 w-5 text-purple-500" />;
            case 'payroll': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            case 'onboarding': return <UserPlus className="h-5 w-5 text-blue-500" />;
            default: return <Bell className="h-5 w-5 text-slate-400" />;
        }
    };

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.message.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || n.type === filterType;
        const matchesRead = filterRead === 'all' || (filterRead === 'unread' && !n.read);
        const isPushOnly = n.type && n.type.startsWith('push_');
        return matchesSearch && matchesType && matchesRead && !isPushOnly;
    });

    const categories = [
        { id: 'all', label: 'Semua', icon: Filter },
        { id: 'leave', label: 'Cuti', icon: Clock },
        { id: 'overtime', label: 'Lembur', icon: Clock },
        { id: 'payroll', label: 'Gaji', icon: CheckCircle2 },
        { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    ];

    // -------------------------------------------------------------------------
    // RENDER: MOBILE VIEW (STRICT PRESERVATION)
    // -------------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20">
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-900 dark:to-cyan-900 rounded-b-[40px] z-0" />

                    <div className="relative z-10 max-w-2xl mx-auto px-4 pt-[calc(1rem+env(safe-area-inset-top))] space-y-6">
                        <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(-1)}
                                    className="text-white hover:bg-white/20 h-8 w-8"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <h1 className="text-xl font-bold">Notifikasi</h1>
                            </div>
                            <div className="flex items-center gap-1">
                                {notifications.some(n => !n.read) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={markAllAsRead}
                                        className="text-white hover:bg-white/20 text-xs font-bold"
                                    >
                                        <MailOpen className="h-4 w-4 mr-1" />
                                        Baca
                                    </Button>
                                )}
                                {notifications.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={deleteAllNotifications}
                                        className="text-white/80 hover:bg-white/20 hover:text-white text-xs font-bold"
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Hapus
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Search & Essential Filters */}
                            <div className="flex flex-col gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    <Input
                                        placeholder="Cari notifikasi..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 h-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-none shadow-sm rounded-2xl focus-visible:ring-blue-500/30 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
                                        >
                                            <X className="h-3 w-3 text-slate-400" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    <Button
                                        variant={filterRead === 'all' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterRead('all')}
                                        className={`rounded-full h-8 text-xs px-4 border-none shadow-sm ${filterRead === 'all' ? 'bg-blue-600 dark:bg-blue-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        Semua
                                    </Button>
                                    <Button
                                        variant={filterRead === 'unread' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterRead('unread')}
                                        className={`rounded-full h-8 text-xs px-4 border-none shadow-sm relative ${filterRead === 'unread' ? 'bg-blue-600 dark:bg-blue-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        Belum Dibaca
                                        {notifications.filter(n => !n.read).length > 0 && (
                                            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                        )}
                                    </Button>
                                    <div className="h-4 w-[1px] bg-slate-200 mx-1 flex-shrink-0" />
                                    {categories.map((cat) => (
                                        <Button
                                            key={cat.id}
                                            variant={filterType === cat.id ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setFilterType(cat.id)}
                                            className={`rounded-full h-8 text-xs px-4 border-none shadow-sm flex-shrink-0 ${filterType === cat.id ? 'bg-indigo-600 dark:bg-indigo-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                        >
                                            {cat.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <Card key={i} className="animate-pulse border-none shadow-sm rounded-2xl h-24" />
                                ))
                            ) : filteredNotifications.length === 0 ? (
                                <Card className="border-none shadow-md rounded-3xl p-12 flex flex-col items-center text-center space-y-4 bg-white/80 backdrop-blur-md">
                                    <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center">
                                        {searchTerm || filterType !== 'all' || filterRead !== 'all' ? (
                                            <FilterX className="h-10 w-10 text-slate-200" />
                                        ) : (
                                            <Bell className="h-10 w-10 text-slate-200" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            {searchTerm || filterType !== 'all' || filterRead !== 'all' ? 'Hasil Tidak Ditemukan' : 'Belum Ada Notifikasi'}
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            {searchTerm || filterType !== 'all' || filterRead !== 'all'
                                                ? 'Coba sesuaikan kata kunci atau filter Anda.'
                                                : 'Semua pemberitahuan akan muncul di sini.'}
                                        </p>
                                    </div>
                                    {(searchTerm || filterType !== 'all' || filterRead !== 'all') && (
                                        <Button
                                            onClick={() => {
                                                setSearchTerm('');
                                                setFilterType('all');
                                                setFilterRead('all');
                                            }}
                                            variant="ghost"
                                            className="rounded-xl text-blue-600 hover:text-blue-700"
                                        >
                                            Reset Filter
                                        </Button>
                                    )}
                                </Card>
                            ) : (
                                filteredNotifications.map((n) => (
                                    <Card
                                        key={n.id}
                                        className={`border-none shadow-sm rounded-2xl transition-all active:scale-[0.98] ${!n.read ? 'bg-white dark:bg-slate-800 ring-2 ring-blue-50 dark:ring-blue-900/30' : 'bg-slate-50/50 dark:bg-slate-900/50 opacity-80'}`}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex gap-4">
                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-800'}`}>
                                                    {getIcon(n.type)}
                                                </div>
                                                <div className="flex-1 min-w-0" onClick={() => {
                                                    markAsRead(n.id);
                                                    if (n.link) navigate(n.link);
                                                }}>
                                                    <div className="flex items-center justify-between">
                                                        <h4 className={`text-sm tracking-tight ${!n.read ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-600 dark:text-slate-400'}`}>
                                                            {n.title}
                                                        </h4>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {format(new Date(n.created_at), 'dd/MM, HH:mm', { locale: id })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                                                        {n.message}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-300 hover:text-red-500"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(n.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: DESKTOP PREMIUM VIEW
    // -------------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-8 px-4 py-8 min-h-screen">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Pusat Notifikasi</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg">Kelola semua pemberitahuan dan informasi penting Anda.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {notifications.some(n => !n.read) && (
                            <Button
                                onClick={markAllAsRead}
                                className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm font-bold gap-2 rounded-xl h-12 px-6"
                            >
                                <MailOpen className="h-5 w-5 text-blue-500" />
                                Tandai Semua Dibaca
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                onClick={deleteAllNotifications}
                                variant="ghost"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/30 font-bold gap-2 rounded-xl h-12 px-6"
                            >
                                <Trash2 className="h-5 w-5" />
                                Hapus Semua
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-start">
                    {/* LEFT SIDEBAR: FILTERS */}
                    <div className="lg:col-span-4 sticky top-24 space-y-6">
                        <Card className="rounded-[32px] border-none shadow-xl shadow-slate-200/40 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 p-6">
                                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Filter className="h-5 w-5 text-blue-600" /> Filter & Pencarian
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cari</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Kata kunci..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            variant={filterRead === 'all' ? 'default' : 'ghost'}
                                            onClick={() => setFilterRead('all')}
                                            className={`justify-start h-10 rounded-xl font-medium ${filterRead === 'all' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Semua Notifikasi
                                        </Button>
                                        <Button
                                            variant={filterRead === 'unread' ? 'default' : 'ghost'}
                                            onClick={() => setFilterRead('unread')}
                                            className={`justify-start h-10 rounded-xl font-medium ${filterRead === 'unread' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Belum Dibaca
                                            {notifications.filter(n => !n.read).length > 0 && (
                                                <Badge className="ml-auto bg-red-500 hover:bg-red-600 text-white border-none h-5 px-1.5 min-w-[20px] justify-center">
                                                    {notifications.filter(n => !n.read).length}
                                                </Badge>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kategori</label>
                                    <div className="space-y-1">
                                        {categories.map((cat) => (
                                            <Button
                                                key={cat.id}
                                                variant={filterType === cat.id ? 'secondary' : 'ghost'}
                                                onClick={() => setFilterType(cat.id)}
                                                className={`w-full justify-start h-10 rounded-xl font-medium ${filterType === cat.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                                            >
                                                <cat.icon className="mr-3 h-4 w-4 opacity-70" />
                                                {cat.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT LIST: NOTIFICATONS */}
                    <div className="lg:col-span-8 space-y-4">
                        {loading ? (
                            [1, 2, 3, 4].map(i => (
                                <Card key={i} className="animate-pulse border-none shadow-sm rounded-2xl h-24" />
                            ))
                        ) : filteredNotifications.length === 0 ? (
                            <div className="py-24 text-center space-y-6 bg-slate-50/50 rounded-[32px] border border-dashed border-slate-200">
                                <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                                    <Bell className="h-10 w-10 text-slate-300" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Tidak ada notifikasi</h3>
                                    <p className="text-slate-500 mt-1">
                                        {searchTerm || filterType !== 'all' || filterRead !== 'all'
                                            ? 'Coba ubah filter pencarian Anda.'
                                            : 'Semua aman! Tidak ada pemberitahuan baru.'}
                                    </p>
                                </div>
                                {(searchTerm || filterType !== 'all' || filterRead !== 'all') && (
                                    <Button onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterRead('all'); }} variant="outline" className="rounded-xl border-slate-200 text-slate-600">
                                        Bersihkan Filter
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredNotifications.map((n) => (
                                    <Card
                                        key={n.id}
                                        onClick={() => {
                                            markAsRead(n.id);
                                            if (n.link) navigate(n.link);
                                        }}
                                        className={`group border-none shadow-sm hover:shadow-md transition-all rounded-2xl cursor-pointer overflow-hidden relative ${!n.read ? 'bg-white dark:bg-slate-800 ring-1 ring-blue-100 dark:ring-blue-900 shadow-blue-100 dark:shadow-none' : 'bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800'}`}
                                    >
                                        {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />}
                                        <CardContent className="p-6 flex items-start gap-5">
                                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${!n.read ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'}`}>
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h4 className={`text-base leading-tight mb-1 ${!n.read ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
                                                            {n.title}
                                                        </h4>
                                                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                                            {n.message}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg">
                                                        {format(new Date(n.created_at), 'd MMM, HH:mm', { locale: id })}
                                                    </span>
                                                </div>

                                                <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 px-3 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg gap-1 ml-auto"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(n.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" /> Hapus
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
