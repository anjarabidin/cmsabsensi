import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FaceLogin } from '@/components/auth/FaceLogin';
import { Loader2, Lock, Mail, User, ArrowRight, Sparkles, Fingerprint, ScanFace, Smartphone, HelpCircle, BookOpen, ExternalLink, Info, Calendar, Clock, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { AppLogo } from '@/components/AppLogo';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import useEmblaCarousel from 'embla-carousel-react';

const loginEmailSchema = z.string().email('Email tidak valid');
const registerEmailSchema = z.string().email('Email tidak valid');
const passwordSchema = z.string().min(6, 'Password minimal 6 karakter');
const nameSchema = z.string().min(2, 'Nama minimal 2 karakter');
const phoneSchema = z.string().min(10, 'Nomor WhatsApp minimal 10 digit').regex(/^[0-9]+$/, 'Hanya angka');

import { useIsMobile } from '@/hooks/useIsMobile';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrorMessage, setLoginErrorMessage] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [lastUser, setLastUser] = useState<{ id?: string; email: string; name: string; avatar?: string } | null>(null);
  const [activeTab, setActiveTab] = useState('login');
  const [justRegistered, setJustRegistered] = useState(false);
  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [currentSlide, setCurrentSlide] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false);
  const [approvalEnabled, setApprovalEnabled] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['enable_account_approval']);

      if (data) {
        const approval = data.find(s => s.key === 'enable_account_approval');
        if (approval) {
          const val = approval.value;
          setApprovalEnabled(val === true || String(val).replace(/"/g, '') === 'true');
        }
      }
    };
    fetchSettings();
    const saved = localStorage.getItem('last_active_user');
    const fpEnabled = localStorage.getItem('fingerprint_enabled') === 'true';
    if (saved) {
      setLastUser(JSON.parse(saved));
    }
    setFingerprintEnabled(fpEnabled);

    // Cek hardware biometrik (khusus Native)
    if (Capacitor.isNativePlatform()) {
      NativeBiometric.isAvailable().then(result => {
        setHasBiometricHardware(result.isAvailable);
      }).catch(() => setHasBiometricHardware(false));
    }
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoginErrorMessage('');

    try {
      loginEmailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors[0].message;
        toast({
          title: 'Validasi Gagal',
          description: message,
          variant: 'destructive',
        });
        setLoginErrorMessage(message);
        return;
      }
    }

    setIsLoading(true);

    const { data: authData, error } = await signIn(loginEmail, loginPassword);

    if (error) {
      let message = 'Terjadi kesalahan saat login';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email atau kata sandi salah';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Email belum dikonfirmasi. Silakan cek inbox Anda';
      }

      toast({
        title: 'Login Gagal',
        description: message,
        variant: 'destructive',
      });
      setLoginErrorMessage(message);
    } else {
      // Save user for quick access
      if (authData?.user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', authData.user.id).single();
        localStorage.setItem('last_active_user', JSON.stringify({
          id: authData.user.id,
          email: loginEmail,
          name: profile?.full_name || 'Staf',
          avatar: profile?.avatar_url
        }));
      }
      navigate('/dashboard');
    }

    setIsLoading(false);
  };

  const handleBiometricLogin = async () => {
    if (!lastUser) {
      toast({
        title: 'Biometrik Belum Aktif',
        description: 'Silakan masuk dengan email & password satu kali dahulu.',
        variant: 'destructive',
      });
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    // Prioritas 1: Native Biometric (Sidik Jari/FaceID Bawaan)
    if (isNative && hasBiometricHardware) {
      handleNativeBiometric();
      return;
    }

    // Prioritas 2: Web Authentication (Jika FaceLogin Enabled)
    // Jika fingerprintEnabled (web simulation) ATAU face_login_enabled true
    if (fingerprintEnabled && !isNative) {
      // Web Simulation for Fingerprint
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        toast({
          title: 'Simulasi Fingerprint (Web)',
          description: `Login berhasil! Menggunakan akun: ${lastUser.name}`,
        });
        navigate('/dashboard');
      }, 1000);
    } else {
      // Fallback ke Kamera Wajah (App-based Face Recognition)
      // Ini akan membuka dialog FaceLogin yang menggunakan kamera & MediaPipe
      // Cocok untuk PWA di iOS/Android yang tidak bisa akses native biometric
      setShowFaceLogin(true);
    }
  };

  const handleNativeBiometric = async () => {
    try {
      setIsLoading(true);

      await NativeBiometric.verifyIdentity({
        reason: "Masuk ke Akun Anda",
        title: "Verifikasi Biometrik",
        subtitle: "Gunakan Sidik Jari atau Wajah untuk masuk",
        description: "Tempelkan jari Anda pada sensor",
        negativeButtonText: "Batal",
        maxAttempts: 3 // Limit percobaan
      });

      toast({
        title: 'Verifikasi Berhasil',
        description: `Selamat datang kembali, ${lastUser?.name}!`,
      });
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Biometric error:', error);

      // Handle User Cancelled specificaly
      if (error.message?.includes('User canceled') || error.code === '10' || error.code === '13') {
        // User sengaja batal, jangan tampilkan error, dan jangan paksa buka kamera wajah
        setIsLoading(false);
        return;
      }

      // Handle Failed Attempt but user might want to retry
      toast({
        title: 'Gagal Verifikasi',
        description: 'Sidik jari tidak dikenali. Silakan coba lagi atau gunakan password.',
        variant: 'destructive',
        duration: 3000
      });

      // Opsional: Fallback ke Face Login jika sensor rusak/gagal terus
      // setShowFaceLogin(true); 
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger biometric login if enabled
  useEffect(() => {
    const faceLoginEnabled = localStorage.getItem('face_login_enabled') === 'true';
    // Only auto-trigger once on mount, not on every state change
    if (faceLoginEnabled && lastUser && !isLoading && !showFaceLogin && !authLoading) {
      const timer = setTimeout(() => {
        handleBiometricLogin();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const onFaceVerified = (success: boolean, data?: any) => {
    if (success) {
      toast({
        title: 'Wajah Terverifikasi',
        description: `Selamat datang kembali, ${lastUser?.name}!`,
      });
      setShowFaceLogin(false);
      // For the demo/prototype, we'll navigate directly. 
      // In a real system, you'd use the verified identity to establish a session.
      navigate('/dashboard');
    } else {
      toast({
        title: 'Verifikasi Gagal',
        description: data?.error || 'Wajah tidak dikenali atau terjadi kesalahan.',
        variant: 'destructive',
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (justRegistered) {
      toast({
        title: 'Pendaftaran Sudah Dikirim',
        description: 'Silakan cek email Anda dan login.',
        variant: 'default',
        duration: 5000,
      });
      return;
    }

    try {
      nameSchema.parse(registerName);
      registerEmailSchema.parse(registerEmail);
      passwordSchema.parse(registerPassword);
      phoneSchema.parse(registerPhone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validasi Gagal',
          description: error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);

    // Send phone and NIK as metadata
    const { data: authData, error } = await supabase.auth.signUp({
      email: registerEmail,
      password: registerPassword,
      options: {
        data: {
          full_name: registerName,
          phone: registerPhone,
        },
      },
    });

    if (error) {
      console.error('Registration Error:', error);
      let message = error.message || 'Terjadi kesalahan saat registrasi';

      if (error.message.includes('User already registered') || error.message.includes('unique constraint')) {
        message = 'Email sudah terdaftar. Silakan login';
      } else if (error.message.toLowerCase().includes('rate limit')) {
        message = 'Terlalu banyak percobaan (Rate Limit). Coba ganti koneksi internet (IP) atau tunggu 1 jam.';
      }

      toast({
        title: 'Registrasi Gagal',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
    } else {
      // Cek apakah Auto-Login berhasil (Email Confirmation Disabled)
      if (authData.session) {
        if (approvalEnabled) {
          toast({
            title: 'Pendaftaran Terkirim! ⏳',
            description: 'Akun Anda sedang dalam proses peninjauan oleh Admin. Mohon tunggu persetujuan untuk dapat masuk.',
            duration: 8000,
          });
          setJustRegistered(true);
        } else {
          toast({
            title: 'Registrasi Berhasil! 🎉',
            description: 'Akun Anda telah dibuat. Mengalihkan ke Dashboard...',
            variant: 'default',
          });
        }
      } else {
        // Cek jika akun butuh approval
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', authData.user?.id)
          .single();

        if (profile && !profile.is_active) {
          toast({
            title: 'Pendaftaran Terkirim! ⏳',
            description: 'Akun Anda sedang dalam proses peninjauan oleh Admin. Mohon tunggu notifikasi selanjutnya.',
            duration: 8000,
          });
          setJustRegistered(true);
        } else {
          toast({
            title: 'Registrasi Berhasil! 🎉',
            description: 'Akun berhasil dibuat. Silakan Login.',
            duration: 3000,
            variant: 'default',
          });
          setTimeout(() => {
            setActiveTab('login');
            setJustRegistered(false);
          }, 1500);
        }
      }

      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterPhone('');
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Render form content directly to avoid re-creation on every render
  const renderAuthForm = () => (
    <Card className={cn("border-0 shadow-none bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden animate-in zoom-in-95 fade-in duration-500", !isMobile && "shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl")}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="px-8 pt-8">
          <TabsList className="grid w-full grid-cols-2 h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 p-1.5">
            <TabsTrigger
              value="login"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all duration-300"
            >
              Masuk
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all duration-300"
            >
              Daftar
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="login" className="mt-0">
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6 pt-8 pb-4 px-8">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
                  Email Perusahaan
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="nama@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                    className="h-14 pl-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 transition-all text-base focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="login-password" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
                    Password
                  </Label>
                  <a href="#" className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline">
                    Lupa password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="current-password"
                    className="h-14 pl-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 transition-all text-base focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {loginErrorMessage && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  {loginErrorMessage}
                </div>
              )}

              {lastUser && (
                <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-100 dark:border-slate-800"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-bold tracking-widest">Atau Akses Cepat</span>
                    </div>
                  </div>

                  <Button
                    className="w-full h-16 rounded-2xl border-2 border-blue-50 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 transition-all group overflow-hidden relative"
                  >
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4 px-2">
                      <div className="relative">
                        {lastUser.avatar ? (
                          <img src={lastUser.avatar} className="h-10 w-10 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm" alt="Avatar" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs border-2 border-white dark:border-slate-700 shadow-sm">
                            {lastUser.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 shadow-sm border border-slate-100 dark:border-slate-700">
                          <Fingerprint className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Masuk Sebagai</p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">{lastUser.name}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <Fingerprint className="h-5 w-5 text-blue-500 group-hover:animate-pulse" />
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Button>
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-4 pb-8 px-8 flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base font-bold rounded-2xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98] group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk Sekarang
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="flex justify-center w-full animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-blue-600 gap-2 text-xs font-semibold tracking-wide w-full hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (!lastUser) {
                      toast({
                        title: 'Aktivasi Diperlukan 🔒',
                        description: 'Mohon Login Manual satu kali untuk memverifikasi perangkat ini.',
                        duration: 5000,
                      });
                    } else {
                      handleBiometricLogin();
                    }
                  }}
                >
                  {hasBiometricHardware ? <Fingerprint className="h-4 w-4" /> : <ScanFace className="h-4 w-4" />}
                  Login Alternatif (Biometrik)
                </Button>
              </div>
            </CardFooter>
          </form>
        </TabsContent>

        <TabsContent value="register" className="mt-0">
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4 pt-8 pb-4 px-8">
              <div className="space-y-2">
                <Label htmlFor="register-name" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
                  Nama Lengkap
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Nama Lengkap"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    disabled={isLoading || justRegistered}
                    required
                    autoComplete="name"
                    className="h-12 pl-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
                  Email Perusahaan
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="nama@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    disabled={isLoading || justRegistered}
                    required
                    autoComplete="email"
                    className="h-12 pl-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-phone" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
                  No. WhatsApp
                </Label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="register-phone"
                    type="tel"
                    placeholder="08123456789"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, ''))}
                    disabled={isLoading || justRegistered}
                    required
                    maxLength={15}
                    autoComplete="tel"
                    className="h-12 pl-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>


              <div className="space-y-2">
                <Label htmlFor="register-password" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={isLoading || justRegistered}
                    required
                    autoComplete="new-password"
                    className="h-12 pl-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-4 pb-8 px-8">
              <Button
                type="submit"
                className="w-full h-14 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white text-base font-bold rounded-2xl shadow-lg shadow-slate-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-500/40 active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || justRegistered}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Daftar Akun Baru
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );

  // -------------------------------------------------------------------------
  // RENDER: MOBILE VIEW (STRICT PRESERVATION)
  // -------------------------------------------------------------------------
  if (isMobile) {
    return (
      <div className="h-[100dvh] bg-white dark:bg-slate-950 flex flex-col overflow-hidden relative">
        {/* Subtle decorative accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-900/50 rounded-bl-full -z-0" />

        <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col h-full">
          {/* Top Bar - Ultra Minimal */}
          <div className="flex items-center justify-between px-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
            <div className="animate-in fade-in duration-700">
              <img src="/logo.png" alt="CMS Duta Solusi" className="h-10 w-auto object-contain" />
            </div>
            <button
              onClick={() => setShowGuide(true)}
              className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-50 dark:bg-slate-900 rounded-full"
            >
              <BookOpen className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center px-7 pb-[calc(3rem+env(safe-area-inset-bottom))]">
            {/* Minimal Form Container - Perfect No-Scroll Fit */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="border border-slate-100 dark:border-slate-800 rounded-[32px] bg-white dark:bg-slate-900/30 overflow-hidden shadow-sm">
                {renderAuthForm()}
              </div>
            </div>

            {/* Subtle Brand Signature */}
            <div className="mt-10 flex flex-col items-center gap-2 opacity-30 animate-in fade-in duration-1000 delay-500">
              <p className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em]">CMS Duta Solusi</p>
              <div className="h-[1px] w-12 bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Face Login Dialog */}
        <Dialog open={showFaceLogin} onOpenChange={setShowFaceLogin}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-transparent">
            <FaceLogin
              onVerificationComplete={onFaceVerified}
              employeeId={lastUser?.id}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog Panduan Pengguna (Minimalist & Professional) */}
        <Dialog open={showGuide} onOpenChange={setShowGuide}>
          <DialogContent className="w-[90vw] sm:max-w-md p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 shadow-2xl">
            {/* Minimal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">User Guide — Ver. 3.0</span>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={cn("h-1 w-1 rounded-full transition-all duration-300", currentSlide === i ? "bg-slate-900 dark:bg-white scale-125" : "bg-slate-200 dark:bg-slate-800")} />
                ))}
              </div>
            </div>

            {/* Compact Slider */}
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex">
                {/* Section 1: Setup */}
                <div className="flex-[0_0_100%] min-w-0 p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Instalasi Aplikasi</h3>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Akses PWA melalui Google Chrome</p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { step: "01", text: "Pastikan koneksi internet stabil & kuota mencukupi." },
                      { step: "02", text: "Buka URL absensi hanya melalui browser Google Chrome." },
                      { step: "03", text: "Tunggu halaman termuat sepenuhnya dengan sempurna." },
                      { step: "04", text: "Ketuk ikon Titik Tiga (⋮) di pojok kanan atas browser." },
                      { step: "05", text: "Cari & pilih menu 'Instal Aplikasi' atau 'Pasang'." },
                      { step: "06", text: "Konfirmasi pemasangan & tunggu hingga muncul di menu HP." },
                      { step: "07", text: "Aplikasi siap digunakan langsung dari Home Screen Anda." }
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <span className="text-[10px] font-black text-slate-300 pointer-events-none">{item.step}</span>
                        <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300 leading-snug">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Core Workflow */}
                <div className="flex-[0_0_100%] min-w-0 p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Prosedur Presensi</h3>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Daily Operating Procedure</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { step: "01", text: "Aktifkan GPS & tunggu indikator hijau (High Accuracy)." },
                      { step: "02", text: "Pastikan posisi Anda sudah berada di dalam radius kantor." },
                      { step: "03", text: "Refresh koordinat jika lokasi belum muncul otomatis." },
                      { step: "04", text: "Ambil swafoto (Fitur segera hadir/Coming Soon)." },
                      { step: "05", text: "Pilih mode kehadiran (WFO / WFH / Dinas Luar)." },
                      { step: "06", text: "Klik tombol 'Kirim Absen' & tunggu proses sinkronisasi." },
                      { step: "07", text: "Pastikan muncul notifikasi 'Berhasil' dari sistem." }
                    ].map((item, i) => (
                      <div key={i} className={cn("flex items-start gap-4", item.step === "04" && "opacity-30")}>
                        <span className="text-[10px] font-black text-slate-300 pointer-events-none">{item.step}</span>
                        <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300 leading-snug">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Policies */}
                <div className="flex-[0_0_100%] min-w-0 p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Kebijakan & Keamanan</h3>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Information & Data Integrity</p>
                  </div>
                  <div className="space-y-3.5">
                    {[
                      { t: "Integritas Lokasi", d: "Sistem mendeteksi & melarang penggunaan aplikasi manipulasi lokasi (Fake GPS)." },
                      { t: "Akurasi Data", d: "Pastikan sinyal seluler stabil untuk sinkronisasi koordinat yang presisi." },
                      { t: "Audit Otomatis", d: "Setiap aktivitas presensi dicatat dengan timestamp server yang tidak terbantahkan." },
                      { t: "Privasi Data", d: "Seluruh data koordinat & identifikasi dienkripsi untuk keamanan informasi pribadi." },
                      { t: "Kebijakan Adil", d: "Validasi lokasi diterapkan setara bagi semua staf demi transparansi kehadiran." }
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.t}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">{item.d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Clean Footer */}
            <div className="px-8 pb-8 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => emblaApi?.scrollPrev()}
                className={cn("h-10 px-0 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-opacity", currentSlide === 0 ? "opacity-0 pointer-events-none" : "opacity-100")}
              >
                Kembali
              </Button>
              <Button
                onClick={() => currentSlide < 2 ? emblaApi?.scrollNext() : setShowGuide(false)}
                className="h-12 px-8 rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                {currentSlide < 2 ? "Selanjutnya" : "Mengerti"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>


      </div >
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: DESKTOP PREMIUM VIEW
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen grid lg:grid-cols-2 overflow-hidden bg-white">
      {/* Left Column: Brand & Logo */}
      <div className="hidden lg:flex relative bg-slate-50 dark:bg-slate-900 flex-col justify-center items-center p-12 overflow-hidden">
        {/* Logo Besar */}
        <div className="relative z-10 w-full max-w-lg">
          <img
            src="/logo.png"
            alt="CMS Duta Solusi"
            className="w-full h-auto object-contain"
          />
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-950 relative">
        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Selamat Datang</h2>
            <p className="text-slate-500 dark:text-slate-400">Silakan masuk ke akun Anda untuk melanjutkan.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none rounded-[32px] overflow-hidden border border-slate-100 dark:border-slate-800 p-2">
            {renderAuthForm()}
          </div>

          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
            <Button
              variant="outline"
              onClick={() => setShowGuide(true)}
              className="w-full h-12 rounded-2xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all font-bold gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Buku Panduan Pengguna
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500 font-medium">
            <Lock className="h-3 w-3" />
            <span>Enkripsi End-to-End & Keamanan Terjamin</span>
          </div>
        </div>

        {/* Dialog for Face Login (Reused) */}
        <Dialog open={showFaceLogin} onOpenChange={setShowFaceLogin}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-transparent">
            <FaceLogin
              onVerificationComplete={onFaceVerified}
              employeeId={lastUser?.id}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog Panduan Pengguna (Integrated minimalist style) */}
        <Dialog open={showGuide} onOpenChange={setShowGuide}>
          <DialogContent className="w-[90vw] sm:max-w-md p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-900">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">User Guide — Ver. 3.0</span>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={cn("h-1 w-1 rounded-full transition-all duration-300", currentSlide === i ? "bg-slate-900 dark:bg-white scale-125" : "bg-slate-200 dark:bg-slate-800")} />
                ))}
              </div>
            </div>

            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex">
                {/* 1. Setup */}
                <div className="flex-[0_0_100%] min-w-0 p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Instalasi PWA</h3>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Akses Cepat Via Chrome</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed">• Pastikan internet stabil & buka di Chrome.</p>
                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed">• Tunggu halaman termuat sempurna.</p>
                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed">• Ketuk Menu browser (titik tiga).</p>
                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed">• Klik 'Instal Aplikasi' atau 'Pasang'.</p>
                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed">• Konfirmasi proses pemasangan PWA.</p>
                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed">• Temukan aplikasi di menu Home Screen.</p>
                  </div>
                </div>

                {/* 2. Workflow */}
                <div className="flex-[0_0_100%] min-w-0 p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Standard Presensi</h3>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">SOP Harian</p>
                  </div>
                  <div className="space-y-3 text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    <p>• Aktifkan GPS (Mode Akurasi Tinggi).</p>
                    <p>• Tunggu indikator lokasi berwarna HIJAU.</p>
                    <p>• Pastikan posisi berada di radius kantor.</p>
                    <p className="opacity-30">• Verifikasi wajah (Fitur segera hadir).</p>
                    <p>• Pilih mode kehadiran dengan teliti.</p>
                    <p>• Klik 'Kirim' & tunggu notifikasi berhasil.</p>
                  </div>
                </div>

                {/* 3. Security */}
                <div className="flex-[0_0_100%] min-w-0 p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Integritas Data</h3>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Information & Transparency</p>
                  </div>
                  <div className="space-y-3.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    <p>• Pelarangan total aplikasi modifikasi lokasi (Fake GPS).</p>
                    <p>• Sinkronisasi otomatis dengan waktu server CMS.</p>
                    <p>• Validasi radius area kerja yang presisi secara real-time.</p>
                    <p>• Pencatatan log aktivitas untuk keperluan audit internal.</p>
                    <p>• Perlindungan enkripsi data koordinat pengguna.</p>
                    <p>• Sistem keadilan kehadiran berbasis data faktual.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 pb-8 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => emblaApi?.scrollPrev()}
                className={cn("h-10 px-0 text-[10px] font-black uppercase tracking-widest text-slate-400", currentSlide === 0 ? "opacity-0 pointer-events-none" : "opacity-100")}
              >
                Kembali
              </Button>
              <Button
                onClick={() => currentSlide < 2 ? emblaApi?.scrollNext() : setShowGuide(false)}
                className="h-12 px-8 rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg"
              >
                {currentSlide < 2 ? "Lanjut" : "Mengerti"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
