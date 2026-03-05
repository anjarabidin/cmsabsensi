
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
    Calendar as CalendarIcon,
    MapPin,
    Users,
    Plus,
    ChevronLeft,
    ChevronRight,
    Clock,
    MoreVertical,
    CheckCircle2,
    HelpCircle,
    Video,
    Search,
    Edit,
    Trash2,
    Loader2,
    TrendingUp,
    Target,
    ArrowLeft,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpanningCalendar } from '@/components/SpanningCalendar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    parseISO
} from 'date-fns';
import { id } from 'date-fns/locale';
import { fromZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { Agenda, Profile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ─── Shared Form Dialog Content (used in both Mobile & Desktop) ─────────────
function AgendaFormDialog({
    open,
    onOpenChange,
    isEditing,
    form,
    setForm,
    selectedParticipants,
    setSelectedParticipants,
    employees,
    employeeSearch,
    setEmployeeSearch,
    groupedEmployees,
    filteredEmployees,
    creating,
    onSave,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    isEditing: boolean;
    form: any;
    setForm: (f: any) => void;
    selectedParticipants: string[];
    setSelectedParticipants: (fn: any) => void;
    employees: Profile[];
    employeeSearch: string;
    setEmployeeSearch: (v: string) => void;
    groupedEmployees: Record<string, Profile[]>;
    filteredEmployees: Profile[];
    creating: boolean;
    onSave: () => void;
}) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const nowTime = format(new Date(), 'HH:mm');

    // Min date for start: today (only for new agenda, not edit)
    const minStartDate = isEditing ? undefined : today;
    // Min time for start: current time, only if startDate == today
    const minStartTime = (!isEditing && form.startDate === today) ? nowTime : undefined;
    // End date can't be before start date
    const minEndDate = form.startDate || today;
    // End time can't be before start time if same day
    const minEndTime = form.endDate === form.startDate ? form.startTime : undefined;

    const handleStartDateChange = (val: string) => {
        const updated: any = { ...form, startDate: val };
        // auto-push endDate if it went before startDate
        if (form.endDate < val) updated.endDate = val;
        setForm(updated);
    };

    const handleStartTimeChange = (val: string) => {
        const updated: any = { ...form, startTime: val };
        // if same day, auto-push endTime if it went before startTime
        if (form.startDate === form.endDate && form.endTime <= val) {
            const [h, m] = val.split(':').map(Number);
            const next = new Date(0, 0, 0, h, m + 30);
            updated.endTime = format(next, 'HH:mm');
        }
        setForm(updated);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
                {/* Header */}
                <div className="bg-slate-900 px-8 py-6 text-white flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">
                            {isEditing ? 'Edit Agenda' : 'Buat Agenda Baru'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">
                            {isEditing ? 'Perbarui detail kegiatan.' : 'Tambahkan jadwal rapat atau kegiatan tim.'}
                        </DialogDescription>
                    </div>
                    <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                        <CalendarIcon className="h-7 w-7 text-blue-400" />
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 py-6 space-y-5 max-h-[65vh] overflow-y-auto">
                    {/* Judul */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Judul Kegiatan *</Label>
                        <Input
                            placeholder="Misal: Rapat Koordinasi Mingguan"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold text-slate-900 px-4 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Tanggal */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Tanggal Mulai *</Label>
                            <Input
                                type="date"
                                value={form.startDate}
                                min={minStartDate}
                                onChange={e => handleStartDateChange(e.target.value)}
                                className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold px-4 focus:bg-white transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Tanggal Selesai *</Label>
                            <Input
                                type="date"
                                value={form.endDate}
                                min={minEndDate}
                                onChange={e => setForm({ ...form, endDate: e.target.value })}
                                className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold px-4 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Jam */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Jam Mulai *</Label>
                            <Input
                                type="time"
                                value={form.startTime}
                                min={minStartTime}
                                onChange={e => handleStartTimeChange(e.target.value)}
                                className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold px-4 focus:bg-white transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Jam Selesai *</Label>
                            <Input
                                type="time"
                                value={form.endTime}
                                min={minEndTime}
                                onChange={e => setForm({ ...form, endTime: e.target.value })}
                                className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold px-4 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Lokasi & Link */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Lokasi (Opsional)</Label>
                            <Input placeholder="Ruang Rapat 1" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold px-4 focus:bg-white transition-all" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Link Meeting (Opsional)</Label>
                            <Input placeholder="https://zoom.us/..." value={form.meetingLink} onChange={e => setForm({ ...form, meetingLink: e.target.value })} className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold px-4 focus:bg-white transition-all" />
                        </div>
                    </div>

                    {/* Deskripsi */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Deskripsi (Opsional)</Label>
                        <Textarea
                            placeholder="Detail kegiatan..."
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            className="rounded-2xl bg-slate-50 border-slate-200 px-4 py-3 min-h-[80px] resize-none transition-all text-sm"
                        />
                    </div>

                    {/* Peserta */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Peserta</Label>
                            <span className="text-[10px] bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded-full">
                                {selectedParticipants.length} terpilih
                            </span>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari nama staf..."
                                value={employeeSearch}
                                onChange={e => setEmployeeSearch(e.target.value)}
                                className="pl-9 h-10 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all"
                            />
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                            {Object.keys(groupedEmployees).length === 0 ? (
                                <div className="p-8 text-center flex flex-col items-center text-slate-400">
                                    <Users className="h-8 w-8 mb-2 opacity-50" />
                                    <span className="text-xs">Tidak ada staf ditemukan</span>
                                </div>
                            ) : (
                                Object.entries(groupedEmployees).map(([dept, emps]) => (
                                    <div key={dept}>
                                        <div className="bg-slate-50 px-4 py-2 border-y border-slate-100 flex items-center justify-between sticky top-0 z-10">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                {dept}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 text-[10px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                                                onClick={() => {
                                                    const ids = emps.map(e => e.id);
                                                    const allSelected = ids.every(id => selectedParticipants.includes(id));
                                                    if (allSelected) {
                                                        setSelectedParticipants((prev: string[]) => prev.filter(id => !ids.includes(id)));
                                                    } else {
                                                        setSelectedParticipants((prev: string[]) => [...new Set([...prev, ...ids])]);
                                                    }
                                                }}
                                            >
                                                {emps.every(e => selectedParticipants.includes(e.id)) ? 'Batal Semua' : 'Pilih Semua'}
                                            </Button>
                                        </div>
                                        <div>
                                            {emps.map(emp => (
                                                <div
                                                    key={emp.id}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 transition-all border-b border-slate-50 last:border-0 cursor-pointer",
                                                        selectedParticipants.includes(emp.id) ? "bg-blue-50/30" : ""
                                                    )}
                                                    onClick={() => {
                                                        if (selectedParticipants.includes(emp.id)) {
                                                            setSelectedParticipants((prev: string[]) => prev.filter(id => id !== emp.id));
                                                        } else {
                                                            setSelectedParticipants((prev: string[]) => [...prev, emp.id]);
                                                        }
                                                    }}
                                                >
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0",
                                                        selectedParticipants.includes(emp.id) ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"
                                                    )}>
                                                        {selectedParticipants.includes(emp.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                    </div>
                                                    <Avatar className="h-7 w-7 border border-slate-100 shadow-sm">
                                                        <AvatarImage src={emp.avatar_url || ''} />
                                                        <AvatarFallback className="text-[9px] bg-sky-100 text-sky-700 font-bold">{emp.full_name[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className={cn("text-xs font-bold truncate", selectedParticipants.includes(emp.id) ? "text-blue-700" : "text-slate-700")}>{emp.full_name}</p>
                                                        <p className="text-[10px] text-slate-400 truncate">{(emp as any).job_position?.title || 'Staff'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 bg-slate-50 flex gap-3 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 h-12 font-black rounded-2xl text-slate-400 hover:bg-white uppercase tracking-widest text-[10px]">
                        Batal
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={creating}
                        className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-200 uppercase tracking-widest text-[10px] transition-all active:scale-95"
                    >
                        {creating ? <Loader2 className="animate-spin h-5 w-5" /> : (isEditing ? 'Simpan Perubahan' : 'Publikasikan Agenda')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AgendaPage() {
    const { user, profile, role } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [agendas, setAgendas] = useState<Agenda[]>([]);
    const [publicHolidays, setPublicHolidays] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(new Date());

    // CRUD State
    const [createOpen, setCreateOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAgendaId, setCurrentAgendaId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, title: string } | null>(null);

    const [employees, setEmployees] = useState<Profile[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [form, setForm] = useState({
        title: '',
        description: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '10:00',
        location: '',
        meetingLink: ''
    });

    const [employeeSearch, setEmployeeSearch] = useState('');

    const canManage = ['admin_hr', 'manager', 'super_admin'].includes(role || '');

    const filteredEmployees = useMemo(() => {
        if (!employeeSearch) return employees;
        return employees.filter(e =>
            e.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
            e.email?.toLowerCase().includes(employeeSearch.toLowerCase())
        );
    }, [employees, employeeSearch]);

    const groupedEmployees = useMemo(() => {
        const groups: Record<string, Profile[]> = {};
        filteredEmployees.forEach(emp => {
            const deptName = (emp as any).job_position?.department?.name || 'Umum';
            if (!groups[deptName]) groups[deptName] = [];
            groups[deptName].push(emp);
        });
        return groups;
    }, [filteredEmployees]);

    useEffect(() => {
        if (role) {
            fetchAgendas();
            fetchHolidays();
            fetchEmployees();
        }
    }, [selectedMonth, role]);

    const fetchHolidays = async () => {
        try {
            const { data } = await supabase.from('public_holidays').select('*');
            setPublicHolidays(data || []);
        } catch (error) {
            console.error('Fetch Holidays Error:', error);
        }
    };

    const fetchAgendas = async () => {
        try {
            setLoading(true);
            const startOfView = startOfWeek(startOfMonth(selectedMonth));
            const endOfView = endOfWeek(endOfMonth(selectedMonth));
            const queryStart = format(startOfView, 'yyyy-MM-dd');
            const queryEnd = format(endOfView, 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('agendas')
                .select(`*, participants:agenda_participants(user_id, status)`)
                .filter('start_time', 'lte', `${queryEnd}T23:59:59`)
                .filter('end_time', 'gte', `${queryStart}T00:00:00`);

            if (error) throw error;
            setAgendas(data || []);
        } catch (error: any) {
            toast({ title: 'Gagal memuat agenda', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        const { data } = await supabase.from('profiles').select(`
            *,
            job_position:job_positions(title, department:departments(name))
        `).eq('is_active', true).order('full_name');
        setEmployees(data || []);
    };

    const resetForm = () => {
        setForm({
            title: '',
            description: '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
            startTime: '09:00',
            endTime: '10:00',
            location: '',
            meetingLink: ''
        });
        setSelectedParticipants([]);
        setEmployeeSearch('');
        setIsEditing(false);
        setCurrentAgendaId(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setCreateOpen(true);
    };

    const handleOpenEdit = (agenda: Agenda) => {
        const startDate = parseISO(agenda.start_time);
        const endDate = parseISO(agenda.end_time);
        setForm({
            title: agenda.title,
            description: agenda.description || '',
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
            startTime: format(startDate, 'HH:mm'),
            endTime: format(endDate, 'HH:mm'),
            location: agenda.location || '',
            meetingLink: agenda.meeting_link || ''
        });
        const participants = agenda.participants?.map((p: any) => p.user_id) || [];
        setSelectedParticipants(participants);
        setIsEditing(true);
        setCurrentAgendaId(agenda.id);
        setCreateOpen(true);
    };

    const handleOpenDelete = (agenda: Agenda) => {
        setItemToDelete({ id: agenda.id, title: agenda.title });
        setDeleteOpen(true);
    };

    const handleSaveAgenda = async () => {
        if (!form.title || !form.startDate || !form.startTime || !form.endTime) {
            toast({ title: 'Mohon isi semua field wajib (Judul, Tanggal, Jam)', variant: 'destructive' });
            return;
        }

        // ─── Validasi Waktu ────────────────────────────────────────────────
        const TIMEZONE = 'Asia/Jakarta';
        const startStr = `${form.startDate}T${form.startTime}:00`;
        const endStr = `${form.endDate}T${form.endTime}:00`;
        const startDate = fromZonedTime(startStr, TIMEZONE);
        const endDate = fromZonedTime(endStr, TIMEZONE);

        if (endDate <= startDate) {
            toast({
                title: 'Waktu Selesai Tidak Valid',
                description: 'Waktu selesai harus lebih dari waktu mulai.',
                variant: 'destructive'
            });
            return;
        }

        // Hanya enforce untuk agenda baru (bukan edit)
        if (!isEditing && startDate < new Date()) {
            toast({
                title: 'Tanggal/Jam Sudah Lewat',
                description: 'Waktu mulai agenda tidak boleh di masa lalu.',
                variant: 'destructive'
            });
            return;
        }
        // ──────────────────────────────────────────────────────────────────

        try {
            setCreating(true);
            const start = startDate.toISOString();
            const end = endDate.toISOString();


            let resultAgendaId = currentAgendaId;

            if (isEditing && currentAgendaId) {
                const { error } = await supabase.from('agendas').update({
                    title: form.title, description: form.description,
                    start_time: start, end_time: end,
                    location: form.location, meeting_link: form.meetingLink,
                }).eq('id', currentAgendaId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('agendas').insert({
                    title: form.title, description: form.description,
                    start_time: start, end_time: end,
                    location: form.location, meeting_link: form.meetingLink,
                    created_by: user?.id
                }).select().single();
                if (error) throw error;
                resultAgendaId = data.id;
            }

            if (resultAgendaId) {
                if (isEditing) {
                    await supabase.from('agenda_participants').delete().eq('agenda_id', resultAgendaId);
                }
                if (selectedParticipants.length > 0) {
                    const participantData = selectedParticipants.map(uid => ({ agenda_id: resultAgendaId, user_id: uid }));
                    const { error: partError } = await supabase.from('agenda_participants').insert(participantData);
                    if (partError) throw partError;
                }
            }

            toast({ title: isEditing ? 'Agenda diperbarui ✅' : 'Agenda berhasil dibuat ✅' });
            setCreateOpen(false);
            resetForm();
            fetchAgendas();
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Gagal menyimpan agenda', description: error.message, variant: 'destructive' });
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            const { error } = await supabase.from('agendas').delete().eq('id', itemToDelete.id);
            if (error) throw error;
            toast({ title: 'Agenda dihapus' });
            fetchAgendas();
        } catch (error: any) {
            toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
        } finally {
            setDeleteOpen(false);
            setItemToDelete(null);
        }
    };

    const agendasForSelectedDay = agendas.filter(a => {
        const targetDate = new Date(selectedDay.toDateString());
        const checkStart = new Date(new Date(a.start_time).toDateString());
        const checkEnd = new Date(new Date(a.end_time).toDateString());
        return targetDate >= checkStart && targetDate <= checkEnd;
    });

    if (loading && agendas.length === 0) return (
        <DashboardLayout>
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-slate-400" />
            </div>
        </DashboardLayout>
    );

    // ─── SHARED DIALOG (both mobile & desktop use this) ──────────────────────
    const sharedDialog = (
        <AgendaFormDialog
            open={createOpen}
            onOpenChange={(open) => { if (!open) resetForm(); setCreateOpen(open); }}
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            selectedParticipants={selectedParticipants}
            setSelectedParticipants={setSelectedParticipants}
            employees={employees}
            employeeSearch={employeeSearch}
            setEmployeeSearch={setEmployeeSearch}
            groupedEmployees={groupedEmployees}
            filteredEmployees={filteredEmployees}
            creating={creating}
            onSave={handleSaveAgenda}
        />
    );

    const sharedDeleteDialog = (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black">Hapus Agenda?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium text-slate-500">
                        Anda yakin ingin menghapus agenda <b>"{itemToDelete?.title}"</b>? Tindakan ini permanen.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold">Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="rounded-xl bg-red-600 hover:bg-red-700 font-bold text-white">
                        Ya, Hapus
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50 pb-24">
                    {/* Gradient Header BG */}
                    <div className="absolute top-0 left-0 w-full h-[180px] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 max-w-4xl mx-auto px-4 pt-6 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between text-white mb-2">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost" size="icon"
                                    onClick={() => navigate('/dashboard')}
                                    className="text-white hover:bg-white/20 hover:text-white rounded-full h-8 w-8"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight">Agenda Kerja</h1>
                                    <p className="text-[10px] text-blue-100 font-medium opacity-90 uppercase tracking-widest">
                                        {format(selectedMonth, 'MMMM yyyy', { locale: id })}
                                    </p>
                                </div>
                            </div>

                            {/* Tombol Buat disini, TERPISAH dari Dialog */}
                            {canManage && (
                                <Button
                                    onClick={handleOpenCreate}
                                    className="bg-white text-blue-600 hover:bg-white/90 h-9 px-4 rounded-xl font-bold text-xs gap-1.5 shadow-lg"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Buat
                                </Button>
                            )}
                        </div>

                        {/* Mobile Calendar */}
                        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white rounded-3xl">
                            <CardHeader className="flex flex-row items-center justify-between pb-3 bg-slate-50/50 border-b border-slate-100 px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-blue-100 p-1.5 rounded-xl">
                                        <CalendarIcon className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <CardTitle className="text-base font-black text-slate-800">
                                        {format(selectedMonth, 'MMMM yyyy', { locale: id })}
                                    </CardTitle>
                                </div>
                                <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-sm">
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="h-7 w-7 rounded-lg">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(new Date())} className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-lg px-2">
                                        Hari Ini
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="h-7 w-7 rounded-lg">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="grid grid-cols-7 mb-3">
                                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                                        <div key={day} className="text-center py-1 text-[9px] font-black text-slate-400 uppercase tracking-wider">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {(() => {
                                        const monthStart = startOfMonth(selectedMonth);
                                        const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });
                                        return days.map((day, idx) => {
                                            const isCurrentMonth = isSameMonth(day, monthStart);
                                            const isSelected = isSameDay(day, selectedDay);
                                            const isToday = isSameDay(day, new Date());
                                            const dailyAgendas = agendas.filter(a => isSameDay(parseISO(a.start_time), day));
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => isCurrentMonth && setSelectedDay(day)}
                                                    className={cn(
                                                        "aspect-square flex flex-col items-center justify-center rounded-2xl text-sm transition-all relative cursor-pointer",
                                                        !isCurrentMonth ? "opacity-10 pointer-events-none" : "hover:bg-blue-50",
                                                        isSelected ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 z-10" : "text-slate-700",
                                                        isToday && !isSelected && "bg-white border-2 border-blue-300 text-blue-600"
                                                    )}
                                                >
                                                    <span className="font-bold text-xs">{format(day, 'd')}</span>
                                                    {dailyAgendas.length > 0 && isCurrentMonth && (
                                                        <div className="mt-0.5 flex gap-0.5 justify-center">
                                                            {dailyAgendas.slice(0, 3).map((_, i) => (
                                                                <div key={i} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-blue-500")} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Selected Day Agenda List */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xl shadow-slate-200/40">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-600" />
                                        {format(selectedDay, 'EEEE, d MMM', { locale: id })}
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Agenda Hari Ini</p>
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 border-none px-3 font-black text-xs h-7 rounded-lg">
                                    {agendasForSelectedDay.length}
                                </Badge>
                            </div>

                            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                                {agendasForSelectedDay.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="bg-slate-50 p-4 rounded-3xl mb-3">
                                            <HelpCircle className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tidak ada agenda</p>
                                        <p className="text-[10px] text-slate-300 mt-1">Pilih tanggal lain atau buat agenda baru</p>
                                    </div>
                                ) : (
                                    agendasForSelectedDay.map(agenda => (
                                        <div key={agenda.id} className="group px-3 py-3 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all relative overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />
                                            <div className="pl-3">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h4 className="font-bold text-slate-800 text-sm leading-tight flex-1">{agenda.title}</h4>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <div className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                            {format(parseISO(agenda.start_time), 'HH:mm')}
                                                        </div>
                                                        {canManage && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-slate-300 hover:text-slate-600">
                                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="rounded-xl shadow-xl">
                                                                    <DropdownMenuItem onClick={() => handleOpenEdit(agenda)} className="text-xs font-bold"><Edit className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleOpenDelete(agenda)} className="text-xs font-bold text-red-500"><Trash2 className="mr-2 h-3.5 w-3.5" />Hapus</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-medium mt-1.5">
                                                    {agenda.location && (
                                                        <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" /><span>{agenda.location}</span></div>
                                                    )}
                                                    {agenda.meeting_link && (
                                                        <div className="flex items-center gap-1"><Video className="h-3 w-3 text-blue-500" /><a href={agenda.meeting_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meeting</a></div>
                                                    )}
                                                    <div className="flex items-center gap-1"><Users className="h-3 w-3 text-slate-400" /><span>{agenda.participants?.length || 0} peserta</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dialogs (outside of header, at root level) */}
                {sharedDialog}
                {sharedDeleteDialog}
            </DashboardLayout>
        );
    }

    // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-4 px-4 py-4">
                {/* Desktop Header */}
                <div className="flex items-end justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-start gap-5">
                        <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <CalendarIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Agenda & Kegiatan</h1>
                            <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none px-3 font-bold text-[10px] uppercase tracking-wider">
                                    {format(selectedMonth, 'MMMM yyyy', { locale: id })}
                                </Badge>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{agendas.length} Total Agenda</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {canManage && (
                            <Button
                                onClick={handleOpenCreate}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 font-black rounded-xl h-11 px-6 gap-2 transition-all active:scale-95"
                            >
                                <Plus className="h-5 w-5" />
                                BUAT AGENDA
                            </Button>
                        )}
                        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="h-9 w-9 rounded-lg hover:bg-slate-50">
                                <ChevronLeft className="h-5 w-5 text-slate-400" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(new Date())} className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 hover:bg-blue-50 rounded-lg px-4 h-9">
                                HARI INI
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="h-9 w-9 rounded-lg hover:bg-slate-50">
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-4 items-start">
                    {/* Calendar (8 cols) */}
                    <div className="lg:col-span-8 space-y-6">
                        <SpanningCalendar
                            currentDate={selectedMonth}
                            agendas={agendas}
                            holidays={publicHolidays}
                            onSelectDay={setSelectedDay}
                            onSelectEvent={(e) => { if (e.type === 'agenda') handleOpenEdit(e.raw); }}
                            selectedDay={selectedDay}
                        />

                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <Card className="border-none shadow-xl shadow-slate-200/40 rounded-2xl bg-white ring-1 ring-slate-100 p-4 flex items-center gap-3 hover:shadow-2xl transition-all">
                                <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Mendatang</p>
                                    <p className="text-lg font-black text-slate-900">{agendas.filter(a => new Date(a.start_time) > new Date()).length} <span className="text-[9px] text-slate-400 font-bold uppercase">Acara</span></p>
                                </div>
                            </Card>
                            <Card className="border-none shadow-xl shadow-slate-200/40 rounded-2xl bg-white ring-1 ring-slate-100 p-4 flex items-center gap-3 hover:shadow-2xl transition-all">
                                <div className="h-10 w-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shadow-sm">
                                    <Target className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Bulan Ini</p>
                                    <p className="text-lg font-black text-slate-900">{agendas.filter(a => isSameMonth(new Date(a.start_time), new Date())).length} <span className="text-[9px] text-slate-400 font-bold uppercase">Agenda</span></p>
                                </div>
                            </Card>
                            <Card className="border-none shadow-xl shadow-slate-200/40 rounded-2xl bg-white ring-1 ring-slate-100 p-4 flex items-center gap-3 hover:shadow-2xl transition-all">
                                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Total Staf</p>
                                    <p className="text-lg font-black text-slate-900">{employees.length}</p>
                                </div>
                            </Card>
                        </div>
                    </div>

                    {/* Right Panel (4 cols) */}
                    <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
                        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[28px] overflow-hidden bg-white ring-1 ring-slate-100">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="h-9 w-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                        <TrendingUp className="h-4 w-4" />
                                    </div>
                                    <Badge className="bg-blue-600 text-white border-none px-3 h-7 rounded-full font-black text-[9px] tracking-widest shadow-lg shadow-blue-200">
                                        {agendasForSelectedDay.length} AGENDA
                                    </Badge>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-0.5">
                                    {format(selectedDay, 'EEEE', { locale: id })}
                                </h3>
                                <p className="text-xs font-bold text-slate-500">
                                    {format(selectedDay, 'd MMMM yyyy', { locale: id })}
                                </p>
                            </CardHeader>
                            <CardContent className="p-5 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                                {agendasForSelectedDay.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                                        <div className="h-16 w-16 bg-slate-50 rounded-[24px] flex items-center justify-center mb-4">
                                            <HelpCircle className="h-8 w-8 text-slate-200" />
                                        </div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Tidak Ada Jadwal</p>
                                    </div>
                                ) : (
                                    agendasForSelectedDay.map(agenda => (
                                        <div key={agenda.id} className="group p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 relative">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="h-7 px-2.5 rounded-lg bg-white border border-slate-200 text-blue-700 font-black text-[10px] flex items-center justify-center shadow-sm">
                                                    {format(parseISO(agenda.start_time), 'HH:mm')}
                                                </div>
                                                {canManage && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-300 hover:text-slate-600 transition-colors">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-2xl shadow-2xl border-none p-2">
                                                            <DropdownMenuItem onClick={() => handleOpenEdit(agenda)} className="rounded-xl font-bold text-xs gap-3 p-3">
                                                                <Edit className="h-4 w-4 text-blue-500" /> Edit Agenda
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDelete(agenda)} className="rounded-xl font-bold text-xs gap-3 p-3 text-red-500">
                                                                <Trash2 className="h-4 w-4 text-red-500" /> Hapus Agenda
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                            <h4 className="font-black text-slate-900 text-sm leading-snug mb-3 group-hover:text-blue-600 transition-colors">{agenda.title}</h4>
                                            <div className="space-y-2">
                                                {agenda.location && (
                                                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                                                        <div className="h-5 w-5 bg-white rounded-lg flex items-center justify-center shadow-sm"><MapPin className="h-3 w-3 text-slate-400" /></div>
                                                        {agenda.location}
                                                    </div>
                                                )}
                                                {agenda.meeting_link && (
                                                    <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600">
                                                        <div className="h-5 w-5 bg-blue-50 rounded-lg flex items-center justify-center shadow-sm"><Video className="h-3 w-3 text-blue-500" /></div>
                                                        <a href={agenda.meeting_link} target="_blank" rel="noopener noreferrer" className="hover:underline">JOIN MEETING →</a>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                                                    <div className="flex -space-x-1.5">
                                                        {agenda.participants?.slice(0, 4).map((p: any, i: number) => {
                                                            const emp = employees.find(e => e.id === p.user_id);
                                                            return (
                                                                <Avatar key={i} className="h-6 w-6 border-2 border-white shadow-sm">
                                                                    <AvatarImage src={emp?.avatar_url || ''} />
                                                                    <AvatarFallback className="text-[8px] font-black bg-slate-100 text-slate-500">{emp?.full_name?.[0] || '?'}</AvatarFallback>
                                                                </Avatar>
                                                            );
                                                        })}
                                                        {(agenda.participants?.length || 0) > 4 && (
                                                            <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white text-[8px] font-black text-slate-400 flex items-center justify-center">
                                                                +{agenda.participants!.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{agenda.participants?.length || 0} Peserta</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Tip card */}
                        <div className="bg-slate-900 rounded-[28px] p-5 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                            <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/20 rounded-full -mr-14 -mt-14 blur-2xl" />
                            <div className="flex items-start gap-3 relative z-10">
                                <div className="h-9 w-9 bg-white/10 rounded-xl flex items-center justify-center">
                                    <HelpCircle className="h-4 w-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-blue-400">Tips Navigasi</p>
                                    <p className="text-[10px] text-slate-300 font-bold leading-relaxed mt-1">Klik tanggal di kalender untuk melihat agenda pada hari tersebut.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dialogs */}
                {sharedDialog}
                {sharedDeleteDialog}
            </div>
        </DashboardLayout>
    );
}
