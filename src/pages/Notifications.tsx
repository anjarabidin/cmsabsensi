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

export default function NotificationsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
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
        return matchesSearch && matchesType && matchesRead;
    });

    const categories = [
        { id: 'all', label: 'Semua', icon: Filter },
        { id: 'leave', label: 'Cuti', icon: Clock },
        { id: 'overtime', label: 'Lembur', icon: Clock },
        { id: 'payroll', label: 'Gaji', icon: CheckCircle2 },
        { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    ];

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50 pb-20">
                <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0" />

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
                        <div className="flex items-center gap-2">
                            {notifications.some(n => !n.read) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={markAllAsRead}
                                    className="text-white hover:bg-white/20 text-xs font-bold"
                                >
                                    <MailOpen className="h-4 w-4 mr-2" />
                                    Baca Semua
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    if (Capacitor.isNativePlatform()) {
                                        try {
                                            const perm = await LocalNotifications.checkPermissions();
                                            if (perm.display !== 'granted') {
                                                await LocalNotifications.requestPermissions();
                                            }
                                            await LocalNotifications.schedule({
                                                notifications: [
                                                    {
                                                        title: "CMS Duta Solusi",
                                                        body: "Sistem notifikasi Anda telah aktif! 🚀",
                                                        id: 1,
                                                        schedule: { at: new Date(Date.now() + 1000) },
                                                        sound: undefined,
                                                        attachments: undefined,
                                                        extra: null
                                                    }
                                                ]
                                            });
                                        } catch (e) {
                                            console.error('Local Notification Error:', e);
                                        }
                                    } else {
                                        import('sonner').then(({ toast }) => {
                                            toast.success('Test Notifikasi', {
                                                description: 'Notifikasi browser berfungsi dengan baik! 🎉'
                                            });
                                        });
                                    }
                                }}
                                className="text-white hover:bg-white/20 text-xs font-bold"
                            >
                                <Bell className="h-4 w-4 mr-2" />
                                Test
                            </Button>
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
                                    className="pl-10 h-12 bg-white/80 backdrop-blur-sm border-none shadow-sm rounded-2xl focus-visible:ring-blue-500/30 transition-all"
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
                                    className={`rounded-full h-8 text-xs px-4 border-none shadow-sm ${filterRead === 'all' ? 'bg-blue-600' : 'bg-white text-slate-600'}`}
                                >
                                    Semua
                                </Button>
                                <Button
                                    variant={filterRead === 'unread' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterRead('unread')}
                                    className={`rounded-full h-8 text-xs px-4 border-none shadow-sm relative ${filterRead === 'unread' ? 'bg-blue-600' : 'bg-white text-slate-600'}`}
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
                                        className={`rounded-full h-8 text-xs px-4 border-none shadow-sm flex-shrink-0 ${filterType === cat.id ? 'bg-indigo-600' : 'bg-white text-slate-600'}`}
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
                                    className={`border-none shadow-sm rounded-2xl transition-all active:scale-[0.98] ${!n.read ? 'bg-white ring-2 ring-blue-50' : 'bg-slate-50/50 opacity-80'}`}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex gap-4">
                                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${!n.read ? 'bg-blue-50' : 'bg-white'}`}>
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="flex-1 min-w-0" onClick={() => {
                                                markAsRead(n.id);
                                                if (n.link) navigate(n.link);
                                            }}>
                                                <div className="flex items-center justify-between">
                                                    <h4 className={`text-sm tracking-tight ${!n.read ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                                                        {n.title}
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {format(new Date(n.created_at), 'dd/MM, HH:mm', { locale: id })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
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
