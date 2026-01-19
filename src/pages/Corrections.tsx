import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, FileText, UploadCloud, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance, AttendanceCorrection } from '@/types';
import { cn } from '@/lib/utils';

export default function CorrectionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    corrected_clock_in: '',
    corrected_clock_out: '',
    reason: '',
  });

  const canSubmit = useMemo(() => {
    if (!form.date) return false;
    if (!form.reason.trim()) return false;
    if (!form.corrected_clock_in && !form.corrected_clock_out) return false;
    return true;
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');

      const [corrRes, attRes] = await Promise.all([
        supabase
          .from('attendance_corrections')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('attendances')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle(),
      ]);

      setCorrections((corrRes.data as AttendanceCorrection[]) || []);
      setTodayAttendance(attRes.data as Attendance | null);
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal Memuat Data', description: 'Silakan coba refresh halaman.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Disetujui</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Ditolak</Badge>;
    return <Badge variant="outline" className="text-slate-500 border-slate-300"><Clock className="w-3 h-3 mr-1" /> Menunggu</Badge>;
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;

    setSubmitting(true);
    try {
      let proofUrl = null;

      // Upload Proof if exists
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('correction-proofs')
          .upload(fileName, proofFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('correction-proofs')
          .getPublicUrl(fileName);

        proofUrl = publicUrl;
      }

      // Check existing attendance on target date
      const { data: attendanceData } = await supabase
        .from('attendances')
        .select('id, clock_in, clock_out')
        .eq('user_id', user.id)
        .eq('date', form.date)
        .maybeSingle();

      const attendance = attendanceData as Attendance | null;

      const { error } = await supabase.from('attendance_corrections').insert({
        user_id: user.id,
        date: form.date,
        attendance_id: attendance?.id ?? null,
        original_clock_in: attendance?.clock_in ?? null,
        original_clock_out: attendance?.clock_out ?? null,
        corrected_clock_in: form.corrected_clock_in ? new Date(`${form.date}T${form.corrected_clock_in}:00`).toISOString() : null,
        corrected_clock_out: form.corrected_clock_out ? new Date(`${form.date}T${form.corrected_clock_out}:00`).toISOString() : null,
        reason: form.reason.trim(),
        proof_url: proofUrl,
        status: 'pending',
      });

      if (error) throw error;

      // Notify HR
      try {
        const { data: hrUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin_hr');

        if (hrUsers && hrUsers.length > 0) {
          const notifications = hrUsers.map(hr => ({
            user_id: hr.id,
            title: 'Pengajuan Koreksi Absensi',
            message: `Karyawan ${user.email} mengajukan koreksi untuk tgl ${format(new Date(form.date), 'd MMM yyyy', { locale: id })}`,
            type: 'correction',
            link: '/approvals',
            is_read: false
          }));

          await supabase.from('notifications').insert(notifications);
        }
      } catch (notifError) {
        console.error('Failed to send notification to HR:', notifError);
      }

      toast({ title: 'Pengajuan Berhasil', description: 'Permintaan koreksi absensi telah dikirim ke atasan.' });
      setDialogOpen(false);
      setForm({
        date: format(new Date(), 'yyyy-MM-dd'),
        corrected_clock_in: '',
        corrected_clock_out: '',
        reason: '',
      });
      setProofFile(null);
      fetchData();
    } catch (e: any) {
      console.error('Submission Error:', e);
      toast({
        title: 'Gagal Mengirim',
        description: e.message || e.details || 'Terjadi kesalahan sistem saat menyimpan data.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto pt-[calc(1rem+env(safe-area-inset-top))] md:pt-6 pb-20 px-4 md:px-0 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Koreksi Absensi</h1>
            <p className="text-slate-500">Ajukan revisi jam kerja jika terjadi kesalahan teknis.</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                Buat Pengajuan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Formulir Koreksi</DialogTitle>
                <DialogDescription>
                  Isi data dengan jujur. Sertakan bukti pendukung jika ada.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Tanggal Absensi</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="date"
                      className="pl-9"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Koreksi Masuk (In)</Label>
                    <Input type="time" value={form.corrected_clock_in} onChange={(e) => setForm({ ...form, corrected_clock_in: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Koreksi Pulang (Out)</Label>
                    <Input type="time" value={form.corrected_clock_out} onChange={(e) => setForm({ ...form, corrected_clock_out: e.target.value })} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Alasan Koreksi</Label>
                  <Textarea
                    placeholder="Contoh: Lupa clock out karena buru-buru meeting..."
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Bukti Pendukung (Opsional)</Label>
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                    <div className="flex flex-col items-center gap-1">
                      <UploadCloud className={cn("h-8 w-8", proofFile ? "text-blue-500" : "text-slate-300")} />
                      <span className="text-sm text-slate-500 font-medium">
                        {proofFile ? proofFile.name : "Klik untuk upload foto/dokumen"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button onClick={handleSubmit} disabled={submitting || !canSubmit} className="bg-blue-600 hover:bg-blue-700">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Kirim Pengajuan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <h3 className="font-semibold text-slate-800">Riwayat Pengajuan</h3>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                <p className="text-slate-500 text-sm">Memuat data...</p>
              </div>
            ) : corrections.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="h-8 w-8 text-slate-300" />
                </div>
                <div>
                  <h4 className="text-slate-900 font-medium">Belum Ada Pengajuan</h4>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">
                    Anda belum pernah mengajukan koreksi absensi. Gunakan tombol di atas untuk membuat pengajuan baru.
                  </p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-slate-50/50">
                    <TableHead className="w-[150px]">Tanggal</TableHead>
                    <TableHead>Detail Koreksi</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead className="text-center">Lampiran</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-900">
                        {format(new Date(c.date), 'd MMM yyyy', { locale: id })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="flex items-center gap-2 text-slate-600">
                            <span className="w-8 text-xs font-semibold uppercase text-slate-400">In</span>
                            {c.original_clock_in ? format(new Date(c.original_clock_in), 'HH:mm') : '--:--'}
                            <span className="text-slate-300">→</span>
                            <span className={cn("font-medium", c.corrected_clock_in ? "text-blue-600" : "text-slate-400")}>
                              {c.corrected_clock_in ? format(new Date(c.corrected_clock_in), 'HH:mm') : '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <span className="w-8 text-xs font-semibold uppercase text-slate-400">Out</span>
                            {c.original_clock_out ? format(new Date(c.original_clock_out), 'HH:mm') : '--:--'}
                            <span className="text-slate-300">→</span>
                            <span className={cn("font-medium", c.corrected_clock_out ? "text-blue-600" : "text-slate-400")}>
                              {c.corrected_clock_out ? format(new Date(c.corrected_clock_out), 'HH:mm') : '-'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <span className="text-slate-700 italic">"{c.reason}"</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.proof_url ? (
                          <a href={c.proof_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center justify-center gap-1">
                            <FileText className="h-3 w-3" /> Lihat
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {statusBadge(c.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout >
  );
}
