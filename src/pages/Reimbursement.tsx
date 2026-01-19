import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, FileText, Image, DollarSign, Calendar, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '@/lib/overtime';

type Reimbursement = {
    id: string;
    claim_date: string;
    type: string;
    amount: number;
    description: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    created_at: string;
    rejection_reason?: string;
    attachment_url?: string;
};

export default function ReimbursementPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        type: '',
        amount: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd')
    });

    useEffect(() => {
        if (user) fetchReimbursements();
    }, [user]);

    const fetchReimbursements = async () => {
        try {
            const { data, error } = await supabase
                .from('reimbursements')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReimbursements(data || []);
        } catch (error) {
            console.error('Error fetching reimbursements:', error);
            toast({ title: 'Gagal', description: 'Gagal memuat data.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!formData.type || !formData.amount || !formData.description) {
            toast({ title: 'Validasi Gagal', description: 'Mohon lengkapi semua field', variant: 'destructive' });
            return;
        }

        setSubmitting(true);
        try {
            let attachmentUrl = null;

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('reimbursements')
                    .upload(fileName, selectedFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('reimbursements')
                    .getPublicUrl(fileName);

                attachmentUrl = publicUrl;
            }

            const { error } = await supabase.from('reimbursements').insert({
                user_id: user?.id,
                type: formData.type,
                amount: Number(formData.amount),
                description: formData.description,
                claim_date: formData.date,
                status: 'pending',
                attachment_url: attachmentUrl
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
                        title: 'Pengajuan Reimbursement Baru',
                        message: `${user?.email} mengajukan klaim ${getTypeLabel(formData.type)} sebesar ${formatCurrency(Number(formData.amount))}`,
                        type: 'reimbursement',
                        link: '/approvals', // Assuming approvals page will handle this eventually
                        is_read: false
                    }));

                    await supabase.from('notifications').insert(notifications);
                }
            } catch (notifError) {
                console.error('Failed to send notification to HR:', notifError);
            }

            toast({ title: 'Berhasil', description: 'Pengajuan reimbursement berhasil dikirim' });
            setDialogOpen(false);
            setFormData({ type: '', amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
            setSelectedFile(null);
            fetchReimbursements();
        } catch (error) {
            console.error('Error creating reimbursement:', error);
            toast({ title: 'Gagal', description: 'Terjadi kesalahan saat menyimpan', variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    // ... existing helpers ...

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                {/* Floating Content */}
                <div className="relative z-10 space-y-6 max-w-[1600px] mx-auto px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-6">

                    {/* Header Section */}
                    <div className="flex items-center justify-between text-white">
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
                                <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Reimbursement</h1>
                                <p className="text-xs text-blue-50 font-medium opacity-90">Ajukan dan pantau klaim pengeluaran operasional.</p>
                            </div>
                        </div>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-white text-blue-600 hover:bg-white/90 shadow-md border-none font-semibold transition-all hover:scale-105 active:scale-95">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Ajukan Klaim
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>Form Pengajuan Klaim</DialogTitle>
                                    <DialogDescription>Isi detail pengeluaran yang ingin diklaim.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Kategori</Label>
                                            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="medical">Kesehatan</SelectItem>
                                                    <SelectItem value="transport">Transportasi</SelectItem>
                                                    <SelectItem value="travel">Dinas Luar</SelectItem>
                                                    <SelectItem value="meal">Konsumsi</SelectItem>
                                                    <SelectItem value="communication">Pulsa/Internet</SelectItem>
                                                    <SelectItem value="other">Lainnya</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tanggal</Label>
                                            <Input
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nominal (Rp)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                className="pl-9"
                                                placeholder="0"
                                                value={formData.amount}
                                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Keterangan</Label>
                                        <Textarea
                                            placeholder="Contoh: Bensin perjalanan ke klien X..."
                                            rows={3}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bukti Foto/Struk (Opsional)</Label>
                                        <div className="border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={handleFileChange}
                                                accept="image/*,application/pdf"
                                            />
                                            <div className="flex justify-center mb-2">
                                                <Image className="h-8 w-8 text-slate-300" />
                                            </div>
                                            {selectedFile ? (
                                                <span className="text-blue-600 font-medium">{selectedFile.name}</span>
                                            ) : (
                                                "Klik untuk upload foto struk"
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setDialogOpen(false)}>Batal</Button>
                                    <Button onClick={handleSubmit} disabled={submitting}>
                                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Kirim Pengajuan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Riwayat Pengajuan</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                            ) : reimbursements.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                                    <div className="p-4 bg-muted rounded-full">
                                        <FileText className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <p className="text-muted-foreground">Belum ada riwayat pengajuan.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                            <TableHead>Nominal</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Bukti</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reimbursements.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                                        {format(new Date(item.claim_date), 'd MMM yyyy', { locale: id })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getTypeLabel(item.type)}</TableCell>
                                                <TableCell className="max-w-[200px] truncate text-muted-foreground" title={item.description}>
                                                    {item.description}
                                                </TableCell>
                                                <TableCell className="font-mono font-medium">
                                                    {formatCurrency(item.amount)}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                <TableCell className="text-right">
                                                    {/* @ts-ignore */}
                                                    {item.attachment_url && (
                                                        <a
                                                            // @ts-ignore
                                                            href={item.attachment_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}

function getTypeLabel(type: string) {
    switch (type) {
        case 'medical': return 'Kesehatan';
        case 'transport': return 'Transportasi';
        case 'travel': return 'Dinas Luar';
        case 'meal': return 'Konsumsi';
        case 'communication': return 'Pulsa/Internet';
        case 'other': return 'Lainnya';
        default: return type;
    }
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'pending': return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">Menunggu</Badge>;
        case 'approved': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Disetujui</Badge>;
        case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Ditolak</Badge>;
        case 'paid': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Dibayarkan</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
    }
}
