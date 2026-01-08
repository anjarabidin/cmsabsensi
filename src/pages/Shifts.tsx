import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Clock, CalendarDays, Moon, Sun, Trash2, Edit, ChevronLeft } from 'lucide-react';
import { Shift, EmployeeSchedule, Profile } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function ShiftsPage() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('master');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);

    // Master Shift State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<Partial<Shift>>({
        name: '',
        code: '',
        start_time: '',
        end_time: '',
        is_night_shift: false
    });
    const [saving, setSaving] = useState(false);

    // Rostering State
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

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
            const { data } = await supabase.from('profiles').select('*, job_position:job_positions(*)').eq('is_active', true).order('full_name');
            setEmployees(data as any[] as Profile[] || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSchedules = async (date: Date) => {
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');

        try {
            const { data, error } = await (supabase
                .from('employee_schedules') as any)
                .select('*, shift:shifts(*)')
                .gte('date', start)
                .lte('date', end);

            if (error) throw error;
            setSchedules(data as EmployeeSchedule[] || []);
        } catch (error) {
            console.error(error);
        }
    };

    // State for Schedule Dialog
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

    // State for individual assignment
    const [clickedEmployeeId, setClickedEmployeeId] = useState<string | null>(null);
    const [clickedDate, setClickedDate] = useState<string | null>(null);
    const [clickedScheduleId, setClickedScheduleId] = useState<string | null>(null);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

    const handleCellClick = (employeeId: string, date: string, existingSchedule?: EmployeeSchedule) => {
        setClickedEmployeeId(employeeId);
        setClickedDate(date);
        setClickedScheduleId(existingSchedule?.id || null);
        setSelectedShiftId(existingSchedule?.shift_id || existingSchedule?.shift?.id || null);
        setAssignDialogOpen(true);
    };

    const handleSaveSchedule = async () => {
        if (!clickedEmployeeId || !clickedDate || !selectedShiftId) return;

        setSaving(true);
        try {
            // Check if existing schedule
            if (clickedScheduleId) {
                if (selectedShiftId === 'OFF') {
                    await (supabase.from('employee_schedules') as any).update({
                        shift_id: null,
                        is_day_off: true
                    }).eq('id', clickedScheduleId);
                } else {
                    await (supabase.from('employee_schedules') as any).update({
                        shift_id: selectedShiftId,
                        is_day_off: false
                    }).eq('id', clickedScheduleId);
                }
            } else {
                // Insert new
                if (selectedShiftId === 'OFF') {
                    await (supabase.from('employee_schedules') as any).insert({
                        user_id: clickedEmployeeId,
                        date: clickedDate,
                        shift_id: null,
                        is_day_off: true
                    });
                } else {
                    await (supabase.from('employee_schedules') as any).insert({
                        user_id: clickedEmployeeId,
                        date: clickedDate,
                        shift_id: selectedShiftId
                    });
                }
            }

            toast({ title: 'Jadwal tersimpan' });
            setAssignDialogOpen(false);
            fetchSchedules(selectedDate);
        } catch (error) {
            toast({ title: 'Gagal menyimpan', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSchedule = async () => {
        if (!clickedScheduleId) return;
        if (!confirm('Hapus jadwal ini?')) return;

        setSaving(true);
        try {
            await (supabase.from('employee_schedules') as any).delete().eq('id', clickedScheduleId);
            toast({ title: 'Jadwal dihapus' });
            setAssignDialogOpen(false);
            fetchSchedules(selectedDate);
        } catch (error) {
            toast({ title: 'Gagal menghapus', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleBulkGenerate = async () => {
        if (!selectedShiftId) return;
        setSaving(true);

        try {
            const dates = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
            const bulkData: any[] = [];

            employees.forEach(emp => {
                dates.forEach(date => {
                    const dayName = format(date, 'EEE');
                    const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                    const dateStr = format(date, 'yyyy-MM-dd');

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

            toast({ title: 'Jadwal 1 Bulan Berhasil Dibuat', description: `Untuk ${employees.length} karyawan.` });
            setBulkAssignOpen(false);
            fetchSchedules(selectedDate);

        } catch (error: any) {
            console.error(error);
            toast({ title: 'Gagal generate', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveShift = async () => {
        if (!form.name || !form.start_time || !form.end_time) {
            toast({ title: 'Mohon lengkapi data', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const { error } = await (supabase.from('shifts') as any).insert(form);
            if (error) throw error;
            toast({ title: 'Shift Berhasil Ditambahkan' });
            setDialogOpen(false);
            setForm({ name: '', code: '', start_time: '', end_time: '', is_night_shift: false });
            fetchShifts();
        } catch (error) {
            toast({ title: 'Gagal menambah shift', variant: 'destructive' });
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

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-[220px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                <div className="relative z-10 space-y-6 px-4 pt-8 pb-24 md:px-8">
                    {/* Header with Back Button */}
                    <div className="flex items-start gap-4 text-white">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/dashboard')}
                            className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight drop-shadow-md flex items-center gap-2">
                                <Clock className="h-6 w-6 text-blue-200" />
                                Manajemen Jadwal & Shift
                            </h1>
                            <p className="text-blue-50 font-medium opacity-90 mt-1">Atur master shift dan penugasan jadwal karyawan.</p>
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
                                            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Buat Shift Baru</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Nama Shift</Label>
                                                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Shift Pagi" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Kode (Opsional)</Label>
                                                    <Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PAGI" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label>Jam Mulai</Label>
                                                        <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label>Jam Selesai</Label>
                                                        <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="night"
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                        checked={form.is_night_shift}
                                                        onChange={e => setForm({ ...form, is_night_shift: e.target.checked })}
                                                    />
                                                    <Label htmlFor="night" className="text-sm">Shift Malam (Lintas Hari)</Label>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleSaveShift} disabled={saving} className="w-full md:w-auto">Simpan</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent className="p-0 md:p-6">
                                    {loading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nama</TableHead>
                                                        <TableHead>Kode</TableHead>
                                                        <TableHead>Jam Kerja</TableHead>
                                                        <TableHead>Tipe</TableHead>
                                                        <TableHead className="text-right">Aksi</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {shifts.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada data shift.</TableCell>
                                                        </TableRow>
                                                    ) : shifts.map(shift => (
                                                        <TableRow key={shift.id}>
                                                            <TableCell className="font-medium">{shift.name}</TableCell>
                                                            <TableCell><span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded border">{shift.code || '-'}</span></TableCell>
                                                            <TableCell className="text-xs">{shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}</TableCell>
                                                            <TableCell>
                                                                {shift.is_night_shift ?
                                                                    <div className="flex items-center text-purple-600 gap-1 text-[10px] font-bold"><Moon className="h-3 w-3" /> Malam</div> :
                                                                    <div className="flex items-center text-orange-600 gap-1 text-[10px] font-bold"><Sun className="h-3 w-3" /> Siang</div>
                                                                }
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteShift(shift.id)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600">
                                                                    <Trash2 className="h-4 w-4" />
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
                        </TabsContent>

                        <TabsContent value="rostering" className="space-y-4 pt-4">
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="h-8 w-8">
                                        <Clock className="h-4 w-4 rotate-180" />
                                    </Button>
                                    <div className="font-bold text-sm min-w-[120px] text-center uppercase tracking-tight">
                                        {format(selectedDate, 'MMMM yyyy', { locale: id })}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="h-8 w-8">
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

                            <Card className="overflow-hidden border-slate-200">
                                <CardContent className="p-0 overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="min-w-[150px] sticky left-0 bg-slate-50 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] py-3">Karyawan</TableHead>
                                                {eachDayOfInterval({
                                                    start: startOfMonth(selectedDate),
                                                    end: endOfMonth(selectedDate)
                                                }).map(date => {
                                                    const isToday = isSameDay(date, new Date());
                                                    const dayName = format(date, 'EEE');
                                                    const isWeekend = dayName === 'Sat' || dayName === 'Sun';

                                                    return (
                                                        <TableHead key={date.toString()} className={cn(
                                                            "min-w-[45px] text-center px-1 border-l border-slate-200/50 py-2",
                                                            isWeekend ? "text-red-500 bg-red-50/30" : "",
                                                            isToday ? "bg-blue-50 text-blue-600 ring-2 ring-blue-500 ring-inset" : ""
                                                        )}>
                                                            <div className="text-[9px] uppercase font-bold opacity-60 tracking-tighter">{dayName}</div>
                                                            <div className="text-xs font-black">{format(date, 'd')}</div>
                                                        </TableHead>
                                                    );
                                                })}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {employees.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={32} className="text-center py-12 text-muted-foreground">Tidak ada karyawan aktif.</TableCell>
                                                </TableRow>
                                            ) : employees.map(employee => (
                                                <TableRow key={employee.id} className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="sticky left-0 bg-white z-10 font-bold border-r border-slate-200/50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] py-2.5">
                                                        <div className="text-[11px] leading-tight truncate max-w-[130px]">{employee.full_name}</div>
                                                        <div className="text-[8px] text-slate-400 font-medium truncate max-w-[130px] uppercase">
                                                            {employee.job_position?.title || employee.position || 'Staff'}
                                                        </div>
                                                    </TableCell>
                                                    {eachDayOfInterval({
                                                        start: startOfMonth(selectedDate),
                                                        end: endOfMonth(selectedDate)
                                                    }).map(date => {
                                                        const dateStr = format(date, 'yyyy-MM-dd');
                                                        const schedule = schedules.find(s => s.user_id === employee.id && s.date === dateStr);
                                                        const isWeekend = ["Sat", "Sun"].includes(format(date, 'EEE'));

                                                        return (
                                                            <TableCell
                                                                key={dateStr}
                                                                className={cn(
                                                                    "p-0 text-center border-l border-slate-200/50 cursor-pointer transition-all h-12 relative group",
                                                                    isWeekend && !schedule ? "bg-slate-50/20" : "",
                                                                    "hover:bg-blue-100/50 hover:z-30"
                                                                )}
                                                                onClick={() => handleCellClick(employee.id, dateStr, schedule)}
                                                            >
                                                                {schedule?.shift ? (
                                                                    <div className={cn(
                                                                        "absolute inset-1 rounded-sm flex items-center justify-center text-[9px] font-black border",
                                                                        schedule.shift.code === 'OFF' || schedule.is_day_off ? "bg-slate-100 text-slate-400 border-slate-200" :
                                                                            schedule.shift.is_night_shift ? "bg-purple-500 text-white border-purple-600 shadow-sm" :
                                                                                "bg-blue-600 text-white border-blue-700 shadow-sm"
                                                                    )}>
                                                                        {schedule.is_day_off ? 'OFF' : (schedule.shift.code || schedule.shift.name.slice(0, 1))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                                                        <Plus className="h-3 w-3 text-slate-300" />
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            <div className="flex gap-4 text-[10px] font-bold text-slate-500 px-2 overflow-x-auto pb-4">
                                <div className="flex items-center gap-1.5 shrink-0"><div className="w-3 h-3 bg-blue-600 rounded-sm" /> Shift Pagi/Siang</div>
                                <div className="flex items-center gap-1.5 shrink-0"><div className="w-3 h-3 bg-purple-500 rounded-sm" /> Shift Malam</div>
                                <div className="flex items-center gap-1.5 shrink-0"><div className="w-3 h-3 bg-slate-100 border rounded-sm" /> Libur/OFF</div>
                            </div>
                        </TabsContent>

                        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                            <DialogContent className="max-w-md rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-blue-600" />
                                        {clickedDate ? format(new Date(clickedDate), 'EEEE, d MMM yyyy', { locale: id }) : 'Atur Jadwal'}
                                    </DialogTitle>
                                    <CardDescription>Pilih shift kerja untuk {employees.find(e => e.id === clickedEmployeeId)?.full_name}</CardDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-1 gap-2">
                                        {shifts.map(s => (
                                            <Button
                                                key={s.id}
                                                variant="outline"
                                                className={cn(
                                                    "justify-between h-auto py-3 px-4 rounded-xl border-2 transition-all",
                                                    selectedShiftId === s.id ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:border-slate-300"
                                                )}
                                                onClick={() => setSelectedShiftId(s.id)}
                                            >
                                                <div className="text-left">
                                                    <div className="font-bold text-slate-900">{s.name}</div>
                                                    <div className="text-xs text-slate-500">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</div>
                                                </div>
                                                {s.is_night_shift ? <Moon className="h-4 w-4 text-purple-600" /> : <Sun className="h-4 w-4 text-orange-500" />}
                                            </Button>
                                        ))}
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "justify-between h-auto py-3 px-4 rounded-xl border-2 transition-all",
                                                selectedShiftId === 'OFF' ? "border-red-500 bg-red-50" : "border-slate-100 hover:border-slate-300"
                                            )}
                                            onClick={() => setSelectedShiftId('OFF')}
                                        >
                                            <div className="text-left font-bold text-red-600">OFF / Libur</div>
                                            <div className="text-xs text-slate-400 uppercase font-black">Day Off</div>
                                        </Button>
                                    </div>
                                    <div className="flex flex-col gap-2 pt-2">
                                        <Button onClick={handleSaveSchedule} disabled={saving || !selectedShiftId} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                                            Simpan Jadwal
                                        </Button>
                                        <Button variant="ghost" onClick={handleDeleteSchedule} disabled={!clickedScheduleId} className="w-full h-10 text-red-500 hover:bg-red-50 hover:text-red-600">
                                            Hapus Jadwal (Set Kosong)
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
                            <DialogContent className="max-w-md rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-blue-600" />
                                        Isi Jadwal Otomatis
                                    </DialogTitle>
                                    <CardDescription>Isi jadwal satu bulan penuh untuk SEMUA karyawan aktif ({employees.length} orang).</CardDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    <div className="grid gap-3">
                                        <Label className="text-sm font-bold text-slate-700">Pilih Shift Kerja Utama</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {shifts.map(s => (
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
                    </Tabs>
                </div>
            </div>
        </DashboardLayout>
    );
}
