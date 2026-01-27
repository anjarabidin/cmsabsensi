import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, BarChart3, Filter, FileText, TrendingUp, Clock, AlertCircle, ChevronLeft, RefreshCw, Search, FileSpreadsheet } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { id } from 'date-fns/locale';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { downloadFormalCSV, downloadExcel } from '@/utils/csvExport';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type AttendanceRow = {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  work_mode: 'wfo' | 'wfh' | 'field';
  is_late: boolean | null;
  late_minutes: number | null;
  work_hours_minutes: number | null;
  status: 'present' | 'late' | 'absent' | 'leave' | 'sick';
};

type ProfileRow = {
  id: string;
  full_name: string;
  employee_id: string | null;
  department: string | null;
  role: string | null;
  avatar_url: string | null; // Added
};

export default function ReportsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  // Filters State
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uniqueDepts, setUniqueDepts] = useState<string[]>([]);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  useEffect(() => {
    if (role) {
      fetchReport();
    }
  }, [role, profile?.department_id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Role-based data isolation
      let attQuery = supabase
        .from('attendances')
        .select('*, profiles:user_id!inner(department_id)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      let profQuery = supabase
        .from('profiles')
        .select('id, full_name, employee_id, department:departments(name), role, avatar_url, department_id')
        .order('full_name', { ascending: true });

      if (role === 'manager' && profile?.department_id) {
        // Manager only sees their department
        attQuery = attQuery.eq('profiles.department_id', profile.department_id);
        profQuery = profQuery.eq('department_id', profile.department_id);
      } else if (role !== 'admin_hr' && role !== 'super_admin') {
        // Regular employee only sees own data
        attQuery = attQuery.eq('user_id', profile?.id);
        profQuery = profQuery.eq('id', profile?.id);
      }

      const [attRes, profRes] = await Promise.all([
        attQuery,
        profQuery,
      ]);

      if (attRes.error) throw attRes.error;
      if (profRes.error) throw profRes.error;

      const attData = (attRes.data as AttendanceRow[]) || [];
      const rawProfData = (profRes.data as any[]) || [];

      const profData: ProfileRow[] = rawProfData.map(p => ({
        id: p.id,
        full_name: p.full_name,
        employee_id: p.employee_id,
        department: p.department?.name || '',
        role: p.role,
        avatar_url: p.avatar_url
      }));

      setAttendances(attData);
      setProfiles(profData);

      // Extract Unique Departments
      const depts = new Set<string>();
      profData.forEach(p => { if (p.department) depts.add(p.department); });
      setUniqueDepts(Array.from(depts));

    } catch (e) {
      toast({ title: 'Error', description: 'Gagal memuat laporan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  // Filter Logic
  const filteredAttendances = useMemo(() => {
    return attendances.filter(a => {
      const userProfile = profileMap.get(a.user_id);
      if (!userProfile) return false;

      // Search Filter
      if (searchQuery && !userProfile.full_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Department Filter
      if (selectedDept !== 'all' && userProfile.department !== selectedDept) {
        return false;
      }

      // Role Filter
      if (selectedRole !== 'all' && userProfile.role !== selectedRole) {
        return false;
      }

      return true;
    });
  }, [attendances, profileMap, searchQuery, selectedDept, selectedRole]);

  const stats = useMemo(() => {
    if (filteredAttendances.length === 0) return null;
    const totalLate = filteredAttendances.filter(a => a.is_late).length;
    const latePercent = Math.round((totalLate / filteredAttendances.length) * 100);
    const avgWorkMinutes = Math.round(filteredAttendances.reduce((acc, a) => acc + (a.work_hours_minutes || 0), 0) / filteredAttendances.length);

    return {
      total: filteredAttendances.length,
      late: totalLate,
      latePercent,
      avgHours: (avgWorkMinutes / 60).toFixed(1)
    };
  }, [filteredAttendances]);

  const quickFilter = (type: 'this_month' | 'last_month' | 'year') => {
    let start = new Date();
    let end = new Date();

    if (type === 'this_month') {
      start = startOfMonth(new Date());
      end = endOfMonth(new Date());
    } else if (type === 'last_month') {
      start = startOfMonth(subMonths(new Date(), 1));
      end = endOfMonth(subMonths(new Date(), 1));
    } else if (type === 'year') {
      start = startOfYear(new Date());
      end = endOfMonth(new Date());
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  // Helper: Prepare Export Data
  const getExportData = () => {
    const headers = ['Tanggal', 'ID Karyawan', 'Nama', 'Departemen', 'Jabatan', 'Clock In', 'Clock Out', 'Mode', 'Terlambat', 'Menit Terlambat', 'Status', 'Durasi Kerja (Menit)'];

    const rows = filteredAttendances.map((a) => {
      const p = profileMap.get(a.user_id);
      return [
        a.date,
        p?.employee_id || '-',
        p?.full_name || '-',
        p?.department || '-',
        p?.role || '-',
        a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '-',
        a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '-',
        a.work_mode.toUpperCase(),
        a.is_late ? 'YA' : 'TIDAK',
        String(a.late_minutes ?? 0),
        a.status.toUpperCase(),
        String(a.work_hours_minutes ?? 0)
      ];
    });

    return { headers, rows };
  };

  const exportCsv = () => {
    const { headers, rows } = getExportData();
    downloadFormalCSV(headers, rows, {
      filename: `Report_Absensi_${startDate}_${endDate}`,
      title: 'Laporan Kehadiran Karyawan',
      period: `${startDate} s/d ${endDate}`,
      generatedBy: profile?.full_name || 'Administrator'
    });
    toast({ title: 'Berhasil', description: 'Laporan CSV berhasil di-generate.' });
  };

  const exportExcel = () => {
    const { headers, rows } = getExportData();
    downloadExcel(headers, rows, {
      filename: `Report_Absensi_${startDate}_${endDate}`,
      title: 'Laporan Kehadiran Karyawan',
      period: `${startDate} s/d ${endDate}`,
      generatedBy: profile?.full_name || 'Administrator'
    });
    toast({ title: 'Berhasil', description: 'Laporan Excel berhasil di-generate.' });
  };

  // Role Check Logic:
  // - Admin/Manager: Can view ALL reports
  // - Employee: Can ONLY view their OWN reports (handled in fetchReport)


  // ----------------------------------------------------------------------
  // MOBILE VIEW - PRESERVED AS IS
  // ----------------------------------------------------------------------
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="relative min-h-screen bg-slate-50/50">
          <div className="absolute top-0 left-0 w-full h-[calc(140px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-700 to-indigo-600 rounded-b-[32px] z-0 shadow-lg" />

          <div className="relative z-10 space-y-4 max-w-[1600px] mx-auto pt-[calc(1rem+env(safe-area-inset-top))] pb-24 px-4">
            {/* COMPACT HEADER */}
            <div className="flex items-center justify-between text-white mb-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/dashboard')}
                  className="text-white hover:bg-white/20 h-9 w-9 -ml-1"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                    Laporan
                  </h1>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-none h-8 px-2.5 text-[10px] font-bold" onClick={exportExcel} disabled={filteredAttendances.length === 0}>
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> XLSX
                </Button>
                <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-none h-8 px-2.5 text-[10px] font-bold" onClick={exportCsv} disabled={filteredAttendances.length === 0}>
                  <Download className="mr-1 h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </div>

            {/* COLLAPSIBLE FILTER - SMART UI */}
            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden ring-1 ring-black/5 transition-all">
              <Accordion type="single" collapsible value={isFilterExpanded ? "item-1" : ""} onValueChange={(v) => setIsFilterExpanded(!!v)}>
                <AccordionItem value="item-1" className="border-none">
                  <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Filter className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-slate-800">Filter Laporan</span>
                        {!isFilterExpanded && (
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                              {format(new Date(startDate), 'dd/MM')} - {format(new Date(endDate), 'dd/MM')}
                            </span>
                            {selectedDept !== 'all' && <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">• {selectedDept}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <AccordionTrigger className="hover:no-underline py-0" />
                  </div>

                  <AccordionContent className="px-5 pb-5 pt-2 border-t border-slate-50">
                    <div className="space-y-4">
                      {/* Quick Filters Row */}
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <Button variant="outline" size="sm" onClick={() => quickFilter('this_month')} className="text-[10px] h-7 rounded-lg border-slate-100 font-bold bg-slate-50 whitespace-nowrap">Bulan Ini</Button>
                        <Button variant="outline" size="sm" onClick={() => quickFilter('last_month')} className="text-[10px] h-7 rounded-lg border-slate-100 font-bold bg-slate-50 whitespace-nowrap">Bulan Lalu</Button>
                        <Button variant="outline" size="sm" onClick={() => quickFilter('year')} className="text-[10px] h-7 rounded-lg border-slate-100 font-bold bg-slate-50 whitespace-nowrap">Tahun Ini</Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Periode Mulai</Label>
                          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 text-xs rounded-xl bg-slate-50 border-none shadow-inner" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Periode Selesai</Label>
                          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 text-xs rounded-xl bg-slate-50 border-none shadow-inner" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Departemen</Label>
                          <select
                            className="w-full h-10 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold text-slate-700 outline-none shadow-inner"
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                          >
                            <option value="all">Semua Dept</option>
                            {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Role</Label>
                          <select
                            className="w-full h-10 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold text-slate-700 outline-none shadow-inner"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                          >
                            <option value="all">Semua Role</option>
                            <option value="staff">Staff</option>
                            <option value="manager">Manager</option>
                            <option value="admin_hr">Admin HR</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            placeholder="Cari nama karyawan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-9 text-xs rounded-xl bg-slate-200/50 border-none shadow-inner"
                          />
                        </div>
                        <Button onClick={fetchReport} className="bg-blue-600 hover:bg-blue-700 h-10 px-6 rounded-xl text-xs font-black shadow-lg shadow-blue-100">
                          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} /> Terapkan
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>

            {/* COMPACT STATS */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Hadir', value: stats?.total || 0, color: 'blue', icon: BarChart3 },
                { label: 'Terlambat', value: stats?.late || 0, color: 'red', icon: Clock },
                { label: 'Jam Rata2', value: stats?.avgHours || 0, color: 'emerald', icon: TrendingUp },
                { label: 'Efisien', value: `${stats ? 100 - (stats.latePercent || 0) : 0}%`, color: 'purple', icon: BarChart3 }
              ].map((item, i) => (
                <div key={i} className="bg-white p-2.5 rounded-2xl shadow-sm ring-1 ring-black/5 flex flex-col items-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">{item.label}</p>
                  <p className={cn(
                    "text-sm font-black tracking-tighter tabular-nums",
                    item.color === 'blue' && "text-blue-600",
                    item.color === 'red' && "text-red-500",
                    item.color === 'emerald' && "text-emerald-600",
                    item.color === 'purple' && "text-purple-600",
                  )}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* LIST BASED REPORT CARDS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Detil Laporan
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{filteredAttendances.length} Record</span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse ring-1 ring-black/5" />)}
                </div>
              ) : filteredAttendances.length === 0 ? (
                <EmptyState icon={BarChart3} title="Data tidak ditemukan" description="Tidak ada data absensi untuk filter yang Anda pilih." />
              ) : (
                <div className="space-y-3">
                  {filteredAttendances.map((a) => {
                    const prof = profileMap.get(a.user_id);
                    return (
                      <Card key={a.id} className="border-none shadow-sm rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-blue-200 transition-all">
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-slate-50 shadow-sm rounded-xl">
                                <AvatarImage src={prof?.avatar_url} />
                                <AvatarFallback className="bg-blue-600 text-white font-black rounded-xl">
                                  {prof?.full_name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-slate-800 line-clamp-1 truncate">{prof?.full_name}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                  <span>{prof?.employee_id || 'N/A'}</span>
                                  <span>•</span>
                                  <span>{prof?.department || 'Umum'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-800 tabular-nums">
                                {format(new Date(a.date), 'dd MMM yyyy', { locale: id })}
                              </p>
                              <Badge className={cn(
                                "text-[9px] mt-1 h-5 rounded-lg border-0 px-2",
                                a.work_mode === 'wfo' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                              )}>
                                {a.work_mode.toUpperCase()}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100/50">
                            <div className="text-center border-r border-slate-200/50">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Masuk</p>
                              <p className="text-xs font-black text-slate-700 tabular-nums">{a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '--:--'}</p>
                            </div>
                            <div className="text-center border-r border-slate-200/50">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Pulang</p>
                              <p className="text-xs font-black text-slate-700 tabular-nums">{a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '--:--'}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Total</p>
                              <p className="text-xs font-black text-slate-700 tabular-nums">
                                {a.work_hours_minutes ? `${Math.floor(a.work_hours_minutes / 60)}h ${a.work_hours_minutes % 60}m` : '-'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                              {a.is_late ? (
                                <Badge variant="destructive" className="text-[9px] h-5 px-2 bg-red-50 text-red-600 border-none font-black uppercase">
                                  Terlambat {a.late_minutes}m
                                </Badge>
                              ) : (
                                <Badge className="text-[9px] h-5 px-2 bg-emerald-50 text-emerald-600 border-none font-black uppercase">Tepat Waktu</Badge>
                              )}
                            </div>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">{a.status}</span>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ----------------------------------------------------------------------
  // DESKTOP VIEW
  // ----------------------------------------------------------------------
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {profile?.role === 'manager' ? 'Evaluasi Tim' : 'Laporan Kehadiran'}
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              {profile?.role === 'manager'
                ? 'Analisa kehadiran anggota tim Anda.'
                : 'Analisa data kehadiran dan ekspor laporan bulanan.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 font-semibold"
              onClick={exportExcel}
              disabled={filteredAttendances.length === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Unduh Excel
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 font-semibold"
              onClick={exportCsv}
              disabled={filteredAttendances.length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> Unduh CSV
            </Button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* LEFT: Sidebar Filters */}
          <Card className="w-80 h-full border-none shadow-xl shadow-slate-200/50 bg-white rounded-[32px] overflow-hidden flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600" /> Filter Data
                </h3>
                <Button variant="ghost" size="sm" onClick={() => {
                  setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setEndDate(format(new Date(), 'yyyy-MM-dd'));
                  setSelectedDept('all');
                  setSelectedRole('all');
                }} className="text-xs text-slate-400 hover:text-red-500 h-6 px-2">Atur Ulang</Button>
              </div>

              {/* Quick Date Filters */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={() => quickFilter('this_month')} className="rounded-lg text-xs border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50">Bulan Ini</Button>
                <Button variant="outline" size="sm" onClick={() => quickFilter('last_month')} className="rounded-lg text-xs border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50">Bulan Lalu</Button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rentang Tanggal</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">Mulai</span>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="pl-12 rounded-xl border-slate-200 bg-slate-50 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">Sampai</span>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="pl-14 rounded-xl border-slate-200 bg-slate-50 transition-all focus:bg-white focus:ring-2 focus:ring-blue-100" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Organisasi</Label>
                <select
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition-all focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="all">Semua Departemen</option>
                  {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition-all focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="all">Semua Jabatan</option>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin_hr">Admin HR</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/30">
              <Button onClick={fetchReport} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl shadow-lg">
                <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Terapkan Filter
              </Button>
            </div>
          </Card>

          {/* RIGHT: Main Content */}
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 shrink-0">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-none rounded-2xl shadow-lg shadow-blue-200 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-20"><BarChart3 className="h-16 w-16" /></div>
                <CardContent className="p-5 relative z-10">
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Total Kehadiran</p>
                  <h2 className="text-3xl font-black">{stats?.total || 0}</h2>
                  <p className="text-blue-100 text-xs mt-1">Data Periode Ini</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-none rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-red-50 rounded-lg"><Clock className="h-5 w-5 text-red-500" /></div>
                    <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{stats?.latePercent || 0}%</span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">{stats?.late || 0}</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Terlambat</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-none rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="h-5 w-5 text-green-500" /></div>
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">{stats?.avgHours || 0}</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Rata-rata Jam Kerja</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-none rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-purple-50 rounded-lg"><FileText className="h-5 w-5 text-purple-500" /></div>
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">{stats ? (100 - (stats.latePercent || 0)) : 0}%</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Efisiensi Waktu</p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card className="flex-1 border-none shadow-xl shadow-slate-200/50 bg-white rounded-[32px] overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <FileText className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Detail Data Absensi</h3>
                    <p className="text-xs text-slate-400 font-medium">Menampilkan {filteredAttendances.length} baris data</p>
                  </div>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari nama karyawan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl border-slate-200 bg-white transition-all focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="font-bold text-slate-500 uppercase text-xs pl-6">Karyawan</TableHead>
                      <TableHead className="font-bold text-slate-500 uppercase text-xs">Tanggal</TableHead>
                      <TableHead className="font-bold text-slate-500 uppercase text-xs">Jam Masuk</TableHead>
                      <TableHead className="font-bold text-slate-500 uppercase text-xs">Jam Pulang</TableHead>
                      <TableHead className="font-bold text-slate-500 uppercase text-xs">Durasi</TableHead>
                      <TableHead className="font-bold text-slate-500 uppercase text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-40 text-center text-slate-400 bg-slate-50/30">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p>Memuat data...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredAttendances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-40 text-center text-slate-400">
                          Tidak ada data yang cocok dengan filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAttendances.map((a) => {
                        const profile = profileMap.get(a.user_id);
                        return (
                          <TableRow key={a.id} className="hover:bg-blue-50/50 transition-colors border-slate-50">
                            <TableCell className="pl-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-slate-200">
                                  <AvatarImage src={profile?.avatar_url} />
                                  <AvatarFallback className="bg-slate-100 text-slate-500 text-xs font-bold">{profile?.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-bold text-sm text-slate-700">{profile?.full_name}</p>
                                  <p className="text-xs text-slate-400">{profile?.department || 'Umum'} • {profile?.role}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-slate-600 text-sm">
                              {format(new Date(a.date), 'EEE, d MMM yyyy', { locale: id })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-slate-50 font-mono text-xs">{a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '--:--'}</Badge>
                                <span className="text-[10px] uppercase font-bold text-slate-400">{a.work_mode}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-slate-50 font-mono text-xs">{a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '--:--'}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 font-medium">
                              {a.work_hours_minutes ? `${Math.floor(a.work_hours_minutes / 60)}j ${a.work_hours_minutes % 60}m` : '-'}
                            </TableCell>
                            <TableCell>
                              {a.is_late ? (
                                <Badge className="bg-red-50 text-red-600 hover:bg-red-100 border-0">Terlambat {a.late_minutes}m</Badge>
                              ) : (
                                <Badge className="bg-green-50 text-green-600 hover:bg-green-100 border-0">Tepat Waktu</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );

}
