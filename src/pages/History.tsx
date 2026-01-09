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
import { Loader2, Calendar as CalendarIcon, Download, Filter, LayoutList, CalendarDays, ChevronLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, getDay } from 'date-fns';
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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

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
        <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[24px] z-0 shadow-lg" />

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
    </DashboardLayout>
  );
}
