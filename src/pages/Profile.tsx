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
import { Switch } from '@/components/ui/switch';
import { ScanFace } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
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
import { Camera as CapCamera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

const CONSENT_VERSION = 'biometric_v1';

export default function ProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stream, videoRef, startCamera, stopCamera, capturePhoto } = useCamera();

  const [faceLoginEnabled, setFaceLoginEnabled] = useState(false);
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);

  const [faceDataRegistered, setFaceDataRegistered] = useState(false);

  useEffect(() => {
    setFaceLoginEnabled(localStorage.getItem('face_login_enabled') === 'true');
    setFingerprintEnabled(localStorage.getItem('fingerprint_enabled') === 'true');
    checkFaceRegistration();
    return () => {
      stopCamera();
    };
  }, [user]);

  const checkFaceRegistration = async () => {
    if (!user) return;
    try {
      // Use new Simple Face Registration check
      const { data } = await supabase
        .rpc('has_face_enrollment', { p_user_id: user.id });

      setFaceDataRegistered(!!data);
    } catch (err) {
      console.error('Error checking face reg:', err);
    }
  };

  const toggleFaceLogin = (enabled: boolean) => {
    setFaceLoginEnabled(enabled);
    localStorage.setItem('face_login_enabled', enabled ? 'true' : 'false');
    if (enabled) toast({ title: 'Login Wajah Diaktifkan', description: 'Anda sekarang bisa login menggunakan wajah.' });
  };

  const toggleFingerprint = async (enabled: boolean) => {
    if (enabled) {
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await NativeBiometric.isAvailable();
          if (!result.isAvailable) {
            toast({
              title: 'Tidak Didukung',
              description: 'Perangkat Anda tidak mendukung biometrik native.',
              variant: 'destructive'
            });
            return;
          }

          // Force verification once before enabling
          await NativeBiometric.verifyIdentity({
            reason: "Verifikasi untuk mengaktifkan login biometrik",
            title: "Konfirmasi Biometrik"
          });

          setFingerprintEnabled(true);
          localStorage.setItem('fingerprint_enabled', 'true');
          toast({ title: 'Biometrik Aktif', description: 'Anda bisa masuk menggunakan Sidik Jari/Face ID perangkat.' });
        } catch (error) {
          console.error('Biometric toggle error:', error);
          toast({ title: 'Gagal Mengaktifkan', description: 'Verifikasi biometrik dibatalkan atau gagal.', variant: 'destructive' });
        }
      } else {
        // Web simulation fallback but with a warning
        setFingerprintEnabled(true);
        localStorage.setItem('fingerprint_enabled', 'true');
        toast({
          title: 'Mode Browser Terdeteksi',
          description: 'Fitur sidik jari native akan aktif saat Anda menggunakan aplikasi di HP (Android/iOS).',
        });
      }
    } else {
      setFingerprintEnabled(false);
      localStorage.setItem('fingerprint_enabled', 'false');
    }
  };

  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [isConsentedState, setIsConsentedState] = useState(false);



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
    return faceDataRegistered;
  }, [faceDataRegistered]);





  // Check permissions on mount
  useEffect(() => {
    checkAllPermissions();
    return () => {
      stopCamera();
    };
  }, []);

  const checkAllPermissions = async () => {
    setCheckingPermissions(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const camPerm = await CapCamera.checkPermissions();
        setCameraPermission(camPerm.camera === 'granted' ? 'granted' : 'denied');

        const locPerm = await Geolocation.checkPermissions();
        setLocationPermission(locPerm.location === 'granted' ? 'granted' : 'denied' as any);

        const notifPerm = await PushNotifications.checkPermissions();
        setNotificationPermission(notifPerm.receive);
      } else {
        if (navigator.permissions) {
          try {
            const camera = await navigator.permissions.query({ name: 'camera' as PermissionName });
            setCameraPermission(camera.state);
          } catch (e) {
            setCameraPermission('prompt');
          }

          try {
            const location = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            setLocationPermission(location.state);
          } catch (e) {
            setLocationPermission('prompt');
          }
        }

        if ('Notification' in window) {
          setNotificationPermission(Notification.permission);
        }
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setCheckingPermissions(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await CapCamera.requestPermissions();
        setCameraPermission(result.camera === 'granted' ? 'granted' : 'denied');
        if (result.camera === 'granted') toast({ title: 'Berhasil', description: 'Izin kamera telah diberikan' });
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setCameraPermission('granted');
        toast({ title: 'Berhasil', description: 'Izin kamera telah diberikan' });
      }
    } catch (error) {
      setCameraPermission('denied');
      toast({
        title: 'Izin Ditolak',
        description: 'Mohon aktifkan izin kamera di pengaturan perangkat',
        variant: 'destructive'
      });
    }
  };

  const requestLocationPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await Geolocation.requestPermissions();
        setLocationPermission(result.location === 'granted' ? 'granted' : 'denied' as any);
        if (result.location === 'granted') toast({ title: 'Berhasil', description: 'Izin lokasi telah diberikan' });
      } else {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        setLocationPermission('granted');
        toast({ title: 'Berhasil', description: 'Izin lokasi telah diberikan' });
      }
    } catch (error) {
      setLocationPermission('denied');
      toast({
        title: 'Izin Ditolak',
        description: 'Mohon aktifkan izin lokasi di pengaturan perangkat',
        variant: 'destructive'
      });
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await PushNotifications.requestPermissions();
        setNotificationPermission(result.receive);
        if (result.receive === 'granted') toast({ title: 'Berhasil', description: 'Izin notifikasi telah diberikan' });
      } else if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          toast({ title: 'Berhasil', description: 'Izin notifikasi telah diberikan' });
        }
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
        <div className="absolute top-0 left-0 w-full h-[calc(120px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] space-y-6">
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
                    <Avatar className="h-40 w-40 border-4 border-white shadow-2xl transition-transform group-active:scale-95">
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

          {/* Biometrics Banner Removed for Cleaner UI */}

          {/* 5. App Permissions Section */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Izin Aplikasi</h3>
              <Button variant="ghost" size="sm" onClick={checkAllPermissions} disabled={checkingPermissions} className="text-blue-600 rounded-lg">
                <RefreshCw className={`h-4 w-4 ${checkingPermissions ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-4 space-y-1">
                {[
                  { icon: <Camera className="h-5 w-5" />, label: 'Akses Kamera', desc: 'Absensi & Verifikasi Wajah', status: cameraPermission, color: 'blue', action: requestCameraPermission },
                  { icon: <MapPin className="h-5 w-5" />, label: 'Akses Lokasi', desc: 'Validasi Lokasi Kerja', status: locationPermission, color: 'emerald', action: requestLocationPermission },
                  { icon: <Bell className="h-5 w-5" />, label: 'Notifikasi', desc: 'Pengumuman & Info Penting', status: notificationPermission, color: 'purple', action: requestNotificationPermission },
                  { icon: <HardDrive className="h-5 w-5" />, label: 'Penyimpanan', desc: 'Cache Foto & Data', status: storagePermission, color: 'orange', action: null }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl bg-${item.color}-50 text-${item.color}-600`}>
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.label}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className={`h-6 px-3 rounded-full text-[10px] font-bold ${(item.status as any) === 'granted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {(item.status as any) === 'granted' ? 'DIIZINKAN' : 'NONAKTIF'}
                      </Badge>
                      {(item.status as any) !== 'granted' && item.action && (
                        <Switch checked={(item.status as any) === 'granted'} onCheckedChange={() => (item.action as any)()} />
                      )}
                      {(item.status as any) === 'granted' && (
                        <div className="h-6 w-11 bg-green-500 rounded-full flex items-center justify-end px-1">
                          <div className="h-4 w-4 bg-white rounded-full shadow-sm" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 6. Login Settings Section */}
          <div className="space-y-4 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Pengaturan Masuk</h3>
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-6 space-y-6">
                {/* Face Registration Link (NEW) */}
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-2xl transition-colors"
                  onClick={() => navigate('/face-registration')}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-blue-100/50 text-blue-600">
                      <ScanFace className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Data Wajah (Biometrik)</p>
                      <p className="text-[10px] text-slate-500 leading-tight max-w-[200px]">
                        {faceDataRegistered ? 'Wajah sudah terdaftar' : 'Belum mendaftarkan wajah'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {faceDataRegistered && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Aktif</Badge>}
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                </div>

                <div className="h-px bg-slate-100 my-2" />

                {/* Face Login Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Login Wajah Otomatis</p>
                      <p className="text-[10px] text-slate-500 leading-tight max-w-[200px]">
                        Buka kamera otomatis saat login untuk masuk lebih cepat
                      </p>
                    </div>
                  </div>
                  <Switch checked={faceLoginEnabled} onCheckedChange={toggleFaceLogin} />
                </div>

                {/* Fingerprint Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
                      <Fingerprint className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Login Sidik Jari</p>
                      <p className="text-[10px] text-slate-500 leading-tight max-w-[200px]">
                        Gunakan sensor sidik jari perangkat (Jika tersedia)
                      </p>
                    </div>
                  </div>
                  <Switch checked={fingerprintEnabled} onCheckedChange={toggleFingerprint} />
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
              CMS Duta Solusi v2.1.0 • Corporate Management System
            </p>
          </div>
        </div>

        {/* --- Dialogs --- */}



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
