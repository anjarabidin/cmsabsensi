import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useCamera } from '@/hooks/useCamera';
import { supabase } from '@/integrations/supabase/client';
import {
  Camera,
  CheckCircle2,
  Loader2,
  Shield,
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Calendar,
  Lock,
  Wallet,
  FileText,
  ChevronLeft,
  MapPin,
  Bell,
  AlertCircle,
  RefreshCw,
  LogOut,
  HardDrive,
  ChevronRight,
  Fingerprint,
  Info,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CONSENT_VERSION = 'biometric_v1';

export default function ProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stream, videoRef, startCamera, stopCamera, capturePhoto } = useCamera();

  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [isConsentedState, setIsConsentedState] = useState(false);

  const [enrollStep, setEnrollStep] = useState<'idle' | 'camera' | 'preview'>('idle');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentPreviewUrl, setEnrollmentPreviewUrl] = useState<string | null>(null);
  const [enrollmentBlob, setEnrollmentBlob] = useState<Blob | null>(null);

  // Permissions state
  const [cameraPermission, setCameraPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [locationPermission, setLocationPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [storagePermission, setStoragePermission] = useState<PermissionState | 'unknown'>('unknown');
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  // Logout state
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Avatar Management State
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSource, setAvatarSource] = useState<'camera' | 'gallery' | null>(null);
  const fileInputRef = useMemo(() => ({ current: null as HTMLInputElement | null }), []);

  // Initialize consent from local storage
  const consentKey = useMemo(() => {
    if (!user) return null;
    return `cms_absensi_consent_${CONSENT_VERSION}_${user.id}`;
  }, [user]);

  useEffect(() => {
    if (consentKey) {
      setIsConsentedState(localStorage.getItem(consentKey) === 'true');
    }
  }, [consentKey]);

  const isEnrolled = useMemo(() => {
    return Boolean(profile?.avatar_url);
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (enrollStep === 'camera' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [enrollStep, stream, videoRef]);

  // Check permissions on mount
  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    setCheckingPermissions(true);
    try {
      if (navigator.permissions) {
        try {
          const camera = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermission(camera.state);
          camera.onchange = () => setCameraPermission(camera.state);
        } catch (e) {
          setCameraPermission('prompt');
        }

        try {
          const location = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          setLocationPermission(location.state);
          location.onchange = () => setLocationPermission(location.state);
        } catch (e) {
          setLocationPermission('prompt');
        }
      }

      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }

      if (navigator.storage && navigator.storage.persisted) {
        const isPersisted = await navigator.storage.persisted();
        setStoragePermission(isPersisted ? 'granted' : 'prompt');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setCheckingPermissions(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
      toast({ title: 'Berhasil', description: 'Izin kamera telah diberikan' });
    } catch (error) {
      setCameraPermission('denied');
      toast({
        title: 'Izin Ditolak',
        description: 'Mohon aktifkan izin kamera di pengaturan browser',
        variant: 'destructive'
      });
    }
  };

  const requestLocationPermission = async () => {
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      setLocationPermission('granted');
      toast({ title: 'Berhasil', description: 'Izin lokasi telah diberikan' });
    } catch (error) {
      setLocationPermission('denied');
      toast({
        title: 'Izin Ditolak',
        description: 'Mohon aktifkan izin lokasi di pengaturan browser',
        variant: 'destructive'
      });
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast({ title: 'Berhasil', description: 'Izin notifikasi telah diberikan' });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      toast({ title: 'Gagal Logout', variant: 'destructive' });
    } finally {
      setLoggingOut(false);
      setLogoutDialogOpen(false);
    }
  };

  const handleSaveConsent = async () => {
    if (!consentKey || !consentChecked) return;
    setConsentSaving(true);
    try {
      localStorage.setItem(consentKey, 'true');
      setIsConsentedState(true);
      toast({ title: 'Berhasil', description: 'Persetujuan biometrik tersimpan.' });
    } finally {
      setConsentSaving(false);
    }
  };

  const handleStartEnroll = async () => {
    if (!isConsentedState) return;
    try {
      await startCamera();
      setEnrollStep('camera');
    } catch (e) {
      toast({ title: 'Gagal membuka kamera', variant: 'destructive' });
    }
  };

  const handleCaptureEnroll = async () => {
    try {
      const blob = await capturePhoto();
      setEnrollmentBlob(blob);
      setEnrollmentPreviewUrl(URL.createObjectURL(blob));
      stopCamera();
      setEnrollStep('preview');
    } catch (e) {
      toast({ title: 'Gagal mengambil foto', variant: 'destructive' });
    }
  };

  const handleRetakeEnroll = async () => {
    setEnrollmentPreviewUrl(null);
    setEnrollmentBlob(null);
    await handleStartEnroll();
  };

  const handleSubmitEnroll = async () => {
    if (!enrollmentBlob || !user) return;
    setEnrolling(true);
    try {
      const fileName = `${user.id}/avatar_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, enrollmentBlob, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      toast({ title: 'Enrollment Berhasil', description: 'Wajah Anda telah terdaftar.' });
      setEnrollStep('idle');
      window.location.reload();
    } catch (error) {
      toast({ title: 'Gagal enrollment', variant: 'destructive' });
    } finally {
      setEnrolling(false);
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const fileName = `${user.id}/avatar_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      toast({ title: 'Berhasil', description: 'Foto profil telah diperbarui.' });
      setAvatarDialogOpen(false);
      await refreshProfile();
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({ title: 'Gagal upload', description: error instanceof Error ? error.message : 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDirectCapture = async () => {
    try {
      const blob = await capturePhoto();
      if (!user) return;

      setUploadingAvatar(true);
      const fileName = `${user.id}/avatar_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      toast({ title: 'Berhasil', description: 'Foto profil telah diperbarui.' });
      stopCamera();
      setAvatarDialogOpen(false);
      setAvatarSource(null);
      await refreshProfile();
    } catch (error) {
      console.error('Avatar capture error:', error);
      toast({ title: 'Gagal mengambil foto', description: error instanceof Error ? error.message : 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-slate-50/50 pb-32">
        {/* Header Section (Conserved style) */}
        <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] space-y-6">
          <div className="flex items-center gap-3 text-white">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Profil Saya</h1>
            </div>
          </div>

          {/* New Vertical Sectional Layout */}

          {/* 1. Main Profile Card */}
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white">
            <CardContent className="p-8">
              <div className="flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-full blur opacity-20 animate-pulse"></div>
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => setAvatarDialogOpen(true)}
                  >
                    <Avatar className="h-32 w-32 border-4 border-white shadow-2xl transition-transform group-active:scale-95">
                      <AvatarImage src={profile?.avatar_url || ''} className="object-cover" />
                      <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black">
                        {profile?.full_name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="h-8 w-8 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className={`absolute bottom-2 right-2 h-8 w-8 rounded-full border-4 border-white flex items-center justify-center shadow-md ${isEnrolled ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {isEnrolled ? <CheckCircle2 className="h-4 w-4 text-white" /> : <Shield className="h-4 w-4 text-white" />}
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{profile?.full_name}</h2>
                  <p className="text-blue-600 font-bold text-sm uppercase tracking-widest px-4 py-1 bg-blue-50 rounded-full inline-block">
                    {profile?.position || 'Staff'}
                  </p>
                </div>

                <div className="grid grid-cols-2 w-full gap-4 mt-8">
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100/50 text-center">
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">ID Karyawan</p>
                    <p className="font-bold text-slate-700">{profile?.employee_id || '--'}</p>
                  </div>
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100/50 text-center">
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Status Akun</p>
                    <div className="flex items-center justify-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <p className="font-bold text-green-700">Aktif</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Personal Information Section */}
          <div className="space-y-4 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Informasi Pribadi</h3>
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {[
                    { icon: <Mail className="h-4 w-4 text-blue-500" />, label: 'Email', value: user?.email },
                    { icon: <Phone className="h-4 w-4 text-emerald-500" />, label: 'Telepon', value: profile?.phone || '-' },
                    { icon: <Building className="h-4 w-4 text-indigo-500" />, label: 'Departemen', value: (profile as any)?.department?.name || '-' },
                    { icon: <Calendar className="h-4 w-4 text-amber-500" />, label: 'Bergabung', value: new Date().getFullYear().toString() }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-slate-50 group-hover:bg-white transition-colors shadow-sm group-hover:shadow text-slate-600">
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{item.label}</p>
                          <p className="font-bold text-slate-800 text-sm truncate max-w-[180px]">{item.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Career & Salary Preview Section */}
          <div className="space-y-4 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Karir & Gaji</h3>
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4 p-2">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <FileText className="h-6 w-6 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">Dokumen Karyawan</p>
                      <p className="font-black text-slate-800">Slip Gaji & Laporan Gaji</p>
                    </div>
                  </div>
                  <Button
                    className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200"
                    onClick={() => navigate('/salary-slips')}
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    Lihat Slip Gaji (PDF)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Security & Biometrics Section */}
          <div className="space-y-4 pt-4 text-white">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Keamanan & Perangkat</h3>
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-800 text-white p-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md shadow-sm border border-white/20">
                      <Fingerprint className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-100 mb-1">Verifikasi Biometrik</p>
                      <h4 className="text-lg font-black">{isEnrolled ? 'Face ID Aktif' : 'Face ID Nonaktif'}</h4>
                    </div>
                  </div>
                  <Badge className={`border-none ${isEnrolled ? 'bg-green-400 text-green-900' : 'bg-white/20 text-white'}`}>
                    {isEnrolled ? 'Aman' : 'Pending'}
                  </Badge>
                </div>

                {!isEnrolled ? (
                  <div className="space-y-4">
                    <Alert className="bg-white/10 border-white/20 text-white p-3 rounded-2xl">
                      <Info className="h-4 w-4 text-blue-200" />
                      <AlertDescription className="text-xs text-blue-50 leading-relaxed ml-2">
                        Daftarkan wajah Anda untuk melakukan absensi yang lebih cepat dan aman.
                      </AlertDescription>
                    </Alert>
                    <Button
                      className="w-full h-12 bg-white text-blue-600 hover:bg-white/90 rounded-2xl font-black shadow-xl"
                      onClick={() => {
                        if (!isConsentedState) {
                          setConsentChecked(false);
                          // Simple scroll or trigger logic would go here, 
                          // but we'll show dialog for enrollment
                        }
                        handleStartEnroll();
                      }}
                    >
                      Daftarkan Wajah Sekarang
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full text-blue-100 hover:bg-white/10 rounded-2xl h-12 font-bold"
                    onClick={handleStartEnroll}
                  >
                    <Camera className="mr-2 h-5 w-5" />
                    Update Foto Wajah
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 5. App Permissions Section */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Izin Aplikasi</h3>
              <Button variant="ghost" size="sm" onClick={checkAllPermissions} disabled={checkingPermissions} className="text-blue-600 rounded-lg">
                <RefreshCw className={`h-4 w-4 ${checkingPermissions ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-2">
                <div className="grid grid-cols-2">
                  {[
                    { icon: <Camera className="h-5 w-5" />, label: 'Kamera', status: cameraPermission, color: 'blue', action: requestCameraPermission },
                    { icon: <MapPin className="h-5 w-5" />, label: 'Lokasi', status: locationPermission, color: 'emerald', action: requestLocationPermission },
                    { icon: <Bell className="h-5 w-5" />, label: 'Notif', status: notificationPermission, color: 'purple', action: requestNotificationPermission },
                    { icon: <HardDrive className="h-5 w-5" />, label: 'Storage', status: storagePermission, color: 'orange', action: null }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 border-b border-r border-slate-50 last:border-0 hover:bg-slate-50 transition-all flex flex-col items-center gap-3">
                      <div className={`p-3 rounded-2xl bg-${item.color}-50 text-${item.color}-600`}>
                        {item.icon}
                      </div>
                      <p className="text-xs font-bold text-slate-700">{item.label}</p>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-2 py-0 h-5 border-none ${item.status === 'granted' ? 'bg-green-100 text-green-700' :
                          item.status === 'denied' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}
                        onClick={item.action as any}
                      >
                        {item.status === 'granted' ? 'OKE' : item.status === 'denied' ? 'OFF' : '??'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 6. Logout Area */}
          <div className="pt-12 pb-6">
            <Button
              variant="ghost"
              className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 font-black flex items-center justify-center gap-3 px-12 h-16 rounded-[24px] transition-all border-2 border-dashed border-red-100 hover:border-red-200"
              onClick={() => setLogoutDialogOpen(true)}
            >
              <LogOut className="h-6 w-6" />
              Keluar Sesi Aplikasi
            </Button>
            <p className="mt-4 text-slate-400 text-[10px] uppercase tracking-widest font-bold text-center">
              Duta Mruput v2.1.0 • CMS Duta Solusi
            </p>
          </div>
        </div>

        {/* --- Dialogs --- */}

        {/* Enrollment Camera Modal */}
        <Dialog open={enrollStep !== 'idle'} onOpenChange={(open) => { if (!open) { stopCamera(); setEnrollStep('idle'); } }}>
          <DialogContent className="max-w-md rounded-[40px] border-none p-0 overflow-hidden bg-black">
            {enrollStep === 'camera' ? (
              <div className="relative aspect-[3/4] flex flex-col">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-10 inset-x-0 flex flex-col items-center">
                  <div className="w-64 h-80 border-2 border-white/50 border-dashed rounded-[60px] relative">
                    <div className="absolute inset-0 bg-blue-500/10 rounded-[60px]" />
                  </div>
                  <p className="mt-4 text-white text-sm font-bold bg-black/40 backdrop-blur-md px-6 py-2 rounded-full">Posisikan wajah di dalam kotak</p>
                </div>
                <div className="absolute bottom-10 inset-x-0 flex justify-center items-center gap-8">
                  <Button variant="ghost" className="text-white hover:bg-white/20 h-14 w-14 rounded-full" onClick={() => { stopCamera(); setEnrollStep('idle'); }}>
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <button onClick={handleCaptureEnroll} className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent group">
                    <div className="h-full w-full rounded-full bg-white group-active:scale-90 transition-transform" />
                  </button>
                  <div className="w-14" />
                </div>
              </div>
            ) : (
              <div className="relative aspect-[3/4] bg-white flex flex-col p-8">
                <div className="flex-1 rounded-[40px] overflow-hidden shadow-2xl relative mb-8">
                  {enrollmentPreviewUrl && (
                    <img src={enrollmentPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={handleRetakeEnroll} className="h-14 rounded-2xl font-bold border-2">
                    Ambil Ulang
                  </Button>
                  <Button onClick={handleSubmitEnroll} disabled={enrolling} className="h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200">
                    {enrolling ? <Loader2 className="animate-spin h-5 w-5" /> : 'Selesai & Simpan'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Logout Confirmation */}
        <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <DialogContent className="max-w-[340px] rounded-[32px] border-none p-8">
            <div className="flex flex-col items-center pt-2">
              <div className="h-20 w-20 bg-red-50 text-red-500 rounded-[24px] flex items-center justify-center mb-6 shadow-sm border border-red-100">
                <LogOut className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Keluar Aplikasi?</h3>
              <p className="text-center text-slate-500 text-sm leading-relaxed mb-8">
                Anda perlu login kembali untuk dapat melakukan absensi.
              </p>
              <div className="grid grid-cols-2 w-full gap-3">
                <Button
                  variant="ghost"
                  className="h-12 rounded-2xl font-bold text-slate-500"
                  onClick={() => setLogoutDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  className="h-12 rounded-2xl font-black bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Ya, Keluar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Biometric Terms (Invisible trigger, handled in state) */}
        {!isConsentedState && (
          <Dialog open={!isConsentedState && enrollStep !== 'idle'} onOpenChange={() => { }}>
            <DialogContent className="max-w-md rounded-[32px] border-none p-8">
              <div className="space-y-6">
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Shield className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900">Aktivasi Face ID</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Kami memerlukan persetujuan Anda untuk menyimpan data biometrik wajah demi keamanan proses absensi.
                  </p>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Checkbox
                    id="terms-dialog"
                    checked={consentChecked}
                    onCheckedChange={(c) => setConsentChecked(c as boolean)}
                    className="h-5 w-5 rounded-md border-slate-300 text-blue-600"
                  />
                  <Label htmlFor="terms-dialog" className="text-xs font-bold text-slate-600 leading-tight">
                    Saya menyetujui syarat & ketentuan penggunaan data biometrik wajah.
                  </Label>
                </div>
                <Button
                  onClick={handleSaveConsent}
                  disabled={!consentChecked || consentSaving}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-100"
                >
                  {consentSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Setuju & Lanjutkan'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* --- Avatar Action Dialog (WhatsApp Style) --- */}
        <Dialog open={avatarDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setAvatarDialogOpen(false);
            setAvatarSource(null);
            stopCamera();
          }
        }}>
          <DialogContent className="max-w-[360px] rounded-[32px] border-none p-0 overflow-hidden bg-white">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 px-2">Foto Profil</h3>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setAvatarDialogOpen(false)}>
                  <X className="h-5 w-5 text-slate-400" />
                </Button>
              </div>

              {!avatarSource ? (
                <div className="grid grid-cols-2 gap-4 px-2 pb-2">
                  <button
                    onClick={async () => {
                      setAvatarSource('camera');
                      try {
                        await startCamera();
                      } catch (e) {
                        toast({ title: "Kamera Gagal", description: "Izin kamera diperlukan", variant: "destructive" });
                        setAvatarSource(null);
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-blue-50 rounded-[24px] border-2 border-transparent hover:border-blue-100 transition-all group"
                  >
                    <div className="h-14 w-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="h-7 w-7" />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Kamera</span>
                  </button>

                  <button
                    onClick={() => {
                      const input = document.getElementById('avatar-upload-input');
                      input?.click();
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-emerald-50 rounded-[24px] border-2 border-transparent hover:border-emerald-100 transition-all group"
                  >
                    <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ImageIcon className="h-7 w-7" />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Galeri</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative aspect-square rounded-[32px] overflow-hidden bg-black shadow-inner">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-[12px] border-white/10 rounded-[32px] pointer-events-none" />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { stopCamera(); setAvatarSource(null); }}
                      className="flex-1 h-14 rounded-2xl font-bold border-2"
                    >
                      Batal
                    </Button>
                    <Button
                      onClick={handleDirectCapture}
                      disabled={uploadingAvatar}
                      className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200"
                    >
                      {uploadingAvatar ? <Loader2 className="animate-spin h-5 w-5" /> : 'Jepret Foto'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Hidden File Input */}
        <input
          id="avatar-upload-input"
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleAvatarFileSelect}
        />
      </div>
    </DashboardLayout>
  );
}
