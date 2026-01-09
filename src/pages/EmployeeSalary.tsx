import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save, Plus, History } from 'lucide-react';
import { EmployeeSalary, Profile } from '@/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { calculateHourlyRate, formatCurrency } from '@/lib/overtime';

export default function EmployeeSalaryPage() {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [employee, setEmployee] = useState<Profile | null>(null);
  const [currentSalary, setCurrentSalary] = useState<EmployeeSalary | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<EmployeeSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [transportAllowance, setTransportAllowance] = useState<number>(0);
  const [mealAllowance, setMealAllowance] = useState<number>(0);
  const [positionAllowance, setPositionAllowance] = useState<number>(0);
  const [housingAllowance, setHousingAllowance] = useState<number>(0);
  const [otherAllowances, setOtherAllowances] = useState<number>(0);
  const [bpjsKesehatanEmployee, setBpjsKesehatanEmployee] = useState<number>(1.0);
  const [bpjsKesehatanEmployer, setBpjsKesehatanEmployer] = useState<number>(4.0);
  const [bpjsTkEmployee, setBpjsTkEmployee] = useState<number>(2.0);
  const [bpjsTkEmployer, setBpjsTkEmployer] = useState<number>(3.7);
  const [ptkpStatus, setPtkpStatus] = useState<string>('TK/0');
  const [npwp, setNpwp] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (userId) {
      fetchEmployeeData();
    }
  }, [userId]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);

      // Fetch employee profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setEmployee(profileData as Profile);

      // Fetch current salary
      const { data: salaryData, error: salaryError } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (salaryError && salaryError.code !== 'PGRST116') throw salaryError;

      if (salaryData) {
        setCurrentSalary(salaryData as EmployeeSalary);
        // Populate form with current data
        setBaseSalary(salaryData.base_salary);
        setTransportAllowance(salaryData.transport_allowance);
        setMealAllowance(salaryData.meal_allowance);
        setPositionAllowance(salaryData.position_allowance);
        setHousingAllowance(salaryData.housing_allowance);
        setOtherAllowances(salaryData.other_allowances);
        setBpjsKesehatanEmployee(salaryData.bpjs_kesehatan_employee_rate);
        setBpjsKesehatanEmployer(salaryData.bpjs_kesehatan_employer_rate);
        setBpjsTkEmployee(salaryData.bpjs_tk_employee_rate);
        setBpjsTkEmployer(salaryData.bpjs_tk_employer_rate);
        setPtkpStatus(salaryData.ptkp_status);
        setNpwp(salaryData.npwp || '');
        setNotes(salaryData.notes || '');
      }

      // Fetch salary history
      const { data: historyData, error: historyError } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('user_id', userId)
        .order('effective_date', { ascending: false });

      if (historyError) throw historyError;
      setSalaryHistory((historyData as EmployeeSalary[]) || []);
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data karyawan',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !user) return;

    if (baseSalary <= 0) {
      toast({
        title: 'Error',
        description: 'Gaji pokok harus lebih dari 0',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      // Deactivate current salary if exists
      if (currentSalary) {
        await supabase
          .from('employee_salaries')
          .update({ is_active: false })
          .eq('id', currentSalary.id);
      }

      // Insert new salary
      const { error } = await supabase.from('employee_salaries').insert({
        user_id: userId,
        effective_date: effectiveDate,
        base_salary: baseSalary,
        transport_allowance: transportAllowance,
        meal_allowance: mealAllowance,
        position_allowance: positionAllowance,
        housing_allowance: housingAllowance,
        other_allowances: otherAllowances,
        bpjs_kesehatan_employee_rate: bpjsKesehatanEmployee,
        bpjs_kesehatan_employer_rate: bpjsKesehatanEmployer,
        bpjs_tk_employee_rate: bpjsTkEmployee,
        bpjs_tk_employer_rate: bpjsTkEmployer,
        ptkp_status: ptkpStatus,
        npwp: npwp || null,
        notes: notes || null,
        is_active: true,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Data gaji berhasil disimpan',
      });

      fetchEmployeeData();
    } catch (error) {
      console.error('Error saving salary:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan data gaji',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const totalAllowances = transportAllowance + mealAllowance + positionAllowance + housingAllowance + otherAllowances;
  const grossSalary = baseSalary + totalAllowances;
  const hourlyRate = baseSalary > 0 ? calculateHourlyRate(baseSalary) : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-0 pb-10 px-4 md:px-0">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Pengaturan Gaji</h1>
            <p className="text-muted-foreground">
              {employee?.full_name} ({employee?.employee_id})
            </p>
          </div>
        </div>

        {/* Current Salary Summary */}
        {currentSalary && (
          <Card>
            <CardHeader>
              <CardTitle>Gaji Saat Ini</CardTitle>
              <CardDescription>Berlaku sejak {format(new Date(currentSalary.effective_date), 'd MMMM yyyy', { locale: id })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Gaji Pokok</p>
                  <p className="text-lg font-semibold">{formatCurrency(currentSalary.base_salary)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tunjangan</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      currentSalary.transport_allowance +
                      currentSalary.meal_allowance +
                      currentSalary.position_allowance +
                      currentSalary.housing_allowance +
                      currentSalary.other_allowances
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gaji Kotor</p>
                  <p className="text-lg font-semibold text-primary">
                    {formatCurrency(
                      currentSalary.base_salary +
                      currentSalary.transport_allowance +
                      currentSalary.meal_allowance +
                      currentSalary.position_allowance +
                      currentSalary.housing_allowance +
                      currentSalary.other_allowances
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PTKP Status</p>
                  <Badge>{currentSalary.ptkp_status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Salary Form */}
        <Card>
          <CardHeader>
            <CardTitle>Update Gaji</CardTitle>
            <CardDescription>Masukkan data gaji baru untuk karyawan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Effective Date */}
            <div className="space-y-2">
              <Label>Tanggal Berlaku</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            {/* Base Salary */}
            <div className="space-y-2">
              <Label>Gaji Pokok (Rp)</Label>
              <Input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))}
                placeholder="5000000"
              />
              {baseSalary > 0 && (
                <p className="text-sm text-muted-foreground">
                  Upah per jam: {formatCurrency(hourlyRate)} (untuk perhitungan lembur)
                </p>
              )}
            </div>

            {/* Allowances */}
            <div className="space-y-4">
              <h3 className="font-semibold">Tunjangan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tunjangan Transport (Rp)</Label>
                  <Input
                    type="number"
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(Number(e.target.value))}
                    placeholder="500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tunjangan Makan (Rp)</Label>
                  <Input
                    type="number"
                    value={mealAllowance}
                    onChange={(e) => setMealAllowance(Number(e.target.value))}
                    placeholder="500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tunjangan Jabatan (Rp)</Label>
                  <Input
                    type="number"
                    value={positionAllowance}
                    onChange={(e) => setPositionAllowance(Number(e.target.value))}
                    placeholder="1000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tunjangan Perumahan (Rp)</Label>
                  <Input
                    type="number"
                    value={housingAllowance}
                    onChange={(e) => setHousingAllowance(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tunjangan Lainnya (Rp)</Label>
                  <Input
                    type="number"
                    value={otherAllowances}
                    onChange={(e) => setOtherAllowances(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold">Total Tunjangan: {formatCurrency(totalAllowances)}</p>
                <p className="text-lg font-bold text-primary mt-1">Gaji Kotor: {formatCurrency(grossSalary)}</p>
              </div>
            </div>

            {/* BPJS Rates */}
            <div className="space-y-4">
              <h3 className="font-semibold">BPJS (%)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>BPJS Kesehatan - Karyawan (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bpjsKesehatanEmployee}
                    onChange={(e) => setBpjsKesehatanEmployee(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>BPJS Kesehatan - Perusahaan (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bpjsKesehatanEmployer}
                    onChange={(e) => setBpjsKesehatanEmployer(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>BPJS Ketenagakerjaan - Karyawan (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bpjsTkEmployee}
                    onChange={(e) => setBpjsTkEmployee(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>BPJS Ketenagakerjaan - Perusahaan (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bpjsTkEmployer}
                    onChange={(e) => setBpjsTkEmployer(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Tax Info */}
            <div className="space-y-4">
              <h3 className="font-semibold">Informasi Pajak</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status PTKP</Label>
                  <Select value={ptkpStatus} onValueChange={setPtkpStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TK/0">TK/0 - Tidak Kawin, Tanpa Tanggungan</SelectItem>
                      <SelectItem value="K/0">K/0 - Kawin, Tanpa Tanggungan</SelectItem>
                      <SelectItem value="K/1">K/1 - Kawin, 1 Tanggungan</SelectItem>
                      <SelectItem value="K/2">K/2 - Kawin, 2 Tanggungan</SelectItem>
                      <SelectItem value="K/3">K/3 - Kawin, 3 Tanggungan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>NPWP (Opsional)</Label>
                  <Input
                    value={npwp}
                    onChange={(e) => setNpwp(e.target.value)}
                    placeholder="00.000.000.0-000.000"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Catatan (Opsional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan tentang perubahan gaji..."
                rows={3}
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Gaji Baru
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Salary History */}
        {salaryHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Riwayat Gaji
              </CardTitle>
              <CardDescription>Perubahan gaji karyawan</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal Berlaku</TableHead>
                    <TableHead>Gaji Pokok</TableHead>
                    <TableHead>Tunjangan</TableHead>
                    <TableHead>Gaji Kotor</TableHead>
                    <TableHead>PTKP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryHistory.map((salary) => (
                    <TableRow key={salary.id}>
                      <TableCell>
                        {format(new Date(salary.effective_date), 'd MMM yyyy', { locale: id })}
                      </TableCell>
                      <TableCell>{formatCurrency(salary.base_salary)}</TableCell>
                      <TableCell>
                        {formatCurrency(
                          salary.transport_allowance +
                          salary.meal_allowance +
                          salary.position_allowance +
                          salary.housing_allowance +
                          salary.other_allowances
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(
                          salary.base_salary +
                          salary.transport_allowance +
                          salary.meal_allowance +
                          salary.position_allowance +
                          salary.housing_allowance +
                          salary.other_allowances
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{salary.ptkp_status}</Badge>
                      </TableCell>
                      <TableCell>
                        {salary.is_active ? (
                          <Badge>Aktif</Badge>
                        ) : (
                          <Badge variant="secondary">Tidak Aktif</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
