import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile } from '@/types';

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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      setProfile(profileData as Profile);

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (roleError) {
        console.error('Error fetching roles:', roleError);
        return;
      }

      const userRoles = (roleData || []).map(r => r.role as AppRole);
      setRoles(userRoles);
      const primaryRole = userRoles.includes('super_admin') ? 'super_admin'
        : userRoles.includes('admin_hr') ? 'admin_hr'
          : userRoles.includes('manager') ? 'manager'
            : userRoles.includes('employee') ? 'employee'
              : (profileData.role as AppRole); // Fallback to profile.role if user_roles table is empty/unsynced

      setRole(primaryRole);
      setActiveRole(primaryRole);

      // Sync user_roles state if empty but profile has role
      if (userRoles.length === 0 && profileData.role) {
        setRoles([profileData.role as AppRole]);
      }
      setActiveRole(primaryRole);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setRoles([]);
          setActiveRole(null);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper to get or create device ID
  const getDeviceId = () => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  };

  const signIn = async (email: string, password: string) => {
    // 1. Standard Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error };
    if (!data.user) return { error: new Error("User not found") };

    // 2. Device Locking Logic
    const deviceId = getDeviceId();
    const userAgent = navigator.userAgent;

    try {
      // Check if user has a registered device
      const { data: existingDevice } = await supabase
        .from('user_devices')
        .select('device_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (existingDevice) {
        // Enforce Lock
        if (existingDevice.device_id !== deviceId) {
          // Auto-logout if unauthorized device
          await supabase.auth.signOut();
          return {
            error: new Error("AKSES DITOLAK: Akun ini terkunci pada perangkat lain. Hubungi HR untuk reset.")
          };
        }
      } else {
        // First time login: Register this device
        const { error: registerError } = await supabase
          .from('user_devices')
          .insert({
            user_id: data.user.id,
            device_id: deviceId,
            device_name: userAgent
          });

        if (registerError) {
          console.error("Device registration failed:", registerError);
          // Optional: decide if we block login if registration fails
        }
      }
    } catch (err) {
      console.error("Device verification error:", err);
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
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
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const hasRole = (checkRole: AppRole) => {
    return roles.includes(checkRole);
  };

  const switchRole = (newRole: AppRole) => {
    if (roles.includes(newRole)) {
      setActiveRole(newRole);
    }
  };

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
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
