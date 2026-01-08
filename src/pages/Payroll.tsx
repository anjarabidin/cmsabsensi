import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Eye, DollarSign, Users, AlertCircle, RefreshCw, Calculator, FileWarning, Info } from 'lucide-react';
import { PayrollRun } from '@/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '@/lib/overtime';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function PayrollPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
    { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (user) fetchPayrollRuns();
  }, [user]);

  const fetchPayrollRuns = async () => {
    try {
      setLoading(true);
      setErrorState(null);
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setPayrollRuns((data as PayrollRun[]) || []);
    } catch (error: any) {
      console.error('Error fetching payroll runs:', error);
      setErrorState(error.message || 'Gagal memuat data payroll.');
      if (error.code !== 'PGRST116') {
        toast({
          title: 'Gagal Memuat Data',
          description: 'Terjadi kesalahan saat mengambil data payroll.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    if (!user) return;
    setGenerating(true);

    try {
      const { data: existing } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Payroll Sudah Ada',
          description: `Periode ini sudah diproses.`,
          variant: 'destructive',
        });
        setGenerating(false);
        return;
      }

      const periodStart = new Date(selectedYear, selectedMonth - 1, 1);
      const periodEnd = new Date(selectedYear, selectedMonth, 0);

      const { data: payrollRun, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          month: selectedMonth,
          year: selectedYear,
          period_start: format(periodStart, 'yyyy-MM-dd'),
          period_end: format(periodEnd, 'yyyy-MM-dd'),
          status: 'draft',
          total_employees: 0,
          total_gross_salary: 0,
          total_deductions: 0,
          total_net_salary: 0,
          generated_by: user.id,
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (runError) throw runError;

      // Get employees with active salaries
      const { data: employees } = await supabase
        .from('employee_salaries')
        .select(`user_id, profiles:user_id(id, is_active)`)
        .eq('is_active', true);

      // @ts-ignore
      const activeEmployees = employees?.filter((e: any) => e.profiles?.is_active) || [];

      let successCount = 0;
      for (const emp of activeEmployees) {
        await supabase.rpc('generate_employee_payroll', {
          p_payroll_run_id: payrollRun.id,
          p_user_id: emp.user_id,
          p_month: selectedMonth,
          p_year: selectedYear,
        });
        successCount++;
      }

      // Update the payroll_run totals
      const { data: details } = await supabase
        .from('payroll_details')
        .select('gross_salary, total_deductions, net_salary')
        .eq('payroll_run_id', payrollRun.id);

      if (details) {
        const totalGross = details.reduce((sum, d) => sum + Number(d.gross_salary), 0);
        const totalDeductions = details.reduce((sum, d) => sum + Number(d.total_deductions), 0);
        const totalNet = details.reduce((sum, d) => sum + Number(d.net_salary), 0);

        await supabase.from('payroll_runs')
          .update({
            total_employees: successCount,
            total_gross_salary: totalGross,
            total_deductions: totalDeductions,
            total_net_salary: totalNet
          })
          .eq('id', payrollRun.id);
      }

      toast({ title: 'Berhasil', description: `Selesai memproses ${successCount} karyawan.` });
      setDialogOpen(false);
      fetchPayrollRuns();
    } catch (error) {
      console.error('Error generating payroll:', error);
      toast({ title: 'Gagal Generate', description: 'Terjadi kesalahan sistem.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      draft: "bg-slate-100 text-slate-600 border-slate-200",
      finalized: "bg-blue-50 text-blue-700 border-blue-200",
      paid: "bg-green-50 text-green-700 border-green-200",
      cancelled: "bg-red-50 text-red-700 border-red-200"
    };
    // @ts-ignore
    return <Badge variant="outline" className={cn("capitalize font-semibold px-2 py-0.5", styles[status] || styles.draft)}>{status}</Badge>;
  };

  if (role !== 'admin_hr') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
            <AlertCircle className="h-10 w-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Akses Terbatas</h2>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 italic">Modul ini hanya dapat diakses oleh Administrator Finance/HR.</p>
          <Button variant="outline" className="mt-8 rounded-full px-8 border-slate-200 hover:bg-slate-50" onClick={() => navigate('/dashboard')}>
            Kembali ke Beranda
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative">
        {/* Modern Header Segment */}
        <div className="absolute -top-6 -left-6 w-[calc(100%+3rem)] h-[220px] bg-gradient-to-br from-indigo-700 via-blue-600 to-sky-500 rounded-b-[48px] z-0 shadow-xl opacity-95" />

        <div className="relative z-10 space-y-8 max-w-[1400px] mx-auto pt-4 pb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center justify-between">
            <div className="text-white drop-shadow-sm">
              <h1 className="text-3xl font-extrabold tracking-tight">Manajemen Payroll</h1>
              <p className="text-blue-100 font-medium opacity-90 mt-1 flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Proses gaji bulanan dan buat slip gaji otomatis.
              </p>
            </div>
            <Button
              className="bg-white text-blue-700 hover:bg-blue-50 hover:scale-105 transition-all shadow-lg active:scale-95 rounded-2xl h-11 px-6 font-bold"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-5 w-5" /> Mulai Periode Baru
            </Button>
          </div>

          <Card className="border-none shadow-2xl shadow-blue-900/5 overflow-hidden bg-white/95 backdrop-blur-sm rounded-[32px]">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 space-y-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="h-14 w-full rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : errorState ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
                  <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                    <FileWarning className="h-10 w-10 text-red-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">Gagal Memuat Database</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">{errorState}</p>
                  </div>
                  <Button variant="outline" onClick={fetchPayrollRuns} className="rounded-full px-8 h-11 border-slate-200 font-semibold hover:bg-slate-50">
                    <RefreshCw className="mr-2 h-4 w-4" /> Hubungkan Ulang
                  </Button>
                </div>
              ) : payrollRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                  <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-2 shadow-inner">
                    <DollarSign className="h-12 w-12 text-slate-200" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Belum Ada Sesi Payroll</h3>
                    <p className="text-slate-400 max-w-sm mx-auto font-medium">Buat pengupahan pertama Anda dengan mengklik tombol "Mulai Periode Baru" di atas.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="border-b border-slate-100 hover:bg-transparent">
                        <TableHead className="py-6 px-8 text-xs font-bold uppercase tracking-widest text-slate-400">Periode Gaji</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-400">Distribusi Karyawan</TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-slate-400">Total Pengeluaran (Net)</TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-slate-400">Status Sesi</TableHead>
                        <TableHead className="text-right py-6 px-8 text-xs font-bold uppercase tracking-widest text-slate-400">Tindakan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRuns.map((run) => (
                        <TableRow key={run.id} className="group hover:bg-blue-50/30 transition-all border-b border-slate-50">
                          <TableCell className="py-6 px-8 font-extrabold text-slate-900 text-lg">
                            {months.find(m => m.value === run.month)?.label} {run.year}
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Digenerate pada {format(new Date(run.generated_at), 'd MMM yyyy, HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100/50 group-hover:bg-white transition-colors">
                              <Users className="h-4 w-4 text-slate-400" />
                              <span className="font-bold text-slate-600 text-sm">{run.total_employees} <span className="font-medium text-slate-400">Pegawai</span></span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-blue-700 text-base">
                            {formatCurrency(run.total_net_salary)}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={run.status} />
                          </TableCell>
                          <TableCell className="text-right py-6 px-8">
                            <Button size="sm" variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-blue-100 group-active:scale-90 transition-all" onClick={() => navigate(`/payroll/${run.id}`)}>
                              <Eye className="h-5 w-5 text-blue-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="rounded-3xl border-none shadow-2xl">
          <DialogHeader className="pb-4">
            <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <DialogTitle className="text-2xl font-bold">Inisialisasi Payroll</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">Tentukan periode bulan dan tahun yang akan diproses gajinya.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Bulan</label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="rounded-xl border-slate-200 h-12 focus:ring-blue-500"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Tahun</label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="rounded-xl border-slate-200 h-12 focus:ring-blue-500"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex gap-4 items-start my-2">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-sm text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800">Info Otomatisasi:</p>
              <p>Sistem akan secara otomatis menarik data kehadiran, lembur, dan iuran BPJS berdasarkan pengaturan masing-masing karyawan.</p>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-semibold h-12">Batalkan</Button>
            <Button onClick={handleGeneratePayroll} disabled={generating} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8 font-bold shadow-lg shadow-blue-200">
              {generating ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
              {generating ? 'Menghitung Gaji...' : 'Generate Payroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
