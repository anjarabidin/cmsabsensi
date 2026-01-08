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
  DollarSign
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance } from '@/types';
import { DashboardCharts } from '@/components/charts/DashboardCharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

import { NotificationBell } from '@/components/notifications/NotificationBell';
import { getDailyArticles } from '@/lib/articles';
import { AppLogo } from '@/components/AppLogo';

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  is_active: boolean;
};

export default function Dashboard() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [stats, setStats] = useState({ present: 0, late: 0, leave: 0, overtime: 0 });
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Announcement Form State
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' });
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  // Allow admin_hr, super_admin, OR any email containing 'admin' (for dev convenience)
  const isAdmin = profile?.role === 'admin_hr' || profile?.role === 'super_admin' || profile?.email?.includes('admin');

  useEffect(() => {
    fetchDashboardData();
  }, [user?.id]);

  const fetchDashboardData = async () => {
    try {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

      const [todayRes, monthRes, announcementsRes] = await Promise.all([
        supabase.from('attendances').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('attendances').select('*').eq('user_id', user.id).gte('date', startOfMonth).lte('date', today),
        supabase.from('announcements')
          .select('*')
          // If admin, fetch all (to manage). If user, fetch only active. 
          // However, RLS handles this, so we just select *.
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      setTodayAttendance(todayRes.data as Attendance | null);

      if (announcementsRes.data) {
        setAnnouncements(announcementsRes.data as Announcement[]);
      }

      if (monthRes.data) {
        setStats({
          present: monthRes.data.filter(a => a.status === 'present').length,
          late: monthRes.data.filter(a => a.is_late).length,
          leave: monthRes.data.filter(a => a.status === 'leave').length,
          overtime: monthRes.data.reduce((acc, a) => acc + (a.work_hours_minutes && a.work_hours_minutes > 480 ? 1 : 0), 0),
        });
      }
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
        created_by: user?.id
      });

      if (error) throw error;

      toast({ title: "Berhasil", description: "Pengumuman berhasil dibuat" });
      setAnnouncementOpen(false);
      setAnnouncementForm({ title: '', content: '' });
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

  return (
    <DashboardLayout>
      {/* Unified JKN Style View for All Devices */}
      <div className="relative">
        {/* Custom Background Header for Mobile Feel */}
        <div className="absolute -top-4 -left-4 w-[calc(100%+2rem)] h-[180px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        <div className="relative z-10 space-y-6 max-w-5xl mx-auto pb-4">
          {/* Header Section */}
          <div className="flex items-center justify-between pt-2 pb-6 px-2 text-white">
            <div className="flex items-center gap-3">
              <div className="h-14 min-w-[140px] px-4 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                <AppLogo className="h-9 w-auto" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Hi, {profile?.full_name?.split(' ')[0]}</h1>
                <p className="text-xs text-blue-50 font-medium opacity-90">{getGreeting()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 rounded-full"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Main Features Grid - JKN Style */}
          {/* Main Features Grid - JKN Style */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 -mt-2 mx-2">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <div className="h-1 w-4 bg-blue-500 rounded-full" /> Menu Karyawan
            </h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-y-6 gap-x-4 text-center">
              <MenuGridItem href="/attendance" icon={Clock} label="Absen" color="text-blue-600" bg="bg-blue-50" />
              <MenuGridItem href="/history" icon={Calendar} label="Riwayat" color="text-purple-600" bg="bg-purple-50" />
              <MenuGridItem href="/leave" icon={FileText} label="Cuti" color="text-orange-600" bg="bg-orange-50" />
              <MenuGridItem href="/overtime" icon={Clock} label="Lembur" color="text-red-500" bg="bg-red-50" />

              <MenuGridItem href="/reimbursement" icon={Receipt} label="Klaim" color="text-emerald-600" bg="bg-emerald-50" />
              <MenuGridItem href="/salary-slips" icon={Wallet} label="Gaji" color="text-teal-600" bg="bg-teal-50" />
              <MenuGridItem href="/profile" icon={SettingsIcon} label="Profil" color="text-slate-600" bg="bg-slate-50" />
            </div>

            {/* Admin Section - Only Visible to HR/Manager */}
            {(profile?.role === 'admin_hr' || profile?.role === 'manager') && (
              <>
                <div className="my-6 border-t border-slate-100" />
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <div className="h-1 w-4 bg-purple-500 rounded-full" /> Menu Admin
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-y-6 gap-x-4 text-center">
                  <MenuGridItem href="/team-map" icon={Users} label="Pantau" color="text-cyan-600" bg="bg-cyan-50" />
                  <MenuGridItem href="/employees" icon={Users} label="Karyawan" color="text-indigo-600" bg="bg-indigo-50" roles={['admin_hr']} />
                  <MenuGridItem href="/shifts" icon={Clock} label="Shift" color="text-pink-600" bg="bg-pink-50" roles={['admin_hr']} />
                  <MenuGridItem href="/approvals" icon={ClipboardCheck} label="Approval" color="text-amber-600" bg="bg-amber-50" />
                  <MenuGridItem href="/payroll" icon={DollarSign} label="Gaji & Payroll" color="text-green-600" bg="bg-green-50" roles={['admin_hr']} />
                  <MenuGridItem href="/locations" icon={MapPin} label="Lokasi" color="text-rose-600" bg="bg-rose-50" roles={['admin_hr']} />
                  <MenuGridItem href="/reports" icon={BarChart3} label="Laporan" color="text-slate-600" bg="bg-slate-50" />
                </div>
              </>
            )}
          </div>

          {/* Desktop Stats & Charts (Visible on md+) */}
          <div className="hidden md:block space-y-6 px-2">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hadir Tepat Waktu</CardTitle>
                  <Clock className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.present}</div>
                  <p className="text-xs text-muted-foreground">Bulan ini</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Terlambat</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.late}</div>
                  <p className="text-xs text-muted-foreground">Bulan ini</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cuti / Izin</CardTitle>
                  <Calendar className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.leave}</div>
                  <p className="text-xs text-muted-foreground">Hari di bulan ini</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lembur</CardTitle>
                  <Briefcase className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.overtime}</div>
                  <p className="text-xs text-muted-foreground">Kali bulan ini</p>
                </CardContent>
              </Card>
            </div>
            <DashboardCharts />
          </div>

          {/* Info Banner Carousel / Grid */}
          <div className="mx-2 md:mx-0">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
              {/* Attendance Summary Slide */}
              <div className="w-[280px] md:w-full h-[140px] rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-4 text-white shadow-lg shadow-blue-900/10 flex flex-col justify-between shrink-0 relative overflow-hidden transition-all hover:scale-[1.02]">
                <div className="absolute right-0 top-0 h-24 w-24 bg-white/10 rounded-bl-full -mr-4 -mt-4" />
                <div>
                  <p className="text-xs font-medium text-blue-100 mb-1">Status Hari Ini</p>
                  <h3 className="text-xl font-bold">{todayAttendance ? (todayAttendance.clock_out ? 'Sudah Pulang' : 'Sedang Bekerja') : 'Belum Absen'}</h3>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-blue-200 uppercase tracking-widest">Masuk</p>
                    <p className="font-mono text-lg font-bold">{todayAttendance ? format(new Date(todayAttendance.clock_in), 'HH:mm') : '--:--'}</p>
                  </div>
                  <Button size="sm" variant="secondary" className="h-8 text-xs bg-white text-blue-700 hover:bg-blue-50 border-0" asChild>
                    <Link to="/attendance">{todayAttendance && !todayAttendance.clock_out ? 'Clock Out' : 'Absen'}</Link>
                  </Button>
                </div>
              </div>

              {/* Announcement Slide */}
              {announcements.length > 0 ? (
                announcements.map((ann, idx) => (
                  <div key={ann.id} className="w-[280px] md:w-full h-[140px] rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex flex-col justify-between shrink-0 transition-all hover:shadow-md">
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
                <div className="w-[280px] md:w-full h-[140px] rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 p-4 flex flex-col items-center justify-center text-center shrink-0">
                  <Info className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">Tidak ada pengumuman baru</p>
                </div>
              )}
            </div>
          </div>

          {/* Article / News Section */}
          <div className="mx-2 mb-6">
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

          </div>

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



    </DashboardLayout>
  );
}

// Helper Components
function MenuGridItem({ href, icon: Icon, label, color, bg, roles }: any) {
  const { hasRole } = useAuth();

  // Check role access if roles prop is provided
  if (roles && !roles.some((r: any) => hasRole(r))) return null;

  return (
    <Link to={href} className="flex flex-col items-center gap-2 group">
      <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 shadow-sm border border-slate-50", bg)}>
        <Icon className={cn("h-7 w-7", color)} />
      </div>
      <span className="text-xs font-medium text-slate-600 leading-tight group-hover:text-blue-600">{label}</span>
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

// ... remove unused old components if not needed ...
