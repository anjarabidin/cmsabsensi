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
import { Loader2, Calendar as CalendarIcon, Download, Filter, LayoutList, CalendarDays, ChevronLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Attendance } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { holidays } from '@/lib/holidays';

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

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
      return <Badge variant="destructive">Terlambat</Badge>;
    }

    switch (attendance.status) {
      case 'present':
        return <Badge>Hadir</Badge>;
      case 'late':
        return <Badge variant="destructive">Terlambat</Badge>;
      case 'absent':
        return <Badge variant="secondary">Tidak Hadir</Badge>;
      case 'leave':
        return <Badge variant="outline">Cuti</Badge>;
      case 'sick':
        return <Badge variant="outline">Sakit</Badge>;
      default:
        return <Badge variant="secondary">{attendance.status}</Badge>;
    }
  };

  const getWorkModeBadge = (mode: string) => {
    switch (mode) {
      case 'wfo':
        return <Badge variant="outline">WFO</Badge>;
      case 'wfh':
        return <Badge variant="outline">WFH</Badge>;
      case 'field':
        return <Badge variant="outline">Dinas</Badge>;
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
    doc.text('Laporan Absensi Karyawan', 14, 20);

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

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-slate-50/50">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-[220px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        <div className="relative z-10 space-y-6 px-4 pt-8 pb-24 md:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-white">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">Riwayat Absensi</h1>
                <p className="text-sm text-blue-50 font-medium opacity-90">Lihat riwayat kehadiran dan rekap bulanan Anda</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white hover:bg-slate-50 text-red-600 border-none shadow-md font-semibold"
                onClick={handleExportPDF}
                disabled={loading || attendances.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>

              <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  ←
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-8 min-w-[140px] font-bold text-white hover:bg-white/20">
                      <CalendarIcon className="mr-2 h-4 w-4 text-blue-100" />
                      {format(selectedMonth, 'MMMM yyyy', { locale: id })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => date && setSelectedMonth(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  →
                </Button>
              </div>
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

          {/* Filter & View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="present">Hadir</SelectItem>
                  <SelectItem value="late">Terlambat</SelectItem>
                  <SelectItem value="leave">Cuti</SelectItem>
                  <SelectItem value="sick">Sakit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn(
                  "h-7 px-3 text-xs font-medium rounded-md",
                  viewMode === 'list' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <LayoutList className="h-3.5 w-3.5 mr-2" />
                List
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={cn(
                  "h-7 px-3 text-xs font-medium rounded-md",
                  viewMode === 'calendar' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5 mr-2" />
                Kalender
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
              ) : attendances.length === 0 ? (
                <EmptyState
                  icon={CalendarIcon}
                  title="Tidak ada data absensi"
                  description="Belum ada riwayat absensi untuk periode yang dipilih"
                  action={viewMode === 'calendar' ? undefined : { label: "Absen Sekarang", onClick: () => navigate('/attendance') }}
                />
              ) : (
                <>
                  {viewMode === 'list' ? (
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
                              <div className="col-span-4 flex justify-end">
                                {attendance.is_late ? (
                                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-red-600 bg-red-50 border-red-200">Telat</Badge>
                                ) : attendance.status === 'present' ? (
                                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-green-600 bg-green-50 border-green-200">Hadir</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-slate-50">{attendance.status}</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 flex flex-col items-center">
                      <Calendar
                        mode="single"
                        selected={selectedMonth}
                        onSelect={(date) => date && setSelectedMonth(date)}
                        month={selectedMonth}
                        onMonthChange={setSelectedMonth}
                        className="rounded-md border shadow p-4 w-fit"
                        modifiers={{
                          present: attendances.filter(a => a.status === 'present' && !a.is_late).map(a => new Date(a.date)),
                          late: attendances.filter(a => a.is_late).map(a => new Date(a.date)),
                          leave: attendances.filter(a => a.status === 'leave').map(a => new Date(a.date)),
                          sick: attendances.filter(a => a.status === 'sick').map(a => new Date(a.date)),
                          absent: attendances.filter(a => a.status === 'absent').map(a => new Date(a.date)),
                          holiday: (date) => {
                            // Import this efficiently or copy logic. Since we can't import easily in replace_block without top-level, 
                            // we will assume we added the import at top, OR generic logic here if simple.
                            // But better to use the helper. 
                            // For this block let's rely on the import I will add in a separate step or just inline the data if small? 
                            // No, I created the file. I need to add the import.
                            // I will add the import in a separate multi_replace or use multi_replace for this too.
                            const d = format(date, 'yyyy-MM-dd');
                            // Check holidays list (I'll need to pass it in or import it)
                            return holidays.some(h => h.date === d);
                          },
                          sunday: (date) => date.getDay() === 0,
                        }}
                        modifiersStyles={{
                          present: { backgroundColor: '#dcfce7', color: '#166534', fontWeight: 'bold' },
                          late: { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' },
                          leave: { backgroundColor: '#f3e8ff', color: '#6b21a8', fontWeight: 'bold' },
                          sick: { backgroundColor: '#fef9c3', color: '#854d0e', fontWeight: 'bold' },
                          absent: { backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 'bold' },
                          holiday: { color: '#ef4444', fontWeight: 'bold' }, // Red text for holidays
                          sunday: { color: '#ef4444' } // Red text for Sundays
                        }}
                      // Custom footer to show holiday name if selected or hovered could be cool, but for now just Legend
                      />

                      {/* Calendar Legend */}
                      <div className="flex flex-wrap gap-4 mt-6 justify-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-200 border border-green-600"></div>
                          <span className="text-xs text-slate-600">Hadir</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-200 border border-red-600"></div>
                          <span className="text-xs text-slate-600">Terlambat</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-200 border border-purple-600"></div>
                          <span className="text-xs text-slate-600">Cuti</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-200 border border-yellow-600"></div>
                          <span className="text-xs text-slate-600">Sakit</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span className="text-xs text-slate-600">Libur Nasional</span>
                        </div>
                      </div>

                      {/* Holiday List for Selected Month */}
                      <div className="w-full mt-6 space-y-2">
                        {holidays
                          .filter(h => {
                            const date = new Date(h.date);
                            return date.getMonth() === selectedMonth.getMonth() &&
                              date.getFullYear() === selectedMonth.getFullYear();
                          })
                          .map((h, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-red-50 p-2 rounded-lg border border-red-100">
                              <span className="font-bold text-red-600 shrink-0 border-r border-red-200 pr-2 mr-1">
                                {format(new Date(h.date), 'd MMM', { locale: id })}
                              </span>
                              <span className="text-red-700">{h.name}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout >
  );
}
