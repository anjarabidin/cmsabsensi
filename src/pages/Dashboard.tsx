import { useEffect, useState, useRef } from 'react';
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
  ChevronDown,
  LogOut,
  Info,
  ClipboardCheck,
  MapPin,
  BarChart3,
  DollarSign,
  TrendingUp,
  StickyNote,
  CalendarDays,
  CheckCircle2,
  UserCheck,
  Fingerprint,
  UserX,
  Image as ImageIcon,
  Bell,
  Loader2,
  Car,
  Smartphone,
  Navigation
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance } from '@/types';
import { DashboardCharts } from '@/components/charts/DashboardCharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { NotificationBell } from '@/components/notifications/NotificationBell';
import { getDailyArticles } from '@/lib/articles';
import { AppLogo } from '@/components/AppLogo';
import { DashboardTour } from '@/components/DashboardTour';
import { usePushNotifications } from '@/hooks/usePushNotifications';

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  expires_at?: string;
  deleted_at?: string;
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
  const { profile, user, signOut, role, activeRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [stats, setStats] = useState({ present: 0, late: 0, leave: 0, overtime: 0 });
  const [teamStats, setTeamStats] = useState({ total_employees: 0, present: 0, late: 0, leave: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [agendaPopupOpen, setAgendaPopupOpen] = useState(false);
  const [todayAgendas, setTodayAgendas] = useState<UpcomingActivity[]>([]);
  const [deptManager, setDeptManager] = useState<any>(null);
  const [driverAssignment, setDriverAssignment] = useState<any>(null);
  const [pendingAccountsCount, setPendingAccountsCount] = useState(0);
  const [approvalPopupOpen, setApprovalPopupOpen] = useState(false);
  const [hasSkippedApproval, setHasSkippedApproval] = useState(false);
  const [announcementPopupOpen, setAnnouncementPopupOpen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);

  // Modular Loading States
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingDriver, setLoadingDriver] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // Announcement Form State
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    expires_at: '' // Default to empty (never expires)
  });
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  // Notification Reliability States
  const push = usePushNotifications();
  const [reliabilityModalOpen, setReliabilityModalOpen] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Check if push is ready
  const isPushActive = push.permission === 'granted';
  const isPushOptimized = push.isOptimized;

  // Allow admin_hr OR any email containing 'admin' (for dev convenience)
  const currentRole = activeRole || role;
  const isAdmin = currentRole === 'super_admin' || currentRole === 'admin_hr' || currentRole === 'manager' || profile?.email?.includes('admin');

  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef(false);

  // Initial load
  useEffect(() => {
    const deps = { userId: user?.id, activeRole, profileId: profile?.id, departmentId: profile?.department_id };
    console.log('🔵 [Dashboard] useEffect triggered:', deps);

    // Only fetch if we have a user and we're not already fetching for THESE specific deps
    // We add a small debounce/throttle to prevent rapid triggers during login handshake
    if (user?.id) {
      const now = Date.now();
      if (now - lastFetchRef.current < 1000) {
        console.log('⏳ [Dashboard] Throttling fetchDashboardData (too frequent)');
        return;
      }
      fetchDashboardData(false); // Initial load is NOT silent
    }
  }, [user?.id, activeRole, profile?.id, profile?.department_id]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user?.id) return;
    const autoRefreshInterval = setInterval(() => {
      console.log('[Dashboard] Auto-refresh triggered');
      fetchDashboardData(true); // Background updates should be silent
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(autoRefreshInterval);
  }, [user?.id]);

  // Realtime subscription: attendance changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`dashboard-attendance-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendances',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('[Dashboard] Realtime attendance change for current user:', payload.eventType);
        // Silently refresh core data on change
        fetchDashboardData(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await fetchDashboardData();
    setLastRefreshed(new Date());
    setIsManualRefreshing(false);
  };


  const fetchDashboardData = async (silent = false) => {
    if (!user) {
      console.warn('⚠️ [Dashboard] fetchDashboardData called but user is null, skipping.');
      return;
    }

    if (isFetchingRef.current) {
      console.log('⏳ [Dashboard] fetchDashboardData already in progress, skipping.');
      return;
    }

    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();

    console.log(`🟢 [Dashboard] fetchDashboardData START (silent=${silent})`);
    if (!silent) setLoading(true);

    const today = format(new Date(), 'yyyy-MM-dd');
    const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
    const now = new Date().toISOString();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayISO = endOfToday.toISOString();

    // 1. CRITICAL DATA (Attendance & Schedule)
    const fetchCoreData = async () => {
      console.log('🟡 [Dashboard] fetchCoreData START');
      try {
        const [todayRes, scheduleRes] = await Promise.all([
          supabase.from('attendances').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
          (supabase.from('employee_schedules') as any).select('*, shift:shifts(*)').eq('user_id', user.id).eq('date', today).maybeSingle()
        ]);
        console.log('✅ [Dashboard] fetchCoreData resolved. Att error:', todayRes.error, '| Sched error:', scheduleRes.error);
        setTodayAttendance(todayRes.data as Attendance | null);
        setTodaySchedule(scheduleRes.data);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('❌ [Dashboard] fetchCoreData EXCEPTION:', err);
      } finally {
        console.log('🔓 [Dashboard] fetchCoreData finally — releasing loading states');
        setLoadingAttendance(false);
        if (!silent) setLoading(false); // Hide main loader once core tools are ready
      }
    };

    // 2. DRIVER & ASSIGNMENT DATA (Prioritized for Driver Role)
    const fetchDriverData = async () => {
      try {
        const { data } = await supabase.rpc('get_driver_assignment', { _user_id: user.id });
        const assignmentData = data as any[];
        setDriverAssignment(assignmentData && assignmentData.length > 0 ? assignmentData[0] : null);
      } catch (err) {
        console.error("Error fetching driver data:", err);
      } finally {
        setLoadingDriver(false);
      }
    };

    // 3. ANNOUNCEMENTS & MANAGER
    const fetchInformationalData = async () => {
      try {
        let announcementQuery = supabase.from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!isAdmin) {
          announcementQuery = announcementQuery.eq('is_active', true);
        }

        const [announcementsRes, managerRes] = await Promise.all([
          announcementQuery,
          profile?.department_id
            ? supabase.from('profiles').select('full_name').eq('department_id', profile.department_id).eq('role', 'manager').limit(1).maybeSingle()
            : Promise.resolve({ data: null })
        ]);

        if (announcementsRes.data) {
          const filteredAnnouncements = (announcementsRes.data as Announcement[]).filter(a => {
            if (!a.is_active) return false;
            if (a.deleted_at) return false;
            if (a.expires_at && new Date(a.expires_at) <= new Date()) return false;
            return true;
          });

          setAnnouncements(filteredAnnouncements);

          // Logic for automatic announcement popup
          if (filteredAnnouncements.length > 0) {
            const latest = filteredAnnouncements[0];
            const lastSeenId = localStorage.getItem('last_seen_announcement_id');
            if (lastSeenId !== latest.id) {
              setActiveAnnouncement(latest);
              setAnnouncementPopupOpen(true);
            }
          }
        }
        if (managerRes?.data) setDeptManager(managerRes.data);
      } catch (err) {
        console.error("Error fetching informational data:", err);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    // 4. ACTIVITIES & AGENDA
    const fetchActivityData = async () => {
      try {
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

        const sortedActivities = [...agendaActivities, ...noteActivities].sort((a, b) =>
          new Date(a.time).getTime() - new Date(b.time).getTime()
        );

        setUpcomingActivities(sortedActivities.slice(0, 3));
        const agendasOnly = sortedActivities.filter(act => act.type === 'agenda');
        setTodayAgendas(agendasOnly);

        const popupShownKey = `agenda_popup_shown_${today}_${user.id}`;
        if (agendasOnly.length > 0 && !sessionStorage.getItem(popupShownKey)) {
          setAgendaPopupOpen(true);
          sessionStorage.setItem(popupShownKey, 'true');
        }
      } catch (err) {
        console.error("Error fetching activity data:", err);
      } finally {
        setLoadingActivities(false);
      }
    };

    // 5. PENDING ACCOUNTS (For Approvers)
    const fetchApprovalData = async () => {
      try {
        const { data: settingsData } = await supabase.from('app_settings').select('key, value').in('key', ['enable_account_approval', 'account_approval_roles']);
        const settings: Record<string, string> = {};
        settingsData?.forEach(s => { settings[s.key] = s.value as string; });

        const enabled = settings['enable_account_approval'] === 'true';
        const allowedRoles = (settings['account_approval_roles'] || 'super_admin,admin_hr').split(',');

        if (enabled && allowedRoles.includes(profile?.role as string)) {
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', false);
          setPendingAccountsCount(count || 0);

          // Auto open if count > 0 and hasn't been skipped in this session
          if ((count || 0) > 0 && !hasSkippedApproval) {
            setApprovalPopupOpen(true);
          }
        }
      } catch (err) {
        console.error("Error fetching approval data:", err);
      }
    };

    // 6. MONTHLY STATS
    const fetchStatData = async () => {
      try {
        const { data: monthData } = await supabase.from('attendances')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lte('date', today);

        if (monthData) {
          setStats({
            present: monthData.filter(a => a.status === 'present').length,
            late: monthData.filter(a => a.is_late).length,
            leave: monthData.filter(a => a.status === 'leave').length,
            overtime: monthData.reduce((acc, a) => acc + (a.work_hours_minutes && a.work_hours_minutes > 480 ? 1 : 0), 0),
          });
        }
      } catch (err) {
        console.error("Error fetching stats data:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    // Execute fetches based on priority
    console.log('🟢 [Dashboard] Awaiting fetchCoreData...');
    await fetchCoreData();
    console.log('🟢 [Dashboard] fetchCoreData DONE. Loading should now be false. Launching background fetches...');

    // The rest can run concurrently without blocking each other's UI updates
    Promise.all([
      fetchDriverData(),
      fetchInformationalData(),
      fetchActivityData(),
      fetchStatData(),
      fetchApprovalData()
    ]).then(() => {
      console.log('🟢 [Dashboard] All background fetches COMPLETE.');
      isFetchingRef.current = false;
    }).catch(err => {
      console.error('❌ [Dashboard] Background fetches error:', err);
      isFetchingRef.current = false;
    });

    // 6. PROCESS TEAM DATA (Admin/Manager only, already backgrounded)
    if (currentRole === 'super_admin' || currentRole === 'admin_hr' || currentRole === 'manager') {
      const fetchTeamData = async () => {
        let teamProfilesQuery = supabase.from('profiles').select('id').eq('is_active', true);
        if (currentRole === 'manager' && profile?.department_id) {
          teamProfilesQuery = teamProfilesQuery.eq('department_id', profile.department_id);
        }
        const { data: teamProfiles } = await teamProfilesQuery;
        const teamIds = teamProfiles?.map(p => p.id) || [];

        if (teamIds.length > 0) {
          const { data: teamAttToday } = await supabase
            .from('attendances')
            .select('user_id, status, is_late')
            .eq('date', today)
            .in('user_id', teamIds);

          const presentCount = teamAttToday?.filter(a => a.status === 'present').length || 0;
          const lateCount = teamAttToday?.filter(a => a.is_late).length || 0;
          const leaveCount = teamAttToday?.filter(a => a.status === 'leave').length || 0;

          setTeamStats({
            total_employees: teamIds.length,
            present: presentCount,
            late: lateCount,
            leave: leaveCount,
            absent: Math.max(0, teamIds.length - presentCount - leaveCount)
          });
        }
      };
      fetchTeamData();
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      toast({ title: "Error", description: "Judul dan isi pengumuman wajib diisi", variant: "destructive" });
      return;
    }

    setSubmittingAnnouncement(true);
    try {
      // Use RPC to create announcement and notify everyone
      const { error } = await supabase.rpc('publish_announcement', {
        p_title: announcementForm.title.trim(),
        p_content: announcementForm.content.trim(),
        p_created_by: user?.id,
        p_send_notification: true, // Always notify from dashboard for now
        p_expires_at: announcementForm.expires_at || null
      });

      if (error) throw error;

      // NOTE: Push notifications are automatically sent by DB trigger
      // when notification rows are inserted. No need to call Edge Function here.
      // Previously this caused duplicate push notifications.

      toast({ title: "Berhasil", description: "Pengumuman dipublikasikan & notifikasi dikirim" });
      setAnnouncementOpen(false);
      setAnnouncementForm({ title: '', content: '', expires_at: '' });
      fetchDashboardData();
    } catch (error) {
      console.error(error);
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

  if (loading) {
    console.warn('⚠️ [Dashboard] Rendering SKELETON. loading=true. Jika stuck di sini, berarti setLoading(false) tidak pernah dipanggil atau ada loop re-render.');
    return <DashboardLayout><div className="p-4 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div></DashboardLayout>;
  }

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
        <DashboardTour />
        <div className="relative">
          {/* Custom Background Header for Mobile Feel - More compact while keeping Avatar large */}
          <div className="absolute top-0 left-0 w-full h-[calc(100px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[32px] z-0 shadow-lg" />

          <div className="relative z-10 space-y-3 max-w-5xl mx-auto pb-24">
            {/* Header Section - Compact but Heroic */}
            <div data-tour="profile-header" className="flex items-center justify-between pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 px-4 text-white">
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0" onClick={() => navigate('/profile')}>
                  <div className="absolute -inset-1.5 bg-white/20 rounded-full blur-md group-active:bg-white/40 transition-all" />
                  <Avatar className="h-[76px] w-[76px] border-2 border-white/95 shadow-2xl relative mt-1">
                    <AvatarImage src={profile?.avatar_url || ''} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-white text-blue-600 font-black">
                      {profile?.full_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Notification Reliability Indicator */}
                  <div
                    onClick={(e) => { e.stopPropagation(); setReliabilityModalOpen(true); }}
                    className={cn(
                      "absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 border-white flex items-center justify-center shadow-lg cursor-pointer transform hover:scale-110 active:scale-95 transition-all z-20",
                      isPushActive && isPushOptimized ? "bg-emerald-500" : (isPushActive ? "bg-amber-500" : "bg-red-500")
                    )}
                  >
                    {isPushActive && isPushOptimized ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <Bell className="h-4 w-4 text-white animate-pulse" />
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-blue-50 font-bold opacity-80 uppercase tracking-widest leading-none mb-1">{getGreeting()} 👋</p>
                  <h1 className="text-base font-black tracking-tight text-white drop-shadow-md leading-none truncate">{profile?.full_name?.split(' ')[0]}</h1>
                  <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
                    <p className="text-[8px] text-white/70 font-bold bg-black/20 px-2 py-0.5 rounded-full inline-block backdrop-blur-sm border border-white/10 uppercase tracking-tighter">
                      {profile?.employee_id || 'ID: --'}
                    </p>
                    {deptManager && profile?.role !== 'manager' && (
                      <p className="text-[7px] text-blue-100 font-bold bg-white/10 px-1.5 py-0.5 rounded-full backdrop-blur-sm truncate border border-white/5 uppercase">
                        SV: {deptManager.full_name}
                      </p>
                    )}
                    {profile?.role === 'manager' && (
                      <p className="text-[7px] text-amber-100 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm border border-amber-500/20 uppercase">
                        Unit Manager
                      </p>
                    )}
                  </div>
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

            {/* Info Banner Carousel / Grid - MOVED TO TOP */}
            <div className="mx-3 md:mx-0 relative z-20 mb-4 -mt-2">
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                {/* Attendance Summary Slide */}
                <div
                  data-tour="attendance-card"
                  onClick={() => navigate('/attendance')}
                  className={cn(
                    "w-[85vw] md:w-full h-[120px] rounded-xl p-3 text-white shadow-lg flex flex-col justify-between shrink-0 relative overflow-hidden transition-all active:scale-95",
                    todayAttendance && !todayAttendance.clock_out
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-900/20" // Status: Working
                      : todayAttendance?.clock_out
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-teal-900/20" // Status: Done
                        : "bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-900/10" // Status: Default
                  )}
                >
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
                {loadingAnnouncements ? (
                  <div className="w-[85vw] md:w-full h-[140px] rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex flex-col justify-between shrink-0">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-6 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ) : announcements.length > 0 ? (
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

            {/* COMPACT DRIVER ASSIGNMENT - REPLACED LARGE CARD WITH DROPDOWN CHIP */}
            {(loadingDriver || driverAssignment) && (
              <div className="mx-3 relative z-20 mb-4">
                {loadingDriver ? (
                  <Skeleton className="h-10 w-40 rounded-full" />
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-200 border border-blue-400/20 active:scale-95 transition-all">
                        <div className="h-5 w-5 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                          {driverAssignment.role_type === 'driver' ? <Car className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-wider">
                          {driverAssignment.role_type === 'driver' ? 'Tugas Driver' : 'Driver Pribadi'}
                        </span>
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[85vw] p-0 border-none shadow-2xl rounded-[28px] overflow-hidden" align="start">
                      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70">Detail Antar Jemput</h4>
                          <Badge className="bg-emerald-500 text-white border-0 text-[9px] px-2 h-5">AKTIF</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                            <p className="text-[8px] font-black uppercase text-blue-100 opacity-60 mb-1">
                              {driverAssignment.role_type === 'driver' ? 'Penumpang' : 'Driver Anda'}
                            </p>
                            <p className="text-sm font-black truncate">{driverAssignment.other_party_name}</p>
                          </div>
                          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                            <p className="text-[8px] font-black uppercase text-blue-100 opacity-60 mb-1">Kendaraan</p>
                            <p className="text-sm font-black truncate">{driverAssignment.vehicle || 'Pribadi'}</p>
                          </div>
                        </div>
                        {driverAssignment.role_type === 'driver' && (
                          <Button
                            onClick={() => { navigate('/driver-logbook'); }}
                            className="w-full mt-4 h-11 rounded-xl bg-white text-blue-600 hover:bg-blue-50 font-black text-[11px] uppercase tracking-widest shadow-lg border-0"
                          >
                            Buka Logbook Driver
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* Main Features Grid - Grouped by Category */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 -mt-1 mx-3 relative z-20">
              {/* CATEGORY 1: ABSENSI */}
              <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <div className="h-1 w-3 bg-blue-500 rounded-full" /> Absensi & Kehadiran
              </h3>

              {/* Mobile Only: Today's Agenda Highlight */}
              {isMobile && todayAgendas.length > 0 && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
                  <div className="bg-indigo-600 rounded-[20px] p-4 text-white shadow-lg shadow-indigo-200 overflow-hidden relative group">
                    <div className="absolute right-0 top-0 h-16 w-16 bg-white/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 bg-white/20 rounded-lg flex items-center justify-center">
                        <Calendar className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Agenda Hari Ini</span>
                    </div>

                    <div className="space-y-3">
                      {todayAgendas.slice(0, 2).map((act) => (
                        <div key={act.id} className="flex items-start gap-3">
                          <div className="text-sm font-black tabular-nums border-r border-white/20 pr-3 h-full flex flex-col justify-center">
                            {format(new Date(act.time), 'HH:mm')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-white line-clamp-1 truncate">{act.title}</h4>
                            <p className="text-[10px] font-bold text-indigo-100/70 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              <span className="truncate">{act.location || 'Lokasi tidak ditentukan'}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/agenda')}
                      className="w-full mt-4 h-8 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border-0"
                    >
                      Buka Kalender Agenda <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="my-4 border-t border-slate-50" />
                </div>
              )}

              <div data-tour="main-menu-grid">
                <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center">
                  <div data-tour="quick-action"><MenuGridItem href="/attendance" icon={Clock} label="Absen" color="text-blue-600" bg="bg-blue-50" /></div>
                  <div data-tour="nav-history"><MenuGridItem href="/history" icon={Calendar} label="Riwayat" color="text-purple-600" bg="bg-purple-50" /></div>
                  <MenuGridItem href="/corrections" icon={ClipboardCheck} label="Koreksi" color="text-cyan-600" bg="bg-cyan-50" />
                  <MenuGridItem href="/overtime" icon={Clock} label="Lembur" color="text-red-500" bg="bg-red-50" />
                </div>

                {/* CATEGORY 2: HRIS */}
                <div className="my-4 border-t border-slate-100" />
                <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="h-1 w-3 bg-orange-500 rounded-full" /> HRIS & Pengajuan
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center">
                  <MenuGridItem href="/leave" icon={FileText} label="Cuti" color="text-orange-600" bg="bg-orange-50" />
                  <MenuGridItem href="/reimbursement" icon={Receipt} label="Klaim" color="text-emerald-600" bg="bg-emerald-50" isComingSoon />
                  <MenuGridItem href="/salary-slips" icon={Wallet} label="Gaji" color="text-teal-600" bg="bg-teal-50" />
                </div>

                {/* CATEGORY 3: PRODUKTIVITAS */}
                <div className="my-4 border-t border-slate-100" />
                <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="h-1 w-3 bg-indigo-500 rounded-full" /> Produktivitas
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center">
                  <div data-tour="nav-schedule"><MenuGridItem href="/agenda" icon={Calendar} label="Agenda" color="text-indigo-600" bg="bg-indigo-50" /></div>
                  <MenuGridItem href="/notes" icon={StickyNote} label="Catatan" color="text-yellow-600" bg="bg-yellow-100/50" />
                </div>

                {/* CATEGORY 4: LAINNYA */}
                <div className="my-4 border-t border-slate-100" />
                <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="h-1 w-3 bg-pink-500 rounded-full" /> Lainnya
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center">
                  {activeRole === 'driver' && <MenuGridItem href="/driver-logbook" icon={Navigation} label="Logbook" color="text-blue-600" bg="bg-blue-50" />}
                  <MenuGridItem href="/albums" icon={ImageIcon} label="Album" color="text-pink-600" bg="bg-pink-50" />
                  <div data-tour="nav-profile"><MenuGridItem href="/profile" icon={SettingsIcon} label="Profil" color="text-slate-600" bg="bg-slate-50" /></div>
                </div>
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

            </div>

            {/* Admin Section - Only Visible to HR/Manager - NEW SEPARATE CARD */}
            {
              (currentRole === 'super_admin' || currentRole === 'admin_hr' || currentRole === 'manager') && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mx-3 mt-4 relative z-20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-slate-200 rounded-lg">
                      <SettingsIcon className="h-4 w-4 text-slate-700" />
                    </div>
                    <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider">Console Admin</h2>
                  </div>

                  {/* 1. SUPER ADMIN SPECIAL MENU */}
                  {currentRole === 'super_admin' && (
                    <>
                      <h3 className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">
                        Super Access
                      </h3>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center mb-6">
                        <MenuGridItem href="/audit-logs" icon={FileText} label="Log Audit" color="text-slate-800" bg="bg-white border border-slate-200" />
                        <MenuGridItem href="/settings" icon={SettingsIcon} label="Pengaturan" color="text-neutral-600" bg="bg-white border border-slate-200" />
                      </div>
                    </>
                  )}

                  {/* 2. MANAJEMEN SDM */}
                  <h3 className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                    Manajemen SDM
                  </h3>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center mb-6">
                    <MenuGridItem href="/team-map" icon={Users} label="Pantau Tim" color="text-cyan-600" bg="bg-white border border-slate-200" />
                    <MenuGridItem href="/employees" icon={Users} label="Data Staff" color="text-indigo-600" bg="bg-white border border-slate-200" roles={['super_admin', 'admin_hr', 'manager']} />

                    <MenuGridItem href="/driver-assignments" icon={Car} label="Tugas Driver" color="text-slate-800" bg="bg-white border border-slate-200" roles={['super_admin', 'admin_hr']} />
                    <MenuGridItem href="/shifts" icon={Clock} label="Jadwal Shift" color="text-pink-600" bg="bg-white border border-slate-200" roles={['super_admin', 'admin_hr', 'manager']} />
                    <MenuGridItem href="/reports" icon={BarChart3} label="Laporan" color="text-slate-600" bg="bg-white border border-slate-200" roles={['super_admin', 'admin_hr', 'manager']} />
                    <MenuGridItem href="/locations" icon={MapPin} label="Lokasi" color="text-rose-600" bg="bg-white border border-slate-200" roles={['super_admin', 'admin_hr']} />
                    <MenuGridItem href="/holidays" icon={CalendarDays} label="Libur" color="text-red-600" bg="bg-white border border-slate-200" roles={['super_admin', 'admin_hr']} />
                  </div>

                  {/* 3. KEUANGAN & APPROVAL */}
                  <h3 className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                    Keuangan & Approval
                  </h3>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-y-4 gap-x-2 text-center">
                    <MenuGridItem href="/payroll" icon={DollarSign} label="Payroll" color="text-green-600" bg="bg-white border border-slate-200" roles={['super_admin', 'admin_hr']} />
                    <MenuGridItem href="/approvals" icon={ClipboardCheck} label="Approval" color="text-amber-600" bg="bg-white border border-slate-200" />
                  </div>
                </div>
              )
            }


            {/* Article / News Section */}
            <div className="mx-2 mb-20" data-tour="news-feed">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-bold text-slate-800">Artikel & Berita</h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 px-2" onClick={() => navigate('/information')}>
                    Lihat Semua
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 px-2" onClick={() => setAnnouncementOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Tambah
                    </Button>
                  )}
                </div>
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
                      onDelete={'onDelete' in item ? item.onDelete : undefined}
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
          </div >
        </div >
        {/* TODAY'S AGENDA POPUP (Mobile) */}
        < Dialog open={agendaPopupOpen} onOpenChange={setAgendaPopupOpen} >
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-white shadow-2xl">
            <div className="relative">
              {/* Header with Background */}
              <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="h-20 w-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md mb-4 shadow-xl">
                    <Calendar className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mb-2">Jangan Lupa Agenda Hari Ini!</h2>
                  <p className="text-indigo-100 text-sm font-medium">Anda memiliki {todayAgendas.length} agenda yang harus dihadiri hari ini.</p>
                </div>
              </div>

              {/* Content List */}
              <div className="p-6 space-y-4 max-h-[350px] overflow-y-auto scrollbar-hide bg-slate-50/50">
                {todayAgendas.map((act) => (
                  <Card key={act.id} className="border-none shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all cursor-pointer group" onClick={() => { setAgendaPopupOpen(false); navigate('/agenda'); }}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shrink-0 border border-indigo-100">
                        <span className="text-xs font-black tabular-nums">{format(new Date(act.time), 'HH:mm')}</span>
                        <span className="text-[8px] font-bold uppercase tracking-tighter">WIB</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">{act.title}</h4>
                        <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{act.location || 'Lokasi tidak ditentukan'}</span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 transition-all" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Footer */}
              <div className="p-6 bg-white border-t border-slate-100">
                <Button
                  className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-xl shadow-indigo-200 transition-all active:scale-95"
                  onClick={() => setAgendaPopupOpen(false)}
                >
                  SIAP, SAYA MENGERTI
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog >

        {/* NOTIFICATION RELIABILITY WIZARD (Mobile) */}
        < Dialog open={reliabilityModalOpen} onOpenChange={setReliabilityModalOpen} >
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-white shadow-2xl">
            <div className="relative">
              {/* Header */}
              <div className={cn(
                "p-8 text-white relative overflow-hidden transition-colors duration-500",
                isPushActive && isPushOptimized ? "bg-emerald-600" : "bg-blue-600"
              )}>
                <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="h-20 w-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md mb-4 shadow-xl">
                    <Bell className={cn("h-10 w-10 text-white", !isPushActive && "animate-bounce")} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mb-2">Keandalan Notifikasi</h2>
                  <p className="text-blue-100 text-sm font-medium">Pastikan pengingat absen masuk ke HP Anda tepat waktu.</p>
                </div>
              </div>

              {/* Wizard Steps */}
              <div className="p-6 space-y-6 max-h-[450px] overflow-y-auto scrollbar-hide bg-white">

                {/* Step 1: Permission */}
                <div className="flex gap-4">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
                    isPushActive ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {isPushActive ? <CheckCircle2 className="h-5 w-5" /> : "1"}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Izin Notifikasi Browser</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Wajib aktif agar browser bisa menampilkan pengingat di layar kunci.
                    </p>
                    {!isPushActive && (
                      <Button
                        size="sm"
                        onClick={() => push.register()}
                        className="mt-2 h-8 rounded-lg bg-blue-600 text-xs font-bold"
                      >
                        Aktifkan Izin
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step 2: Battery Optimization (The "Lure" for Sleep) */}
                <div className="flex gap-4">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
                    isPushOptimized ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {isPushOptimized ? <CheckCircle2 className="h-5 w-5" /> : "2"}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Matikan Optimasi Baterai</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Agar HP tidak "menidurkan" aplikasi ini saat tidak dibuka lama.
                    </p>
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Langkah Android:</p>
                      <ol className="text-[11px] text-slate-600 space-y-1.5 list-decimal pl-4">
                        <li>Tekan lama ikon aplikasi ini di Home Screen.</li>
                        <li>Pilih <strong>Info Aplikasi</strong> (huruf 'i').</li>
                        <li>Cari menu <strong>Baterai</strong> / Penggunaan Baterai.</li>
                        <li>Pilih <strong>Tidak Dibatasi</strong> (Unrestricted).</li>
                      </ol>
                    </div>
                    {!isPushOptimized && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { push.completeGuide(); toast({ title: "Siap!", description: "Status keandalan diperbarui." }); }}
                        className="mt-2 h-8 rounded-lg text-blue-600 bg-blue-50 text-xs font-bold hover:bg-blue-100"
                      >
                        Saya Sudah Lakukan Ini ✅
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step 3: Test Push */}
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                    3
                  </div>
                  <div className="space-y-1 w-full">
                    <h4 className="text-sm font-bold text-slate-800">Test Pengingat</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Kirim sinyal test ke HP Anda sekarang untuk memastikan semua OK.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isManualRefreshing}
                      onClick={async () => {
                        setIsManualRefreshing(true);
                        const res = await push.sendTestPush();
                        setTestSuccess(res?.success || false);
                        setIsManualRefreshing(false);
                      }}
                      className="mt-2 w-full h-10 rounded-xl border-blue-200 text-blue-600 text-xs font-bold hover:bg-blue-50"
                    >
                      {isManualRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Test Notifikasi 🚀"}
                    </Button>

                    {testSuccess === true && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Berhasil dikirim! Cek bilah notifikasi HP Anda.
                      </p>
                    )}
                    {testSuccess === false && (
                      <p className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Gagal. Hubungi Admin jika Anda tidak menerima notif.
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex justify-center">
                <Button
                  onClick={() => setReliabilityModalOpen(false)}
                  className="w-full h-12 rounded-2xl bg-blue-600 text-sm font-bold shadow-lg"
                >
                  Tutup & Selesai
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog >
      </DashboardLayout >
    );
  }

  // -------------------------------------------------------------------------
  // RENDER DESKTOP LAYOUT (Premium V2)
  // -------------------------------------------------------------------------
  return (
    <DashboardLayout>
      <DashboardTour />
      <div className="max-w-7xl mx-auto space-y-8 px-6 py-8">

        {/* Header Section - Simplified to Greeting only */}
        <div data-tour="profile-header">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {getGreeting()}, <span className="text-blue-600">{profile?.full_name?.split(' ')[0]}</span>
              </h1>
              <div className="flex flex-col gap-1">
                <p className="text-base text-slate-500 font-medium max-w-lg">
                  Selamat datang di dashboard absensi. Pantau produktivitas dan kelola jadwal Anda hari ini.
                </p>
                {deptManager && profile?.role !== 'manager' && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] font-black bg-blue-50 text-blue-600 border-blue-100 px-2 h-5">
                      MANAGER UNIT: {deptManager.full_name.toUpperCase()}
                    </Badge>
                  </div>
                )}
                {profile?.role === 'manager' && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] font-black bg-amber-50 text-amber-700 border-amber-200 px-2 h-5">
                      MANAJER UNIT: {((profile as any)?.department?.name || 'UNIT').toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <div className="h-12 px-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center text-sm font-bold text-slate-600">
                {format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}
              </div>
              <button
                onClick={handleManualRefresh}
                disabled={isManualRefreshing}
                title="Refresh data"
                className="h-12 w-12 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all disabled:opacity-50"
              >
                {isManualRefreshing
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                }
              </button>
              {lastRefreshed && (
                <span className="text-[10px] text-slate-400 font-medium">
                  Update: {format(lastRefreshed, 'HH:mm:ss')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid lg:grid-cols-12 gap-8">

          {/* LEFT PRIMARY COLUMN (8 Cols) */}
          <div className="lg:col-span-8 space-y-8">

            {/* 1. Hero Card - Status & Quick Action */}
            <div data-tour="attendance-card">
              {loadingAttendance ? (
                <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white p-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-6 flex-1">
                      <Skeleton className="h-6 w-32 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-3/4 rounded-xl" />
                        <Skeleton className="h-6 w-1/2 rounded-lg" />
                      </div>
                      <div className="flex gap-6">
                        <Skeleton className="h-16 w-32 rounded-2xl" />
                        <Skeleton className="h-16 w-32 rounded-2xl" />
                      </div>
                    </div>
                    <Skeleton className="h-24 w-64 rounded-3xl" />
                  </div>
                </Card>
              ) : (
                <Card className={cn(
                  "border-none overflow-hidden relative group transition-all duration-500 hover:shadow-2xl shadow-xl",
                  todayAttendance && !todayAttendance.clock_out
                    ? "bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 shadow-orange-200"
                    : todayAttendance?.clock_out
                      ? "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-teal-200"
                      : "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 shadow-blue-200/50"
                )}>
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full -mr-64 -mt-64 blur-3xl" />
                  <CardContent className="p-8 relative">
                    <div className="flex items-center justify-between">
                      <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20">
                          <Clock className="h-3.5 w-3.5 text-white" />
                          <span className="text-[11px] font-black text-white uppercase tracking-widest">
                            {todaySchedule?.is_day_off ? 'Hari Libur' : 'Status Absensi'}
                          </span>
                        </div>

                        <div>
                          <h2 className="text-4xl font-black text-white mb-2 tracking-tight">
                            {todaySchedule?.is_day_off
                              ? 'Selamat Berlibur! 🏖️'
                              : todayAttendance
                                ? (todayAttendance.clock_out ? 'Kerja Bagus Hari Ini!' : 'Selamat Bekerja!') // Custom greeting based on state
                                : 'Jangan Lupa Absen!'}
                          </h2>
                          <p className="text-blue-100 font-medium text-lg">
                            {todaySchedule?.is_day_off
                              ? 'Nikmati waktu istirahat Anda.'
                              : todayAttendance
                                ? (todayAttendance.clock_out ? 'Anda sudah menyelesaikan jam kerja hari ini.' : 'Waktu terus berjalan, semangat produktif!')
                                : 'Silakan lakukan Clock In untuk memulai hari.'}
                          </p>
                        </div>

                        {todayAttendance && !todaySchedule?.is_day_off && (
                          <div className="flex items-center gap-6 pt-2">
                            <div>
                              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Waktu Masuk</p>
                              <div className="text-2xl font-black text-white font-mono bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm inline-block">
                                {format(new Date(todayAttendance.clock_in), 'HH:mm')}
                              </div>
                            </div>
                            {todayAttendance.clock_out && (
                              <div>
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Waktu Pulang</p>
                                <div className="text-2xl font-black text-white font-mono bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm inline-block">
                                  {format(new Date(todayAttendance.clock_out), 'HH:mm')}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {!todaySchedule?.is_day_off && (
                        <div className="flex flex-col items-center gap-3">
                          <Button
                            size="lg"
                            onClick={() => navigate('/attendance')}
                            className="h-16 px-8 bg-white hover:bg-slate-50 text-slate-900 border-none rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                          >
                            <Fingerprint className="h-6 w-6 mr-3 text-blue-600" />
                            {todayAttendance && !todayAttendance.clock_out ? 'Clock Out Status' : 'Absen Sekarang'}
                          </Button>
                          <p className="text-xs text-white/60 font-medium">Lokasi Anda Terpantau</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* DRIVER ASSIGNMENT CARD (Desktop) */}
            {(loadingDriver || driverAssignment) && (
              loadingDriver ? (
                <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <Skeleton className="h-24 rounded-[28px]" />
                    <Skeleton className="h-24 rounded-[28px]" />
                    <Skeleton className="h-24 rounded-[28px]" />
                  </div>
                </Card>
              ) : (
                <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                          {driverAssignment.role_type === 'driver' ? <Car className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
                        </div>
                        <div>
                          <h4 className="text-base font-black uppercase tracking-widest opacity-80">
                            {driverAssignment.role_type === 'driver' ? 'Penugasan Driver Aktif' : 'Driver Pribadi Terdaftar'}
                          </h4>
                          <p className="text-sm font-bold text-blue-100 italic">Sistem Monitoring Kendaraan</p>
                        </div>
                      </div>
                      <Badge className="bg-white/30 text-white border-none px-4 py-1 text-xs font-black">ACTIVE MONITORING</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-white/10 p-6 rounded-[28px] backdrop-blur-md border border-white/10 flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase text-blue-100 opacity-60 mb-1">
                          {driverAssignment.role_type === 'driver' ? 'Penumpang Utama' : 'Nama Driver'}
                        </p>
                        <p className="text-lg font-black truncate">{driverAssignment.other_party_name}</p>
                      </div>
                      <div className="bg-white/10 p-6 rounded-[28px] backdrop-blur-md border border-white/10 flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase text-blue-100 opacity-60 mb-1">Unit Kendaraan</p>
                        <p className="text-lg font-black truncate">{driverAssignment.vehicle || 'Pribadi'}</p>
                      </div>
                      <div className="flex flex-col justify-center">
                        {driverAssignment.role_type === 'driver' ? (
                          <Button
                            onClick={() => navigate('/driver-logbook')}
                            className="w-full h-full rounded-[28px] bg-white text-blue-600 hover:bg-blue-50 font-black text-sm uppercase tracking-wider shadow-xl border-0 transition-all active:scale-95 flex items-center justify-center gap-3"
                          >
                            <Navigation className="h-5 w-5" /> Isi Logbook Driver
                          </Button>
                        ) : (
                          <div className="bg-white/10 p-6 rounded-[28px] backdrop-blur-md border border-white/10 flex flex-col justify-center">
                            <p className="text-[10px] font-black uppercase text-blue-100 opacity-60 mb-1">Status Keamanan</p>
                            <p className="text-lg font-black truncate text-emerald-300">Terpantau GPS</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            )}

            {/* 2. Stats Grid - Clean & Big */}
            <div data-tour="main-menu-grid">
              <div className="grid grid-cols-4 gap-6">
                {loadingStats ? (
                  Array(4).fill(0).map((_, i) => (
                    <Card key={i} className="border-none shadow-lg bg-white p-6">
                      <div className="flex justify-between items-start mb-4">
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </Card>
                  ))
                ) : (
                  [
                    {
                      label: isAdmin ? 'Hadir (Tim)' : 'Hadir',
                      value: isAdmin ? teamStats.present : stats.present,
                      icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100',
                      sub: isAdmin ? `${teamStats.total_employees} Total` : 'Bulan Ini'
                    },
                    {
                      label: isAdmin ? 'Terlambat (Tim)' : 'Terlambat',
                      value: isAdmin ? teamStats.late : stats.late,
                      icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-100',
                      sub: isAdmin ? 'Hari Ini' : 'Bulan Ini'
                    },
                    {
                      label: isAdmin ? 'Cuti (Tim)' : 'Cuti / Izin',
                      value: isAdmin ? teamStats.leave : stats.leave,
                      icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100',
                      sub: isAdmin ? 'Hari Ini' : 'Bulan Ini'
                    },
                    {
                      label: isAdmin ? 'Mangkir (Tim)' : 'Lembur',
                      value: isAdmin ? teamStats.absent : stats.overtime,
                      icon: isAdmin ? UserX : Briefcase,
                      color: isAdmin ? 'text-slate-600' : 'text-orange-600',
                      bg: isAdmin ? 'bg-slate-100' : 'bg-orange-50',
                      ring: isAdmin ? 'ring-slate-200' : 'ring-orange-100',
                      sub: isAdmin ? 'Hari Ini' : 'Bulan Ini'
                    }
                  ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-lg shadow-slate-200/40 hover:shadow-xl transition-all hover:-translate-y-1 group bg-white ring-1 ring-slate-100/50">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm", stat.bg, stat.color)}>
                            <stat.icon className="h-6 w-6" />
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-50 px-2 py-1 rounded-lg">
                            {stat.sub}
                          </div>
                        </div>
                        <div>
                          <div className="text-4xl font-black text-slate-900 tracking-tight">{stat.value}</div>
                          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{stat.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* 3. Charts Section */}
            <div className="grid grid-cols-1 gap-6">
              <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100">
                <CardHeader className="border-b border-slate-50 p-6 bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black text-slate-900">Statistik Aktivitas</CardTitle>
                      <p className="text-xs text-slate-500 font-medium">Grafik kehadiran 7 hari terakhir</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <DashboardCharts />
                </CardContent>
              </Card>
            </div>

          </div>

          {/* RIGHT SIDEBAR COLUMN (4 Cols) */}
          <div className="lg:col-span-4 space-y-8">


            {/* Admin Quick Actions (Desktop Only) */}
            {(profile?.role === 'admin_hr' || profile?.role === 'manager') && (
              <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 p-6">
                  <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5 text-slate-600" /> Menu Admin
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-20 flex flex-col gap-2 rounded-2xl border-slate-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm" onClick={() => navigate('/employees')}>
                      <Users className="h-6 w-6" />
                      <span className="text-xs font-bold">Staff</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2 rounded-2xl border-slate-100 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 transition-all shadow-sm" onClick={() => navigate('/approvals')}>
                      <ClipboardCheck className="h-6 w-6" />
                      <span className="text-xs font-bold">Approval</span>
                    </Button>

                    <Button variant="outline" className="h-20 flex flex-col gap-2 rounded-2xl border-slate-100 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600 transition-all shadow-sm" onClick={() => navigate('/shifts')}>
                      <Clock className="h-6 w-6" />
                      <span className="text-xs font-bold">Shift</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2 rounded-2xl border-slate-100 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-600 transition-all shadow-sm" onClick={() => navigate('/team-map')}>
                      <MapPin className="h-6 w-6" />
                      <span className="text-xs font-bold">Pantau</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2 rounded-2xl border-slate-100 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all shadow-sm" onClick={() => navigate('/reports')}>
                      <BarChart3 className="h-6 w-6" />
                      <span className="text-xs font-bold">Laporan</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Announcements Widget */}
            <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100 h-fit">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 p-6">
                <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-orange-500" /> Pengumuman
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-blue-600 font-bold" onClick={() => navigate('/information')}>Lihat Semua</Button>
              </CardHeader>
              <CardContent className="p-0">
                {loadingAnnouncements ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </div>
                ) : announcements.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {announcements.map((ann) => (
                      <div key={ann.id} className="p-6 group relative hover:bg-slate-50 transition-all cursor-pointer" onClick={() => navigate('/information')}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{ann.title}</h4>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">{format(new Date(ann.created_at), 'd MMM')}</span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-slate-50/50">
                    <Info className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">Belum ada pengumuman</p>
                  </div>
                )}
                {isAdmin && (
                  <div className="p-4 border-t border-slate-50 bg-slate-50/30">
                    <Button onClick={() => setAnnouncementOpen(true)} className="w-full bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-200 shadow-sm font-bold">
                      <Plus className="h-4 w-4 mr-2" /> Buat Pengumuman
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Agenda Widget */}
            <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 p-6">
                <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-500" /> Agenda Hari Ini
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingActivities ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ) : upcomingActivities.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {upcomingActivities.map((act) => (
                      <div key={act.id} className="p-5 hover:bg-slate-50 transition-colors cursor-pointer group flex items-center justify-between" onClick={() => navigate(act.type === 'agenda' ? '/agenda' : '/notes')}>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{act.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[9px] h-5 bg-slate-100 text-slate-500">{format(new Date(act.time), 'HH:mm')}</Badge>
                            {act.location && <span className="text-[10px] font-medium text-slate-400 truncate max-w-[120px]">{act.location}</span>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50/50">
                    <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">Tidak ada agenda hari ini</p>
                    <Button variant="link" onClick={() => navigate('/agenda')} className="text-blue-600 h-auto p-0 mt-2 text-xs font-bold">Cek Agenda Mendatang</Button>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* --- Dialogs (Shared with Mobile but kept here for scope) --- */}
        {/* Article Detail Dialog */}
        <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto rounded-[32px] border-0 shadow-2xl p-0">
            {selectedArticle && (
              <div className="relative">
                <div className="h-32 bg-slate-100 relative">
                  <img src={selectedArticle.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <Button size="icon" variant="ghost" className="absolute top-2 right-2 text-white hover:bg-black/20 rounded-full" onClick={() => setSelectedArticle(null)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none">{selectedArticle.category}</Badge>
                    <span className="text-xs font-bold text-slate-400">{selectedArticle.date}</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">{selectedArticle.title}</h3>
                  <div className="prose prose-sm prose-slate leading-relaxed text-slate-600">
                    {selectedArticle.content}
                  </div>
                  {selectedArticle.is_generated && (
                    <Button
                      variant="outline"
                      className="w-full mt-6 h-12 rounded-xl font-bold border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                      onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedArticle.title)}`, '_blank')}
                    >
                      Baca Selengkapnya di Google <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Announcement Dialog */}
        <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
          <DialogContent className="sm:max-w-lg rounded-[28px] p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900">Buat Pengumuman Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Judul</label>
                <Input
                  placeholder="Judul pengumuman..."
                  value={announcementForm.title}
                  onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Isi Konten</label>
                <Textarea
                  placeholder="Tulis isi pengumuman di sini..."
                  className="min-h-[120px] rounded-xl border-slate-200 p-4"
                  value={announcementForm.content}
                  onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tampil Sampai (Opsional)</label>
                <Input
                  type="datetime-local"
                  value={announcementForm.expires_at}
                  onChange={e => setAnnouncementForm({ ...announcementForm, expires_at: e.target.value })}
                  className="h-12 rounded-xl border-slate-200"
                />
                <p className="text-[10px] font-bold text-slate-400">Jika dikosongkan, pengumuman akan tampil selamanya.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAnnouncementOpen(false)} className="rounded-xl font-bold text-slate-500">Batal</Button>
              <Button onClick={handleCreateAnnouncement} disabled={submittingAnnouncement} className="bg-blue-600 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700">
                {submittingAnnouncement ? 'Menyimpan...' : 'Posting Berita'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DashboardTour />

        {/* TODAY'S AGENDA POPUP */}
        <Dialog open={agendaPopupOpen} onOpenChange={setAgendaPopupOpen}>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-white shadow-2xl">
            <div className="relative">
              {/* Header with Premium Gradient */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 h-48 w-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl opacity-50" />
                <div className="absolute left-0 bottom-0 h-24 w-24 bg-indigo-400/20 rounded-full -ml-12 -mb-12 blur-2xl" />

                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="h-20 w-20 bg-white/20 rounded-[24px] flex items-center justify-center backdrop-blur-md mb-6 shadow-2xl ring-2 ring-white/30 animate-pulse-slow">
                    <Calendar className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mb-2 leading-tight">Agenda Anda Hari Ini</h2>
                  <div className="flex items-center gap-2 bg-black/10 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-indigo-50 text-[11px] font-bold uppercase tracking-widest">{todayAgendas.length} Jadwal Tersedia</p>
                  </div>
                </div>
              </div>

              {/* Content List */}
              <div className="p-8 space-y-4 max-h-[380px] overflow-y-auto scrollbar-hide bg-slate-50/30">
                {todayAgendas.map((act) => (
                  <Card key={act.id} className="border-none shadow-sm rounded-[24px] overflow-hidden hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1 bg-white ring-1 ring-slate-100/50" onClick={() => { setAgendaPopupOpen(false); navigate('/agenda'); }}>
                    <CardContent className="p-5 flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                        <span className="text-sm font-black tabular-nums leading-none mb-0.5">{format(new Date(act.time), 'HH:mm')}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-70">WIB</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors text-base">{act.title}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium truncate">{act.location || 'Lokasi tidak ditentukan'}</span>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-all">
                        <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Footer */}
              <div className="p-8 bg-white border-t border-slate-50">
                <Button
                  className="w-full h-14 rounded-[20px] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                  onClick={() => setAgendaPopupOpen(false)}
                >
                  MENGERTI, SIAP!
                  <div className="h-1.5 w-1.5 rounded-full bg-white/40 group-hover:bg-white transition-colors" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PENDING ACCOUNTS APPROVAL ALERT POPUP */}
        <Dialog open={approvalPopupOpen} onOpenChange={(open) => {
          if (!open) { setApprovalPopupOpen(false); setHasSkippedApproval(true); }
        }}>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-white shadow-2xl">
            <div className="relative">
              {/* Vibrant & Energizing Header */}
              <div className="bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 h-64 w-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-32 w-32 bg-purple-400/20 rounded-full -ml-16 -mb-16 blur-2xl" />

                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="h-20 w-20 bg-white/20 rounded-[28px] flex items-center justify-center backdrop-blur-md shadow-2xl ring-2 ring-white/30 relative z-10">
                      <UserCheck className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-8 w-8 bg-white text-purple-600 rounded-full flex items-center justify-center font-black text-sm shadow-xl z-20 animate-bounce">
                      {pendingAccountsCount}
                    </div>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mb-2">Persetujuan Akun Pending!</h2>
                  <p className="text-purple-50 text-sm font-medium opacity-90 max-w-[280px]">Dibutuhkan tindakan segera untuk aktivasi akun karyawan baru.</p>
                </div>
              </div>

              {/* Action Area */}
              <div className="p-8 space-y-4 bg-white">
                <Button
                  className="w-full h-16 rounded-[22px] bg-purple-600 hover:bg-purple-700 text-white font-black text-base shadow-2xl shadow-purple-200 transition-all active:scale-95 flex items-center justify-center gap-3 group"
                  onClick={() => {
                    setApprovalPopupOpen(false);
                    navigate('/approvals');
                  }}
                >
                  <ClipboardCheck className="h-6 w-6 group-hover:scale-110 transition-transform" />
                  KELOLA SEKARANG
                </Button>

                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-xl text-slate-400 font-bold hover:text-purple-600 hover:bg-purple-50 transition-all"
                  onClick={() => {
                    setApprovalPopupOpen(false);
                    setHasSkippedApproval(true);
                  }}
                >
                  Nanti Saja
                </Button>
              </div>

              {/* Enhanced Info Box */}
              <div className="px-8 pb-10 bg-white">
                <div className="p-5 rounded-[24px] bg-slate-50 border border-slate-100 flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                    <Info className="h-5 w-5 text-purple-500" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                    Kami akan mengingatkan Anda secara berkala sampai pendaftaran baru ini diselesaikan (Disetujui/Ditolak).
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* AUTOMATIC ANNOUNCEMENT POPUP */}
        <Dialog open={announcementPopupOpen} onOpenChange={setAnnouncementPopupOpen}>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-white shadow-2xl">
            <div className="relative">
              {/* High-Impact Visual Header */}
              <div className="bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600 p-12 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 h-64 w-64 bg-white/20 rounded-full -mr-32 -mt-32 blur-3xl opacity-60" />
                <div className="absolute left-0 bottom-0 h-32 w-32 bg-amber-300/20 rounded-full -ml-16 -mb-16 blur-2xl" />

                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="h-24 w-24 bg-white/20 rounded-[30px] flex items-center justify-center backdrop-blur-md mb-8 shadow-2xl ring-2 ring-white/30 group animate-pulse-slow">
                    <Megaphone className="h-12 w-12 text-white group-hover:rotate-12 transition-transform duration-500" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight mb-2 leading-tight">Wajib Dibaca!</h2>
                  <div className="h-1 w-12 bg-white/30 rounded-full mb-2" />
                  <p className="text-orange-50 text-xs font-bold uppercase tracking-[0.2em] opacity-80">Pengumuman Penting Pekan Ini</p>
                </div>
              </div>

              {/* Content with Enhanced Typography */}
              <div className="p-10 bg-white">
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight tracking-tight border-l-4 border-orange-500 pl-4">{activeAnnouncement?.title}</h3>
                  <div className="prose prose-sm prose-slate text-slate-600 leading-relaxed max-h-[220px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-orange-100 scrollbar-track-transparent">
                    <p className="text-[15px] font-medium leading-[1.6]">
                      {activeAnnouncement?.content}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <Button
                    className="w-full h-16 rounded-[22px] bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-base shadow-2xl shadow-orange-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                    onClick={() => {
                      if (activeAnnouncement) {
                        localStorage.setItem('last_seen_announcement_id', activeAnnouncement.id);
                      }
                      setAnnouncementPopupOpen(false);
                    }}
                  >
                    SAYA PAHAM & MENGERTI
                    <CheckCircle2 className="h-5 w-5" />
                  </Button>

                  <div className="flex items-center justify-center gap-2 py-2 border-t border-slate-50 italic">
                    <Clock className="h-3 w-3 text-slate-300" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                      Diterbitkan pada {activeAnnouncement?.created_at ? format(new Date(activeAnnouncement.created_at), 'd MMM yyyy', { locale: id }) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
