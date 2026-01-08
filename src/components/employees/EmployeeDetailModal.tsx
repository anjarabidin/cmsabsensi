import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User, Briefcase, DollarSign, FileText, ChevronRight } from 'lucide-react';
import { Profile, JobPosition, JobGrade, Department, EmploymentStatus, Bank } from '@/types';

interface EmployeeDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId: string | null;
    onUpdate: () => void;
}

export function EmployeeDetailModal({ isOpen, onClose, employeeId, onUpdate }: EmployeeDetailModalProps) {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');

    // Data State
    const [profile, setProfile] = useState<Profile | null>(null);
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [grades, setGrades] = useState<JobGrade[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [statuses, setStatuses] = useState<EmploymentStatus[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [allEmployees, setAllEmployees] = useState<Profile[]>([]);

    // Form State (Flattened for easier handling)
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        if (isOpen && employeeId) {
            loadData();
        }
    }, [isOpen, employeeId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch Master Data in Parallel
            const [pRes, gRes, dRes, sRes, bRes, allEmployeesRes, empRes] = await Promise.all([
                supabase.from('job_positions').select('*'),
                supabase.from('job_grades').select('*'),
                supabase.from('departments').select('*'),
                supabase.from('employment_statuses').select('*'),
                supabase.from('banks').select('*').eq('is_active', true),
                supabase.from('profiles').select('id, full_name').eq('is_active', true).neq('id', employeeId || '').order('full_name'),
                supabase.from('profiles').select('*, department:departments(*), job_position:job_positions(*), job_grade:job_grades(*), employment_status:employment_statuses(*), bank:banks(*)').eq('id', employeeId!).single()
            ]);

            if (pRes.data) setPositions(pRes.data as JobPosition[]);
            if (gRes.data) setGrades(gRes.data as JobGrade[]);
            if (dRes.data) setDepartments(dRes.data as Department[]);
            if (sRes.data) setStatuses(sRes.data as EmploymentStatus[]);
            if (bRes.data) setBanks(bRes.data as Bank[]);
            if (allEmployeesRes.data) setAllEmployees(allEmployeesRes.data as Profile[]);

            if (empRes.data) {
                setProfile(empRes.data as Profile);
                // Initialize Form Data
                setFormData({
                    ...empRes.data,
                    // Ensure nulls are empty strings for inputs
                    nik_ktp: empRes.data.nik_ktp || '',
                    full_name: empRes.data.full_name || '',
                    email: empRes.data.email || '',
                    phone: empRes.data.phone || '',
                    address_ktp: empRes.data.address_ktp || '',
                    department_id: empRes.data.department_id || '',
                    job_position_id: empRes.data.job_position_id || '',
                    job_grade_id: empRes.data.job_grade_id || '',
                    employment_status_id: empRes.data.employment_status_id || '',
                    join_date: empRes.data.join_date || '',
                    bank_id: empRes.data.bank_id || '',
                    bank_account_number: empRes.data.bank_account_number || '',
                    bank_account_holder: empRes.data.bank_account_holder || '',
                    npwp_number: empRes.data.npwp_number || '',
                    reports_to: empRes.data.reports_to || '',
                    base_salary_display: 0
                });
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'Gagal memuat data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (shouldVerify = false) => {
        setSaving(true);
        try {
            const updates: any = {
                full_name: formData.full_name,
                nik_ktp: formData.nik_ktp,
                phone: formData.phone,
                address_ktp: formData.address_ktp,
                department_id: formData.department_id || null,
                job_position_id: formData.job_position_id || null,
                job_grade_id: formData.job_grade_id || null,
                employment_status_id: formData.employment_status_id || null,
                join_date: formData.join_date || null,
                bank_id: formData.bank_id || null,
                bank_account_number: formData.bank_account_number || null,
                bank_account_holder: formData.bank_account_holder || null,
                npwp_number: formData.npwp_number,
                reports_to: formData.reports_to === 'none' ? null : formData.reports_to || null,
                updated_at: new Date().toISOString(),
            };

            if (shouldVerify) {
                updates.onboarding_status = 'approved';
                updates.is_active = true;
            }

            const { error } = await supabase.from('profiles').update(updates).eq('id', employeeId!);

            if (error) throw error;

            toast({
                title: shouldVerify ? 'Karyawan Diverifikasi!' : 'Data Berhasil Disimpan',
                description: shouldVerify ? 'Status karyawan kini Aktif.' : undefined,
                variant: shouldVerify ? 'default' : 'default'
            });
            onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
            toast({ title: 'Gagal menyimpan', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // Helper to update state
    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl">Manajemen Karyawan</DialogTitle>
                            <DialogDescription>Edit profil, karir, dan data penggajian dalam satu tempat.</DialogDescription>
                        </div>
                        <Badge variant={profile?.onboarding_status === 'approved' ? 'default' : 'secondary'}>
                            {profile?.onboarding_status?.toUpperCase() || 'DRAFT'}
                        </Badge>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="profile">
                                <User className="w-4 h-4 mr-2" /> Data Diri
                            </TabsTrigger>
                            <TabsTrigger value="job">
                                <Briefcase className="w-4 h-4 mr-2" /> Karir & Jabatan
                            </TabsTrigger>
                            <TabsTrigger value="payroll">
                                <DollarSign className="w-4 h-4 mr-2" /> Payroll & Bank
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB 1: PROFILE */}
                        <TabsContent value="profile" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nama Lengkap</Label>
                                    <Input value={formData.full_name} onChange={e => updateField('full_name', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email (Akun Login)</Label>
                                    <Input value={formData.email} disabled className="bg-slate-100" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nomor Induk Kependudukan (NIK KTP)</Label>
                                    <Input value={formData.nik_ktp} onChange={e => updateField('nik_ktp', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nomor HP / WhatsApp</Label>
                                    <Input value={formData.phone} onChange={e => updateField('phone', e.target.value)} />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label>Alamat Lengkap (KTP)</Label>
                                    <Textarea value={formData.address_ktp} onChange={e => updateField('address_ktp', e.target.value)} />
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 2: JOB & CAREER */}
                        <TabsContent value="job" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Departemen</Label>
                                    <Select value={formData.department_id} onValueChange={v => updateField('department_id', v)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Dept..." /></SelectTrigger>
                                        <SelectContent>
                                            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Posisi / Jabatan</Label>
                                    <Select value={formData.job_position_id} onValueChange={v => updateField('job_position_id', v)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Jabatan..." /></SelectTrigger>
                                        <SelectContent>
                                            {positions.filter(p => !formData.department_id || p.department_id === formData.department_id).length > 0 ? (
                                                positions.filter(p => !formData.department_id || p.department_id === formData.department_id).map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                                ))
                                            ) : (
                                                <>
                                                    {positions.length > 0 ? (
                                                        <>
                                                            <div className="p-2 text-xs font-bold text-slate-400 bg-slate-50">Semua Jabatan (Dept tidak cocok)</div>
                                                            {positions.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <div className="p-4 text-sm text-center text-slate-500 font-medium italic">
                                                            Belum ada data jabatan di database.
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Status Kepegawaian</Label>
                                    <Select value={formData.employment_status_id} onValueChange={v => updateField('employment_status_id', v)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Status..." /></SelectTrigger>
                                        <SelectContent>
                                            {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Grade / Golongan (Menentukan Gaji)</Label>
                                    <Select value={formData.job_grade_id} onValueChange={v => updateField('job_grade_id', v)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Grade..." /></SelectTrigger>
                                        <SelectContent>
                                            {grades.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Atasan Langsung (Manager)</Label>
                                    <Select value={formData.reports_to} onValueChange={v => updateField('reports_to', v)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Atasan..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Tanpa Atasan (Top Level)</SelectItem>
                                            {allEmployees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Tanggal Bergabung</Label>
                                    <Input type="date" value={formData.join_date} onChange={e => updateField('join_date', e.target.value)} />
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 3: PAYROLL */}
                        <TabsContent value="payroll" className="space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg mb-4">
                                <h4 className="font-semibold text-blue-800 mb-1 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" /> Informasi Rekening
                                </h4>
                                <div className="grid grid-cols-3 gap-4 mt-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Bank</Label>
                                        <Select value={formData.bank_id} onValueChange={v => updateField('bank_id', v)}>
                                            <SelectTrigger className="bg-white h-8"><SelectValue placeholder="-" /></SelectTrigger>
                                            <SelectContent>
                                                {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">No. Rekening</Label>
                                        <Input className="bg-white h-8" value={formData.bank_account_number} onChange={e => updateField('bank_account_number', e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Atas Nama</Label>
                                        <Input className="bg-white h-8" value={formData.bank_account_holder} onChange={e => updateField('bank_account_holder', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>NPWP (Pajak)</Label>
                                    <Input value={formData.npwp_number} onChange={e => updateField('npwp_number', e.target.value)} placeholder="XX.XXX.XXX.X-XXX.XXX" />
                                </div>
                                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 col-span-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-sm font-bold text-slate-700">Gaji & Remunerasi</Label>
                                            <p className="text-[10px] text-slate-500">Konfigurasi Gaji Pokok, Tunjangan, BPJS, & Pajak.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="bg-blue-600 text-white hover:bg-blue-700 border-none px-4 h-9 font-bold"
                                            onClick={() => {
                                                onClose();
                                                navigate(`/employees/${employeeId}/salary`);
                                            }}
                                        >
                                            <DollarSign className="w-3.5 h-3.5 mr-2" />
                                            Kelola Gaji
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Gaji Pokok Terdaftar</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">Rp</span>
                                                <Input className="pl-9 h-9 bg-white" placeholder="Sesuai Grade" disabled />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Status Pajak (PTKP)</Label>
                                            <Input className="h-9 bg-white" placeholder="Otomatis" disabled />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 italic mt-1">Konfigurasi detail gaji pokok, tunjangan, BPJS, dan PPh 21 dilakukan melalui modul Salary Management.</p>
                        </TabsContent>
                    </Tabs>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>Batal</Button>

                    {profile?.onboarding_status === 'pending_verification' && (
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleSave(true)}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                            Verifikasi & Aktifkan
                        </Button>
                    )}

                    <Button onClick={() => handleSave(false)} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                        Simpan Perubahan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
