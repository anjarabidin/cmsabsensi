import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent
} from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Edit, Trash2, Building2, Briefcase, Database, Search } from 'lucide-react';
import { Department, JobPosition } from '@/types';

interface MasterDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    tab?: 'departments' | 'positions';
    onTabChange?: (tab: 'departments' | 'positions') => void;
    userRole?: string; // Add role to control permissions
}

export function MasterDataDialog({ open, onOpenChange, onSuccess, tab: controlledTab, onTabChange, userRole }: MasterDataDialogProps) {
    const { toast } = useToast();
    const [internalTab, setInternalTab] = useState<'departments' | 'positions'>('departments');
    const tab = controlledTab ?? internalTab;

    const setTab = (v: 'departments' | 'positions') => {
        if (onTabChange) onTabChange(v);
        setInternalTab(v);
    };

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [positions, setPositions] = useState<JobPosition[]>([]);

    // Form State
    const [formData, setFormData] = useState({ name: '', title: '', description: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (open) {
            fetchData();
        } else {
            // Reset form when closed
            resetForm();
        }
    }, [open]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [deptRes, posRes] = await Promise.all([
                supabase.from('departments').select('*').order('name'),
                supabase.from('job_positions').select('*').order('title')
            ]);

            if (deptRes.error) throw deptRes.error;
            if (posRes.error) throw posRes.error;

            setDepartments(deptRes.data || []);
            setPositions((posRes.data as any) || []);
        } catch (error: any) {
            console.error('Error fetching master data:', error);
            toast({
                title: "Gagal memuat data",
                description: "Terjadi kesalahan koneksi.",
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', title: '', description: '' });
        setEditingId(null);
        setSearchTerm('');
    };

    const handleSave = async () => {
        if (tab === 'departments' && !formData.name) return;
        if (tab === 'positions' && !formData.title) return;

        setIsSaving(true);
        try {
            if (tab === 'departments') {
                const payload = {
                    name: formData.name,
                    description: formData.description
                };

                if (editingId) {
                    const { error } = await supabase.from('departments').update(payload).eq('id', editingId);
                    if (error) throw error;
                    toast({ title: "Berhasil", description: "Departemen diperbarui" });
                } else {
                    const { error } = await supabase.from('departments').insert([payload]);
                    if (error) throw error;
                    toast({ title: "Berhasil", description: "Departemen ditambahkan" });
                }
            } else {
                // Job Positions
                // We need a department to associate with if creating new. 
                // For simplicity in this improved UI, let's auto-assign to 'General' if not specified, 
                // Or since the simplified UI doesn't ask for department, we might need to handle it.
                // The original UI didn't ask for department_id either? Let's check. 
                // Wait, the original code DID NOT ask for department_id in the master popup. 
                // It likely let the DB default or fail? 
                // DB constraint: department_id REFERENCES departments. It's likely required.
                // But my migration lines 89+ in 024 insert with department_id.
                // The user code in Employees.tsx lines 191-204 did NOT provide department_id on insert.
                // This means existing inserts probably FAILED unless there's a default.

                // I should fetch the 'General' department ID to use as default.
                const generalDept = departments.find(d => d.name === 'General') || departments[0];
                const deptId = generalDept?.id;

                if (!deptId) throw new Error("Tidak ada departemen tersedia untuk referensi.");

                const payload = {
                    title: formData.title,
                    description: formData.description,
                    department_id: deptId, // Default link
                    // New positions default to non-leadership and some grade
                    is_leadership: false
                };

                // If updating, we don't need to touch department_id unless we want to allow changing it.
                // But we are only editing title/desc here.

                if (editingId) {
                    const { error } = await supabase.from('job_positions').update({
                        title: formData.title,
                        description: formData.description
                    }).eq('id', editingId);
                    if (error) throw error;
                    toast({ title: "Berhasil", description: "Jabatan diperbarui" });
                } else {
                    // For insert we need required fields.
                    // Let's assume we use the first found grade or NULL if allowed.
                    // Schema says grade_id references list, likely nullable? 
                    // My migration 071 inserted without grade_id (lines 35+). 
                    // So grade_id is nullable.
                    const { error } = await supabase.from('job_positions').insert([payload]);
                    if (error) throw error;
                    toast({ title: "Berhasil", description: "Jabatan ditambahkan" });
                }
            }

            resetForm();
            fetchData();
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, type: 'departments' | 'positions') => {
        if (!confirm('Hapus data ini?')) return;
        try {
            const table = type === 'departments' ? 'departments' : 'job_positions';
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Terhapus", description: "Data berhasil dihapus" });
            fetchData();
            if (onSuccess) onSuccess();
        } catch (error: any) {
            toast({
                title: "Tidak dapat menghapus",
                description: "Data mungkin sedang digunakan oleh karyawan.",
                variant: "destructive"
            });
        }
    };

    const handleEdit = (item: any, type: 'departments' | 'positions') => {
        setEditingId(item.id);
        setFormData({
            name: type === 'departments' ? item.name : '',
            title: type === 'positions' ? item.title : '',
            description: item.description || ''
        });
    };

    const filteredData = (tab === 'departments' ? departments : positions).filter((item: any) => {
        const text = (item.name || item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return text.includes(searchTerm.toLowerCase()) || desc.includes(searchTerm.toLowerCase());
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl p-0 overflow-hidden rounded-[24px] border-none shadow-2xl bg-white max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Database className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">Data Master</DialogTitle>
                            <DialogDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Departemen & Jabatan
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <Tabs value={tab} onValueChange={(v: any) => { setTab(v); resetForm(); }} className="w-full h-full flex flex-col">
                        <div className="px-6 pt-4 pb-0 shrink-0">
                            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl h-11">
                                <TabsTrigger value="departments" className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
                                    <Building2 className="mr-2 h-3.5 w-3.5" /> Departemen
                                </TabsTrigger>
                                <TabsTrigger value="positions" className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
                                    <Briefcase className="mr-2 h-3.5 w-3.5" /> Jabatan
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="p-6 h-full overflow-hidden">
                            <div className="flex flex-col lg:flex-row gap-6 h-full">
                                {/* Left Column: Form Section - Hidden for Managers */}
                                {userRole !== 'manager' && (
                                    <div className="lg:w-1/3 shrink-0 flex flex-col gap-4">
                                        <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-5 space-y-5 h-fit">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                    {editingId ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                                </div>
                                                <h3 className="font-bold text-slate-700 text-sm">
                                                    {editingId ? 'Edit Data' : 'Tambah Baru'}
                                                </h3>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                                        {tab === 'departments' ? 'Nama Departemen' : 'Nama Jabatan'}
                                                    </Label>
                                                    <Input
                                                        placeholder={tab === 'departments' ? "Cth: Human Capital" : "Cth: Senior Staff"}
                                                        value={tab === 'departments' ? formData.name : formData.title}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            [tab === 'departments' ? 'name' : 'title']: e.target.value
                                                        }))}
                                                        className="h-10 rounded-xl border-slate-200 bg-white font-semibold text-sm focus-visible:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Deskripsi</Label>
                                                    <Input
                                                        placeholder={tab === 'departments' ? "Deskripsi departemen..." : "Deskripsi jabatan..."}
                                                        value={formData.description}
                                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                        className="h-10 rounded-xl border-slate-200 bg-white text-sm focus-visible:ring-blue-500"
                                                    />
                                                </div>

                                                <div className="pt-2 flex gap-2">
                                                    <Button
                                                        onClick={handleSave}
                                                        disabled={isSaving || (tab === 'departments' ? !formData.name : !formData.title)}
                                                        className={`h-10 flex-1 rounded-xl px-5 font-bold shadow-md transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                                                    >
                                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                        {editingId ? 'Simpan Perubahan' : 'Tambah Data'}
                                                    </Button>
                                                    {editingId && (
                                                        <Button variant="outline" className="h-10 rounded-xl text-slate-500 hover:text-slate-700 border-slate-200" onClick={resetForm}>
                                                            Batal
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Right Column: List Section */}
                                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                                            Daftar {tab === 'departments' ? 'Departemen' : 'Jabatan'} ({filteredData.length})
                                        </h4>
                                        <div className="relative w-48">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                            <Input
                                                placeholder="Cari data..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="h-8 pl-8 text-xs rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    <ScrollArea className="flex-1 p-4">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center justify-center h-48 space-y-3 text-slate-400">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                <span className="text-xs font-medium">Memuat data...</span>
                                            </div>
                                        ) : filteredData.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-40 space-y-2 text-slate-400 m-1">
                                                {tab === 'departments' ? <Building2 className="h-8 w-8 opacity-20" /> : <Briefcase className="h-8 w-8 opacity-20" />}
                                                <span className="text-xs font-medium opacity-60">
                                                    {searchTerm ? 'Tidak ditemukan' : 'Belum ada data'}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                                                {filteredData.map((item: any) => (
                                                    <div
                                                        key={item.id}
                                                        className={`group flex items-center justify-between p-3 rounded-xl border bg-white hover:shadow-md transition-all duration-300 cursor-default ${editingId === item.id ? 'ring-2 ring-amber-400 border-amber-400 shadow-sm' : 'border-slate-100 hover:border-blue-200'}`}
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${tab === 'departments'
                                                                ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                                                                : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
                                                                }`}>
                                                                {tab === 'departments' ? <Building2 className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                                                            </div>
                                                            <div className="space-y-0.5 overflow-hidden">
                                                                <p className="text-sm font-bold text-slate-800 truncate leading-none">
                                                                    {tab === 'departments' ? item.name : item.title}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 truncate font-medium">
                                                                    {item.description || 'Tidak ada deskripsi'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {userRole !== 'manager' && (
                                                            <div className="flex flex-col gap-1 items-end opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                                                    onClick={() => handleEdit(item, tab)}
                                                                >
                                                                    <Edit className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                                    onClick={() => handleDelete(item.id, tab)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
