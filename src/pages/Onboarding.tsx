import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, User, MapPin, CreditCard, FileText, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { Bank } from '@/types';

type Step = 'welcome' | 'personal' | 'address' | 'bank' | 'review';

export default function OnboardingPage() {
    const { profile, user, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [currentStep, setCurrentStep] = useState<Step>('welcome');
    const [submitting, setSubmitting] = useState(false);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [banks, setBanks] = useState<Bank[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        // Personal
        nik_ktp: '',
        kk_number: '',
        npwp_number: '',
        place_of_birth: '',
        date_of_birth: '',
        gender: '',
        marital_status: '',
        religion: '',
        blood_type: '',
        mother_maiden_name: '',

        // Address
        address_ktp: '',
        address_domicile: '',

        // Bank
        bank_id: '',
        bank_account_number: '',
        bank_account_holder: '',
    });

    useEffect(() => {
        // Redirect if already approved or pending? 
        // For now, let them edit if draft/pending.
        if (profile?.onboarding_status === 'approved') {
            navigate('/dashboard');
        }

        // Pre-fill if data exists
        if (profile) {
            setFormData(prev => ({
                ...prev,
                nik_ktp: profile.nik_ktp || '',
                kk_number: profile.kk_number || '',
                npwp_number: profile.npwp_number || '',
                place_of_birth: profile.place_of_birth || '',
                date_of_birth: profile.date_of_birth ? new Date(profile.date_of_birth).toISOString().split('T')[0] : '',
                gender: profile.gender || '',
                marital_status: profile.marital_status || '',
                religion: profile.religion || '',
                blood_type: profile.blood_type || '',
                mother_maiden_name: profile.mother_maiden_name || '',
                address_ktp: profile.address_ktp || '',
                address_domicile: profile.address_domicile || '',
                bank_id: profile.bank_id || '',
                bank_account_number: profile.bank_account_number || '',
                bank_account_holder: profile.bank_account_holder || '',
            }));
        }

        fetchBanks();
    }, [profile, navigate]);

    const fetchBanks = async () => {
        setLoadingBanks(true);
        const { data } = await supabase.from('banks').select('*').eq('is_active', true);
        if (data) setBanks(data as Bank[]);
        setLoadingBanks(false);
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const validateStep = (step: Step): boolean => {
        if (step === 'personal') {
            if (!formData.nik_ktp || !formData.date_of_birth || !formData.gender || !formData.mother_maiden_name) {
                toast({ title: 'Data belum lengkap', description: 'Mohon lengkapi field bertanda bintang (*).', variant: 'destructive' });
                return false;
            }
        }
        if (step === 'address') {
            if (!formData.address_ktp) {
                toast({ title: 'Alamat KTP wajib diisi', variant: 'destructive' });
                return false;
            }
        }
        return true;
    };

    const nextStep = () => {
        if (!validateStep(currentStep)) return;

        const steps: Step[] = ['welcome', 'personal', 'address', 'bank', 'review'];
        const idx = steps.indexOf(currentStep);
        if (idx < steps.length - 1) {
            setCurrentStep(steps[idx + 1]);
        }
    };

    const prevStep = () => {
        const steps: Step[] = ['welcome', 'personal', 'address', 'bank', 'review'];
        const idx = steps.indexOf(currentStep);
        if (idx > 0) {
            setCurrentStep(steps[idx - 1]);
        }
    };

    const handleSubmit = async () => {
        if (!user) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('profiles').update({
                ...formData,
                // Convert empty strings to null for strict types if needed, or keeping stored as string is fine for text
                onboarding_status: 'pending_verification',
                updated_at: new Date().toISOString(),
            }).eq('id', user.id);

            if (error) throw error;

            toast({
                title: 'Data Terkirim!',
                description: 'Profil Anda sedang diverifikasi oleh HRD.',
            });

            await refreshProfile();
            navigate('/dashboard'); // Or stay here with a "Pending" view
        } catch (error) {
            console.error(error);
            toast({ title: 'Gagal Menyimpan', description: 'Terjadi kesalahan sistem.', variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8 px-4">
                {/* Progress Bar */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Lengkapi Data Karyawan</h1>
                    <p className="text-slate-500 mb-6">Mohon isi data dengan sebenar-benarnya sesuai KTP/KK untuk keperluan administrasi dan penggajian (Payroll).</p>

                    <div className="flex items-center justify-between text-sm font-medium text-slate-500 relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full" />
                        <div className={`absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-300`}
                            style={{ width: currentStep === 'welcome' ? '0%' : currentStep === 'personal' ? '25%' : currentStep === 'address' ? '50%' : currentStep === 'bank' ? '75%' : '100%' }} />

                        {['welcome', 'personal', 'address', 'bank', 'review'].map((step, idx) => (
                            <div key={step} className={`flex flex-col items-center bg-white px-2 cursor-default ${currentStep === step ? 'text-blue-600' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-colors ${['welcome', 'personal', 'address', 'bank', 'review'].indexOf(currentStep) >= idx ? 'bg-blue-600 text-white' : 'bg-slate-200'
                                    }`}>
                                    {idx + 1}
                                </div>
                                <span className="hidden sm:inline capitalize">{step}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <Card className="shadow-lg border-t-4 border-t-blue-600">
                    {currentStep === 'welcome' && (
                        <div className="text-center py-10 px-6">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                                <FileText className="h-10 w-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-4">Selamat Datang di Portal Karyawan</h2>
                            <p className="text-slate-600 max-w-lg mx-auto mb-8">
                                Sebelum mulai bekerja, Anda diwajibkan melengkapi data diri untuk keperluan:
                                <br /><br />
                                ✅ Pendaftaran BPJS Kesehatan & Ketenagakerjaan<br />
                                ✅ Pembukaan Rekening Payroll (Jika belum ada)<br />
                                ✅ Pelaporan Pajak (PPh 21)<br />
                            </p>
                            <Button size="lg" onClick={nextStep}>
                                Mulai Pengisian Data <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {currentStep === 'personal' && (
                        <>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-blue-600" /> Data Pribadi</CardTitle>
                                <CardDescription>Sesuai KTP & Kartu Keluarga</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Nama Lengkap (Sesuai KTP) *</Label>
                                        <Input value={formData.nik_ktp ? formData.nik_ktp : profile?.full_name} disabled className="bg-slate-100" />
                                        <p className="text-xs text-slate-400">Hubungi HR jika nama akun salah.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>NIK KTP (16 Digit) *</Label>
                                        <Input value={formData.nik_ktp} onChange={(e) => handleInputChange('nik_ktp', e.target.value)} maxLength={16} placeholder="3374..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>No. Kartu Keluarga (KK)</Label>
                                        <Input value={formData.kk_number} onChange={(e) => handleInputChange('kk_number', e.target.value)} maxLength={16} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>NPWP (Format: 16 Digit)</Label>
                                        <Input value={formData.npwp_number} onChange={(e) => handleInputChange('npwp_number', e.target.value)} placeholder="09.254..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tempat Lahir</Label>
                                        <Input value={formData.place_of_birth} onChange={(e) => handleInputChange('place_of_birth', e.target.value)} placeholder="Semarang" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tanggal Lahir *</Label>
                                        <Input type="date" value={formData.date_of_birth} onChange={(e) => handleInputChange('date_of_birth', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Jenis Kelamin *</Label>
                                        <Select value={formData.gender} onValueChange={(v) => handleInputChange('gender', v)}>
                                            <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="male">Laki-laki</SelectItem>
                                                <SelectItem value="female">Perempuan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Status Perkawinan</Label>
                                        <Select value={formData.marital_status} onValueChange={(v) => handleInputChange('marital_status', v)}>
                                            <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="single">Belum Kawin</SelectItem>
                                                <SelectItem value="married">Kawin</SelectItem>
                                                <SelectItem value="divorced">Cerai Hidup</SelectItem>
                                                <SelectItem value="widowed">Cerai Mati</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Agama</Label>
                                        <Select value={formData.religion} onValueChange={(v) => handleInputChange('religion', v)}>
                                            <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="islam">Islam</SelectItem>
                                                <SelectItem value="kristen">Kristen</SelectItem>
                                                <SelectItem value="katolik">Katolik</SelectItem>
                                                <SelectItem value="hindu">Hindu</SelectItem>
                                                <SelectItem value="buddha">Buddha</SelectItem>
                                                <SelectItem value="konghucu">Konghucu</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Golongan Darah</Label>
                                        <Select value={formData.blood_type} onValueChange={(v) => handleInputChange('blood_type', v)}>
                                            <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="A">A</SelectItem>
                                                <SelectItem value="B">B</SelectItem>
                                                <SelectItem value="AB">AB</SelectItem>
                                                <SelectItem value="O">O</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-1 md:col-span-2 space-y-2">
                                        <Label className="text-blue-600">Nama Gadis Ibu Kandung *</Label>
                                        <Input value={formData.mother_maiden_name} onChange={(e) => handleInputChange('mother_maiden_name', e.target.value)} placeholder="Wajib untuk validasi kepemilikan rekening & asuransi" />
                                    </div>
                                </div>
                            </CardContent>
                        </>
                    )}

                    {currentStep === 'address' && (
                        <>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-600" /> Alamat Domisili</CardTitle>
                                <CardDescription>Untuk keperluan surat menyurat.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Alamat Lengkap (Sesuai KTP) *</Label>
                                    <Textarea
                                        value={formData.address_ktp}
                                        onChange={(e) => handleInputChange('address_ktp', e.target.value)}
                                        placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota/Kab, Kode Pos"
                                        className="h-24"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Alamat Domisili Saat Ini</Label>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => handleInputChange('address_domicile', formData.address_ktp)}>
                                            Sama dengan KTP
                                        </Button>
                                    </div>
                                    <Textarea
                                        value={formData.address_domicile}
                                        onChange={(e) => handleInputChange('address_domicile', e.target.value)}
                                        placeholder="Jika berbeda dengan KTP"
                                        className="h-24"
                                    />
                                </div>
                            </CardContent>
                        </>
                    )}

                    {currentStep === 'bank' && (
                        <>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-blue-600" /> Rekening Payroll</CardTitle>
                                <CardDescription>Rekening untuk penerimaan gaji bulanan.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Bank</Label>
                                    <Select value={formData.bank_id} onValueChange={(v) => handleInputChange('bank_id', v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {banks.map((bank) => (
                                                <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Nomor Rekening</Label>
                                    <Input
                                        value={formData.bank_account_number}
                                        onChange={(e) => handleInputChange('bank_account_number', e.target.value)}
                                        placeholder="Contoh: 156000..."
                                        type="number"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nama Pemilik Rekening (Sesuai Buku Tabungan)</Label>
                                    <Input
                                        value={formData.bank_account_holder}
                                        onChange={(e) => handleInputChange('bank_account_holder', e.target.value)}
                                    />
                                    <p className="text-xs text-red-500 font-medium">Wajib atas nama sendiri (bukan istri/suami/anak).</p>
                                </div>
                            </CardContent>
                        </>
                    )}

                    {currentStep === 'review' && (
                        <>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-600" /> Tinjauan Akhir</CardTitle>
                                <CardDescription>Pastikan seluruh data sudah benar sebelum disimpan.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-lg space-y-3 text-sm">
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-slate-500">Nama Lengkap</span>
                                        <span className="col-span-2 font-medium">{profile?.full_name}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-slate-500">NIK KTP</span>
                                        <span className="col-span-2 font-medium">{formData.nik_ktp}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-slate-500">Tanggal Lahir</span>
                                        <span className="col-span-2 font-medium">{formData.date_of_birth}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-slate-500">Nama Ibu Kandung</span>
                                        <span className="col-span-2 font-medium">{formData.mother_maiden_name}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-slate-500">Rekening</span>
                                        <span className="col-span-2 font-medium">
                                            {banks.find(b => b.id === formData.bank_id)?.name} - {formData.bank_account_number}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                    <div className="mt-0.5"><CheckCircle2 className="h-4 w-4 text-yellow-600" /></div>
                                    <p className="text-sm text-yellow-700">
                                        Dengan menekan tombol Simpan, saya menyatakan bahwa data yang saya isikan adalah benar dan dapat dipertanggungjawabkan.
                                    </p>
                                </div>
                            </CardContent>
                        </>
                    )}

                    {currentStep !== 'welcome' && (
                        <CardFooter className="flex justify-between border-t border-slate-100 mt-4 pt-6">
                            <Button variant="outline" onClick={prevStep} disabled={submitting}>
                                <ChevronLeft className="mr-2 h-4 w-4" /> Kembali
                            </Button>
                            {currentStep === 'review' ? (
                                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmit} disabled={submitting}>
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Simpan Permanen</>}
                                </Button>
                            ) : (
                                <Button onClick={nextStep}>
                                    Lanjut <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </CardFooter>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
}
