import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
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
  Scan,
  Timer,
  Briefcase,
  ClipboardCheck,
  Newspaper,
  StickyNote
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
  roles?: ('admin_hr' | 'manager' | 'employee')[];
}

// Global Nav Groups for Desktop Sidebar
const navGroups = [
  {
    title: 'Menu Karyawan',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Berita & Info', href: '/information', icon: Newspaper },
      { title: 'Absensi', href: '/attendance', icon: Clock },
      { title: 'Agenda Kerja', href: '/agenda', icon: ClipboardCheck },
      { title: 'Catatan Pribadi', href: '/notes', icon: StickyNote },
      { title: 'Cuti / Izin', href: '/leave', icon: Briefcase },
      { title: 'Lembur', href: '/overtime', icon: Timer },
      { title: 'Riwayat', href: '/history', icon: Calendar },
      { title: 'Reimbursement', href: '/reimbursement', icon: Receipt },
    ]
  },
  {
    title: 'Manajemen Tim',
    roles: ['admin_hr', 'manager'],
    items: [
      { title: 'Jadwal & Shift', href: '/shifts', icon: Clock, roles: ['admin_hr'] },
      { title: 'Pantau Tim', href: '/team-map', icon: Navigation, roles: ['admin_hr', 'manager'] },
      { title: 'Lokasi Kantor', href: '/locations', icon: MapPin, roles: ['admin_hr'] },
    ]
  },
  {
    title: 'Finansial & Laporan',
    roles: ['admin_hr'],
    items: [
      { title: 'Gaji & Payroll', href: '/payroll', icon: DollarSign, roles: ['admin_hr'] },
      { title: 'Laporan Gaji', href: '/payroll-report', icon: Receipt, roles: ['admin_hr'] },
    ]
  }
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  usePushNotifications();
  const { profile, roles, activeRole, switchRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

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
      case 'admin_hr': return 'HRD';
      case 'manager': return 'Manager';
      case 'employee': return 'Staff';
      default: return '';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
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

          {/* Floating Scan Button (Compact) */}
          <div className="relative -top-6">
            <button
              onClick={() => navigate('/quick-attendance')}
              className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transform transition-all active:scale-90 border-[4px] border-white"
            >
              <Scan className="h-6 w-6" />
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
          "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-sm transition-all duration-300 lg:block hidden",
          collapsed ? "w-[80px]" : "w-[280px]"
        )}
      >
        <div className="flex flex-col h-full">
          <nav className={cn("flex flex-col gap-1 overflow-y-auto py-4", collapsed ? "items-center" : "")}>
            <div className={cn("flex items-center h-16 border-b border-sidebar-border mb-4 shrink-0", collapsed ? "justify-center px-0" : "px-6")}>
              <AppLogo variant="light" className={cn("h-9 w-auto transition-all", collapsed ? "opacity-0 scale-0" : "opacity-100 scale-100")} />
              {collapsed && <div className="h-10 w-10 bg-sidebar-primary rounded-xl flex items-center justify-center font-bold text-white shadow-lg">A</div>}
            </div>

            <div className={cn("flex-1 space-y-6", collapsed ? "px-2" : "px-4")}>
              {navGroups.map((group) => {
                if (group.roles && !group.roles.some(r => roles.includes(r as any))) return null;
                const visibleItems = group.items.filter(item => !item.roles || (activeRole && item.roles.includes(activeRole as any)));
                if (visibleItems.length === 0) return null;

                return (
                  <div key={group.title}>
                    {!collapsed && <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-widest px-2 mb-2">{group.title}</p>}
                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 group relative',
                              isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20 font-medium' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                              collapsed ? 'justify-center px-2 py-3' : ''
                            )}
                          >
                            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
                            {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>

          <div className="mt-auto p-4 border-t border-sidebar-border bg-sidebar/50">
            {!collapsed ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border-2 border-sidebar-border">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{profile?.full_name ? getInitials(profile.full_name) : 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name}</p>
                  <p className="text-xs text-sidebar-foreground/70">{getRoleBadge()}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/70" onClick={() => setCollapsed(true)}><PanelLeft className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="w-full justify-center text-sidebar-foreground/70" onClick={() => setCollapsed(false)}><PanelLeftClose className="h-4 w-4" /></Button>
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
