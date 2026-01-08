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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useCamera } from '@/hooks/useCamera';
import { supabase } from '@/integrations/supabase/client';
import { Camera, CheckCircle2, Loader2, Shield, User, Mail, Phone, Building, Briefcase, Calendar, Lock, Wallet, FileText, ChevronLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CONSENT_VERSION = 'biometric_v1';

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stream, videoRef, startCamera, stopCamera, capturePhoto, isActive } = useCamera();

  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [isConsentedState, setIsConsentedState] = useState(false);

  const [enrollStep, setEnrollStep] = useState<'idle' | 'camera' | 'preview'>('idle');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentPreviewUrl, setEnrollmentPreviewUrl] = useState<string | null>(null);
  const [enrollmentBlob, setEnrollmentBlob] = useState<Blob | null>(null);

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

  const handleSaveConsent = async () => {
    if (!consentKey) return;
    if (!consentChecked) {
      toast({
        title: 'Belum disetujui',
        description: 'Centang persetujuan terlebih dahulu.',
        variant: 'destructive',
      });
      return;
    }

    setConsentSaving(true);
    try {
      localStorage.setItem(consentKey, 'true');
      setIsConsentedState(true);
      toast({
        title: 'Berhasil',
        description: 'Persetujuan biometrik tersimpan.',
      });
    } finally {
      setConsentSaving(false);
    }
  };

  const handleStartEnroll = async () => {
    if (!isConsentedState) {
      toast({
        title: 'Perlu persetujuan',
        description: 'Setujui persyaratan biometrik sebelum enrollment.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await startCamera();
      setEnrollStep('camera');
    } catch (e) {
      toast({
        title: 'Gagal membuka kamera',
        description: e instanceof Error ? e.message : 'Tidak dapat mengakses kamera.',
        variant: 'destructive',
      });
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

      toast({
        title: 'Enrollment Berhasil',
        description: 'Wajah Anda telah terdaftar untuk absensi.',
      });
      setEnrollStep('idle');
      setEnrollmentPreviewUrl(null);
      setEnrollmentBlob(null);
      window.location.reload(); // Simple refresh to update context
    } catch (error) {
      console.error('Enrollmnet error', error);
      toast({ title: 'Gagal enrollment', description: 'Terjadi kesalahan saat menyimpan data.', variant: 'destructive' });
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-slate-50/50">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-[240px] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8 pb-24 space-y-8 md:px-8">
          {/* Header Text */}
          <div className="flex items-start gap-4 text-white">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight drop-shadow-md">Profil Saya</h1>
              <p className="text-blue-50 font-medium opacity-90 mt-1">Kelola informasi pribadi dan keamanan akun Anda.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Identity Card */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-lg overflow-hidden relative">
                <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200" />
                <CardContent className="pt-0 relative px-6 pb-8 text-center">
                  <div className="-mt-16 mb-4 flex justify-center">
                    <div className="relative">
                      <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                        <AvatarImage src={profile?.avatar_url || ''} className="object-cover" />
                        <AvatarFallback className="text-4xl bg-blue-100 text-blue-700 font-bold">
                          {profile?.full_name?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute bottom-2 right-2 h-6 w-6 rounded-full border-2 border-white ${isEnrolled ? 'bg-green-500' : 'bg-slate-300'}`} title={isEnrolled ? "Biometrik Terdaftar" : "Biometrik Belum Terdaftar"} />
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-slate-900">{profile?.full_name}</h2>
                  <p className="text-sm text-slate-500 font-medium mb-4">{profile?.position || 'Posisi Belum Diatur'}</p>

                  <div className="flex flex-wrap gap-2 justify-center mb-6">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                      {profile?.employee_id || 'ID: --'}
                    </Badge>
                    {(profile as any)?.department && (
                      <Badge variant="outline">{(profile as any).department.name}</Badge>
                    )}
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{profile?.phone || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>Bergabung: {new Date().getFullYear()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Status Card */}
              <Card className="border-none shadow-md bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5" /> Status Keamanan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-100 text-sm">Verifikasi Wajah</span>
                    {isEnrolled ? (
                      <Badge className="bg-green-400 text-green-900 hover:bg-green-500 border-none">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none">Nonaktif</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-100 text-sm">Akun</span>
                    <Badge className="bg-green-400 text-green-900 hover:bg-green-500 border-none">Terverifikasi</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Details & Settings */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-white/20 backdrop-blur-md p-1 rounded-xl mb-6">
                  <TabsTrigger value="personal" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 font-semibold text-white">Data Pribadi</TabsTrigger>
                  <TabsTrigger value="salary" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 font-semibold text-white">Gaji & Slip</TabsTrigger>
                  <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 font-semibold text-white">Keamanan</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-6">
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle>Informasi Dasar</CardTitle>
                      <CardDescription>Detail informasi profil karyawan Anda.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nama Lengkap</Label>
                          <Input defaultValue={profile?.full_name} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>NIP / ID Karyawan</Label>
                          <Input defaultValue={profile?.employee_id || ''} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input defaultValue={user?.email || ''} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Nomor Telepon</Label>
                          <Input defaultValue={profile?.phone || ''} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Posisi</Label>
                          <Input defaultValue={profile?.position || ''} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Departemen</Label>
                          <Input defaultValue={(profile as any)?.department?.name || ''} disabled className="bg-slate-50" />
                        </div>
                      </div>
                      <div className="pt-4 flex justify-end">
                        <Button disabled variant="outline">
                          Hubungi Admin untuk Ubah Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="salary" className="space-y-6">
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle>Overview Penghasilan</CardTitle>
                      <CardDescription>Ringkasan komponen gaji pokok dan slip terbaru Anda.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-emerald-800 font-semibold text-sm">Gaji Pokok Terdaftar</p>
                          <p className="text-2xl font-bold text-emerald-900 mt-1">
                            {/* In a real app, this would come from the employee_salaries table */}
                            Rp 7.500.000
                          </p>
                        </div>
                        <Wallet className="h-10 w-10 text-emerald-200" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status PTKP</h4>
                          <p className="text-sm font-semibold text-slate-700 mt-1">TK/0 (Wajib Pajak Sendiri)</p>
                        </div>
                        <div className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metode Pajak</h4>
                          <p className="text-sm font-semibold text-slate-700 mt-1">PPh 21 TER 2024</p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg font-bold rounded-2xl" onClick={() => navigate('/salary-slips')}>
                          <FileText className="mr-2 h-5 w-5" /> Lihat Semua Slip Gaji (PDF)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="security" className="space-y-6">
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle>Verifikasi Wajah (Face ID)</CardTitle>
                      <CardDescription>Digunakan untuk validasi saat melakukan absensi masuk dan pulang.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {!isEnrolled && !isConsentedState && (
                        <Alert className="bg-blue-50 border-blue-200">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <AlertTitle className="text-blue-800">Persetujuan Diperlukan</AlertTitle>
                          <AlertDescription className="text-blue-700">
                            Sebelum mengaktifkan Face ID, Anda harus menyetujui kebijakan penggunaan data biometrik.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Consent Section */}
                      {!isConsentedState && (
                        <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                          <h3 className="font-semibold text-slate-900">Persetujuan Penggunaan Data Wajah</h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            Dengan mengaktifkan fitur ini, saya setuju bahwa foto wajah saya akan disimpan
                            dan digunakan sistem semata-mata untuk keperluan verifikasi identitas saat melakukan absensi.
                            Data ini dilindungi dan tidak akan dibagikan ke pihak ketiga tanpa izin.
                          </p>
                          <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                              id="terms"
                              checked={consentChecked}
                              onCheckedChange={(c) => setConsentChecked(c as boolean)}
                            />
                            <Label htmlFor="terms" className="text-sm font-medium">
                              Saya mengerti dan menyetujui persyaratan di atas
                            </Label>
                          </div>
                          <Button
                            onClick={handleSaveConsent}
                            disabled={!consentChecked || consentSaving}
                            className="w-full sm:w-auto"
                          >
                            {consentSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            Simpan Persetujuan
                          </Button>
                        </div>
                      )}

                      {/* Enrollment UI */}
                      {isConsentedState && (
                        <div className="space-y-6">
                          {enrollStep === 'idle' ? (
                            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                                <Camera className="h-8 w-8" />
                              </div>
                              <h3 className="text-lg font-medium text-slate-900 mb-2">
                                {isEnrolled ? 'Perbarui Data Wajah' : 'Daftarkan Wajah'}
                              </h3>
                              <p className="text-slate-500 text-center max-w-sm mb-6">
                                {isEnrolled
                                  ? 'Wajah sudah terdaftar. Klik di bawah jika ingin memperbarui foto terbaru.'
                                  : 'Ambil foto wajah Anda sekarang untuk mulai menggunakan fitur absensi wajah.'}
                              </p>
                              <Button onClick={handleStartEnroll} size="lg" className="shadow-lg hover:shadow-xl transition-all">
                                {isEnrolled ? 'Ambil Ulang Foto' : 'Mulai Pendaftaran'}
                              </Button>
                            </div>
                          ) : enrollStep === 'camera' ? (
                            <div className="bg-black rounded-xl overflow-hidden shadow-2xl relative max-w-md mx-auto">
                              <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" />
                              <div className="absolute bottom-6 inset-x-0 flex justify-center gap-4">
                                <Button variant="outline" className="bg-white/20 text-white border-none hover:bg-white/40" onClick={() => { stopCamera(); setEnrollStep('idle'); }}>
                                  Batal
                                </Button>
                                <Button onClick={handleCaptureEnroll} size="lg" className="rounded-full h-14 w-14 p-0 border-4 border-white/50 bg-white hover:bg-white text-blue-600">
                                  <Camera className="h-6 w-6" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4 max-w-md mx-auto">
                              <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-slate-200">
                                {enrollmentPreviewUrl && (
                                  <img src={enrollmentPreviewUrl} alt="Preview" className="w-full h-full object-cover transform scale-x-[-1]" />
                                )}
                              </div>
                              <div className="flex gap-3">
                                <Button variant="outline" onClick={handleRetakeEnroll} className="flex-1">
                                  Ulangi
                                </Button>
                                <Button onClick={handleSubmitEnroll} className="flex-1" disabled={enrolling}>
                                  {enrolling ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                                    </>
                                  ) : 'Simpan Foto'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout >
  );
}
