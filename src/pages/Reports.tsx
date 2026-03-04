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
  work_mode: 'wfo' | 'wfh' | 'field' | 'leave' | 'overtime';
  is_late: boolean | null;
  late_minutes: number | null;
  work_hours_minutes: number | null;
  status: 'present' | 'late' | 'absent' | 'leave' | 'sick' | 'overtime';
  leave_type?: string;
  overtime_hours?: number;
  reason?: string;
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
      // Build Queries
      let attQuery = supabase
        .from('attendances')
        .select('*, profiles:user_id!inner(department_id)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      let leaveQuery = supabase
        .from('leave_requests')
        .select('*, profiles:user_id!inner(department_id)')
        .eq('status', 'approved')
        .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

      let overtimeQuery = supabase
        .from('overtime_requests')
        .select('*, profiles:user_id!inner(department_id)')
        .eq('status', 'approved')
        .gte('date', startDate)
        .lte('date', endDate);

      let profQuery = supabase
        .from('profiles')
        .select('id, full_name, employee_id, department:departments(name), role, avatar_url, department_id')
        .order('full_name', { ascending: true });

      // Apply Role Filters
      if (role === 'manager' && profile?.department_id) {
        attQuery = attQuery.eq('profiles.department_id', profile.department_id);
        leaveQuery = leaveQuery.eq('profiles.department_id', profile.department_id);
        overtimeQuery = overtimeQuery.eq('profiles.department_id', profile.department_id);
        profQuery = profQuery.eq('department_id', profile.department_id);
      } else if (role !== 'admin_hr' && role !== 'super_admin') {
        attQuery = attQuery.eq('user_id', profile?.id);
        leaveQuery = leaveQuery.eq('user_id', profile?.id);
        overtimeQuery = overtimeQuery.eq('user_id', profile?.id);
        profQuery = profQuery.eq('id', profile?.id);
      }

      const [attRes, leaveRes, overtimeRes, profRes] = await Promise.all([
        attQuery,
        leaveQuery,
        overtimeQuery,
        profQuery,
      ]);

      if (attRes.error) throw attRes.error;
      if (leaveRes.error) throw leaveRes.error;
      if (overtimeRes.error) throw overtimeRes.error;
      if (profRes.error) throw profRes.error;

      const rawAttData = (attRes.data as any[]) || [];
      const leaveData = (leaveRes.data as any[]) || [];
      const overtimeData = (overtimeRes.data as any[]) || [];
      const rawProfData = (profRes.data as any[]) || [];

      // 1. Map Profiles
      const profData: ProfileRow[] = rawProfData.map(p => ({
        id: p.id,
        full_name: p.full_name,
        employee_id: p.employee_id,
        department: p.department?.name || '',
        role: p.role,
        avatar_url: p.avatar_url
      }));

      // 2. Process Attendances
      const combinedData: AttendanceRow[] = rawAttData.map(a => ({
        ...a,
        status: a.is_late ? 'late' : 'present'
      }));

      // 3. Process Overtime (Attach to existing or create new)
      overtimeData.forEach(ot => {
        const existing = combinedData.find(a => a.user_id === ot.user_id && a.date === ot.date);
        if (existing) {
          existing.overtime_hours = ot.hours;
        } else {
          combinedData.push({
            id: ot.id,
            user_id: ot.user_id,
            date: ot.date,
            clock_in: null,
            clock_out: null,
            work_mode: 'overtime',
            is_late: false,
            late_minutes: 0,
            work_hours_minutes: 0,
            status: 'overtime',
            overtime_hours: ot.hours,
            reason: ot.reason
          });
        }
      });

      // 4. Process Leaves (Expand date range)
      leaveData.forEach(lv => {
        let current = new Date(lv.start_date);
        const end = new Date(lv.end_date);
        const reportStart = new Date(startDate);
        const reportEnd = new Date(endDate);

        while (current <= end) {
          const dateStr = format(current, 'yyyy-MM-dd');

          // Only add if within report period
          if (current >= reportStart && current <= reportEnd) {
            // Check if user actually attended this day (attendance takes precedence)
            const attendanceIdx = combinedData.findIndex(a => a.user_id === lv.user_id && a.date === dateStr);

            if (attendanceIdx === -1) {
              combinedData.push({
                id: lv.id + dateStr,
                user_id: lv.user_id,
                date: dateStr,
                clock_in: null,
                clock_out: null,
                work_mode: 'leave',
                is_late: false,
                late_minutes: 0,
                work_hours_minutes: 0,
                status: lv.leave_type === 'sick' ? 'sick' : 'leave',
                leave_type: lv.leave_type,
                reason: lv.reason
              });
            } else {
              // Mark existing attendance as "Attendance on Leave Day" (optional)
              combinedData[attendanceIdx].leave_type = lv.leave_type;
            }
          }
          current.setDate(current.getDate() + 1);
        }
      });

      // 5. Final Sorting: Name (A-Z) then Date (A-Z)
      const sortedData = combinedData.sort((a, b) => {
        const pA = profData.find(p => p.id === a.user_id);
        const pB = profData.find(p => p.id === b.user_id);
        const nameA = pA?.full_name || '';
        const nameB = pB?.full_name || '';

        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.date.localeCompare(b.date);
      });

      setAttendances(sortedData);
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

    const attendancesOnly = filteredAttendances.filter(a => a.clock_in);
    const totalLate = filteredAttendances.filter(a => a.is_late).length;
    const latePercent = Math.round((totalLate / (attendancesOnly.length || 1)) * 100);
    const totalWorkMinutes = filteredAttendances.reduce((acc, a) => acc + (a.work_hours_minutes || 0), 0);
    const avgWorkMinutes = Math.round(totalWorkMinutes / (attendancesOnly.length || 1));

    // Detailed breakdowns
    const byMode = {
      wfo: filteredAttendances.filter(a => a.work_mode === 'wfo').length,
      wfh: filteredAttendances.filter(a => a.work_mode === 'wfh').length,
      field: filteredAttendances.filter(a => a.work_mode === 'field').length
    };

    const byStatus = {
      present: filteredAttendances.filter(a => a.status === 'present').length,
      late: totalLate,
      sick: filteredAttendances.filter(a => a.status === 'sick').length,
      leave: filteredAttendances.filter(a => a.status === 'leave').length,
      overtime: filteredAttendances.filter(a => a.status === 'overtime').length
    };

    const totalOvertimeHours = filteredAttendances.reduce((acc, a) => acc + (a.overtime_hours || 0), 0);

    return {
      total: filteredAttendances.length,
      totalPresent: attendancesOnly.length,
      late: totalLate,
      latePercent,
      avgHours: (avgWorkMinutes / 60).toFixed(1),
      totalWorkHours: (totalWorkMinutes / 60).toFixed(1),
      totalOvertimeHours,
      byMode,
      byStatus
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
    const headers = ['Tanggal', 'ID Staf', 'Nama', 'Departemen', 'Jabatan', 'Clock In', 'Clock Out', 'Mode', 'Terlambat', 'Menit Terlambat', 'Status', 'Durasi Kerja (Menit)'];
    const isAdmin = role === 'super_admin' || role === 'admin_hr';

    if (!isAdmin) {
      // Standard behavior for manager/Employee
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
          a.is_late ? '⚠️ YA' : 'TIDAK',
          String(a.late_minutes ?? 0),
          a.status === 'present' ? 'HADIR' : a.status === 'late' ? 'TERLAMBAT' : a.status.toUpperCase(),
          String(a.work_hours_minutes ?? 0)
        ];
      });
      return { headers, rows: [headers, ...rows] };
    }

    // ADVANCED BEHAVIOR FOR ADMINS (Grouped by Dept)
    const allRows: any[][] = [];
    const depts = Array.from(new Set(filteredAttendances.map(a => profileMap.get(a.user_id)?.department || 'Tanpa Departemen')));

    depts.forEach(deptName => {
      // Add Dept Header
      allRows.push(['', '', '', '', '', '', '', '', '', '', '', '']); // Spacer
      allRows.push([`>>> DEPARTEMEN: ${deptName.toUpperCase()}`, '', '', '', '', '', '', '', '', '', '', '']);
      allRows.push(headers); // Re-add headers for each dept table section

      const deptAttendances = filteredAttendances.filter(a => (profileMap.get(a.user_id)?.department || 'Tanpa Departemen') === deptName);

      deptAttendances.forEach(a => {
        const p = profileMap.get(a.user_id);
        allRows.push([
          a.date,
          p?.employee_id || '-',
          p?.full_name || '-',
          p?.department || '-',
          p?.role || '-',
          a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '-',
          a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '-',
          a.work_mode.toUpperCase(),
          a.is_late ? '⚠️ YA' : 'TIDAK',
          String(a.late_minutes ?? 0),
          a.status === 'present' ? 'HADIR' :
            a.status === 'late' ? 'TERLAMBAT' :
              a.status === 'sick' ? 'SAKIT' :
                a.status === 'leave' ? `CUTI (${a.leave_type})` :
                  a.status === 'overtime' ? 'LEMBUR' : a.status.toUpperCase(),
          a.overtime_hours ? `OT: ${a.overtime_hours}j` : String(a.work_hours_minutes ?? 0)
        ]);
      });

      // Dept Summary
      const deptLate = deptAttendances.filter(a => a.is_late).length;
      allRows.push(['', '', '', `TOTAL DATA ${deptName}:`, String(deptAttendances.length), '', '', '', 'TOTAL TERLAMBAT:', String(deptLate), '', '']);
      allRows.push(['', '', '', '', '', '', '', '', '', '', '', '']); // Multi-spacer
      allRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    });

    // GRAND TOTAL SECTION
    allRows.push(['']);
    allRows.push(['====================================================================================================']);
    allRows.push(['RINGKASAN AKHIR LAPORAN (KONSOLIDASI SELURUH DEPARTEMEN)']);
    allRows.push(['====================================================================================================']);

    // 1. STATISTIK KEHADIRAN (Attendance Stats)
    allRows.push(['I. STATISTIK KEHADIRAN & ABSENSI']);
    allRows.push(['   • Total Baris Data:', String(stats?.total || 0)]);
    allRows.push(['   • Total Absensi Masuk (Hadir/Lambat):', String(stats?.totalPresent || 0)]);
    allRows.push(['   • Total Terlambat:', String(stats?.late || 0), `(${stats?.latePercent || 0}% dari total absensi)`]);
    allRows.push(['   • Rata-rata Jam Kerja per Hari:', `${stats?.avgHours || 0} Jam`]);
    allRows.push(['']);

    // 2. BREAKDOWN STATUS (Status Breakdown)
    allRows.push(['II. RINCIAN STATUS & KETIDAKHADIRAN']);
    allRows.push(['   • Hadir Tepat Waktu:', String(stats?.byStatus.present || 0)]);
    allRows.push(['   • Hadir Terlambat:', String(stats?.byStatus.late || 0)]);
    allRows.push(['   • Izin Sakit (Approved):', String(stats?.byStatus.sick || 0)]);
    allRows.push(['   • Cuti / Izin Lainnya:', String(stats?.byStatus.leave || 0)]);
    allRows.push(['']);

    // 3. BREAKDOWN MODE KERJA (Work Mode Breakdown)
    allRows.push(['III. RINCIAN TEMPAT KERJA']);
    allRows.push(['   • Bekerja dari Kantor (WFO):', String(stats?.byMode.wfo || 0)]);
    allRows.push(['   • Bekerja dari Rumah (WFH):', String(stats?.byMode.wfh || 0)]);
    allRows.push(['   • Bekerja di Lapangan (FIELD):', String(stats?.byMode.field || 0)]);
    allRows.push(['']);

    // 4. PRODUKTIVITAS (Productivity)
    allRows.push(['IV. PRODUKTIVITAS & LEMBUR']);
    allRows.push(['   • Akumulasi Jam Kerja Seluruhnya:', `${stats?.totalWorkHours || 0} Jam`]);
    allRows.push(['   • Akumulasi Lembur (Overtime):', `${stats?.totalOvertimeHours || 0} Jam`]);
    allRows.push(['']);
    allRows.push(['====================================================================================================']);

    return { headers: headers, rows: allRows };
  };

  const exportCsv = () => {
    const { headers, rows } = getExportData();
    downloadFormalCSV(headers, rows, {
      filename: `Report_Absensi_${startDate}_${endDate}`,
      title: 'Laporan Kehadiran Staf',
      period: `${startDate} s/d ${endDate}`,
      generatedBy: profile?.full_name || 'Administrator'
    });
    toast({ title: 'Berhasil', description: 'Laporan CSV berhasil di-generate.' });
  };

  const exportExcel = async () => {
    const { headers, rows } = getExportData();
    await downloadExcel(headers, rows, {
      filename: `Report_Absensi_${startDate}_${endDate}`,
      title: 'Laporan Kehadiran Staf',
      period: `${startDate} s/d ${endDate}`,
      generatedBy: profile?.full_name || 'Administrator'
    });
    toast({ title: 'Berhasil', description: 'Laporan Excel berhasil di-generate.' });
  };

  // Role Check Logic:
  // - Admin/manager: Can view ALL reports
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
                        {role !== 'manager' && (
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
                        )}
                        <div className={cn("space-y-1", role === 'manager' && "col-span-2")}>
                          <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Role</Label>
                          <select
                            className="w-full h-10 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold text-slate-700 outline-none shadow-inner"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                          >
                            <option value="all">Semua Role</option>
                            <option value="employee">Staf</option>
                            <option value="manager">Head unit</option>
                            <option value="admin_hr">Admin HR</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            placeholder="Cari nama staf..."
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

                          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Metode Kerja</Label>
                          <div className="flex flex-wrap gap-2">
                            {['all', 'wfo', 'wfh', 'field'].map((m) => (
                              <Button
                                key={m}
                                variant={workModeFilter === m ? 'default' : 'outline'}
                                size="sm"
                                className={cn(
                                  "rounded-full text-[10px] font-bold uppercase h-8 px-4",
                                  workModeFilter === m ? "bg-blue-600 shadow-lg shadow-blue-100" : "text-slate-500 hover:bg-slate-50"
                                )}
                                onClick={() => setWorkModeFilter(m as any)}
                              >
                                {m === 'all' ? 'Semua' : m === 'wfo' ? 'Kantor' : m === 'wfh' ? 'Rumah' : 'Lapangan'}
                              </Button>
                            ))}
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
                              {a.status === 'leave' || a.status === 'sick' ? (
                                <Badge className={cn(
                                  "text-[9px] h-5 px-2 text-white border-none font-black uppercase",
                                  a.status === 'sick' ? "bg-amber-500" : "bg-orange-500"
                                )}>
                                  {a.leave_type === 'sick' ? 'SAKIT' : `CUTI: ${a.leave_type}`}
                                </Badge>
                              ) : a.status === 'overtime' ? (
                                <Badge className="text-[9px] h-5 px-2 bg-purple-600 text-white border-none font-black uppercase">Lembur {a.overtime_hours}j</Badge>
                              ) : a.is_late ? (
                                <div className="flex gap-1">
                                  <Badge variant="destructive" className="text-[9px] h-5 px-2 bg-red-50 text-red-600 border-none font-black uppercase">
                                    Terlambat {a.late_minutes}m
                                  </Badge>
                                  {a.overtime_hours && <Badge className="text-[9px] h-5 px-2 bg-purple-100 text-purple-700 border-none font-black uppercase">OT {a.overtime_hours}j</Badge>}
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <Badge className="text-[9px] h-5 px-2 bg-emerald-50 text-emerald-600 border-none font-black uppercase">Tepat Waktu</Badge>
                                  {a.overtime_hours && <Badge className="text-[9px] h-5 px-2 bg-purple-100 text-purple-700 border-none font-black uppercase">OT {a.overtime_hours}j</Badge>}
                                </div>
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
                {role !== 'manager' ? (
                  <>
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
                      <option value="employee">Staf</option>
                      <option value="manager">Head unit</option>
                      <option value="admin_hr">Admin HR</option>
                    </select>
                  </>
                ) : (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Terverifikasi Untuk</p>
                    <p className="text-xs font-bold text-blue-700">Departemen Anda</p>
                  </div>
                )}
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
                    placeholder="Cari nama staf..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl border-slate-200 bg-white transition-all focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow className="bg-slate-100/50">
                      <TableHead className="w-[150px] pl-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Jam Masuk</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Jam Pulang</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Metode</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Durasi Kerja</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status / Keterangan</TableHead>
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
                        <TableCell colSpan={6} className="h-24 text-center">
                          <EmptyState title="Tidak ada data" description="Coba ubah filter jika diperlukan" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAttendances.map((a, index) => {
                        const p = profileMap.get(a.user_id);
                        const prevA = index > 0 ? filteredAttendances[index - 1] : null;
                        const isNewPerson = !prevA || prevA.user_id !== a.user_id;

                        return (
                          <>
                            {isNewPerson && (
                              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                <TableCell colSpan={8} className="py-2.5">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-7 w-7 border-2 border-white shadow-sm">
                                      <AvatarImage src={p?.avatar_url || ''} />
                                      <AvatarFallback className="bg-blue-600 text-white text-[10px] font-bold">
                                        {p?.full_name?.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{p?.full_name}</span>
                                      <span className="text-[10px] font-bold text-slate-400 leading-none">{p?.employee_id || 'No ID'} • {p?.department || '-'}</span>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow key={a.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                              <TableCell className="font-bold text-slate-600 pl-6">
                                {format(new Date(a.date), 'dd MMM yyyy', { locale: id })}
                              </TableCell>
                              <TableCell className="text-center font-bold text-slate-700">
                                {a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '-'}
                              </TableCell>
                              <TableCell className="text-center font-bold text-slate-700">
                                {a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-slate-200 text-slate-500 italic">
                                  {a.work_mode === 'wfo' ? 'Kantor' : a.work_mode === 'wfh' ? 'Rumah' : a.work_mode === 'field' ? 'Lapangan' : a.work_mode}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center font-medium text-slate-600 text-xs">
                                {a.work_hours_minutes ? `${Math.floor(a.work_hours_minutes / 60)}j ${a.work_hours_minutes % 60}m` : '-'}
                              </TableCell>
                              <TableCell>
                                {a.status === 'leave' || a.status === 'sick' ? (
                                  <Badge className={cn(
                                    "border-0 text-white font-bold",
                                    a.status === 'sick' ? "bg-amber-500" : "bg-orange-500"
                                  )}>
                                    {a.leave_type === 'sick' ? 'SAKIT' : `CUTI: ${a.leave_type?.toUpperCase()}`}
                                  </Badge>
                                ) : a.status === 'overtime' ? (
                                  <Badge className="bg-purple-600 text-white border-0 font-bold">LEMBUR {a.overtime_hours}j</Badge>
                                ) : a.is_late ? (
                                  <div className="flex flex-col gap-1">
                                    <Badge className="bg-red-50 text-red-600 hover:bg-red-100 border-0">Terlambat {a.late_minutes}m</Badge>
                                    {a.overtime_hours && <Badge className="bg-purple-100 text-purple-700 border-0">OT: {a.overtime_hours}j</Badge>}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <Badge className="bg-green-50 text-green-600 hover:bg-green-100 border-0">Tepat Waktu</Badge>
                                    {a.overtime_hours && <Badge className="bg-purple-100 text-purple-700 border-0">OT: {a.overtime_hours}j</Badge>}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          </>
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
