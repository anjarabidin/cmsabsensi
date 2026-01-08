import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Lock, Check, Download, AlertCircle, Printer, Calendar, Users, DollarSign } from 'lucide-react';
import { PayrollRun, PayrollDetail as PayrollDetailType } from '@/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '@/lib/overtime';
import { generateSlipGaji, downloadSlipGaji } from '@/lib/pdfGenerator';
import { cn } from '@/lib/utils';

export default function PayrollDetailPage() {
  const { id: payrollRunId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
  const [payrollDetails, setPayrollDetails] = useState<(PayrollDetailType & { profiles?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [generatingSlips, setGeneratingSlips] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  useEffect(() => {
    if (payrollRunId) fetchPayrollData();
  }, [payrollRunId]);

  const fetchPayrollData = async () => {
    try {
      setLoading(true);
      const { data: runData, error: runError } = await supabase.from('payroll_runs').select('*').eq('id', payrollRunId).single();
      if (runError) throw runError;
      setPayrollRun(runData as PayrollRun);

      const { data: detailsData, error: detailsError } = await supabase
        .from('payroll_details')
        .select(`*, profiles:user_id (id, full_name, employee_id, email, position)`)
        .eq('payroll_run_id', payrollRunId)
        .order('created_at', { ascending: true });

      if (detailsError) throw detailsError;
      setPayrollDetails(detailsData as any[] || []);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast({ title: 'Gagal Memuat Data', description: 'Silakan refresh halaman.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      draft: "bg-slate-100 text-slate-600 border-slate-200",
      finalized: "bg-blue-50 text-blue-700 border-blue-200",
      paid: "bg-green-50 text-green-700 border-green-200",
      cancelled: "bg-red-50 text-red-700 border-red-200"
    };
    return <Badge variant="outline" className={cn("capitalize font-bold px-3 py-1 rounded-lg shadow-sm border-2", styles[status] || styles.draft)}>{status}</Badge>;
  };

  const handleFinalize = async () => {
    if (!user || !payrollRun) return;
    setFinalizing(true);
    try {
      const { error } = await supabase.from('payroll_runs')
        .update({ status: 'finalized', finalized_by: user.id, finalized_at: new Date().toISOString() })
        .eq('id', payrollRun.id);

      if (error) throw error;
      toast({ title: 'Payroll Dikunci', description: 'Data gaji telah difinalisasi.' });
      setFinalizeDialogOpen(false);
      fetchPayrollData();
    } catch (error) {
      toast({ title: 'Gagal Finalize', description: 'Terjadi kesalahan sistem.', variant: 'destructive' });
    } finally {
      setFinalizing(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!payrollRun) return;
    setMarkingPaid(true);
    try {
      const { error } = await supabase.from('payroll_runs')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payrollRun.id);

      if (error) throw error;

      await supabase.from('payroll_details')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('payroll_run_id', payrollRun.id);

      toast({ title: 'Pembayaran Berhasil', description: 'Status telah diperbarui menjadi PAID.' });
      setPaidDialogOpen(false);
      fetchPayrollData();
    } catch (error) {
      toast({ title: 'Gagal Update', description: 'Terjadi kesalahan sistem.', variant: 'destructive' });
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleGenerateSlips = async () => {
    if (!payrollRun) return;
    setGeneratingSlips(true);
    try {
      for (const detail of payrollDetails) {
        const profile = detail.profiles || {};
        const pdfDoc = generateSlipGaji({
          employee: {
            name: profile.full_name || 'Tanpa Nama',
            employeeId: profile.employee_id || '-',
            position: profile.position || '-',
            department: '-'
          },
          period: {
            month: payrollRun.month,
            year: payrollRun.year,
            periodStart: payrollRun.period_start,
            periodEnd: payrollRun.period_end,
          },
          payroll: detail,
        });
        downloadSlipGaji(pdfDoc, profile.full_name || 'slip', payrollRun.month, payrollRun.year);
      }
      await supabase.from('payroll_details').update({ slip_generated: true }).eq('payroll_run_id', payrollRunId);
      toast({ title: 'Selesai', description: 'Semua slip gaji berhasil diunduh.' });
      fetchPayrollData();
    } catch (error) {
      console.error(error);
      toast({ title: 'Gagal', description: 'Gagal membuat slip PDF.', variant: 'destructive' });
    } finally {
      setGeneratingSlips(false);
    }
  };

  const handleDownloadSingleSlip = (detail: PayrollDetailType & { profiles?: any }) => {
    if (!payrollRun) return;
    try {
      const profile = detail.profiles || {};
      const pdfDoc = generateSlipGaji({
        employee: {
          name: profile.full_name || 'Tanpa Nama',
          employeeId: profile.employee_id || '-',
          position: profile.position || '-',
        },
        period: {
          month: payrollRun.month,
          year: payrollRun.year,
          periodStart: payrollRun.period_start,
          periodEnd: payrollRun.period_end,
        },
        payroll: detail,
      });
      downloadSlipGaji(pdfDoc, profile.full_name || 'slip', payrollRun.month, payrollRun.year);
      toast({ title: 'Berhasil', description: 'Slip gaji diunduh.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Gagal', description: 'Terjadi kesalahan saat download.', variant: 'destructive' });
    }
  };

  if (loading) return <DashboardLayout><div className="flex flex-col items-center justify-center py-32 space-y-4"><Loader2 className="h-10 w-10 animate-spin text-blue-500" /><p className="text-slate-500 font-medium">Memuat rincian payroll...</p></div></DashboardLayout>;
  if (!payrollRun) return <DashboardLayout><div className="text-center py-20 text-slate-500 font-bold uppercase tracking-widest bg-slate-50 rounded-3xl mx-6 border-2 border-dashed border-slate-200">Data Payroll Tidak Ditemukan</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="relative">
        <div className="absolute -top-6 -left-6 w-[calc(100%+3rem)] h-[280px] bg-gradient-to-br from-indigo-800 via-blue-700 to-cyan-500 rounded-b-[64px] z-0 shadow-2xl opacity-95 transition-all" />

        <div className="relative z-10 space-y-6 max-w-[1600px] mx-auto pt-2 pb-24 animate-in fade-in slide-in-from-top-4 duration-700">
          {/* Header Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
            <div className="flex items-center gap-5">
              <Button variant="outline" size="icon" onClick={() => navigate('/payroll')} className="rounded-2xl h-12 w-12 bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all hover:scale-110 active:scale-95 shadow-lg backdrop-blur-md">
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div className="text-white drop-shadow-lg">
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl font-black tracking-tighter">Buku Payroll</h1>
                  <StatusBadge status={payrollRun.status} />
                </div>
                <p className="text-blue-50 font-bold opacity-90 flex items-center gap-2 mt-2 text-lg">
                  {months[payrollRun.month - 1]} {payrollRun.year} <span className="text-white/40 leading-none">|</span> <span className="opacity-80 font-medium">{format(new Date(payrollRun.period_start), 'd MMM', { locale: id })} - {format(new Date(payrollRun.period_end), 'd MMM yyyy', { locale: id })}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Button variant="outline" className="h-12 rounded-2xl bg-white/10 border-white/20 text-white hover:bg-white/20 px-6 font-bold backdrop-blur-md shadow-xl transition-all hover:translate-y-[-2px]" onClick={() => {
                const headers = ['ID', 'Nama', 'Hari Kerja', 'Hadir', 'Lembur', 'Gaji Pokok', 'Tunjangan', 'Gaji Kotor', 'Potongan', 'PPh21', 'Net'];
                const rows = payrollDetails.map(d => [d.profiles?.employee_id, d.profiles?.full_name, d.working_days, d.present_days, d.overtime_hours, d.base_salary, d.total_allowances, d.gross_salary, d.total_deductions, d.pph21, d.net_salary]);
                const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `payroll_${payrollRun.month}_${payrollRun.year}.csv`;
                a.click();
              }}>
                <Download className="mr-2 h-5 w-5" /> Export Ledger
              </Button>

              {payrollRun.status === 'draft' && (
                <Button onClick={() => setFinalizeDialogOpen(true)} className="h-12 rounded-2xl bg-white text-blue-800 hover:bg-blue-50 px-10 font-black shadow-2xl transition-all hover:scale-105 active:scale-95">
                  <Lock className="mr-2 h-5 w-5" /> Kunci Data Payroll
                </Button>
              )}

              {payrollRun.status === 'finalized' && (
                <>
                  <Button variant="outline" onClick={handleGenerateSlips} disabled={generatingSlips} className="h-12 rounded-2xl bg-white/10 border-white/20 text-white hover:bg-white/20 px-6 font-bold backdrop-blur-md shadow-xl">
                    {generatingSlips ? <Loader2 className="mr-2 animate-spin h-5 w-5" /> : <Printer className="mr-2 h-5 w-5" />}
                    Cetak Masal Slip
                  </Button>
                  <Button onClick={() => setPaidDialogOpen(true)} className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-10 font-black shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105">
                    <Check className="mr-2 h-5 w-5" /> Tandai Lunas (Paid)
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Key Insights Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={Users} title="Total Tenaga Kerja" value={`${payrollRun.total_employees}`} suffix="Orang" color="bg-blue-600" />
            <StatCard icon={DollarSign} title="Total Belanja Gaji" value={formatCurrency(payrollRun.total_gross_salary)} color="bg-indigo-600" />
            <StatCard icon={AlertCircle} title="Pajak & BPJS Pendapatan" value={formatCurrency(payrollRun.total_deductions)} color="bg-rose-600" subValue={`Potongan Kolektif`} />
            <StatCard icon={Check} title="Total Bersih Dibayarkan" value={formatCurrency(payrollRun.total_net_salary)} color="bg-emerald-600" isHighlight />
          </div>

          {/* Conditional Alerts */}
          {payrollRun.status === 'draft' && (
            <div className="bg-amber-50/80 backdrop-blur-sm border-2 border-amber-200/50 rounded-[32px] p-6 flex gap-5 text-amber-900 shadow-xl shadow-amber-900/5 animate-pulse-subtle">
              <div className="h-12 w-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                <AlertCircle className="h-7 w-7 text-amber-600" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-xl tracking-tight text-amber-950">Draft Berjalan: Perhitungan Belum Final</p>
                <p className="opacity-90 font-bold text-amber-800 leading-relaxed max-w-4xl">Nilai di bawah ini dapat berubah sewaktu-waktu sesuai dengan penutupan data absensi akhir bulan. Mohon klik <strong>Kunci Data Payroll</strong> untuk mematikan sinkronisasi dan memulai proses transfer.</p>
              </div>
            </div>
          )}

          {/* Data Table */}
          <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden bg-white/98 rounded-[40px] border border-slate-100">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="py-8 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pegawai (ID)</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Produktifitas</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gaji Pokok</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Lembur & Tunj.</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Deductions (Nett)</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Net Payable</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-6">Slip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollDetails.map((detail) => (
                      <TableRow key={detail.id} className="group hover:bg-blue-50/40 transition-all border-b border-slate-50 last:border-none">
                        <TableCell className="py-6 px-10">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-gradient-to-br from-slate-100 to-white rounded-2xl flex items-center justify-center font-black text-slate-400 shadow-sm border border-slate-100 group-hover:from-blue-100 group-hover:to-white group-hover:text-blue-500 transition-colors">
                              {detail.profiles?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-black text-slate-950 text-base leading-tight">{detail.profiles?.full_name || 'Tanpa Nama'}</p>
                              <p className="text-[11px] font-black text-blue-500/60 uppercase tracking-widest mt-1">{detail.profiles?.employee_id || 'ID: -'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex flex-col items-center">
                            <div className="px-4 py-1.5 bg-slate-100 rounded-full text-xs font-black text-slate-700 shadow-inner group-hover:bg-white transition-colors">
                              {detail.present_days} <span className="text-slate-400 mx-0.5">/</span> {detail.working_days}
                            </div>
                            {detail.overtime_hours > 0 && (
                              <div className="text-[10px] font-black text-orange-500 mt-1.5 flex items-center gap-1">
                                <div className="h-1 w-1 bg-orange-500 rounded-full animate-pulse" /> Lembur {detail.overtime_hours}h
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-600 text-sm">{formatCurrency(detail.base_salary)}</TableCell>
                        <TableCell className="text-right">
                          <p className="font-extrabold text-emerald-600 text-sm">+{formatCurrency(detail.total_allowances + detail.overtime_pay)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Allowances</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-extrabold text-rose-500 text-xs">-{formatCurrency(detail.total_deductions)}</p>
                          <p className="text-[10px] text-slate-400 font-bold tracking-tight italic mt-0.5 opacity-60">incl. pph21 & bpjs</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-lg font-black text-slate-900 tracking-tight">{formatCurrency(detail.net_salary)}</div>
                          {detail.payment_status === 'paid' ? (
                            <div className="mt-1"><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-black text-[9px] h-4.5 px-2">PAID SUCCESS</Badge></div>
                          ) : (
                            <div className="mt-1"><Badge variant="outline" className="text-slate-300 font-black text-[9px] h-4.5 px-2 tracking-widest uppercase">Unprocessed</Badge></div>
                          )}
                        </TableCell>
                        <TableCell className="text-center px-6">
                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-2xl bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all active:scale-90" onClick={() => handleDownloadSingleSlip(detail)}>
                            <Download className="h-5 w-5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={finalizeDialogOpen}
        onOpenChange={setFinalizeDialogOpen}
        title="Otorisasi Finalisasi"
        desc="Apakah Anda yakin telah melakukan verifikasi akhir pada seluruh variabel gaji? Data akan dikunci secara permanen untuk kebutuhan audit."
        onConfirm={handleFinalize}
        loading={finalizing}
        confirmText="Otorisasi & Kunci"
      />

      <ConfirmDialog
        open={paidDialogOpen}
        onOpenChange={setPaidDialogOpen}
        title="Validasi Pembayaran"
        desc="Periode ini akan ditandai LUNAS. Pastikan sinkronisasi dengan Bank Cash Management telah berhasil dilakukan."
        onConfirm={handleMarkAsPaid}
        loading={markingPaid}
        confirmText="Validasi Pembayaran"
      />
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, title, value, color, suffix, subValue, isHighlight }: any) {
  return (
    <Card className={cn("border-none shadow-2xl shadow-slate-200/40 rounded-[32px] overflow-hidden group hover:translate-y-[-4px] transition-all", isHighlight ? "bg-gradient-to-br from-white to-emerald-50/30 ring-1 ring-emerald-500/10" : "bg-white/95")}>
      <CardContent className="p-7">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all group-hover:scale-110", color)}>
            <Icon className="h-7 w-7" />
          </div>
          {isHighlight && (
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-2.5">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <p className={cn("text-2xl font-black tracking-tighter", isHighlight ? "text-emerald-700" : "text-slate-950")}>{value}</p>
            {suffix && <span className="text-xs font-bold text-slate-400">{suffix}</span>}
          </div>
          {subValue && <p className="text-[10px] font-black text-slate-400/70 mt-1 uppercase tracking-wider">{subValue}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function ConfirmDialog({ open, onOpenChange, title, desc, onConfirm, loading, confirmText }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[40px] border-none shadow-2xl max-w-sm p-8">
        <DialogHeader>
          <div className="h-16 w-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner mx-auto">
            <Lock className="h-8 w-8 text-slate-900" />
          </div>
          <DialogTitle className="text-3xl font-black tracking-tight text-center">{title}</DialogTitle>
          <DialogDescription className="text-slate-500 font-bold text-center leading-relaxed mt-4">{desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-3 mt-8">
          <Button onClick={onConfirm} disabled={loading} className="w-full rounded-2xl h-14 bg-slate-950 font-black text-lg shadow-2xl shadow-slate-900/30 transition-all hover:scale-[1.02] active:scale-95">
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : confirmText}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full rounded-2xl h-12 font-bold text-slate-400 hover:text-slate-600">Batalkan Prosedur</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
