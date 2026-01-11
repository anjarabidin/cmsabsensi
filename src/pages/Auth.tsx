import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EnhancedFaceRecognition } from '@/components/face-recognition/EnhancedFaceRecognition';
import { Loader2, Lock, Mail, User, ArrowRight, Sparkles, Fingerprint, ScanFace } from 'lucide-react';
import { z } from 'zod';
import { AppLogo } from '@/components/AppLogo';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

const emailSchema = z.string().email('Email tidak valid');
const passwordSchema = z.string().min(6, 'Password minimal 6 karakter');
const nameSchema = z.string().min(2, 'Nama minimal 2 karakter');

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [lastUser, setLastUser] = useState<{ id?: string; email: string; name: string; avatar?: string } | null>(null);
  const [showFaceLogin, setShowFaceLogin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('last_active_user');
    if (saved) {
      setLastUser(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
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

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      let message = 'Terjadi kesalahan saat login';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email atau password salah';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Email belum dikonfirmasi. Silakan cek inbox Anda';
      }

      toast({
        title: 'Login Gagal',
        description: message,
        variant: 'destructive',
      });
    } else {
      // Save user for quick access
      if (data?.user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', data.user.id).single();
        localStorage.setItem('last_active_user', JSON.stringify({
          id: data.user.id,
          email: loginEmail,
          name: profile?.full_name || 'Karyawan',
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

    const fingerprintEnabled = localStorage.getItem('fingerprint_enabled') === 'true';
    const isNative = Capacitor.isNativePlatform();

    if (fingerprintEnabled && isNative) {
      handleNativeBiometric();
    } else {
      // Fallback to Face ID (Web-ready)
      setShowFaceLogin(true);
    }
  };

  const handleNativeBiometric = async () => {
    try {
      setIsLoading(true);
      const result = await NativeBiometric.isAvailable();

      if (!result.isAvailable) {
        setShowFaceLogin(true); // Fallback
        return;
      }

      const verified = await NativeBiometric.verifyIdentity({
        reason: "Masuk ke Akun Anda",
        title: "Verifikasi Biometrik",
        subtitle: "Gunakan Sidik Jari atau Wajah untuk masuk",
        description: "Tempelkan jari Anda pada sensor",
        negativeButtonText: "Batal",
      });

      if (verified) {
        toast({
          title: 'Verifikasi Berhasil',
          description: `Selamat datang kembali, ${lastUser?.name}!`,
        });
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Biometric error:', error);
      // If error is "user canceled", don't show toast
      if (error.message?.includes('User canceled') || error.code === 'USER_CANCELED') {
        return;
      }
      setShowFaceLogin(true); // Fallback on any error
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger biometric login if enabled
  useEffect(() => {
    const faceLoginEnabled = localStorage.getItem('face_login_enabled') === 'true';
    if (faceLoginEnabled && lastUser && !isLoading && !showFaceLogin) {
      // Small delay to ensure smooth UX
      const timer = setTimeout(() => {
        handleBiometricLogin();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [lastUser]); // Only run when lastUser loads

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

    try {
      nameSchema.parse(registerName);
      emailSchema.parse(registerEmail);
      passwordSchema.parse(registerPassword);
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

    const { error } = await signUp(registerEmail, registerPassword, registerName);

    if (error) {
      let message = 'Terjadi kesalahan saat registrasi';
      if (error.message.includes('User already registered')) {
        message = 'Email sudah terdaftar. Silakan login';
      }

      toast({
        title: 'Registrasi Gagal',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Registrasi Berhasil',
        description: 'Akun Anda telah dibuat. Silakan login.',
      });
    }

    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 overflow-x-hidden relative">
      {/* Decorative Background Elements & Dynamic Animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated Gradient Orbs */}
        <div className="absolute -top-40 -right-40 w-[450px] h-[450px] bg-blue-200/30 rounded-full blur-[100px] animate-pulse duration-7000"></div>
        <div className="absolute -bottom-40 -left-40 w-[450px] h-[450px] bg-indigo-200/30 rounded-full blur-[100px] animate-pulse duration-5000"></div>
        <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-cyan-100/20 rounded-full blur-[80px] animate-bounce duration-[10s]"></div>

        {/* Animated Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150"></div>

        {/* Floating Particles */}
        <div className="absolute top-20 left-10 w-2 h-2 bg-blue-400 rounded-full opacity-20 animate-ping"></div>
        <div className="absolute bottom-40 right-20 w-3 h-3 bg-indigo-400 rounded-full opacity-20 animate-ping duration-1500"></div>
      </div>

      <div className="w-full max-w-[480px] relative z-10">
        {/* Logo & Brand Header */}
        <div className="flex flex-col items-center gap-6 mb-10 mt-8 animate-in fade-in slide-in-from-top-8 duration-700">
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative p-5 bg-white rounded-3xl shadow-lg ring-1 ring-slate-200/50">
              <AppLogo className="h-16 w-auto" />
            </div>
          </div>

          <div className="text-center">
            <h1 className="font-black tracking-tighter flex items-baseline justify-center gap-2.5">
              <span className="text-4xl md:text-5xl text-blue-950 drop-shadow-sm">CMS</span>
              <span className="text-2xl md:text-2xl text-emerald-900 opacity-90 tracking-tight">Duta Solusi</span>
            </h1>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="border-0 shadow-2xl shadow-slate-200/50 bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden animate-in zoom-in-95 fade-in duration-500">
          <Tabs defaultValue="login" className="w-full">
            <div className="px-8 pt-8">
              <TabsList className="grid w-full grid-cols-2 h-14 rounded-2xl bg-slate-100/80 p-1.5">
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
                    <Label htmlFor="login-email" className="text-slate-700 font-semibold text-sm">
                      Email Perusahaan
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="nama@perusahaan.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        className="h-14 pl-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all text-base focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="login-password" className="text-slate-700 font-semibold text-sm">
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
                        className="h-14 pl-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all text-base focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  {lastUser && (
                    <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-slate-100"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-3 text-slate-400 font-bold tracking-widest">Atau Akses Cepat</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={handleBiometricLogin}
                        disabled={isLoading}
                        variant="outline"
                        className="w-full h-16 rounded-2xl border-2 border-blue-50 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-200 transition-all group overflow-hidden relative"
                      >
                        <div className="absolute left-0 top-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-4 px-2">
                          <div className="relative">
                            {lastUser.avatar ? (
                              <img src={lastUser.avatar} className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm" alt="Avatar" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-sm">
                                {lastUser.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                              <ScanFace className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Masuk Sebagai</p>
                            <p className="text-sm font-black text-slate-800">{lastUser.name}</p>
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

                <CardFooter className="pt-4 pb-8 px-8">
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
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-0">
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-5 pt-8 pb-4 px-8">
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-slate-700 font-semibold text-sm">
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
                        disabled={isLoading}
                        required
                        className="h-13 pl-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-slate-700 font-semibold text-sm">
                      Email Perusahaan
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="nama@perusahaan.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        className="h-13 pl-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-slate-700 font-semibold text-sm">
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
                        disabled={isLoading}
                        required
                        className="h-13 pl-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-4 pb-8 px-8">
                  <Button
                    type="submit"
                    className="w-full h-14 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white text-base font-bold rounded-2xl shadow-lg shadow-slate-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-500/40 active:scale-[0.98] group"
                    disabled={isLoading}
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

        {/* Footer */}
        <p className="mt-10 text-xs text-slate-400 font-medium text-center">
          © 2026 CMS Duta Solusi. All rights reserved.
        </p>
      </div>

      {/* Face Login Dialog */}
      <Dialog open={showFaceLogin} onOpenChange={setShowFaceLogin}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-transparent">
          <EnhancedFaceRecognition
            onVerificationComplete={onFaceVerified}
            employeeId={lastUser?.id}
            mode="verification"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
