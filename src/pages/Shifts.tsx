import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Clock, CalendarDays, Moon, Sun, Trash2, Edit, ChevronLeft, Search, Users, Calendar, Star } from 'lucide-react';
import { Shift, EmployeeSchedule, Profile } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { format as formatTz } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function ShiftsPage() {
    const { toast } = useToast();
    const { profile } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState('master');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);

    // Master Shift State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<Shift>>({
        name: '',
        code: '',
        start_time: '',
        end_time: '',
        break_start: '',
        break_end: '',
        tolerance_minutes: 15,
        clock_in_advance_minutes: 30,
        is_night_shift: false
    });
    const [saving, setSaving] = useState(false);

    // Rostering State
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');

    useEffect(() => {
        fetchShifts();
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (activeTab === 'rostering') {
            fetchSchedules(selectedDate);
        }
    }, [activeTab, selectedDate]);

    const fetchShifts = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase.from('shifts') as any).select('*').order('created_at', { ascending: true });
            if (error) throw error;
            setShifts(data as Shift[] || []);
        } catch (error) {
            toast({ title: 'Gagal memuat shift', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            let query = supabase.from('profiles').select('*, job_position:job_positions(*), department:departments(*)').eq('is_active', true);

            if (profile?.role === 'manager' && profile?.department_id) {
                query = query.eq('department_id', profile.department_id);
            }

            const { data } = await query.order('full_name');
            setEmployees(data as any[] as Profile[] || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSchedules = async (date: Date) => {
        const TIMEZONE = 'Asia/Jakarta';
        // Ensure start/end of month are calculated in WIB
        const start = formatTz(startOfMonth(date), 'yyyy-MM-dd', { timeZone: TIMEZONE });
        const end = formatTz(endOfMonth(date), 'yyyy-MM-dd', { timeZone: TIMEZONE });

        try {
            let query = (supabase.from('employee_schedules') as any)
                .select('*, shift:shifts(*), profiles:user_id!inner(department_id)')
                .gte('date', start)
                .lte('date', end);

            if (profile?.role === 'manager' && profile?.department_id) {
                query = query.eq('profiles.department_id', profile.department_id);
            }

            const { data, error } = await query;

            if (error) throw error;
            setSchedules(data as EmployeeSchedule[] || []);
        } catch (error) {
            console.error(error);
        }
    };

    // State for Schedule Dialog
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

    // State for individual assignment
    const [clickedEmployeeId, setClickedEmployeeId] = useState<string | null>(null);
    const [clickedDate, setClickedDate] = useState<string | null>(null);
    const [existingSchedulesForDay, setExistingSchedulesForDay] = useState<EmployeeSchedule[]>([]);

    const handleCellClick = (employeeId: string, date: string, daySchedules: EmployeeSchedule[]) => {
        setClickedEmployeeId(employeeId);
        setClickedDate(date);
        setExistingSchedulesForDay(daySchedules);
        setAssignDialogOpen(true);
    };

    const handleAddSchedule = async (shiftId: string) => {
        if (!clickedEmployeeId || !clickedDate) return;
        setSaving(true);
        try {
            await (supabase.from('employee_schedules') as any).insert({
                user_id: clickedEmployeeId,
                date: clickedDate,
                shift_id: shiftId
            });
            toast({ title: 'Shift ditambahkan' });
            fetchSchedules(selectedDate);
            setAssignDialogOpen(false);
        } catch (error) {
            toast({ title: 'Gagal menambah shift', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleSetDayOff = async () => {
        if (!clickedEmployeeId || !clickedDate) return;
        setSaving(true);
        try {
            const { error: delError } = await (supabase.from('employee_schedules') as any)
                .delete()
                .eq('user_id', clickedEmployeeId)
                .eq('date', clickedDate);

            if (delError) throw delError;

            await (supabase.from('employee_schedules') as any).insert({
                user_id: clickedEmployeeId,
                date: clickedDate,
                shift_id: null,
                is_day_off: true
            });

            toast({ title: 'Set Libur Berhasil' });
            fetchSchedules(selectedDate);
            setAssignDialogOpen(false);
        } catch (error) {
            toast({ title: 'Gagal set libur', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    const handleRemoveSchedule = async (scheduleId: string) => {
        if (!confirm("Hapus jadwal ini?")) return;
        setSaving(true);
        try {
            await (supabase.from('employee_schedules') as any).delete().eq('id', scheduleId);
            toast({ title: 'Jadwal dihapus' });
            setExistingSchedulesForDay(prev => prev.filter(s => s.id !== scheduleId));
            fetchSchedules(selectedDate);
        } catch (error) {
            toast({ title: 'Gagal', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    const handleBulkGenerate = async () => {
        if (!selectedShiftId) return;
        setSaving(true);

        try {
            const dates = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
            const bulkData: any[] = [];

            // TIMEZONE FIX: Asia/Jakarta
            const TIMEZONE = 'Asia/Jakarta';

            employees.forEach(emp => {
                dates.forEach(date => {
                    const dayName = format(date, 'EEE');
                    const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                    // Force date string in WIB
                    const dateStr = formatTz(date, 'yyyy-MM-dd', { timeZone: TIMEZONE });

                    bulkData.push({
                        user_id: emp.id,
                        date: dateStr,
                        shift_id: isWeekend ? null : selectedShiftId,
                        is_day_off: isWeekend
                    });
                });
            });

            const { error } = await (supabase.from('employee_schedules') as any).upsert(bulkData, { onConflict: 'user_id,date' });

            if (error) throw error;

            toast({ title: 'Jadwal 1 Bulan Berhasil Dibuat', description: `Untuk ${employees.length} staf.` });
            setBulkAssignOpen(false);
            fetchSchedules(selectedDate);

        } catch (error: any) {
            console.error(error);
            toast({ title: 'Gagal generate', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleOpenCreate = () => {
        setIsEditing(false);
        setCurrentShiftId(null);
        setForm({
            name: '',
            code: '',
            start_time: '',
            end_time: '',
            break_start: '',
            break_end: '',
            tolerance_minutes: 15,
            clock_in_advance_minutes: 30,
            is_night_shift: false
        });
        setDialogOpen(true);
    };

    const handleOpenEdit = (shift: Shift) => {
        setIsEditing(true);
        setCurrentShiftId(shift.id);
        setForm({
            name: shift.name,
            code: shift.code,
            start_time: shift.start_time,
            end_time: shift.end_time,
            break_start: shift.break_start,
            break_end: shift.break_end,
            tolerance_minutes: shift.tolerance_minutes,
            clock_in_advance_minutes: shift.clock_in_advance_minutes,
            is_night_shift: shift.is_night_shift
        });
        setDialogOpen(true);
    };

    const handleSaveShift = async () => {
        if (!form.name || !form.start_time || !form.end_time) {
            toast({ title: 'Mohon lengkapi data', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                code: form.code || null,
                break_start: form.break_start || null,
                break_end: form.break_end || null,
            };

            if (isEditing && currentShiftId) {
                // UPDATE
                const { error } = await (supabase.from('shifts') as any)
                    .update(payload)
                    .eq('id', currentShiftId);

                if (error) throw error;
                toast({ title: 'Shift Berhasil Diperbarui' });
            } else {
                // CREATE
                const { error } = await (supabase.from('shifts') as any).insert(payload);
                if (error) throw error;
                toast({ title: 'Shift Berhasil Ditambahkan' });
            }

            setDialogOpen(false);
            setForm({
                name: '',
                code: '',
                start_time: '',
                end_time: '',
                break_start: '',
                break_end: '',
                tolerance_minutes: 15,
                clock_in_advance_minutes: 30,
                is_night_shift: false
            });
            fetchShifts();
        } catch (error) {
            toast({ title: 'Gagal menyimpan shift', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteShift = async (id: string) => {
        if (!confirm('Hapus shift ini?')) return;
        try {
            await (supabase.from('shifts') as any).delete().eq('id', id);
            fetchShifts();
        } catch (error) {
            toast({ title: 'Gagal menghapus', variant: 'destructive' });
        }
    };

    const handleSetDefault = async (shiftId: string, isCurrentlyDefault: boolean) => {
        try {
            if (isCurrentlyDefault) {
                // Unset default
                await (supabase.from('shifts') as any)
                    .update({ is_default: false })
                    .eq('id', shiftId);
                toast({ title: 'Shift default dihapus', description: 'Sistem akan menggunakan jadwal eksplisit saja.' });
            } else {
                // Unset semua dulu, lalu set yang baru
                await (supabase.from('shifts') as any)
                    .update({ is_default: false })
                    .eq('is_default', true);
                await (supabase.from('shifts') as any)
                    .update({ is_default: true })
                    .eq('id', shiftId);
                toast({
                    title: '✅ Shift Default Berhasil Diset',
                    description: 'Pengingat otomatis akan menggunakan shift ini untuk semua staf yang belum dijadwalkan.',
                });
            }
            fetchShifts();
        } catch (error) {
            toast({ title: 'Gagal mengubah shift default', variant: 'destructive' });
        }
    };

    // Filter employees
    const filteredEmployees = employees.filter(e => {
        const matchesSearch = e.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const deptName = (e.department as any)?.name || '';
        const matchesDept = departmentFilter === 'all' || deptName === departmentFilter;
        return matchesSearch && matchesDept;
    });

    const uniqueDepartments = Array.from(new Set(employees.map(e => (e.department as any)?.name).filter(Boolean)));

    // ----------------------------------------------------------------------
    // MOBILE VIEW (PRESERVED)
    // ----------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    {/* Background Gradient */}
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8">
                        {/* Header with Back Button */}
                        <div className="flex items-start gap-3 text-white">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight drop-shadow-md flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-blue-200" />
                                    Manajemen Jadwal & Shift
                                </h1>
                                <p className="text-blue-50 font-medium opacity-90 mt-1 text-xs">Atur master shift dan penugasan jadwal staf.</p>
                            </div>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full md:w-[400px] grid-cols-2 bg-slate-100 p-1">
                                <TabsTrigger value="master" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Master Shift</TabsTrigger>
                                <TabsTrigger value="rostering" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Rostering</TabsTrigger>
                            </TabsList>

                            <TabsContent value="master" className="space-y-4 pt-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle>Daftar Shift Kerja</CardTitle>
                                            <CardDescription>Definisikan jam kerja (Pagi/Siang/Malam).</CardDescription>
                                        </div>
                                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button size="sm" onClick={handleOpenCreate}><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
                                            </DialogTrigger>
                                            <ShiftFormDialog
                                                form={form} setForm={setForm} handleSaveShift={handleSaveShift} saving={saving}
                                                isEditing={isEditing}
                                            />
                                        </Dialog>
                                    </CardHeader>
                                    <CardContent className="p-0 md:p-6">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nama</TableHead>
                                                        <TableHead>Kode</TableHead>
                                                        <TableHead>Jam Kerja</TableHead>
                                                        <TableHead>Istirahat (Split)</TableHead>
                                                        <TableHead>Toleransi</TableHead>
                                                        <TableHead>Batas Awal</TableHead>
                                                        <TableHead>Tipe</TableHead>
                                                        <TableHead className="text-center">Jadikan Default</TableHead>
                                                        <TableHead className="text-right">Aksi</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {shifts.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada data shift.</TableCell>
                                                        </TableRow>
                                                    ) : shifts.map(shift => (
                                                        <TableRow key={shift.id}>
                                                            <TableCell className="font-medium">{shift.name}</TableCell>
                                                            <TableCell><span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded border">{shift.code || '-'}</span></TableCell>
                                                            <TableCell className="text-xs">{shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}</TableCell>
                                                            <TableCell className="text-xs text-slate-500">{shift.break_start ? `${shift.break_start.slice(0, 5)} - ${shift.break_end?.slice(0, 5)}` : '-'}</TableCell>
                                                            <TableCell className="text-xs">{shift.tolerance_minutes}m</TableCell>
                                                            <TableCell className="text-xs">-{shift.clock_in_advance_minutes}m</TableCell>
                                                            <TableCell>
                                                                {shift.is_night_shift ?
                                                                    <div className="flex items-center text-purple-600 gap-1 text-[10px] font-bold"><Moon className="h-3 w-3" /> Malam</div> :
                                                                    <div className="flex items-center text-orange-600 gap-1 text-[10px] font-bold"><Sun className="h-3 w-3" /> Siang</div>
                                                                }
                                                                {(shift as any).is_default && (
                                                                    <div className="mt-1 text-[9px] text-emerald-600 font-bold max-w-min flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-emerald-600" /> DEFAULT</div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Switch
                                                                    checked={!!(shift as any).is_default}
                                                                    onCheckedChange={() => handleSetDefault(shift.id, !!(shift as any).is_default)}
                                                                    className="data-[state=checked]:bg-emerald-500 scale-75"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(shift)} className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600">
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteShift(shift.id)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="rostering" className="space-y-4 pt-4">
                                <RosterControls
                                    selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                                    setBulkAssignOpen={setBulkAssignOpen}
                                    format={format} id={id}
                                />

                                <Card className="overflow-hidden border-slate-200">
                                    <CardContent className="p-0 overflow-x-auto">
                                        <RosterTable
                                            employees={employees} schedules={schedules} selectedDate={selectedDate}
                                            handleCellClick={handleCellClick}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <AssignDialog
                                assignDialogOpen={assignDialogOpen} setAssignDialogOpen={setAssignDialogOpen}
                                clickedDate={clickedDate} clickedEmployeeId={clickedEmployeeId} employees={employees}
                                existingSchedulesForDay={existingSchedulesForDay} shifts={shifts}
                                handleAddSchedule={handleAddSchedule} handleSetDayOff={handleSetDayOff} handleRemoveSchedule={handleRemoveSchedule}
                                saving={saving}
                            />

                            <BulkDialog
                                bulkAssignOpen={bulkAssignOpen} setBulkAssignOpen={setBulkAssignOpen}
                                employees={employees} shifts={shifts} selectedShiftId={selectedShiftId} setSelectedShiftId={setSelectedShiftId}
                                handleBulkGenerate={handleBulkGenerate} saving={saving}
                            />
                        </Tabs>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // ----------------------------------------------------------------------
    // DESKTOP VIEW (PREMIUM)
    // ----------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-full mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manajemen Jadwal</h1>
                        <p className="text-slate-500 font-medium text-sm">Atur shift kerja dan penugasan jadwal staf.</p>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                        <div className="px-6 pt-6 pb-2 border-b border-slate-100 flex items-center justify-between bg-white">
                            <TabsList className="bg-slate-100 p-1 rounded-xl h-11">
                                <TabsTrigger value="master" className="rounded-lg px-6 h-9 font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all">
                                    Master Shift
                                </TabsTrigger>
                                <TabsTrigger value="rostering" className="rounded-lg px-6 h-9 font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all">
                                    Kalender Rostering
                                </TabsTrigger>
                            </TabsList>

                            {activeTab === 'master' && (
                                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button onClick={handleOpenCreate} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                                            <Plus className="mr-2 h-4 w-4" /> Buat Shift Baru
                                        </Button>
                                    </DialogTrigger>
                                    <ShiftFormDialog
                                        form={form} setForm={setForm} handleSaveShift={handleSaveShift} saving={saving}
                                        isEditing={isEditing}
                                    />
                                </Dialog>
                            )}

                            {activeTab === 'rostering' && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="h-7 w-7 rounded-sm">
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="min-w-[120px] text-center text-sm font-bold text-slate-700">
                                            {format(selectedDate, 'MMMM yyyy', { locale: id })}
                                        </span>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="h-7 w-7 rounded-sm">
                                            <ChevronLeft className="h-4 w-4 rotate-180" />
                                        </Button>
                                    </div>
                                    <div className="h-8 w-[1px] bg-slate-200 mx-2" />
                                    <Button onClick={() => setBulkAssignOpen(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 text-white">
                                        <CalendarDays className="mr-2 h-4 w-4" />
                                        Isi Jadwal Otomatis
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-hidden bg-slate-50/30 p-6">
                            <TabsContent value="master" className="h-full mt-0 border-none outline-none overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {shifts.map(shift => (
                                        <Card key={shift.id} className={cn(
                                            "border-none shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden bg-white rounded-2xl",
                                            (shift as any).is_default && "ring-2 ring-emerald-400 ring-offset-1"
                                        )}>
                                            <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-10 -mt-10 rounded-full opacity-10 transition-transform group-hover:scale-110",
                                                shift.is_night_shift ? "bg-purple-600" : "bg-orange-500"
                                            )} />

                                            <CardHeader className="pb-2 relative pt-6 px-6">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant={shift.is_night_shift ? 'secondary' : 'outline'} className={cn("border-0 font-bold",
                                                            shift.is_night_shift ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                                                        )}>
                                                            {shift.is_night_shift ? "Shift Malam" : "Shift Siang"}
                                                        </Badge>
                                                        {(shift as any).is_default && (
                                                            <Badge className="bg-emerald-100 text-emerald-700 border-0 font-bold gap-1">
                                                                <Star className="h-2.5 w-2.5 fill-emerald-600" /> DEFAULT
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1 -mr-2 -mt-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(shift)} className="h-8 w-8 text-slate-300 hover:text-blue-600">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteShift(shift.id)} className="h-8 w-8 text-slate-300 hover:text-red-600">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <CardTitle className="text-xl font-black text-slate-800">{shift.name}</CardTitle>
                                                <p className="font-mono text-xs text-slate-400 font-medium tracking-wide uppercase mt-1">Kode: {shift.code || '-'}</p>
                                            </CardHeader>
                                            <CardContent className="px-6 pb-6">
                                                <div className="flex items-end justify-between mt-4 mb-6">
                                                    <div>
                                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Jam Kerja</p>
                                                        <p className="text-2xl font-black text-slate-800 tracking-tight">
                                                            {shift.start_time.slice(0, 5)} <span className="text-slate-300 text-lg font-normal">s/d</span> {shift.end_time.slice(0, 5)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 text-xs">
                                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                        <p className="text-slate-400 mb-0.5">Istirahat</p>
                                                        <p className="font-bold text-slate-700">
                                                            {shift.break_start ? `${shift.break_start.slice(0, 5)} - ${shift.break_end?.slice(0, 5)}` : '-'}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                        <p className="text-slate-400 mb-0.5">Toleransi</p>
                                                        <p className="font-bold text-slate-700">{shift.tolerance_minutes} Menit</p>
                                                    </div>
                                                </div>

                                                <div className={cn("mt-4 flex items-center justify-between p-3.5 rounded-xl border transition-colors", (shift as any).is_default ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100")}>
                                                    <div>
                                                        <Label className={cn("text-sm font-bold cursor-pointer flex items-center gap-1.5", (shift as any).is_default ? "text-emerald-700" : "text-slate-600")} onClick={() => handleSetDefault(shift.id, !!(shift as any).is_default)}>
                                                            <Star className={cn("h-4 w-4", (shift as any).is_default ? "fill-emerald-600" : "text-slate-400")} />
                                                            Shift Default
                                                        </Label>
                                                        <p className={cn("text-[10px] mt-0.5 max-w-[160px] leading-tight", (shift as any).is_default ? "text-emerald-600" : "text-slate-500")}>
                                                            Berlaku otomatis jika staf tidak dijadwalkan.
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={!!(shift as any).is_default}
                                                        onCheckedChange={() => handleSetDefault(shift.id, !!(shift as any).is_default)}
                                                        className="data-[state=checked]:bg-emerald-500"
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}


                                    {/* Add New Card Button */}
                                    <div
                                        onClick={handleOpenCreate}
                                        className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group min-h-[250px]"
                                    >
                                        <div className="h-14 w-14 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors mb-4">
                                            <Plus className="h-6 w-6 text-slate-400 group-hover:text-blue-600" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-600 group-hover:text-blue-700">Buat Shift Baru</h3>
                                        <p className="text-sm text-slate-400 font-medium mt-1">Tambahkan jam kerja</p>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="rostering" className="h-full mt-0 border-none outline-none flex flex-col gap-4">
                                {/* Search & Filters Bar */}
                                <div className="flex gap-4 items-center mb-2 px-1">
                                    <div className="relative w-80">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Cari staf..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 bg-white border-slate-200 rounded-xl"
                                        />
                                    </div>
                                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                        <SelectTrigger className="w-[200px] bg-white border-slate-200 rounded-xl">
                                            <SelectValue placeholder="Semua Departemen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Departemen</SelectItem>
                                            {uniqueDepartments.map(dept => (
                                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="ml-auto flex items-center gap-4 text-xs font-bold text-slate-500">
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded shadow-sm" /> Shift Siang</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-50 border border-purple-200 rounded shadow-sm" /> Shift Malam</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-50 border border-red-200 rounded shadow-sm" /> Libur/OFF</div>
                                    </div>
                                </div>

                                <Card className="flex-1 overflow-hidden border-none shadow-sm rounded-2xl bg-white flex flex-col">
                                    <CardContent className="flex-1 p-0 overflow-auto custom-scrollbar">
                                        <RosterTable
                                            employees={filteredEmployees} schedules={schedules} selectedDate={selectedDate}
                                            handleCellClick={handleCellClick}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                <AssignDialog
                    assignDialogOpen={assignDialogOpen} setAssignDialogOpen={setAssignDialogOpen}
                    clickedDate={clickedDate} clickedEmployeeId={clickedEmployeeId} employees={employees}
                    existingSchedulesForDay={existingSchedulesForDay} shifts={shifts}
                    handleAddSchedule={handleAddSchedule} handleSetDayOff={handleSetDayOff} handleRemoveSchedule={handleRemoveSchedule}
                    saving={saving}
                />

                <BulkDialog
                    bulkAssignOpen={bulkAssignOpen} setBulkAssignOpen={setBulkAssignOpen}
                    employees={employees} shifts={shifts} selectedShiftId={selectedShiftId} setSelectedShiftId={setSelectedShiftId}
                    handleBulkGenerate={handleBulkGenerate} saving={saving}
                />
            </div>
        </DashboardLayout>
    );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

function ShiftFormDialog({ form, setForm, handleSaveShift, saving, isEditing }: any) {
    return (
        <DialogContent className="max-w-xl rounded-2xl">
            <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Shift Kerja' : 'Buat Shift Baru'}</DialogTitle>
                <CardDescription>Definisikan parameter untuk shift kerja.</CardDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Nama Shift</Label>
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Shift Pagi" className="rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Kode (Opsional)</Label>
                        <Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PAGI" className="rounded-xl font-mono" />
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl space-y-4 border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jam Kerja</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Jam Mulai</Label>
                            <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="bg-white rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Jam Selesai</Label>
                            <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="bg-white rounded-xl" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Mulai Istirahat</Label>
                            <Input type="time" value={form.break_start || ''} onChange={e => setForm({ ...form, break_start: e.target.value })} className="bg-white rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Selesai Istirahat</Label>
                            <Input type="time" value={form.break_end || ''} onChange={e => setForm({ ...form, break_end: e.target.value })} className="bg-white rounded-xl" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Toleransi (Menit)</Label>
                        <Input type="number" value={form.tolerance_minutes} onChange={e => setForm({ ...form, tolerance_minutes: parseInt(e.target.value) || 0 })} className="rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Check-In Awal (Menit)</Label>
                        <Input type="number" value={form.clock_in_advance_minutes} onChange={e => setForm({ ...form, clock_in_advance_minutes: parseInt(e.target.value) || 0 })} className="rounded-xl" />
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50" onClick={() => setForm({ ...form, is_night_shift: !form.is_night_shift })}>
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors", form.is_night_shift ? "bg-purple-600 border-purple-600" : "border-slate-300 bg-white")}>
                        {form.is_night_shift && <Moon className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1">
                        <Label className="cursor-pointer block text-sm font-bold text-slate-700">Shift Malam</Label>
                        <p className="text-xs text-slate-500">Aktifkan jika shift ini melewati tengah malam (lintas hari).</p>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSaveShift} disabled={saving} className="w-full md:w-auto rounded-xl bg-blue-600 hover:bg-blue-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Simpan Shift
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

function RosterControls({ selectedDate, setSelectedDate, setBulkAssignOpen, format, id }: any) {
    return (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d: any) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="h-8 w-8">
                    <Clock className="h-4 w-4 rotate-180" />
                </Button>
                <div className="font-bold text-sm min-w-[120px] text-center uppercase tracking-tight">
                    {format(selectedDate, 'MMMM yyyy', { locale: id })}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d: any) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="h-8 w-8">
                    <Clock className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <Button onClick={() => setBulkAssignOpen(true)} variant="outline" size="sm" className="flex-1 md:flex-none border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 rounded-lg">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Isi Otomatis
                </Button>
            </div>
        </div>
    )
}

function RosterTable({ employees, schedules, selectedDate, handleCellClick }: any) {
    return (
        <Table>
            <TableHeader className="bg-slate-50">
                <TableRow>
                    <TableHead className="min-w-[180px] sticky left-0 bg-slate-50 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] py-4 font-bold text-slate-700">Staf</TableHead>
                    {eachDayOfInterval({
                        start: startOfMonth(selectedDate),
                        end: endOfMonth(selectedDate)
                    }).map(date => {
                        const isToday = isSameDay(date, new Date());
                        const dayName = format(date, 'EEE');
                        const isWeekend = dayName === 'Sat' || dayName === 'Sun';

                        return (
                            <TableHead key={date.toString()} className={cn(
                                "min-w-[48px] text-center px-1 border-l border-slate-200/50 py-2",
                                isWeekend ? "text-red-500 bg-red-50/20" : "",
                                isToday ? "bg-blue-100/50 text-blue-700 font-black" : ""
                            )}>
                                <div className="text-[10px] uppercase font-bold opacity-60 tracking-tighter mb-0.5">{dayName}</div>
                                <div className="text-sm font-black">{format(date, 'd')}</div>
                            </TableHead>
                        );
                    })}
                </TableRow>
            </TableHeader>
            <TableBody>
                {employees.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={32} className="text-center py-12 text-muted-foreground">Tidak ada staf yang sesuai filter.</TableCell>
                    </TableRow>
                ) : employees.map((employee: any) => (
                    <TableRow key={employee.id} className="hover:bg-slate-50 transition-colors group">
                        <TableCell className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200/50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] py-3">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                                    {employee.full_name?.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{employee.full_name}</div>
                                    <div className="text-[10px] text-slate-400 font-medium truncate max-w-[120px] uppercase">
                                        {employee.job_position?.title || employee.department?.name || 'Staff'}
                                    </div>
                                </div>
                            </div>
                        </TableCell>
                        {eachDayOfInterval({
                            start: startOfMonth(selectedDate),
                            end: endOfMonth(selectedDate)
                        }).map(date => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const daySchedules = schedules.filter((s: any) => s.user_id === employee.id && s.date === dateStr);
                            const isWeekend = ["Sat", "Sun"].includes(format(date, 'EEE'));
                            const isOff = daySchedules.some((s: any) => s.is_day_off);

                            return (
                                <TableCell
                                    key={dateStr}
                                    className={cn(
                                        "p-0 text-center border-l border-slate-100 cursor-pointer transition-all h-14 relative align-top",
                                        isWeekend && daySchedules.length === 0 ? "bg-slate-50/40" : "",
                                        "hover:bg-blue-50 hover:z-30"
                                    )}
                                    onClick={() => handleCellClick(employee.id, dateStr, daySchedules)}
                                >
                                    <div className="w-full h-full p-1 flex flex-col gap-1 items-center justify-center min-h-[56px]">
                                        {daySchedules.length > 0 ? (
                                            isOff ? (
                                                <div className="w-full h-full flex items-center justify-center bg-red-50/50">
                                                    <span className="text-[9px] font-black text-red-300">OFF</span>
                                                </div>
                                            ) : (
                                                daySchedules.map((sch: any) => sch.shift && (
                                                    <div key={sch.id} className={cn(
                                                        "rounded-md flex flex-col items-center justify-center text-[10px] font-bold border w-full h-full shadow-sm",
                                                        sch.shift.is_night_shift ? "bg-purple-50 text-purple-700 border-purple-200" :
                                                            "bg-blue-50 text-blue-700 border-blue-200"
                                                    )}>
                                                        <span className="leading-none text-xs">{sch.shift.code || sch.shift.name.slice(0, 1)}</span>
                                                        <span className="text-[8px] opacity-70 font-normal leading-none mt-0.5">{sch.shift.start_time.slice(0, 5)}</span>
                                                    </div>
                                                ))
                                            )
                                        ) : (
                                            <Plus className="h-3 w-3 text-slate-200 opacity-0 group-hover:opacity-100" />
                                        )}
                                    </div>
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function AssignDialog({ assignDialogOpen, setAssignDialogOpen, clickedDate, clickedEmployeeId, employees, existingSchedulesForDay, shifts, handleAddSchedule, handleSetDayOff, handleRemoveSchedule, saving }: any) {
    return (
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        {clickedDate ? format(new Date(clickedDate), 'EEEE, d MMM yyyy', { locale: id }) : 'Atur Jadwal'}
                    </DialogTitle>
                    <CardDescription>Pilih shift kerja untuk {employees.find((e: any) => e.id === clickedEmployeeId)?.full_name}</CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="mb-4">
                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Jadwal Terdaftar</h4>
                        {existingSchedulesForDay.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">Belum ada jadwal hari ini.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {existingSchedulesForDay.map((sch: any) => (
                                    <div key={sch.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl shadow-sm">
                                        {sch.is_day_off ? (
                                            <span className="text-xs font-bold text-red-500 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> LIBUR / OFF</span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-2 h-2 rounded-full", sch.shift?.is_night_shift ? "bg-purple-500" : "bg-blue-500")} />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700">{sch.shift?.name}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">{sch.shift?.start_time?.slice(0, 5)} - {sch.shift?.end_time?.slice(0, 5)}</span>
                                                </div>
                                            </div>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => handleRemoveSchedule(sch.id)} className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 p-0 rounded-lg"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase text-slate-400">Tambah Shift</h4>
                        <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2">
                            {shifts.map((s: any) => (
                                <Button
                                    key={s.id}
                                    variant="outline"
                                    className="justify-between h-auto py-3 px-4 rounded-xl border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 group transition-all"
                                    onClick={() => handleAddSchedule(s.id)}
                                    disabled={saving}
                                >
                                    <div className="text-left">
                                        <div className="font-bold text-slate-700 group-hover:text-blue-700">{s.name}</div>
                                        <div className="text-[10px] text-slate-400 group-hover:text-blue-500">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</div>
                                    </div>
                                    {s.is_night_shift ? <Moon className="h-4 w-4 text-purple-400 group-hover:text-purple-600" /> : <Sun className="h-4 w-4 text-orange-400 group-hover:text-orange-600" />}
                                </Button>
                            ))}

                            <Button
                                variant="outline"
                                className="justify-between h-auto py-3 px-4 rounded-xl border-dashed border-red-200 hover:border-red-400 hover:bg-red-50 group mt-2"
                                onClick={handleSetDayOff}
                                disabled={saving}
                            >
                                <div className="text-left font-bold text-red-600 group-hover:text-red-700">Set OFF / Libur</div>
                                <div className="text-[10px] text-red-300 font-black">Hapus semua shift</div>
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function BulkDialog({ bulkAssignOpen, setBulkAssignOpen, employees, shifts, selectedShiftId, setSelectedShiftId, handleBulkGenerate, saving }: any) {
    return (
        <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-blue-600" />
                        Isi Jadwal Otomatis
                    </DialogTitle>
                    <CardDescription>Isi jadwal satu bulan penuh untuk SEMUA staf aktif ({employees.length} orang).</CardDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="grid gap-3">
                        <Label className="text-sm font-bold text-slate-700">Pilih Shift Kerja Utama</Label>
                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                            {shifts.map((s: any) => (
                                <div
                                    key={s.id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all",
                                        selectedShiftId === s.id ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:bg-slate-50"
                                    )}
                                    onClick={() => setSelectedShiftId(s.id)}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900">{s.name}</span>
                                        <span className="text-xs text-slate-500">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedShiftId === s.id ? "border-blue-500 bg-blue-500" : "border-slate-300")}>
                                        {selectedShiftId === s.id && <Clock className="h-3 w-3 text-white" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="flex gap-3">
                            <div className="text-amber-600 mt-0.5 font-black text-xs shrink-0">!</div>
                            <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                Penjadwalan otomatis akan mengisi hari <strong>Senin - Jumat</strong> dengan shift pilihan anda. Hari Sabtu & Minggu otomatis diset <strong>OFF (Libur)</strong>.
                            </p>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleBulkGenerate} disabled={saving || !selectedShiftId} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                        {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                        Buat Jadwal Kolektif
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
