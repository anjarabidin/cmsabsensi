import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MediaPipeFaceRegistration } from '@/components/face-registration/MediaPipeFaceRegistration';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, AlertCircle, Camera, ShieldCheck, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function FaceRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasFaceEnrollment, setHasFaceEnrollment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    checkFaceEnrollment();
  }, [user]);

  const checkFaceEnrollment = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await supabase.rpc('has_face_enrollment', { p_user_id: user.id });
      setHasFaceEnrollment(data || false);
    } catch (error) {
      console.error('Error checking face enrollment:', error);
      setError('Gagal memuat status pendaftaran wajah');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationComplete = (success: boolean, data?: any) => {
    if (success) {
      setRegistrationComplete(true);
      setHasFaceEnrollment(true);
      setIsEditMode(false);
      setError('');
    } else {
      setError(data?.message || 'Registrasi wajah gagal');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-slate-50/50 pb-20 overflow-x-hidden">
        <div
          className="absolute top-0 left-0 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[48px] z-0 shadow-lg transition-all"
          style={{ height: 'calc(180px + env(safe-area-inset-top))' }}
        />
        <div
          className="relative z-10 max-w-md mx-auto px-6 space-y-6"
          style={{ paddingTop: 'calc(2.5rem + env(safe-area-inset-top) + 0.5rem)' }}
        >
          <div className="flex items-center gap-4 text-white mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
              className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-11 w-11 rounded-full backdrop-blur-sm"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="space-y-0.5">
              <h1 className="text-2xl font-black tracking-tight leading-none">Registrasi Wajah</h1>
              <p className="text-blue-100 text-[11px] font-bold uppercase tracking-widest opacity-80">Security Biometric</p>
            </div>
          </div>
          <div className="space-y-6">
            {hasFaceEnrollment && !isEditMode && !registrationComplete && (
              <Card className="border-none shadow-xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-white animate-in slide-in-from-bottom-4 duration-500">
                <CardContent className="pt-10 pb-8 px-6 text-center space-y-6">
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-blue-100 rounded-full animate-pulse opacity-50"></div>
                    <div className="relative flex items-center justify-center w-full h-full bg-blue-50 rounded-full border-4 border-white shadow-lg">
                      <ShieldCheck className="h-10 w-10 text-blue-600" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1.5 rounded-full border-4 border-white shadow-sm">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Wajah Terdaftar</h2>
                    <p className="text-slate-500 text-sm mt-2 max-w-[260px] mx-auto">
                      Data wajah Anda sudah aktif. Anda dapat menggunakan wajah untuk login dan absensi.
                    </p>
                  </div>
                  <div className="w-full h-px bg-slate-100"></div>
                  <Button
                    onClick={() => setIsEditMode(true)}
                    className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold shadow-sm"
                  >
                    Perbarui Data Wajah
                  </Button>
                </CardContent>
              </Card>
            )}
            {(!hasFaceEnrollment || isEditMode) && !registrationComplete && (
              <div key="registration-container" className="animate-in slide-in-from-bottom-4 duration-500">
                <MediaPipeFaceRegistration onComplete={handleRegistrationComplete} />
              </div>
            )}
            {registrationComplete && (
              <Card key="success-card" className="border-none shadow-xl shadow-green-900/5 rounded-3xl overflow-hidden bg-white animate-in zoom-in-95 duration-500">
                <CardContent className="pt-10 pb-8 px-6 text-center space-y-6">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Berhasil!</h2>
                    <p className="text-slate-500 text-sm mt-2">
                      Wajah Anda telah didaftarkan. Anda sekarang dapat menggunakan fitur Login Wajah.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate('/profile')}
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200"
                  >
                    Kembali ke Profil
                  </Button>
                </CardContent>
              </Card>
            )}
            {(!hasFaceEnrollment || isEditMode) && !registrationComplete && (
              <div className="grid grid-cols-2 gap-3 pb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Zap className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Login Cepat</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Anti Spoofing</p>
                </div>
              </div>
            )}
            {error && (
              <Alert variant="destructive" className="rounded-2xl border-white/20 bg-red-400 text-white">
                <AlertCircle className="h-4 w-4 text-white" />
                <AlertDescription className="ml-2 font-medium">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
