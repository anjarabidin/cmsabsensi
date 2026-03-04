import { createContext, useContext, useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile } from '@/types';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  switchRole: (role: AppRole) => void;
  signIn: (email: string, password: string) => Promise<{ data?: { user: User | null; session: Session | null }; error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  navPermissions: Record<string, boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [navPermissions, setNavPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const initialProfileFetched = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Helper to get or create device ID
  const getDeviceId = () => {
    try {
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          deviceId = crypto.randomUUID();
        } else {
          deviceId = 'dev-' + Math.random().toString(36).substring(2, 15);
        }
        localStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (e) {
      return 'fallback-' + Date.now();
    }
  };

  const fetchProfile = async (userId: string): Promise<AppRole[]> => {
    console.log('🔐 [AuthContext] fetchProfile START for userId:', userId);
    // Safety timeout: if fetchProfile hangs > 10s, release loading to avoid permanent stuck
    const timeoutId = setTimeout(() => {
      console.error('🔐 [AuthContext] fetchProfile TIMEOUT (10s) — forcing setLoading(false)');
      setLoading(false);
    }, 10000);

    try {
      console.log('🔐 [AuthContext] fetchProfile: calling Supabase Promise.all...');
      // ⚡ OPTIMIZED: Fetch profile AND roles in PARALLEL (saves ~400ms round-trip)
      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(`*, department:department_id(id, name, code), job_position:job_position_id(id, title)`)
          .eq('id', userId)
          .single(),
        supabase.from('user_roles').select('role').eq('user_id', userId)
      ]);
      console.log('🔐 [AuthContext] fetchProfile: Supabase resolved. profileErr:', profileRes.error?.message, '| roleErr:', roleRes.error?.message);

      if (profileRes.error) {
        console.error('❌ Error fetching profile:', profileRes.error);
        setLoading(false);
        return [];
      }

      setProfile(profileRes.data as Profile);

      // 🚨 ACCOUNT APPROVAL CHECK
      // If the user's account is not active, sign them out immediately
      if (profileRes.data && profileRes.data.is_active === false) {
        console.warn('🔐 [AuthContext] Account is INACTIVE. Forcing sign out.');

        // Show a descriptive toast for the user
        toast({
          title: "Akun Belum Aktif",
          description: "Akun Anda sedang dalam peninjauan oleh Admin. Mohon tunggu persetujuan untuk dapat masuk.",
          variant: "destructive",
          duration: 6000
        });

        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
        setRole(null);
        setActiveRole(null);
        setLoading(false);
        return [];
      }

      if (roleRes.error) {
        console.error('❌ Error fetching roles:', roleRes.error);
        setLoading(false);
        return [];
      }

      const userRoles = (roleRes.data || []).map(r => r.role as AppRole);

      // Fallback to profile.role if user_roles is empty
      const effectiveRoles = userRoles.length === 0 && profileRes.data?.role
        ? [profileRes.data.role as AppRole]
        : userRoles;

      setRoles(effectiveRoles);

      const primaryRole = effectiveRoles.includes('super_admin') ? 'super_admin'
        : effectiveRoles.includes('admin_hr') ? 'admin_hr'
          : effectiveRoles.includes('manager') ? 'manager'
            : effectiveRoles.includes('employee') ? 'employee'
              : effectiveRoles.includes('driver') ? 'driver'
                : (profileRes.data?.role as AppRole);

      setRole(primaryRole);
      setActiveRole(primaryRole);

      // ⚡ Fetch Navigation Permissions (Role-based + User Overrides)
      const [rolePermsRes, userPermsRes] = await Promise.all([
        supabase.from('role_nav_permissions').select('nav_key, is_enabled').eq('role', primaryRole),
        supabase.from('user_nav_permissions').select('nav_key, is_enabled').eq('user_id', userId)
      ]);

      const perms: Record<string, boolean> = {};
      // 1. Apply role defaults
      (rolePermsRes.data || []).forEach(row => { perms[row.nav_key] = row.is_enabled; });
      // 2. Override with user-specific settings (if any)
      (userPermsRes.data || []).forEach(row => { perms[row.nav_key] = row.is_enabled; });

      setNavPermissions(perms);

      console.log('🔐 [AuthContext] fetchProfile DONE. primaryRole:', primaryRole);

      return effectiveRoles;
    } catch (error) {
      console.error('❌ Error in fetchProfile:', error);
      setLoading(false);
      return [];
    } finally {
      clearTimeout(timeoutId);
      // ⚡ Release loading state immediately after profile is set
      setLoading(false);
    }
  };

  const checkDeviceLock = async (userId: string, isSuperAdmin: boolean): Promise<{ success: boolean; error?: string }> => {
    const deviceId = getDeviceId();
    const userAgent = navigator.userAgent;

    try {
      // 1. Fetch ALL registered devices for this user
      const { data: userDevices } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId);

      const deviceList = userDevices || [];
      const currentDevice = deviceList.find(d => d.device_id === deviceId);

      // 2. Fetch max device limit from settings (default 3)
      const { data: maxDevicesSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'max_devices_per_user')
        .maybeSingle();

      const maxAllowed = parseInt(maxDevicesSetting?.value || '3', 10);

      // Case A: Device already registered
      if (currentDevice) {
        // Just update last login time
        supabase.from('user_devices')
          .update({ last_login: new Date().toISOString() })
          .eq('id', currentDevice.id)
          .then(() => { });
        return { success: true };
      }

      // Case B: New device, check limit
      if (deviceList.length >= maxAllowed) {
        // Super Admin can "take over" (replace the oldest device if limit reached)
        if (isSuperAdmin) {
          const oldestDevice = [...deviceList].sort((a, b) =>
            new Date(a.last_login).getTime() - new Date(b.last_login).getTime()
          )[0];

          await supabase.from('user_devices')
            .update({
              device_id: deviceId,
              device_name: `${userAgent} (Admin Asset)`,
              last_login: new Date().toISOString()
            })
            .eq('id', oldestDevice.id);

          return { success: true };
        }

        return {
          success: false,
          error: `AKSES DITOLAK: Anda sudah mencapai batas maksimal ${maxAllowed} perangkat. Silakan reset perangkat lama via Admin.`
        };
      }

      // Case C: Register new device (under limit)
      await supabase.from('user_devices').insert({
        user_id: userId,
        device_id: deviceId,
        device_name: userAgent,
        last_login: new Date().toISOString()
      });

      return { success: true };
    } catch (err) {
      console.error('[Auth] Device check error:', err);
      return { success: true }; // Fail open to not block users if DB is flaking
    }
  };

  useEffect(() => {
    let authSubscription: any;

    const init = async () => {
      // Global safety timeout to prevent permanent spinner
      const globalTimeout = setTimeout(() => {
        if (loading) {
          console.warn('🔐 [AuthContext] Global Init Timeout (8s) — forcing setLoading(false)');
          setLoading(false);
        }
      }, 8000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('🔐 [AuthContext] Session found in init(), fetching profile...');
          if (!initialProfileFetched.current) {
            initialProfileFetched.current = true;
            // Fetch profile immediately to speed up initial load
            const roles = await fetchProfile(session.user.id);
            // ⚡ Security: Check device lock on initial session too
            checkDeviceLock(session.user.id, roles.includes('super_admin')).then(({ success }) => {
              if (!success) {
                toast({
                  title: "Akses Perangkat Ditolak",
                  description: "Akun Anda terdaftar di perangkat lain. Silakan hubungi admin.",
                  variant: "destructive"
                });
                supabase.auth.signOut().then(() => {
                  setProfile(null); setRole(null); setRoles([]); setActiveRole(null);
                });
              }
            });
          }
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('[Auth] Init error:', e);
        setLoading(false);
      } finally {
        clearTimeout(globalTimeout);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('🔐 [AuthContext] onAuthStateChange event:', event);
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newSession?.user) {
          // 🛡️ Guard: If we already have a profile for THIS user and we're not explicitly forced,
          // OR if we are already in the middle of an initial fetch, skip it.
          // This prevents double-fetching during complex bootstrap (init + onAuthStateChange).
          const isFetchingSameUser = initialProfileFetched.current && user?.id === newSession.user.id;

          if (isFetchingSameUser && event === 'INITIAL_SESSION') {
            console.log('🔐 [AuthContext] Profile for user already fetching/fetched (INITIAL_SESSION), skipping.');
            return;
          }

          if (isFetchingSameUser && event === 'SIGNED_IN' && profile) {
            console.log('🔐 [AuthContext] Profile for user already exists (SIGNED_IN), skipping redundant fetch.');
            return;
          }

          initialProfileFetched.current = true;
          // Use a small delay for SIGNED_IN events to ensure state is settled
          const delay = event === 'SIGNED_IN' ? 100 : 0;

          setTimeout(async () => {
            if (newSession.user.id !== userIdRef.current) {
              userIdRef.current = newSession.user.id;
              console.log('🔐 [AuthContext] fetchProfile executing (deferred tick)...');
              const userRoles = await fetchProfile(newSession.user!.id);
              // Device lock in background — never block the UI
              checkDeviceLock(newSession.user!.id, userRoles.includes('super_admin')).then(({ success }) => {
                if (!success) {
                  toast({
                    title: "Akses Perangkat Ditolak",
                    description: "Akun Anda terdaftar di perangkat lain. Silakan hubungi admin.",
                    variant: "destructive"
                  });
                  supabase.auth.signOut().then(() => {
                    setProfile(null); setRole(null); setRoles([]); setActiveRole(null);
                  });
                }
              });
            }
          }, delay);
        }
      } else if (event === 'SIGNED_OUT') {
        initialProfileFetched.current = false;
        setProfile(null);
        setRole(null);
        setRoles([]);
        setActiveRole(null);
        setLoading(false);
      } else {
        // TOKEN_REFRESHED, PASSWORD_RECOVERY, etc. — never touch profile state
        console.log('🔐 [AuthContext] Ignoring non-profile event:', event);
      }
    });

    authSubscription = subscription;
    return () => authSubscription?.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setRoles([]);
    setActiveRole(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const hasRole = (r: AppRole) => roles.includes(r);

  const switchRole = async (r: AppRole) => {
    if (roles.includes(r) && user) {
      setActiveRole(r);
      // ⚡ Update permissions when switching roles (including user overrides)
      const [rolePermsRes, userPermsRes] = await Promise.all([
        supabase.from('role_nav_permissions').select('nav_key, is_enabled').eq('role', r),
        supabase.from('user_nav_permissions').select('nav_key, is_enabled').eq('user_id', user.id)
      ]);

      const perms: Record<string, boolean> = {};
      (rolePermsRes.data || []).forEach(row => { perms[row.nav_key] = row.is_enabled; });
      (userPermsRes.data || []).forEach(row => { perms[row.nav_key] = row.is_enabled; });

      setNavPermissions(perms);
    }
  };

  const authValue = useMemo(() => ({
    user,
    session,
    profile,
    role,
    roles,
    activeRole,
    loading,
    hasRole,
    switchRole,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    navPermissions
  }), [user, session, profile, role, roles, activeRole, loading, navPermissions]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
