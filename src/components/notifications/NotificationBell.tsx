import { useState, useEffect } from 'react';
import { Bell, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'leave' | 'overtime' | 'payroll' | 'system' | 'onboarding';
  read: boolean;
  created_at: string;
  link?: string;
  is_action_required?: boolean;
}

interface NotificationBellProps {
  iconClassName?: string;
}

export function NotificationBell({ iconClassName }: NotificationBellProps) {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      requestNotificationPermission();

      // Subscribe to Realtime Notifications
      const channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);

            // Toast Alert (Sonner)
            import('sonner').then(({ toast }) => {
              toast(newNotif.title, {
                description: newNotif.message,
                icon: getNotificationIcon(newNotif.type, newNotif.title),
                action: newNotif.link ? {
                  label: 'Buka',
                  onClick: () => navigate(newNotif.link!)
                } : undefined
              });
            });

            // Trigger Native Browser Notification (Muncul di HP)
            if (Notification.permission === 'granted') {
              new Notification(newNotif.title, {
                body: newNotif.message,
                icon: '/logo.png', // Pastikan ada logo.png di public
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, activeRole]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!user) return;

      let allNotifications: Notification[] = [];

      // 1. Fetch System Notifications
      const { data: systemNotifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (systemNotifs) allNotifications = [...systemNotifs] as Notification[];

      // 2. Fetch "Action Items" for HR (Onboarding Verifications)
      // Only if role is admin_hr
      if (activeRole === 'admin_hr') {
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('onboarding_status', 'pending_verification');

        if (!countError && count && count > 0) {
          // Add a synthetic notification at the top
          const onboardingNotif: Notification = {
            id: 'action-onboarding',
            title: 'Verifikasi Karyawan Baru',
            message: `${count} karyawan menunggu verifikasi data.`,
            type: 'onboarding',
            read: false,
            created_at: new Date().toISOString(),
            link: '/employees',
            is_action_required: true
          };
          allNotifications.unshift(onboardingNotif);
        }
      }

      setNotifications(allNotifications);

      // Count unread (including the action item which is always 'unread' until resolved)
      const unread = allNotifications.filter((n) => !n.read).length;
      setUnreadCount(unread);

    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    // If it's a synthetic action item, we don't mark as read in DB, we just navigate
    if (notificationId.startsWith('action-')) {
      return;
    }

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
  };

  const markAllAsRead = async () => {
    // Optimistic update for DB notifications only
    setNotifications(prev => prev.map(n => n.is_action_required ? n : { ...n, read: true }));

    // Recalculate unread count (Action items remain unread)
    const remainingUnread = notifications.filter(n => n.is_action_required).length;
    setUnreadCount(remainingUnread);

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user?.id)
      .eq('read', false);
  };

  const getNotificationIcon = (type: string, title?: string) => {
    if (title?.includes('Pengumuman')) return '📢';
    switch (type) {
      case 'leave': return '🏖️';
      case 'overtime': return '⏰';
      case 'payroll': return '💰';
      case 'onboarding': return '👋';
      case 'system': return '⚙️';
      default: return '🔔';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className={iconClassName || "h-5 w-5 text-slate-500 group-hover:text-blue-600 transition-colors"} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="font-bold text-slate-800">Notifikasi</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
              onClick={markAllAsRead}
            >
              Tandai semua dibaca
            </Button>
          )}
        </DropdownMenuLabel>

        {notifications.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 flex flex-col items-center">
            <Bell className="h-8 w-8 mb-2 opacity-20" />
            <span>Tidak ada notifikasi baru</span>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-pointer border-b border-slate-50 last:border-0 ${notification.is_action_required ? 'bg-blue-50/70' : (!notification.read ? 'bg-slate-50' : '')
                  }`}
                onClick={() => {
                  markAsRead(notification.id);
                  if (notification.link) {
                    navigate(notification.link);
                    setOpen(false);
                  }
                }}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center text-sm shadow-sm ${notification.type === 'onboarding' ? 'bg-blue-100 text-blue-600' : 'bg-white border border-slate-100'
                    }`}>
                    {notification.type === 'onboarding' ? <UserPlus className="h-4 w-4" /> : getNotificationIcon(notification.type, notification.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.read ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                      {format(new Date(notification.created_at), 'dd MMM, HH:mm', { locale: id })}
                      {notification.is_action_required && (
                        <span className="text-blue-600 font-bold ml-1">• Butuh Tindakan</span>
                      )}
                    </p>
                  </div>
                  {!notification.read && !notification.is_action_required && (
                    <div className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
