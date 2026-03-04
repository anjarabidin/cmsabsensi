import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Calendar as CalendarIcon,
  Download,
  Filter,
  LayoutList,
  CalendarDays,
  ChevronLeft,
  FileSpreadsheet,
  History as HistoryIcon,
  Clock,
  AlertCircle,
  FileCheck,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Attendance } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { holidays } from '@/lib/holidays';
import { useIsMobile } from '@/hooks/useIsMobile';
import { downloadExcel } from '@/utils/csvExport';

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Correction State
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    date: '',
    corrected_clock_in: '',
    corrected_clock_out: '',
    reason: '',
  });
  const [correctionProof, setCorrectionProof] = useState<File | null>(null);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  useEffect(() => {
    fetchAttendances();
  }, [selectedMonth, filterStatus, user?.id]);

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      if (!user) return;
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      let query = supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });

      if (filterStatus !== 'all') {
        if (filterStatus === 'late') {
          query = query.eq('is_late', true);
        } else {
          query = query.eq('status', filterStatus as 'present' | 'late' | 'absent' | 'leave' | 'sick');
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAttendances((data as Attendance[]) || []);
    } catch (error) {
      console.error('Error fetching attendances:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    return format(new Date(isoString), 'HH:mm');
  };

  const formatMinutes = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  };

  const getStatusBadge = (attendance: Attendance) => {
    if (attendance.is_late) {
      return <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100">Terlambat</Badge>;
    }

    switch (attendance.status) {
      case 'present':
        return <Badge className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100">Hadir</Badge>;
      case 'late':
        return <Badge variant="destructive">Terlambat</Badge>;
      case 'absent':
        return <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200">Tidak Hadir</Badge>;
      case 'leave':
        return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100">Cuti</Badge>;
      case 'sick':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100">Sakit</Badge>;
      default:
        return <Badge variant="secondary">{attendance.status}</Badge>;
    }
  };

  const getWorkModeBadge = (mode: string) => {
    switch (mode) {
      case 'wfo':
        return <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">WFO</Badge>;
      case 'wfh':
        return <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">WFH</Badge>;
      case 'field':
        return <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Dinas</Badge>;
      default:
        return <Badge variant="secondary">{mode}</Badge>;
    }
  };

  const stats = {
    total: attendances.length,
    present: attendances.filter(a => a.status === 'present' || a.status === 'late').length,
    late: attendances.filter(a => a.is_late).length,
    leave: attendances.filter(a => a.status === 'leave' || a.status === 'sick').length,
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Laporan Absensi Staf', 14, 20);

    // Meta Info
    doc.setFontSize(10);
    doc.text(`Nama: ${user?.user_metadata?.full_name || user?.email}`, 14, 30);
    doc.text(`Periode: ${format(selectedMonth, 'MMMM yyyy', { locale: id })}`, 14, 35);
    doc.text(`Tanggal Cetak: ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: id })}`, 14, 40);

    // Table Data
    const tableData = attendances.map(a => [
      format(new Date(a.date), 'd MMM yyyy', { locale: id }),
      formatTime(a.clock_in),
      formatTime(a.clock_out),
      formatMinutes(a.work_hours_minutes),
      a.work_mode.toUpperCase(),
      a.is_late ? 'Terlambat' : a.status === 'present' ? 'Hadir' : a.status,
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Tanggal', 'Masuk', 'Keluar', 'Durasi', 'Mode', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }, // Blue-600
      styles: { fontSize: 8 },
    });

    doc.save(`Absensi_${format(selectedMonth, 'MM_yyyy')}.pdf`);
  };

  const handleExportExcel = () => {
    const headers = ['Tanggal', 'Masuk', 'Keluar', 'Durasi', 'Mode', 'Status'];
    const rows = attendances.map(a => [
      format(new Date(a.date), 'yyyy-MM-dd'),
      formatTime(a.clock_in),
      formatTime(a.clock_out),
      formatMinutes(a.work_hours_minutes),
      a.work_mode.toUpperCase(),
      a.is_late ? 'TERLAMBAT' : a.status === 'present' ? 'HADIR' : a.status.toUpperCase(),
    ]);

    downloadExcel(headers, rows, {
      filename: `History_Absensi_${format(selectedMonth, 'MM_yyyy')}`,
      title: 'Riwayat Absensi Saya',
      period: format(selectedMonth, 'MMMM yyyy', { locale: id }),
      generatedBy: user?.user_metadata?.full_name || user?.email
    });
  };

  const handleOpenCorrection = (attendance: Attendance) => {
    setSelectedAttendance(attendance);
    setCorrectionForm({
      date: attendance.date,
      corrected_clock_in: attendance.clock_in ? format(new Date(attendance.clock_in), "HH:mm") : '',
      corrected_clock_out: attendance.clock_out ? format(new Date(attendance.clock_out), "HH:mm") : '',
      reason: '',
    });
    setCorrectionProof(null);
    setIsCorrectionOpen(true);
  };

  const handleCorrectionSubmit = async () => {
    if (!correctionForm.reason.trim()) {
      toast({ title: "Error", description: "Alasan koreksi wajib diisi", variant: "destructive" });
      return;
    }

    setSubmittingCorrection(true);
    try {
      let proofUrl = null;

      if (correctionProof) {
        const fileExt = correctionProof.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('correction-proofs')
          .upload(fileName, correctionProof);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('correction-proofs')
          .getPublicUrl(fileName);

        proofUrl = publicUrl;
      }

      // Convert HH:mm to ISO TIMESTAMPTZ for the selected date
      const dateStr = correctionForm.date;
      const clockInISO = correctionForm.corrected_clock_in
        ? new Date(`${dateStr}T${correctionForm.corrected_clock_in}:00`).toISOString()
        : null;
      const clockOutISO = correctionForm.corrected_clock_out
        ? new Date(`${dateStr}T${correctionForm.corrected_clock_out}:00`).toISOString()
        : null;

      const { error } = await supabase
        .from('attendance_corrections')
        .insert({
          user_id: user?.id,
          attendance_id: selectedAttendance?.id,
          date: dateStr,
          original_clock_in: selectedAttendance?.clock_in,
          original_clock_out: selectedAttendance?.clock_out,
          corrected_clock_in: clockInISO,
          corrected_clock_out: clockOutISO,
          reason: correctionForm.reason,
          proof_url: proofUrl,
          status: 'pending'
        });

      if (error) throw error;

      toast({ title: "Berhasil", description: "Pengajuan koreksi telah dikirim dan menunggu persetujuan HR." });
      setIsCorrectionOpen(false);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Gagal", description: error.message || "Gagal mengirim pengajuan koreksi", variant: "destructive" });
    } finally {
      setSubmittingCorrection(false);
    }
  };


  if (!isMobile) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          {/* Desktop Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Riwayat Absensi</h1>
              <p className="text-slate-500 font-medium">Pantau kehadiran dan performa kerja Anda di sini.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 font-bold"
                onClick={() => setSelectedMonth(new Date())}
              >
                Hari Ini
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200"
                onClick={handleExportPDF}
                disabled={loading || attendances.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Laporan PDF
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200"
                onClick={handleExportExcel}
                disabled={loading || attendances.length === 0}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>

          {/* Premium Filter Bar */}
          <Card className="border-none shadow-xl shadow-slate-200/40 rounded-2xl bg-white p-2 flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg hover:bg-white text-slate-400 hover:text-slate-900 hover:shadow-sm"
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="px-4 font-black text-slate-700 w-40 text-center uppercase tracking-wider text-sm">
                {format(selectedMonth, 'MMMM yyyy', { locale: id })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg hover:bg-white text-slate-400 hover:text-slate-900 hover:shadow-sm"
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              >
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </Button>
            </div>

            <div className="h-8 w-px bg-slate-100 mx-2" />

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px] border-none shadow-none bg-slate-50 rounded-xl font-bold text-slate-600">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="present">Hadir Tepat Waktu</SelectItem>
                <SelectItem value="late">Terlambat</SelectItem>
                <SelectItem value="leave">Izin / Cuti</SelectItem>
                <SelectItem value="sick">Sakit</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex bg-slate-100 p-1 rounded-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={cn("rounded-lg text-xs font-bold uppercase tracking-wider px-4", viewMode === 'calendar' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900")}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Kalender
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn("rounded-lg text-xs font-bold uppercase tracking-wider px-4", viewMode === 'list' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900")}
              >
                <LayoutList className="h-4 w-4 mr-2" />
                List View
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-12 gap-8">
            {/* LEFT SIDE: STATISTICS & INFO */}
            <div className="col-span-3 space-y-6">
              {/* Main Stats Card */}
              <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-700 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-blue-100 uppercase tracking-widest">Total Kehadiran</CardTitle>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black tracking-tighter">{stats.total}</span>
                    <span className="text-sm font-bold text-blue-200">Hari</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
                      <div className="text-[10px] font-bold text-blue-200 uppercase mb-1">Hadir</div>
                      <div className="text-2xl font-black">{stats.present}</div>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
                      <div className="text-[10px] font-bold text-red-200 uppercase mb-1">Telat</div>
                      <div className="text-2xl font-black text-red-100">{stats.late}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Secondary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-none shadow-lg shadow-slate-200/50 rounded-3xl bg-white p-5 flex flex-col items-center justify-center gap-2 group hover:shadow-xl transition-all">
                  <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LayoutList className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-slate-900">{stats.leave}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cuti</div>
                  </div>
                </Card>
                <Card className="border-none shadow-lg shadow-slate-200/50 rounded-3xl bg-white p-5 flex flex-col items-center justify-center gap-2 group hover:shadow-xl transition-all">
                  <div className="h-10 w-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-slate-900">PDF</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export</div>
                  </div>
                </Card>
              </div>
            </div>

            {/* RIGHT SIDE: CONTENT */}
            <div className="col-span-9">
              <Card className="border-none shadow-2xl shadow-slate-200/20 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100 min-h-[500px]">
                <CardContent className="p-6">
                  {loading ? (
                    <TableSkeleton rows={8} columns={6} />
                  ) : viewMode === 'list' ? (
                    attendances.length === 0 ? (
                      <EmptyState
                        icon={CalendarIcon}
                        title="Tidak ada data absensi"
                        description="Belum ada riwayat absensi untuk periode yang dipilih"
                        action={{ label: "Absen Sekarang", onClick: () => navigate('/attendance') }}
                      />
                    ) : (
                      <Table>
                        <TableHeader className="bg-slate-50/80">
                          <TableRow className="border-b-slate-100 hover:bg-transparent">
                            <TableHead className="py-4 pl-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tanggal</TableHead>
                            <TableHead className="py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Jam Kerja</TableHead>
                            <TableHead className="py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Durasi</TableHead>
                            <TableHead className="py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Lokasi</TableHead>
                            <TableHead className="py-4 pr-6 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Status Kehadiran</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendances.map((attendance) => (
                            <TableRow key={attendance.id} className="group hover:bg-blue-50/30 border-b-slate-50 transition-colors">
                              <TableCell className="pl-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">{format(new Date(attendance.date), 'dd MMMM yyyy', { locale: id })}</span>
                                  <span className="text-xs text-slate-400 font-medium">{format(new Date(attendance.date), 'EEEE', { locale: id })}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                  <span className={cn("text-xs font-bold px-2 py-1 rounded-lg border", attendance.is_late ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                                    {formatTime(attendance.clock_in)}
                                  </span>
                                  <span className="text-slate-300">-</span>
                                  <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                                    {formatTime(attendance.clock_out)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="text-sm font-bold text-slate-700">{formatMinutes(attendance.work_hours_minutes)}</span>
                              </TableCell>
                              <TableCell className="py-4">
                                {getWorkModeBadge(attendance.work_mode)}
                              </TableCell>
                              <TableCell className="pr-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {getStatusBadge(attendance)}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-orange-50 hover:text-orange-600"
                                    onClick={() => handleOpenCorrection(attendance)}
                                    title="Ajukan Koreksi"
                                  >
                                    <HistoryIcon className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : (
                    /* Calendar Desktop View */
                    <div className="p-4">
                      <div className="grid grid-cols-7 mb-4">
                        {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((day) => (
                          <div key={day} className="text-center py-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                            {day}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-3">
                        {(() => {
                          const monthStart = startOfMonth(selectedMonth);
                          const monthEnd = endOfMonth(monthStart);
                          const calendarStart = startOfWeek(monthStart);
                          const calendarEnd = endOfWeek(monthEnd);

                          const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                          return days.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const attendance = attendances.find(a => a.date === dateStr);
                            const holiday = holidays.find(h => h.date === dateStr);
                            const isSunday = getDay(day) === 0;
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const isToday = isSameDay(day, new Date());

                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "min-h-[100px] border rounded-2xl p-3 flex flex-col justify-between transition-all group relative overflow-hidden",
                                  !isCurrentMonth ? "bg-slate-50/40 border-transparent opacity-40" : "bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-1",
                                  isToday && "ring-2 ring-blue-500 ring-offset-2 border-blue-200Bg"
                                )}
                              >
                                <div className="flex justify-between items-start">
                                  <span className={cn("text-sm font-bold", isSunday || holiday ? "text-red-500" : "text-slate-700")}>
                                    {format(day, 'd')}
                                  </span>
                                </div>

                                <div className="mt-2 space-y-1">
                                  {holiday && (
                                    <div className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md truncate" title={holiday.name}>
                                      {holiday.name}
                                    </div>
                                  )}
                                  {attendance && (
                                    <>
                                      <div className={cn("text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5",
                                        attendance.is_late ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700")}>
                                        <div className={cn("w-1.5 h-1.5 rounded-full", attendance.is_late ? "bg-red-500" : "bg-green-500")} />
                                        {formatTime(attendance.clock_in)} - {formatTime(attendance.clock_out)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-slate-50/50">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[24px] z-0 shadow-lg" />

        <div className="relative z-10 space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-white">
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Riwayat Absensi</h1>
                <p className="text-xs text-blue-50 font-medium opacity-90">Lihat riwayat kehadiran dan rekap bulanan Anda</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white hover:bg-white/90 text-blue-700 border-none shadow-lg font-bold transition-all active:scale-95"
                onClick={handleExportPDF}
                disabled={loading || attendances.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white hover:bg-white/90 text-green-700 border-none shadow-lg font-bold transition-all active:scale-95"
                onClick={handleExportExcel}
                disabled={loading || attendances.length === 0}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                XLSX
              </Button>

            </div>
          </div>

          {/* Stats Cards */}
          {/* Stats Strip (Non-Card Design) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex justify-between divide-x divide-slate-100">
            <div className="flex-1 px-2 text-center first:pl-0 last:pr-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Total</p>
              <p className="text-xl font-bold text-slate-700">{stats.total}</p>
            </div>
            <div className="flex-1 px-2 text-center first:pl-0 last:pr-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Hadir</p>
              <p className="text-xl font-bold text-blue-600">{stats.present}</p>
            </div>
            <div className="flex-1 px-2 text-center first:pl-0 last:pr-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Telat</p>
              <p className="text-xl font-bold text-red-500">{stats.late}</p>
            </div>
            <div className="flex-1 px-2 text-center first:pl-0 last:pr-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Cuti</p>
              <p className="text-xl font-bold text-purple-600">{stats.leave}</p>
            </div>
          </div>

          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'calendar')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 backdrop-blur-md p-1.5 rounded-2xl h-11 border border-white/20">
              <TabsTrigger
                value="list"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold text-slate-600 rounded-xl transition-all h-full"
              >
                <LayoutList className="h-4 w-4 mr-2" />
                Daftar
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold text-slate-600 rounded-xl transition-all h-full"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Kalender
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filter & Navigation Bar */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm h-12 group transition-all hover:border-blue-200">
            <div className="flex items-center flex-1 min-w-0 px-2">
              <Filter className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="border-none shadow-none focus:ring-0 h-8 bg-transparent font-bold text-slate-700 text-xs p-0 w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="present">Hadir</SelectItem>
                  <SelectItem value="late">Terlambat</SelectItem>
                  <SelectItem value="leave">Cuti</SelectItem>
                  <SelectItem value="sick">Sakit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-6 w-[1px] bg-slate-100" />

            <div className="flex items-center shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-8 px-2 font-black text-slate-800 hover:bg-blue-50 rounded-xl tracking-tight text-[11px] flex items-center gap-1.5 transition-all">
                    <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                    <span className="whitespace-nowrap">{format(selectedMonth, 'MMM yyyy', { locale: id })}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedMonth}
                    onSelect={(date) => date && setSelectedMonth(date)}
                    initialFocus
                  />
                  <div className="p-2 border-t border-slate-100 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 text-[10px] font-black uppercase tracking-wider h-7"
                      onClick={() => setSelectedMonth(new Date())}
                    >
                      Hari Ini
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          </div>

          {/* Table */}
          {/* Content Area */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6">
                  <TableSkeleton rows={8} columns={6} />
                </div>
              ) : (
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
                  {viewMode === 'list' ? (
                    attendances.length === 0 ? (
                      <div className="p-12">
                        <EmptyState
                          icon={CalendarIcon}
                          title="Tidak ada data absensi"
                          description="Belum ada riwayat absensi untuk periode yang dipilih"
                          action={{ label: "Absen Sekarang", onClick: () => navigate('/attendance') }}
                        />
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Clock In</TableHead>
                                <TableHead>Clock Out</TableHead>
                                <TableHead>Jam Kerja</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attendances.map((attendance) => (
                                <TableRow key={attendance.id}>
                                  <TableCell className="font-medium">
                                    {format(new Date(attendance.date), 'd MMM yyyy', { locale: id })}
                                  </TableCell>
                                  <TableCell>{formatTime(attendance.clock_in)}</TableCell>
                                  <TableCell>{formatTime(attendance.clock_out)}</TableCell>
                                  <TableCell>{formatMinutes(attendance.work_hours_minutes)}</TableCell>
                                  <TableCell>{getWorkModeBadge(attendance.work_mode)}</TableCell>
                                  <TableCell>{getStatusBadge(attendance)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile Compact List View */}
                        <div className="md:hidden space-y-0 divide-y divide-slate-100">
                          {/* Simple Header */}
                          <div className="grid grid-cols-12 gap-2 p-3 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-4">Tanggal</div>
                            <div className="col-span-4 text-center">Jam Kerja</div>
                            <div className="col-span-4 text-right">Status</div>
                          </div>

                          {/* Rows */}
                          <div className="divide-y divide-slate-100">
                            {attendances.map((attendance) => (
                              <div key={attendance.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-50 transition-colors">
                                {/* Date */}
                                <div className="col-span-4">
                                  <span className="text-xs font-bold text-slate-800 block">
                                    {format(new Date(attendance.date), 'dd MMM', { locale: id })}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {format(new Date(attendance.date), 'yyyy', { locale: id })}
                                  </span>
                                </div>

                                {/* Time */}
                                <div className="col-span-4 flex flex-col items-center justify-center">
                                  <div className="text-xs font-mono font-medium text-slate-700">
                                    {formatTime(attendance.clock_in)}
                                  </div>
                                  <div className="h-2 w-[1px] bg-slate-200 my-0.5" />
                                  <div className="text-xs font-mono font-medium text-slate-700">
                                    {formatTime(attendance.clock_out)}
                                  </div>
                                </div>

                                {/* Status */}
                                <div className="col-span-4 flex justify-end items-center gap-2">
                                  {attendance.is_late ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-red-600 bg-red-50 border-red-200">Telat</Badge>
                                  ) : attendance.status === 'present' ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-green-600 bg-green-50 border-green-200">Hadir</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-slate-50">{attendance.status}</Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg hover:bg-orange-50 text-orange-600"
                                    onClick={() => handleOpenCorrection(attendance)}
                                  >
                                    <HistoryIcon className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )
                  ) : (
                    <div className="p-4">
                      {/* Custom Grid Calendar */}
                      <div className="grid grid-cols-7 gap-1">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
                          <div key={day} className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase">
                            {day}
                          </div>
                        ))}

                        {(() => {
                          const monthStart = startOfMonth(selectedMonth);
                          const monthEnd = endOfMonth(monthStart);
                          const calendarStart = startOfWeek(monthStart);
                          const calendarEnd = endOfWeek(monthEnd);

                          const days = eachDayOfInterval({
                            start: calendarStart,
                            end: calendarEnd
                          });

                          return days.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const attendance = attendances.find(a => a.date === dateStr);
                            const holiday = holidays.find(h => h.date === dateStr);
                            const isSunday = getDay(day) === 0;
                            const isCurrentMonth = isSameMonth(day, monthStart);

                            let bgColor = 'bg-transparent';
                            let textColor = 'text-slate-900';
                            let borderColor = 'border-transparent';

                            if (attendance) {
                              if (attendance.is_late) {
                                bgColor = 'bg-red-50';
                                textColor = 'text-red-700';
                                borderColor = 'border-red-200';
                              } else if (attendance.status === 'present') {
                                bgColor = 'bg-green-50';
                                textColor = 'text-green-700';
                                borderColor = 'border-green-200';
                              } else if (attendance.status === 'leave') {
                                bgColor = 'bg-purple-50';
                                textColor = 'text-purple-700';
                                borderColor = 'border-purple-200';
                              } else if (attendance.status === 'sick') {
                                bgColor = 'bg-yellow-50';
                                textColor = 'text-yellow-700';
                                borderColor = 'border-yellow-200';
                              }
                            } else if (holiday || isSunday) {
                              textColor = 'text-red-500';
                              if (holiday) bgColor = 'bg-red-50/30';
                            }

                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "aspect-square flex flex-col items-center justify-center rounded-xl border text-sm transition-all",
                                  !isCurrentMonth ? "opacity-20 translate-y-1 scale-95 pointer-events-none" : "hover:scale-105 cursor-default",
                                  bgColor,
                                  borderColor,
                                  isSameDay(day, new Date()) && "ring-2 ring-blue-500 ring-offset-2"
                                )}
                              >
                                <span className={cn("font-bold text-xs", textColor)}>
                                  {format(day, 'd')}
                                </span>
                                {holiday && isCurrentMonth && (
                                  <div className="w-1 h-1 bg-red-500 rounded-full mt-0.5" />
                                )}
                                {attendance && isCurrentMonth && (
                                  <div className={cn(
                                    "w-1 h-1 rounded-full mt-0.5",
                                    attendance.is_late ? "bg-red-500" : "bg-green-500"
                                  )} />
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Calendar Legend */}
                      <div className="grid grid-cols-3 gap-2 mt-8 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                          <span className="text-[10px] font-bold text-slate-600">Hadir</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
                          <span className="text-[10px] font-bold text-slate-600">Telat</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                          <span className="text-[10px] font-bold text-slate-600">Cuti</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                          <span className="text-[10px] font-bold text-slate-600">Sakit</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                          <span className="text-[10px] font-bold text-slate-600">Libur</span>
                        </div>
                      </div>

                      {/* Holiday List */}
                      <div className="mt-6 space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Daftar Hari Libur</h4>
                        {holidays
                          .filter(h => {
                            const date = new Date(h.date);
                            return date.getMonth() === selectedMonth.getMonth() &&
                              date.getFullYear() === selectedMonth.getFullYear();
                          })
                          .map((h, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                              <div className="w-10 h-10 rounded-xl bg-red-50 flex flex-col items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-red-400 leading-none">
                                  {format(new Date(h.date), 'MMM', { locale: id })}
                                </span>
                                <span className="text-sm font-black text-red-600 leading-none mt-0.5">
                                  {format(new Date(h.date), 'd')}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{h.name}</p>
                                <p className="text-[10px] text-slate-400 font-medium">Libur Nasional</p>
                              </div>
                            </div>
                          ))}
                        {holidays.filter(h => {
                          const date = new Date(h.date);
                          return date.getMonth() === selectedMonth.getMonth() &&
                            date.getFullYear() === selectedMonth.getFullYear();
                        }).length === 0 && (
                            <p className="text-[10px] text-slate-400 text-center py-4 italic">Tidak ada hari libur nasional bulan ini</p>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ATTENDANCE CORRECTION DIALOG */}
      <Dialog open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[32px] bg-white shadow-2xl">
          <DialogHeader className="p-8 bg-gradient-to-br from-orange-500 to-amber-600 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <DialogTitle className="text-2xl font-black tracking-tight mb-2 flex items-center gap-2">
                <HistoryIcon className="h-6 w-6" /> Ajukan Koreksi
              </DialogTitle>
              <DialogDescription className="text-orange-100 font-medium">
                Berikan data absensi yang benar untuk tanggal {selectedAttendance && format(new Date(selectedAttendance.date), 'dd MMMM yyyy', { locale: id })}.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Jam Masuk Baru</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="time"
                    value={correctionForm.corrected_clock_in}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, corrected_clock_in: e.target.value })}
                    className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold focus:ring-orange-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Jam Pulang Baru</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="time"
                    value={correctionForm.corrected_clock_out}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, corrected_clock_out: e.target.value })}
                    className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Alasan Koreksi</Label>
              <Textarea
                placeholder="Contoh: Lupa absen karena rapat mendadak, atau kendala perangkat..."
                value={correctionForm.reason}
                onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                className="min-h-[100px] rounded-2xl border-slate-200 bg-slate-50 p-4 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Lampiran Bukti (Opsional)</Label>
              <div className="relative group">
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setCorrectionProof(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="correction-upload"
                />
                <label
                  htmlFor="correction-upload"
                  className="flex items-center justify-center gap-3 h-14 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 transition-all cursor-pointer"
                >
                  <Upload className="h-5 w-5 text-slate-400 group-hover:text-orange-500" />
                  <span className="text-sm font-bold text-slate-500 group-hover:text-orange-600">
                    {correctionProof ? correctionProof.name : "Upload Foto/Bukti"}
                  </span>
                </label>
              </div>
              <p className="text-[10px] text-slate-400 font-medium px-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Mendukung format JPG, PNG, atau PDF.
              </p>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100 flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setIsCorrectionOpen(false)}
              className="w-full sm:w-auto h-12 rounded-2xl border-slate-200 text-slate-600 font-bold hover:bg-white"
            >
              Batal
            </Button>
            <Button
              onClick={handleCorrectionSubmit}
              disabled={submittingCorrection}
              className="w-full sm:w-auto flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black shadow-lg shadow-orange-200 transition-all active:scale-95"
            >
              {submittingCorrection ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</>
              ) : (
                <><FileCheck className="mr-2 h-4 w-4" /> Kirim Pengajuan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
