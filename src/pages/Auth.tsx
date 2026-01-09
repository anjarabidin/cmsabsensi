import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { AppLogo } from '@/components/AppLogo';

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
      toast({
        title: 'Login Berhasil',
        description: 'Selamat datang kembali!',
      });
      navigate('/dashboard');
    }

    setIsLoading(false);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 p-4">
      <div className="flex flex-col items-center gap-6 mb-8 animate-in slide-in-from-top-10 duration-700">
        <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md shadow-2xl ring-1 ring-white/20">
          <AppLogo className="h-20 w-auto" variant="light" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Duta Mruput</h1>
          <p className="text-xs text-blue-100 font-medium uppercase tracking-widest opacity-80">CMS Duta Solusi System</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-xl animate-in zoom-in-95 duration-500 rounded-3xl overflow-hidden">
        <Tabs defaultValue="login" className="w-full">
          <div className="px-6 pt-6">
            <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="login" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all duration-300">Masuk</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all duration-300">Daftar</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="login" className="mt-0">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-5 pt-6 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-slate-600 font-medium">Email Perusahaan</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="nama@perusahaan.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="login-password" className="text-slate-600 font-medium">Password</Label>
                    <a href="#" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Lupa?</a>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-4 pb-8">
                <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-base font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-95" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Masuk Sekarang'
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-0">
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4 pt-6 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="register-name" className="text-slate-600">Nama Lengkap</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Nama Lengkap"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    disabled={isLoading}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-slate-600">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="nama@perusahaan.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-slate-600">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-4 pb-8">
                <Button type="submit" className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-base font-bold rounded-xl shadow-lg" disabled={isLoading}>
                  {isLoading ? 'Memproses...' : 'Daftar Akun Baru'}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>

      <p className="mt-8 text-[10px] text-blue-200/60 font-medium text-center uppercase tracking-widest">
        © 2026 CMS Duta Solusi. All rights reserved.
      </p>
    </div>
  );
}
