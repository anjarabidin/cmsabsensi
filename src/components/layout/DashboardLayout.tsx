import { ReactNode, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Clock,
  Calendar,
  FileText,
  Users,
  LogOut,
  Home,
  MapPin,
  BarChart3,
  DollarSign,
  Check,
  User,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Receipt,
  Navigation,
  Smartphone,
  ScanFace,
  Scan,
  Timer,
  Briefcase,
  ClipboardCheck,
  Newspaper,
  StickyNote,
  Settings,
  Camera,
  BellRing,
  Shield,
  Info as InfoIcon,
  UserCheck,
  Car,
  Fingerprint
} from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  key: string;
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Role-specific Navigation Configurations
const employeeNavGroups = [
  {
    title: 'Utama',
    items: [
      { key: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: Home },
      { key: 'attendance', title: 'Absensi', href: '/attendance', icon: Clock },
      { key: 'agenda', title: 'Agenda Kerja', href: '/agenda', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Permohonan',
    items: [
      { key: 'leave', title: 'Cuti / Izin', href: '/leave', icon: Briefcase },
      { key: 'overtime', title: 'Lembur', href: '/overtime', icon: Timer },
      { key: 'reimbursement', title: 'Reimbursement', href: '/reimbursement', icon: Receipt },
      { key: 'corrections', title: 'Koreksi Absen', href: '/corrections', icon: Check },
      { key: 'approvals', title: 'Pusat Persetujuan', href: '/approvals', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Info & Riwayat',
    items: [
      { key: 'history', title: 'Riwayat', href: '/history', icon: Calendar },
      { key: 'notes', title: 'Catatan', href: '/notes', icon: StickyNote },
      { key: 'information', title: 'Berita & Info', href: '/information', icon: Newspaper },
      { key: 'albums', title: 'Album Kenangan', href: '/albums', icon: Camera },
      { key: 'profile', title: 'Pengaturan', href: '/profile', icon: Settings },
    ]
  }
];

const adminNavGroups = [
  {
    title: 'Overview',
    items: [
      { key: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: Home },
      { key: 'approvals', title: 'Pusat Persetujuan', href: '/approvals', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Manajemen SDM',
    items: [
      { key: 'employees', title: 'Data Karyawan', href: '/employees', icon: Users },
      { key: 'shifts', title: 'Jadwal & Shift', href: '/shifts', icon: Clock },
      { key: 'locations', title: 'Lokasi Kantor', href: '/locations', icon: MapPin },
      { key: 'team_map', title: 'Pantau Tim', href: '/team-map', icon: Navigation },

      { key: 'reports', title: 'Laporan Kehadiran', href: '/reports', icon: BarChart3 },
      { key: 'attendance_log', title: 'Log Foto Absen', href: '/attendance-log', icon: Camera },
    ]
  },
  {
    title: 'Operasional Driver',
    items: [
      { key: 'driver_assignments', title: 'Tugas Driver', href: '/driver-assignments', icon: UserCheck },
      { key: 'vehicles', title: 'Kendaraan', href: '/vehicles', icon: Car },
      { key: 'driver_logbook', title: 'Logbook Driver', href: '/driver-logbook', icon: Navigation },
      { key: 'driver_receipts', title: 'Nota & Biaya', href: '/driver-receipts', icon: Camera },
      { key: 'driver_reports', title: 'Monitoring Driver', href: '/driver-reports', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Keuangan',
    items: [
      { key: 'payroll', title: 'Gaji & Payroll', href: '/payroll', icon: DollarSign },
      { key: 'payroll_report', title: 'Laporan Gaji', href: '/payroll-report', icon: FileText },
      { key: 'reimbursement', title: 'Reimbursement', href: '/reimbursement', icon: Receipt },
    ]
  },
  {
    title: 'Perusahaan',
    items: [
      { key: 'information', title: 'Berita & Info', href: '/information', icon: Newspaper },
      { key: 'albums', title: 'Album Kenangan', href: '/albums', icon: Camera },
    ]
  },
  {
    title: 'Menu Saya',
    items: [
      { key: 'attendance', title: 'Absensi', href: '/attendance', icon: Clock },
      { key: 'history', title: 'Riwayat Saya', href: '/history', icon: Calendar },
      { key: 'leave', title: 'Cuti & Izin', href: '/leave', icon: Briefcase },
      { key: 'agenda', title: 'Agenda', href: '/agenda', icon: ClipboardCheck },
      { key: 'profile', title: 'Pengaturan', href: '/profile', icon: Settings },
    ]
  }
];

const superAdminNavGroups = [
  {
    title: 'Super Admin',
    items: [
      { key: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: Home },
      { key: 'audit_logs', title: 'Log Audit', href: '/audit-logs', icon: FileText },
      { key: 'device_management', title: 'Manajemen Perangkat', href: '/device-management', icon: Smartphone },
      { key: 'role_management', title: 'Role & Akses', href: '/role-management', icon: Shield },
      { key: 'settings', title: 'Pengaturan Sistem', href: '/settings', icon: Settings },
    ]
  },
  {
    title: 'Manajemen SDM',
    items: [
      { key: 'employees', title: 'Data Karyawan', href: '/employees', icon: Users },
      { key: 'shifts', title: 'Jadwal & Shift', href: '/shifts', icon: Clock },
      { key: 'locations', title: 'Lokasi Kantor', href: '/locations', icon: MapPin },
      { key: 'team_map', title: 'Pantau Tim', href: '/team-map', icon: Navigation },

      { key: 'reports', title: 'Laporan', href: '/reports', icon: BarChart3 },
      { key: 'attendance_log', title: 'Log Foto Absen', href: '/attendance-log', icon: Camera },
    ]
  },
  {
    title: 'Operasional Driver',
    items: [
      { key: 'driver_assignments', title: 'Tugas Driver', href: '/driver-assignments', icon: UserCheck },
      { key: 'vehicles', title: 'Kendaraan', href: '/vehicles', icon: Car },
      { key: 'driver_logbook', title: 'Logbook Driver', href: '/driver-logbook', icon: Navigation },
      { key: 'driver_receipts', title: 'Nota & Biaya', href: '/driver-receipts', icon: Camera },
      { key: 'driver_reports', title: 'Monitoring Driver', href: '/driver-reports', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Keuangan',
    items: [
      { key: 'payroll', title: 'Gaji & Payroll', href: '/payroll', icon: DollarSign },
      { key: 'payroll_report', title: 'Laporan Gaji', href: '/payroll-report', icon: FileText },
    ]
  },
  {
    title: 'Pusat Approval',
    items: [
      { key: 'approvals', title: 'Daftar Persetujuan', href: '/approvals', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Menu Saya',
    items: [
      { key: 'attendance', title: 'Absensi ', href: '/attendance', icon: Clock },
      { key: 'history', title: 'Riwayat Saya', href: '/history', icon: Calendar },
      { key: 'leave', title: 'Cuti & Izin', href: '/leave', icon: Briefcase },
      { key: 'agenda', title: 'Agenda Saya', href: '/agenda', icon: ClipboardCheck },
      { key: 'profile', title: 'Profil Saya', href: '/profile', icon: Settings },
    ]
  }
];

const managerNavGroups = [
  {
    title: 'Overview',
    items: [
      { key: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: Home },
      { key: 'approvals', title: 'Pusat Persetujuan', href: '/approvals', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Kelola Tim',
    items: [
      { key: 'shifts', title: 'Jadwal Tim', href: '/shifts', icon: Clock },
      { key: 'team_map', title: 'Lokasi Tim', href: '/team-map', icon: Navigation },
      { key: 'employees', title: 'Anggota Tim', href: '/employees', icon: Users },
      { key: 'albums', title: 'Album', href: '/albums', icon: Camera },
      { key: 'reports', title: 'Evaluasi Tim', href: '/reports', icon: BarChart3 },
      { key: 'attendance_log', title: 'Log Foto Absen', href: '/attendance-log', icon: Camera },
    ]
  },
  {
    title: 'Operasional Driver',
    items: [
      { key: 'driver_logbook', title: 'Logbook Driver', href: '/driver-logbook', icon: Navigation },
      { key: 'driver_receipts', title: 'Nota & Biaya', href: '/driver-receipts', icon: Camera },
      { key: 'driver_reports', title: 'Monitoring Driver', href: '/driver-reports', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Pribadi',
    items: [
      { key: 'attendance', title: 'Absensi Saya', href: '/attendance', icon: Clock },
      { key: 'history', title: 'Riwayat Saya', href: '/history', icon: Calendar },
      { key: 'leave', title: 'Cuti Saya', href: '/leave', icon: Briefcase },
      { key: 'agenda', title: 'Agenda Saya', href: '/agenda', icon: ClipboardCheck },
      { key: 'profile', title: 'Pengaturan', href: '/profile', icon: Settings },
    ]
  }
];

const driverNavGroups = [
  {
    title: 'Driver',
    items: [
      { key: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: Home },
      { key: 'driver_logbook', title: 'Logbook Driver', href: '/driver-logbook', icon: Navigation },
      { key: 'driver_receipts', title: 'Nota & Biaya', href: '/driver-receipts', icon: Camera },
      { key: 'attendance', title: 'Absensi', href: '/attendance', icon: Clock },
      { key: 'approvals', title: 'Pusat Persetujuan', href: '/approvals', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Pribadi',
    items: [
      { key: 'history', title: 'Riwayat Saya', href: '/history', icon: Calendar },
      { key: 'information', title: 'Berita & Info', href: '/information', icon: Newspaper },
      { key: 'profile', title: 'Pengaturan', href: '/profile', icon: Settings },
    ]
  }
];

const getNavGroups = (role: string, perms: Record<string, boolean>) => {
  let groups;
  if (role === 'super_admin') groups = superAdminNavGroups;
  else if (role === 'admin_hr') groups = adminNavGroups;
  else if (role === 'manager') groups = managerNavGroups;
  else if (role === 'driver') groups = driverNavGroups;
  else groups = employeeNavGroups;

  // Filter based on perms from DB
  return groups.map(group => ({
    ...group,
    items: group.items.filter(item => perms[item.key] === true) // Strict whitelist: only show if explicitly enabled in DB
  })).filter(group => group.items.length > 0);
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { permission, isIOS, isStandalone, register } = usePushNotifications();
  const { profile, roles, activeRole, navPermissions, switchRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  // --- SYSTEM KEEP-ALIVE LOGIC ---
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;

    const startKeepAlive = async () => {
      try {
        // Fetch Keep-Alive Settings (Align with Settings.tsx keys)
        const { data: settings } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', [
            'enable_keepalive_ping',
            'keepalive_interval_minutes',
            'keepalive_start_hour',
            'keepalive_end_hour'
          ]);

        let enabled = false;
        let interval = 5;
        let startH = 6;
        let endH = 22;

        settings?.forEach(s => {
          if (s.key === 'enable_keepalive_ping') enabled = s.value === 'true' || s.value === true || s.value === '1';
          if (s.key === 'keepalive_interval_minutes') interval = Number(s.value) || 5;
          if (s.key === 'keepalive_start_hour') startH = Number(s.value) || 6;
          if (s.key === 'keepalive_end_hour') endH = Number(s.value) || 22;
        });

        if (!enabled) return;

        const performPing = async () => {
          const now = new Date();
          const hour = now.getHours();

          // Only ping during operational hours to be efficient
          if (hour >= startH && hour <= endH) {
            console.log(`[System] Keep-Alive Ping at ${now.toLocaleTimeString()}`);
            // Simple lightweight query to keep connection warm
            await supabase.from('app_settings').select('key').limit(1);
          }
        };

        // Initial ping
        performPing();

        // Setup interval
        pingInterval = setInterval(performPing, interval * 60000);
      } catch (err) {
        console.error('[System] Keep-Alive Error:', err);
      }
    };

    startKeepAlive();
    return () => {
      if (pingInterval) clearInterval(pingInterval);
    };
  }, []);

  // Ref to store sidebar scroll position
  const sidebarNavRef = useRef<HTMLElement>(null);

  // Save scroll position to sessionStorage on scroll
  useEffect(() => {
    const navElement = sidebarNavRef.current;
    if (!navElement || isMobile) return;

    const handleScroll = () => {
      sessionStorage.setItem('sidebar-scroll-position', navElement.scrollTop.toString());
    };

    navElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => navElement.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  // Restore scroll position after navigation/mount
  useEffect(() => {
    if (isMobile) return;

    const navElement = sidebarNavRef.current;
    if (!navElement) return;

    const savedPosition = sessionStorage.getItem('sidebar-scroll-position');
    if (savedPosition) {
      const position = parseInt(savedPosition, 10);

      // Use multiple methods to ensure scroll is restored
      const restoreScroll = () => {
        if (navElement) {
          navElement.scrollTop = position;
        }
      };

      // Multiple restoration attempts with increasing delays
      const timeouts: NodeJS.Timeout[] = [];

      // Immediate
      restoreScroll();

      // Delayed attempts
      timeouts.push(setTimeout(restoreScroll, 0));
      timeouts.push(setTimeout(restoreScroll, 10));
      timeouts.push(setTimeout(restoreScroll, 50));
      timeouts.push(setTimeout(restoreScroll, 100));
      timeouts.push(setTimeout(restoreScroll, 200));

      requestAnimationFrame(restoreScroll);
      requestAnimationFrame(() => {
        requestAnimationFrame(restoreScroll);
      });

      // Cleanup
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [location.pathname, isMobile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getRoleBadge = () => {
    if (!activeRole) return '';
    switch (activeRole) {
      case 'super_admin': return 'Super Admin';
      case 'admin_hr': return 'HRD';
      case 'manager': return 'Manager';
      case 'employee': return 'Staff';
      case 'driver': return 'Driver';
      default: return '';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'System Administrator';
      case 'admin_hr': return 'Administrator';
      case 'manager': return 'Manajer';
      case 'employee': return 'Karyawan';
      case 'driver': return 'Pengemudi';
      default: return '';
    }
  };

  // -------------------------------------------------------------------------
  // RENDER MOBILE LAYOUT (FROZEN FOR MOBILE)
  // -------------------------------------------------------------------------
  if (isMobile) {

    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col overflow-x-hidden">
        {/* iOS PWA Notification Prompt - Crucial for User Gesture Requirement */}
        {isIOS && permission === 'default' && (
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg sticky top-0 z-[60] animate-in slide-in-from-top duration-500">
            {isStandalone ? (
              <>
                <div className="flex items-center gap-3 text-left">
                  <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-wider leading-none">Aktifkan Notifikasi</span>
                    <span className="text-[10px] opacity-80 font-medium">Klik agar tidak telat absen</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => register()}
                  className="bg-white text-blue-600 hover:bg-slate-100 h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm shrink-0"
                >
                  Izinkan
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-[11px] font-black uppercase tracking-wider leading-none block">Pasang Aplikasi</span>
                  <span className="text-[10px] opacity-80 font-medium leading-tight">Tekan ikon <span className="inline-block px-1 bg-white/20 rounded mx-0.5 whitespace-nowrap">↑</span> lalu 'Add to Home Screen' untuk notifikasi</span>
                </div>
              </div>
            )}
          </div>
        )}

        <main className="flex-1 pb-20 px-1 overflow-x-hidden">
          {children}
        </main>

        {/* Fixed Bottom Navigation - Mobile Only (Compact) */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around h-20 pb-[env(safe-area-inset-bottom)] px-2 shadow-[0_-2px_15px_rgba(0,0,0,0.08)]">
          <Link to="/dashboard" className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 h-full transition-all", location.pathname === '/dashboard' ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
            <Home className={cn("h-5 w-5", location.pathname === '/dashboard' ? "fill-blue-600/10" : "")} />
            <span className="text-[9px] font-bold">Home</span>
          </Link>
          <Link to="/attendance" className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 h-full transition-all", location.pathname === '/attendance' ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
            <Clock className="h-5 w-5" />
            <span className="text-[9px] font-bold">Absen</span>
          </Link>

          {activeRole === 'driver' ? (
            <Link to="/driver-logbook" className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 h-full transition-all", location.pathname === '/driver-logbook' ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
              <Navigation className={cn("h-5 w-5", location.pathname === '/driver-logbook' ? "fill-blue-600/10" : "")} />
              <span className="text-[9px] font-bold">Logbook</span>
            </Link>
          ) : (
            <div className="relative -top-6">
              <Link
                to="/attendance"
                className="h-14 w-14 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-200 flex items-center justify-center transform transition-all active:scale-95 border-[4px] border-white ring-2 ring-blue-100"
              >
                <Fingerprint className="h-7 w-7" />
              </Link>
            </div>
          )}

          <Link to="/history" className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 h-full transition-all", location.pathname === '/history' ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
            <Calendar className="h-5 w-5" />
            <span className="text-[9px] font-bold">Riwayat</span>
          </Link>
          <Link to="/profile" className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 h-full transition-all", location.pathname === '/profile' ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
            <User className="h-5 w-5" />
            <span className="text-[9px] font-bold">Profil</span>
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER DESKTOP LAYOUT (CAN BE FREELY UPDATED LATER)
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Sidebar for Desktop */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-[#1e293b] text-slate-300 border-r border-[#334155] shadow-2xl transition-all duration-300 lg:block hidden",
          collapsed ? "w-[80px]" : "w-[280px]"
        )}
      >
        <div className="flex flex-col h-full bg-[#1e293b]">
          {/* Sidebar Header - Fixed */}
          <div className={cn("flex items-center h-24 mb-6 shrink-0 transition-all", collapsed ? "justify-center px-0" : "px-6")}>
            <div
              className={cn(
                "bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 transition-all duration-300 overflow-hidden relative group cursor-pointer hover:shadow-blue-500/20",
                collapsed ? "h-14 w-14 p-1" : "h-20 w-full px-2"
              )}
            >
              {/* Logo with Scale to Crop White Edges */}
              <div className="absolute inset-0 flex items-center justify-center">
                <AppLogo className={cn("transition-all duration-500", collapsed ? "h-10 w-auto scale-110" : "h-28 w-auto scale-125")} />
              </div>
            </div>
          </div>

          {/* Navigation Items - Scrollable */}
          <nav ref={sidebarNavRef} className={cn("flex-1 overflow-y-auto overscroll-contain scroll-auto py-2 custom-scrollbar", collapsed ? "px-2" : "px-4")}>
            <div className="space-y-8">
              {getNavGroups(activeRole || 'employee', navPermissions).map((group) => {
                const visibleItems = group.items;
                if (visibleItems.length === 0) return null;

                return (
                  <div key={group.title}>
                    {!collapsed && (
                      <div className="px-4 mb-3 flex items-center gap-3">
                        <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                        <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">{group.title}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        let isActive = location.pathname === item.href;
                        // Special case for dashboard
                        if (item.href !== '/dashboard' && location.pathname.startsWith(item.href)) {
                          isActive = true;
                        }
                        if (item.href === '/dashboard' && location.pathname === '/dashboard') isActive = true;


                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition-all duration-200 group relative',
                              isActive
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/30 font-bold tracking-wide'
                                : 'text-slate-300 font-medium hover:text-white hover:bg-slate-800 hover:pl-4',
                              collapsed ? 'justify-center px-2' : ''
                            )}
                          >
                            <Icon className={cn("h-[19px] w-[19px] shrink-0 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400")} />
                            {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                            {isActive && !collapsed && (
                              <div className="absolute right-3 w-2 h-2 rounded-full bg-white shadow-sm ring-2 ring-blue-500 animate-pulse" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Sidebar Footer / Profile Info */}
          <div className="mt-auto p-4 border-t border-[#334155] bg-[#0f172a]">
            {!collapsed ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-slate-600 shadow-sm relative">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-slate-700 text-slate-200 font-bold">{profile?.full_name ? getInitials(profile.full_name) : 'U'}</AvatarFallback>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-[#0f172a]"></span>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
                  <p className="text-xs text-slate-400 font-medium truncate">{getRoleBadge()}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg" onClick={() => setCollapsed(true)}><PanelLeft className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-9 w-9 border border-slate-600">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-slate-700 text-slate-200">{profile?.full_name ? getInitials(profile.full_name) : 'U'}</AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" className="w-full justify-center text-slate-500 hover:text-white hover:bg-slate-800" onClick={() => setCollapsed(false)}><ChevronRight className="h-5 w-5" /></Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Desktop Content Area */}
      <div className={cn("transition-all duration-300 min-h-screen", collapsed ? "lg:pl-[80px]" : "lg:pl-[280px]")}>
        <header className="sticky top-0 z-30 h-16 items-center gap-4 bg-white/80 backdrop-blur-md border-b border-sidebar-border px-6 flex">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Home className="h-4 w-4" />
            <span>/</span>
            <span className="font-medium text-foreground capitalize">{location.pathname.split('/')[1] || 'Dashboard'}</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-slate-50 rounded-xl">
                  <Avatar className="h-8 w-8 border border-slate-200">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback>{profile?.full_name ? getInitials(profile.full_name) : 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-bold text-slate-900 leading-none">{profile?.full_name?.split(' ')[0]}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{getRoleBadge()}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl border-slate-100 shadow-xl">
                <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}><User className="mr-2 h-4 w-4" /> Profil</DropdownMenuItem>
                {roles.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Ganti Role</DropdownMenuLabel>
                    {roles.map(r => (
                      <DropdownMenuItem key={r} onClick={() => switchRole(r as any)} className={r === activeRole ? "bg-slate-50" : ""}>
                        <Users className="mr-2 h-4 w-4" /> {getRoleLabel(r)}
                        {r === activeRole && <Check className="ml-auto h-3 w-3" />}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-700 focus:bg-red-50"><LogOut className="mr-2 h-4 w-4" /> Keluar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="">
          {children}
        </main>
      </div>
    </div>
  );
}
