import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Clock,
  Calendar,
  ArrowRight,
  Briefcase,
  AlertCircle,
  MoreHorizontal,
  Plus,
  Megaphone,
  Trash,
  X,
  Wallet,
  Users,
  Settings as SettingsIcon,
  Receipt,
  FileText,
  ChevronRight,
  LogOut,
  Info,
  ClipboardCheck,
  MapPin,
  BarChart3,
  DollarSign,
  TrendingUp,
  StickyNote
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance } from '@/types';
import { DashboardCharts } from '@/components/charts/DashboardCharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

import { NotificationBell } from '@/components/notifications/NotificationBell';
import { getDailyArticles } from '@/lib/articles';
import { AppLogo } from '@/components/AppLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
};

type UpcomingActivity = {
  id: string;
  type: 'agenda' | 'note';
  title: string;
  time: string;
  location?: string;
  is_completed?: boolean;
};

export default function Dashboard() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [stats, setStats] = useState({ present: 0, late: 0, leave: 0, overtime: 0 });
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);

  // Announcement Form State
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    expires_at: '' // Default to empty (never expires)
  });
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  // Allow admin_hr OR any email containing 'admin' (for dev convenience)
  const isAdmin = profile?.role === 'admin_hr' || profile?.email?.includes('admin');

  useEffect(() => {
    fetchDashboardData();
  }, [user?.id]);

  const fetchDashboardData = async () => {
    try {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

      let announcementQuery = supabase.from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!isAdmin) {
        announcementQuery = announcementQuery.eq('is_active', true);
      }

      const [todayRes, scheduleRes, monthRes, announcementsRes] = await Promise.all([
        supabase.from('attendances').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        (supabase.from('employee_schedules') as any).select('*, shift:shifts(*)').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('attendances').select('*').eq('user_id', user.id).gte('date', startOfMonth).lte('date', today),
        announcementQuery
      ]);

      setTodayAttendance(todayRes.data as Attendance | null);
      setTodaySchedule(scheduleRes.data);

      if (announcementsRes.data) {
        const filteredAnnouncements = isAdmin ? (announcementsRes.data as Announcement[]) : (announcementsRes.data as Announcement[]).filter(a => {
          if (!a.is_active) return false;
          if (!a.expires_at) return true;
          return new Date(a.expires_at) > new Date();
        });
        setAnnouncements(filteredAnnouncements);
      }

      if (monthRes.data) {
        setStats({
          present: monthRes.data.filter(a => a.status === 'present').length,
          late: monthRes.data.filter(a => a.is_late).length,
          leave: monthRes.data.filter(a => a.status === 'leave').length,
          overtime: monthRes.data.reduce((acc, a) => acc + (a.work_hours_minutes && a.work_hours_minutes > 480 ? 1 : 0), 0),
        });
      }

      // Fetch Upcoming Activities (Agenda & Notes)
      const now = new Date().toISOString();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const endOfTodayISO = endOfToday.toISOString();

      const [agendaRes, notesRes] = await Promise.all([
        supabase.from('agendas')
          .select('*, agenda_participants!inner(user_id)')
          .eq('agenda_participants.user_id', user.id)
          .gte('start_time', now)
          .lte('start_time', endOfTodayISO)
          .order('start_time', { ascending: true }),
        supabase.from('personal_reminders' as any)
          .select('*')
          .eq('user_id', user.id)
          .eq('is_completed', false)
          .gte('remind_at', now)
          .lte('remind_at', endOfTodayISO)
          .order('remind_at', { ascending: true })
      ]);

      const agendaActivities: UpcomingActivity[] = (agendaRes.data || []).map(a => ({
        id: a.id,
        type: 'agenda',
        title: a.title,
        time: a.start_time,
        location: a.location
      }));

      const noteActivities: UpcomingActivity[] = (notesRes.data || []).map(n => ({
        id: n.id,
        type: 'note',
        title: n.title,
        time: n.remind_at,
        is_completed: n.is_completed
      }));

      setUpcomingActivities([...agendaActivities, ...noteActivities].sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
      ).slice(0, 3));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      toast({ title: "Error", description: "Judul dan isi pengumuman wajib diisi", variant: "destructive" });
      return;
    }

    setSubmittingAnnouncement(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        expires_at: announcementForm.expires_at || null,
        created_by: user?.id
      });

      if (error) throw error;

      toast({ title: "Berhasil", description: "Pengumuman berhasil dibuat" });
      setAnnouncementOpen(false);
      setAnnouncementForm({ title: '', content: '', expires_at: '' });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Error", description: "Gagal membuat pengumuman", variant: "destructive" });
    } finally {
      setSubmittingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Pengumuman dihapus" });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Error", description: "Gagal menghapus pengumuman", variant: "destructive" });
    }
  };

  if (loading) return <DashboardLayout><div className="p-4 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div></DashboardLayout>;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  // -------------------------------------------------------------------------
  // RENDER MOBILE LAYOUT (Unified JKN Style adapted for Mobile)
  // -------------------------------------------------------------------------
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="relative">
          {/* Custom Background Header for Mobile Feel - More compact while keeping Avatar large */}
          <div className="absolute top-0 left-0 w-full h-[calc(100px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[32px] z-0 shadow-lg" />

          <div className="relative z-10 space-y-3 max-w-5xl mx-auto pb-24">
            {/* Header Section - Compact but Heroic */}
            <div className="flex items-center justify-between pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 px-4 text-white">
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0" onClick={() => navigate('/profile')}>
                  <div className="absolute -inset-1.5 bg-white/20 rounded-full blur-md group-active:bg-white/40 transition-all" />
                  <Avatar className="h-[76px] w-[76px] border-2 border-white/95 shadow-2xl relative mt-1">
                    <AvatarImage src={profile?.avatar_url || ''} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-white text-blue-600 font-black">
                      {profile?.full_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-blue-50 font-bold opacity-80 uppercase tracking-widest leading-none mb-1">{getGreeting()} 👋</p>
                  <h1 className="text-base font-black tracking-tight text-white drop-shadow-md leading-none truncate">{profile?.full_name?.split(' ')[0]}</h1>
                  <p className="text-[8px] text-white/70 font-bold mt-1.5 bg-black/20 px-2 py-0.5 rounded-full inline-block backdrop-blur-sm border border-white/10 uppercase tracking-tighter">
                    {profile?.employee_id || 'ID: --'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/notifications')}
                  className="text-white hover:bg-white/20 text-[10px] font-bold h-7 px-2"
                >
                  Lihat Semua
                </Button>
                <NotificationBell iconClassName="text-white h-6 w-6" />
              </div>
            </div>

            {/* Main Features Grid - Compact Style */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 -mt-1 mx-3 relative z-20">
              <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <div className="h-1 w-3 bg-blue-500 rounded-full" /> Menu Karyawan
              </h3>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center">
                <MenuGridItem href="/attendance" icon={Clock} label="Absen" color="text-blue-600" bg="bg-blue-50" />
                <MenuGridItem href="/history" icon={Calendar} label="Riwayat" color="text-purple-600" bg="bg-purple-50" />
                <MenuGridItem href="/leave" icon={FileText} label="Cuti" color="text-orange-600" bg="bg-orange-50" />
                <MenuGridItem href="/overtime" icon={Clock} label="Lembur" color="text-red-500" bg="bg-red-50" />
                <MenuGridItem href="/agenda" icon={Calendar} label="Agenda" color="text-indigo-600" bg="bg-indigo-50" />
                <MenuGridItem href="/notes" icon={StickyNote} label="Catatan" color="text-yellow-600" bg="bg-yellow-100/50" />

                <MenuGridItem href="/reimbursement" icon={Receipt} label="Klaim" color="text-emerald-600" bg="bg-emerald-50" isComingSoon />
                <MenuGridItem href="/salary-slips" icon={Wallet} label="Gaji" color="text-teal-600" bg="bg-teal-50" isComingSoon />
                <MenuGridItem href="/profile" icon={SettingsIcon} label="Profil" color="text-slate-600" bg="bg-slate-50" />
              </div>

              {/* Upcoming Activities Section (NEW) */}
              {upcomingActivities.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-50">
                  <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-3 bg-indigo-500 rounded-full" /> Kegiatan Mendatang
                    </div>
                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Hari Ini</span>
                  </h3>
                  <div className="space-y-2">
                    {upcomingActivities.map((act) => (
                      <div
                        key={act.id}
                        onClick={() => navigate(act.type === 'agenda' ? '/agenda' : '/notes')}
                        className="flex items-center gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all cursor-pointer group"
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          act.type === 'agenda' ? "bg-indigo-100 text-indigo-600" : "bg-yellow-100 text-yellow-600"
                        )}>
                          {act.type === 'agenda' ? <ClipboardCheck className="h-5 w-5" /> : <StickyNote className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{act.title}</h4>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(act.time), 'HH:mm')}</span>
                            {act.location && (
                              <>
                                <span>•</span>
                                <span className="line-clamp-1">{act.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Section - Only Visible to HR/Manager */}
              {(profile?.role === 'admin_hr' || profile?.role === 'manager') && (
                <>
                  <div className="my-4 border-t border-slate-100" />
                  <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <div className="h-1 w-3 bg-purple-500 rounded-full" /> Menu Admin
                  </h3>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center">
                    <MenuGridItem href="/team-map" icon={Users} label="Pantau" color="text-cyan-600" bg="bg-cyan-50" />
                    <MenuGridItem href="/employees" icon={Users} label="Staff" color="text-indigo-600" bg="bg-indigo-50" roles={['admin_hr']} />
                    <MenuGridItem href="/shifts" icon={Clock} label="Shift" color="text-pink-600" bg="bg-pink-50" roles={['admin_hr']} />
                    <MenuGridItem href="/approvals" icon={ClipboardCheck} label="Approval" color="text-amber-600" bg="bg-amber-50" />
                    <MenuGridItem href="/payroll" icon={DollarSign} label="Payroll" color="text-green-600" bg="bg-green-50" roles={['admin_hr']} />
                    <MenuGridItem href="/locations" icon={MapPin} label="Lokasi" color="text-rose-600" bg="bg-rose-50" roles={['admin_hr']} />
                    <MenuGridItem href="/reports" icon={BarChart3} label="Laporan" color="text-slate-600" bg="bg-slate-50" />
                  </div>
                </>
              )}
            </div>

            {/* Info Banner Carousel / Grid */}
            <div className="mx-3 md:mx-0">
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                {/* Attendance Summary Slide */}
                <div className="w-[85vw] md:w-full h-[120px] rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-3 text-white shadow-lg shadow-blue-900/10 flex flex-col justify-between shrink-0 relative overflow-hidden transition-all active:scale-95">
                  <div className="absolute right-0 top-0 h-20 w-20 bg-white/10 rounded-bl-full -mr-4 -mt-4" />
                  <div>
                    <p className="text-[10px] font-medium text-blue-100 mb-0.5">Status Hari Ini</p>
                    <h3 className="text-lg font-bold">
                      {todaySchedule?.is_day_off
                        ? 'Hari Libur'
                        : todayAttendance
                          ? (todayAttendance.clock_out ? 'Sudah Pulang' : 'Sedang Bekerja')
                          : 'Belum Absen'}
                    </h3>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] text-blue-200 uppercase tracking-widest">Waktu</p>
                      <p className="font-mono text-base font-bold">
                        {todaySchedule?.is_day_off
                          ? '🏖️'
                          : todayAttendance
                            ? format(new Date(todayAttendance.clock_in), 'HH:mm')
                            : '--:--'}
                      </p>
                    </div>
                    {!todaySchedule?.is_day_off && (
                      <Button size="sm" variant="secondary" className="h-8 text-xs bg-white text-blue-700 hover:bg-blue-50 border-0" asChild>
                        <Link to="/attendance">{todayAttendance && !todayAttendance.clock_out ? 'Clock Out' : 'Absen'}</Link>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Announcement Slide */}
                {announcements.length > 0 ? (
                  announcements.map((ann, idx) => (
                    <div key={ann.id} className="w-[85vw] md:w-full h-[140px] rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex flex-col justify-between shrink-0 transition-all hover:shadow-md">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Megaphone className="h-4 w-4 text-orange-500" />
                          <span className="text-[10px] font-bold text-orange-500 uppercase bg-orange-50 px-2 py-0.5 rounded-full">Info</span>
                        </div>
                        <h4 className="font-bold text-slate-800 line-clamp-2">{ann.title}</h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.content}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 text-right">{format(new Date(ann.created_at), 'd MMM yyyy')}</p>
                    </div>
                  ))
                ) : (
                  <div className="w-[85vw] md:w-full h-[140px] rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 p-4 flex flex-col items-center justify-center text-center shrink-0">
                    <Info className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Tidak ada pengumuman baru</p>
                  </div>
                )}
              </div>
            </div>

            {/* Article / News Section */}
            <div className="mx-2 mb-20">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-bold text-slate-800">Artikel & Berita</h3>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600" onClick={() => setAnnouncementOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Tambah
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(() => {
                  const dailyArticles = getDailyArticles();
                  const combinedFeed = [
                    ...announcements.map(a => ({
                      id: a.id,
                      category: 'Pengumuman',
                      title: a.title,
                      content: a.content,
                      date: format(new Date(a.created_at), 'd MMM', { locale: id }),
                      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(a.title)}&background=random&color=fff&size=128`,
                      onClick: () => { },
                      onDelete: isAdmin ? () => handleDeleteAnnouncement(a.id) : undefined
                    })),
                    ...dailyArticles.slice(0, 4) // Always show top 4 daily articles as fillers
                  ];

                  // Limit total items displayed to keep UI clean
                  const displayItems = combinedFeed.slice(0, 6);

                  if (displayItems.length === 0) {
                    return (
                      <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                        Belum ada berita hari ini.
                      </div>
                    );
                  }

                  return displayItems.map((item) => (
                    <NewsItem
                      key={item.id}
                      category={item.category}
                      title={item.title}
                      date={item.date}
                      image={item.image}
                      onClick={() => setSelectedArticle(item)}
                      onDelete={item.onDelete}
                    />
                  ));
                })()}
              </div>

              {/* Article Detail Dialog */}
              <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto !rounded-3xl border-0 shadow-2xl">
                  {selectedArticle && (
                    <>
                      <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">{selectedArticle.category}</span>
                          <span className="text-[10px] text-slate-400">{selectedArticle.date}</span>
                        </div>
                        <DialogTitle className="text-xl leading-snug">{selectedArticle.title}</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4 py-2">
                        <img src={selectedArticle.image} alt="" className="w-full h-48 object-cover rounded-2xl bg-slate-100 shadow-inner" />
                        <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-line">
                          {selectedArticle.content}
                        </p>

                        {/* Direct Link to Google Search for Infinite Reading */}
                        {selectedArticle.is_generated && (
                          <div className="pt-4 border-t border-slate-100">
                            <Button
                              variant="outline"
                              className="w-full h-12 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 transition-all active:scale-95"
                              onClick={() => {
                                window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedArticle.title)}`, '_blank');
                              }}
                            >
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Baca Selengkapnya di Google
                            </Button>
                            <p className="text-[10px] text-center text-slate-400 mt-2">
                              Temukan sumber dan artikel terkait lebih lengkap via Google Search.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>

              {/* Create Announcement Dialog */}
              <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Buat Pengumuman Baru</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Judul</label>
                      <Input
                        placeholder="Judul pengumuman..."
                        value={announcementForm.title}
                        onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Isi Konten</label>
                      <Textarea
                        placeholder="Tulis isi pengumuman di sini..."
                        className="min-h-[100px]"
                        value={announcementForm.content}
                        onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tampil Sampai (Opsional)</label>
                      <Input
                        type="datetime-local"
                        value={announcementForm.expires_at}
                        onChange={e => setAnnouncementForm({ ...announcementForm, expires_at: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-500">Jika dikosongkan, pengumuman akan tampil selamanya.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Batal</Button>
                    <Button onClick={handleCreateAnnouncement} disabled={submittingAnnouncement} className="bg-blue-600">
                      {submittingAnnouncement ? 'Menyimpan...' : 'Posting Berita'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER DESKTOP LAYOUT (Unified)
  // -------------------------------------------------------------------------
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Desktop Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{getGreeting()}, {profile?.full_name}</h1>
            <p className="text-slate-500 mt-1 font-medium">Selamat datang kembali di sistem HRIS.</p>
          </div>
        </div>

        {/* Desktop Statistics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Kehadiran</p>
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.present}</div>
              <p className="text-xs text-slate-400 mt-1">Tepat waktu bulan ini</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Terlambat</p>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.late}</div>
              <p className="text-xs text-slate-400 mt-1">Sesi terlambat terdeteksi</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cuti / Izin</p>
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.leave}</div>
              <p className="text-xs text-slate-400 mt-1">Hari absen terdaftar</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lembur</p>
                <Briefcase className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.overtime}</div>
              <p className="text-xs text-slate-400 mt-1">Sesi lembur divalidasi</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Today Status Card */}
          <Card className="lg:col-span-2 border-none shadow-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-2">Status Absensi Hari Ini</p>
                  <h2 className="text-3xl font-black mb-1">
                    {todayAttendance ? (todayAttendance.clock_out ? 'Sudah Selesai' : 'Sedang Bekerja') : 'Belum Absen'}
                  </h2>
                  {todayAttendance && (
                    <p className="text-blue-100">
                      Masuk: {format(new Date(todayAttendance.clock_in), 'HH:mm')}
                      {todayAttendance.clock_out && ` • Pulang: ${format(new Date(todayAttendance.clock_out), 'HH:mm')}`}
                    </p>
                  )}
                </div>
                <Button
                  size="lg"
                  onClick={() => navigate('/attendance')}
                  className="bg-white text-blue-700 hover:bg-blue-50 rounded-2xl px-8 font-black shadow-xl"
                >
                  {todayAttendance && !todayAttendance.clock_out ? 'Absen Pulang' : 'Buka Absensi'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Desktop Announcements */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Berita & Pengumuman
            </h3>
            <div className="space-y-3">
              {announcements.length > 0 ? (
                announcements.map((ann) => (
                  <Card key={ann.id} className="border-none shadow-lg bg-white rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-blue-50 text-blue-700">Info</Badge>
                        <span className="text-[10px] text-slate-400">{format(new Date(ann.created_at), 'd MMM yyyy', { locale: id })}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 mb-1 mt-2 line-clamp-1">{ann.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{ann.content}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent">
                  <CardContent className="p-6 text-center text-slate-400 text-sm">
                    Tidak ada pengumuman saat ini.
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Desktop Article Feed (Added to match Mobile) */}
            <Card className="border-none shadow-xl bg-white rounded-2xl p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  Artikel Terbaru
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                {(() => {
                  const dailyArticles = getDailyArticles();
                  return dailyArticles.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors" onClick={() => setSelectedArticle(item)}>
                      <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.image ? <img src={item.image} className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-slate-400" />}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-blue-600">{item.title}</h5>
                        <span className="text-[10px] text-slate-400">{item.date}</span>
                      </div>
                    </div>
                  ));
                })()}
                <Button variant="ghost" size="sm" className="w-full text-xs text-blue-600 mt-2">Lihat Semua</Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Helper Components
function MenuGridItem({ href, icon: Icon, label, color, bg, roles, isComingSoon }: any) {
  const { hasRole } = useAuth();
  const { toast } = useToast();

  // Check role access if roles prop is provided
  if (roles && !roles.some((r: any) => hasRole(r))) return null;

  const content = (
    <div className="flex flex-col items-center gap-2 group relative">
      <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 shadow-sm border border-slate-50 relative", bg)}>
        <Icon className={cn("h-7 w-7", color)} />
        {isComingSoon && (
          <div className="absolute -top-1 -right-1 bg-slate-800 text-[8px] font-black text-white px-1.5 py-0.5 rounded-full border-2 border-white uppercase tracking-tighter">
            Soon
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-slate-600 leading-tight group-hover:text-blue-600">{label}</span>
    </div>
  );

  if (isComingSoon) {
    return (
      <button
        onClick={() => toast({ title: "Fitur Segera Hadir", description: `Fitur ${label} masih dalam tahap pengembangan.`, variant: "default" })}
        className="cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={href}>
      {content}
    </Link>
  );
}

function NewsItem({ category, title, date, image, onClick, onDelete }: any) {
  return (
    <div className="relative group">
      <div
        className="flex gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-300 cursor-pointer"
        onClick={onClick}
      >
        <img src={image} alt="" className="h-16 w-16 rounded-xl object-cover bg-slate-100 shrink-0 shadow-sm" />
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <span className="text-[10px] font-bold text-blue-600 mb-1">{category}</span>
          <h4 className="text-sm font-bold text-slate-800 leading-tight line-clamp-2">{title}</h4>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-400">{date}</span>
          </div>
        </div>
      </div>
      {onDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
