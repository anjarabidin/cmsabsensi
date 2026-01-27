import { ReactNode, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  Camera
} from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ('super_admin' | 'admin_hr' | 'manager' | 'employee')[];
}

// Role-specific Navigation Configurations
const employeeNavGroups = [
  {
    title: 'Utama',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Absensi', href: '/attendance', icon: Clock },
      { title: 'Agenda Kerja', href: '/agenda', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Permohonan',
    items: [
      { title: 'Cuti / Izin', href: '/leave', icon: Briefcase },
      { title: 'Lembur', href: '/overtime', icon: Timer },
      { title: 'Reimbursement', href: '/reimbursement', icon: Receipt },
      { title: 'Koreksi Absen', href: '/corrections', icon: Check },
    ]
  },
  {
    title: 'Info & Riwayat',
    items: [
      { title: 'Riwayat', href: '/history', icon: Calendar },
      { title: 'Catatan', href: '/notes', icon: StickyNote },
      { title: 'Berita & Info', href: '/information', icon: Newspaper },
      { title: 'Album Kenangan', href: '/albums', icon: Camera },
      { title: 'Pengaturan', href: '/profile', icon: Settings },
    ]
  }
];

const adminNavGroups = [
  {
    title: 'Overview',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Pusat Persetujuan', href: '/approvals', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Manajemen SDM',
    items: [
      { title: 'Data Karyawan', href: '/employees', icon: Users },
      { title: 'Jadwal & Shift', href: '/shifts', icon: Clock },
      { title: 'Lokasi Kantor', href: '/locations', icon: MapPin },
      { title: 'Pantau Tim', href: '/team-map', icon: Navigation },
      { title: 'Laporan Kehadiran', href: '/reports', icon: BarChart3 },
    ]
  },
  {
    title: 'Keuangan',
    items: [
      { title: 'Gaji & Payroll', href: '/payroll', icon: DollarSign },
      { title: 'Laporan Gaji', href: '/payroll-report', icon: FileText },
      { title: 'Reimbursement', href: '/reimbursement', icon: Receipt },
    ]
  },
  {
    title: 'Perusahaan',
    items: [
      { title: 'Berita & Info', href: '/information', icon: Newspaper },
      { title: 'Album Kenangan', href: '/albums', icon: Camera },
    ]
  },
  {
    title: 'Menu Saya',
    items: [
      { title: 'Absensi', href: '/attendance', icon: Clock },
      { title: 'Riwayat Saya', href: '/history', icon: Calendar },
      { title: 'Cuti & Izin', href: '/leave', icon: Briefcase },
      { title: 'Agenda', href: '/agenda', icon: ClipboardCheck },
      { title: 'Pengaturan', href: '/profile', icon: Settings },
    ]
  }
];

const superAdminNavGroups = [
  {
    title: 'Super Admin',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Audit Logs', href: '/audit-logs', icon: FileText },
      { title: 'System Settings', href: '/settings', icon: Settings },
    ]
  },
  {
    title: 'Manajemen SDM',
    items: [
      { title: 'Data Karyawan', href: '/employees', icon: Users },
      { title: 'Jadwal & Shift', href: '/shifts', icon: Clock },
      { title: 'Lokasi Kantor', href: '/locations', icon: MapPin },
      { title: 'Pantau Tim', href: '/team-map', icon: Navigation },
      { title: 'Laporan', href: '/reports', icon: BarChart3 },
    ]
  },
  {
    title: 'Keuangan',
    items: [
      { title: 'Gaji & Payroll', href: '/payroll', icon: DollarSign },
      { title: 'Laporan Gaji', href: '/payroll-report', icon: FileText },
    ]
  },
  {
    title: 'Approval',
    items: [
      { title: 'Pusat Approval', href: '/approvals', icon: ClipboardCheck },
    ]
  }
];

const managerNavGroups = [
  {
    title: 'Overview',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Pusat Persetujuan', href: '/approvals', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Kelola Tim',
    items: [
      { title: 'Jadwal Tim', href: '/shifts', icon: Clock },
      { title: 'Lokasi Tim', href: '/team-map', icon: Navigation },
      { title: 'Anggota Tim', href: '/employees', icon: Users },
      { title: 'Album', href: '/albums', icon: Camera },
      { title: 'Evaluasi Tim', href: '/reports', icon: BarChart3 },
    ]
  },
  {
    title: 'Pribadi',
    items: [
      { title: 'Absensi Saya', href: '/attendance', icon: Clock },
      { title: 'Riwayat Saya', href: '/history', icon: Calendar },
      { title: 'Cuti Saya', href: '/leave', icon: Briefcase },
      { title: 'Agenda Saya', href: '/agenda', icon: ClipboardCheck },
      { title: 'Pengaturan', href: '/profile', icon: Settings },
    ]
  }
];

const getNavGroups = (role: string) => {
  if (role === 'super_admin') return superAdminNavGroups;
  if (role === 'admin_hr') return adminNavGroups;
  if (role === 'manager') return managerNavGroups;
  return employeeNavGroups;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  usePushNotifications();
  const { profile, roles, activeRole, switchRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

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
      default: return '';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'System Administrator';
      case 'admin_hr': return 'Administrator';
      case 'manager': return 'Manajer';
      case 'employee': return 'Karyawan';
      default: return '';
    }
  };

  // -------------------------------------------------------------------------
  // RENDER MOBILE LAYOUT (FROZEN FOR MOBILE)
  // -------------------------------------------------------------------------
  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col overflow-x-hidden">
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

          {/* Floating Scan Button (Compact) - COMING SOON */}
          <div className="relative -top-6">
            <button
              onClick={() => {
                toast({
                  title: "Fitur Segera Hadir",
                  description: "Dashboard Scan Wajah masih dalam tahap pengembangan.",
                  duration: 3000,
                });
              }}
              className="h-14 w-14 rounded-full bg-slate-100 text-slate-400 shadow-lg flex items-center justify-center transform transition-all active:scale-90 border-[4px] border-white ring-2 ring-slate-100"
            >
              <ScanFace className="h-7 w-7 opacity-50" />
            </button>
          </div>

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
              {getNavGroups(activeRole || 'employee').map((group) => {
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
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
