import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Plus,
    Camera,
    Trash2,
    DollarSign,
    CreditCard,
    Zap,
    Wallet,
    Fuel,
    Receipt
} from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface Expense {
    id: string;
    category: 'fuel' | 'toll' | 'topup' | 'emoney_balance' | 'misc';
    amount: number;
    description: string | null;
    receipt_url: string | null;
    emoney_balance: number | null;
    expense_time: string;
    has_receipt: boolean;
}

export default function DriverReceipts() {
    const { user, roles } = useAuth();
    const { toast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = roles.includes('super_admin') || roles.includes('admin_hr');

    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [savingExpense, setSavingExpense] = useState(false);
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [expenseForm, setExpenseForm] = useState({
        category: 'fuel' as Expense['category'],
        amount: '',
        description: '',
        emoney_balance: '',
        has_receipt: true,
        expense_time: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });

    useEffect(() => {
        if (user?.id) {
            fetchExpenses();
        }
    }, [user?.id]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('driver_expenses')
                .select('*, driver:driver_id(full_name)')
                .order('expense_time', { ascending: false })
                .limit(100);

            if (!isAdmin) {
                query = query.eq('driver_id', user?.id);
            }

            const { data, error } = await query;

            if (error) throw error;
            setExpenses(data || []);
        } catch (error: any) {
            toast({
                title: 'Error memuat data',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const compressImage = (file: File, maxWidth = 1024, quality = 0.72): Promise<File> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) { resolve(file); return; }
                            const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
                            resolve(compressed);
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.files?.[0];
        if (!raw) return;

        setReceiptPreview(URL.createObjectURL(raw));

        const compressed = await compressImage(raw);
        setReceiptFile(compressed);
        setExpenseForm(prev => ({ ...prev, has_receipt: true }));

        const kb = Math.round(compressed.size / 1024);
        const origKb = Math.round(raw.size / 1024);
        if (origKb > kb + 10) {
            toast({ title: `📸 Foto terkompresi`, description: `${origKb} KB → ${kb} KB` });
        }
    };

    const uploadReceiptToStorage = async (file: File): Promise<string | null> => {
        setUploadingReceipt(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `${user?.id}/general/${Date.now()}.${ext}`;
            const { error } = await supabase.storage
                .from('driver-receipts')
                .upload(path, file, { upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage
                .from('driver-receipts')
                .getPublicUrl(path);
            return publicUrl;
        } catch (err: any) {
            toast({ title: 'Gagal upload foto', description: err.message, variant: 'destructive' });
            return null;
        } finally {
            setUploadingReceipt(false);
        }
    };

    const handleAddExpense = async () => {
        if (!expenseForm.amount && expenseForm.category !== 'emoney_balance') {
            toast({ title: "Data tidak lengkap", description: "Isi nominal pengeluaran", variant: "destructive" });
            return;
        }

        setSavingExpense(true);
        try {
            let receipt_url: string | null = null;
            if (receiptFile) {
                receipt_url = await uploadReceiptToStorage(receiptFile);
            }

            const { error } = await supabase
                .from('driver_expenses')
                .insert({
                    driver_id: user?.id,
                    trip_id: null, // Removed active trip requirement
                    category: expenseForm.category,
                    amount: parseFloat(expenseForm.amount) || 0,
                    description: expenseForm.description,
                    emoney_balance: parseFloat(expenseForm.emoney_balance) || null,
                    has_receipt: expenseForm.has_receipt,
                    receipt_url,
                    expense_time: new Date(expenseForm.expense_time).toISOString(),
                });

            if (error) throw error;

            toast({ title: "Pengeluaran Tercatat", description: receipt_url ? "Termasuk foto nota ✅" : "Data tersimpan" });
            setIsExpenseModalOpen(false);
            setReceiptFile(null);
            setReceiptPreview(null);
            setExpenseForm({
                category: 'fuel',
                amount: '',
                description: '',
                emoney_balance: '',
                has_receipt: true,
                expense_time: format(new Date(), "yyyy-MM-dd'T'HH:mm")
            });
            fetchExpenses();
        } catch (error: any) {
            toast({ title: "Gagal mencatat", description: error.message, variant: "destructive" });
        } finally {
            setSavingExpense(false);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        try {
            const { error } = await supabase.from('driver_expenses').delete().eq('id', id);
            if (error) throw error;
            fetchExpenses();
            toast({ title: "Data dihapus" });
        } catch (error: any) {
            toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-md mx-auto space-y-6 pb-20">
                <div className="flex items-center gap-3 px-4 pt-4">
                    <div className="h-12 w-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <Receipt className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 leading-tight">Nota & Biaya</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Catat Pengeluaran Jalan</p>
                    </div>
                </div>

                <div className="px-4">
                    <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100">
                        <CardHeader className="p-6 pb-2">
                            <CardTitle className="text-lg font-black text-slate-900 flex items-center justify-between">
                                <span>Daftar Pengeluaran</span>
                                <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs h-9">
                                            <Plus className="h-4 w-4 mr-1" /> CATAT BIAYA
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-[calc(100vw-32px)] w-[400px] rounded-[32px] p-6 border-none shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-black text-slate-900">Catat Pengeluaran</DialogTitle>
                                            <DialogDescription className="text-slate-500 font-medium">Input nota & biaya operasional.</DialogDescription>
                                        </DialogHeader>

                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-black uppercase text-slate-400">Kategori</Label>
                                                <Select
                                                    value={expenseForm.category}
                                                    onValueChange={(val: any) => setExpenseForm({ ...expenseForm, category: val })}
                                                >
                                                    <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50 font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                                        <SelectItem value="fuel" className="font-bold">⛽ Nota Bensin</SelectItem>
                                                        <SelectItem value="toll" className="font-bold">🛣️ Nota Tol</SelectItem>
                                                        <SelectItem value="topup" className="font-bold">💳 Top Up E-Money</SelectItem>
                                                        <SelectItem value="emoney_balance" className="font-bold">📊 Saldo E-Money Akhir</SelectItem>
                                                        <SelectItem value="misc" className="font-bold">🛠️ Lain-lain</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {expenseForm.category !== 'emoney_balance' && (
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-black uppercase text-slate-400">Nominal (Rp)</Label>
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            className="pl-9 h-12 rounded-xl border-slate-100 bg-slate-50 font-black"
                                                            value={expenseForm.amount}
                                                            onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {(expenseForm.category === 'emoney_balance' || expenseForm.category === 'topup' || expenseForm.category === 'toll') && (
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-black uppercase text-slate-400">Saldo E-Money (Rp)</Label>
                                                    <div className="relative">
                                                        <Wallet className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                                        <Input
                                                            type="number"
                                                            placeholder="Sisa saldo..."
                                                            className="pl-9 h-12 rounded-xl border-slate-100 bg-slate-50 font-black"
                                                            value={expenseForm.emoney_balance}
                                                            onChange={e => setExpenseForm({ ...expenseForm, emoney_balance: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <Label className="text-xs font-black uppercase text-slate-400">Waktu Pengeluaran</Label>
                                                <Input
                                                    type="datetime-local"
                                                    className="h-12 rounded-xl border-slate-100 bg-slate-50 font-bold"
                                                    value={expenseForm.expense_time}
                                                    onChange={e => setExpenseForm({ ...expenseForm, expense_time: e.target.value })}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-black uppercase text-slate-400">Keterangan / Deskripsi</Label>
                                                <Textarea
                                                    placeholder="Opsional..."
                                                    className="rounded-xl border-slate-100 bg-slate-50 font-medium resize-none min-h-[80px]"
                                                    value={expenseForm.description}
                                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> Foto Nota</Label>
                                                <label className={cn(
                                                    "flex items-center gap-3 h-14 rounded-xl border-2 cursor-pointer transition-all px-4",
                                                    receiptPreview ? "border-green-400 bg-green-50" : "border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100"
                                                )}>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        className="hidden"
                                                        onChange={handleReceiptChange}
                                                    />
                                                    {receiptPreview ? (
                                                        <>
                                                            <img src={receiptPreview} className="h-9 w-9 rounded-lg object-cover border border-green-200" />
                                                            <div className="flex-1">
                                                                <p className="text-xs font-black text-green-700">Foto terpilih ✓</p>
                                                                <p className="text-[10px] text-green-500">Tap untuk ganti foto</p>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="h-9 w-9 rounded-lg bg-slate-200 flex items-center justify-center">
                                                                <Camera className="h-4 w-4 text-slate-400" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-xs font-black text-slate-600">Foto / Upload Nota</p>
                                                                <p className="text-[10px] text-slate-400">Opsional — jpg, png, webp</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </label>
                                                {!receiptPreview && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpenseForm(p => ({ ...p, has_receipt: !p.has_receipt }))}
                                                        className={cn(
                                                            "text-[10px] font-bold transition-all",
                                                            expenseForm.has_receipt ? "text-amber-600" : "text-slate-400"
                                                        )}
                                                    >
                                                        {expenseForm.has_receipt ? "✓ Ada nota fisik (tanpa foto)" : "Tidak ada nota"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button variant="ghost" className="rounded-xl" onClick={() => setIsExpenseModalOpen(false)}>Batal</Button>
                                            <Button
                                                className="rounded-xl bg-blue-600 hover:bg-blue-700 font-black"
                                                onClick={handleAddExpense}
                                                disabled={savingExpense || uploadingReceipt}
                                            >
                                                Simpan Biaya
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 pt-2">
                            <div className="space-y-3">
                                {loading ? (
                                    <div className="text-center text-sm py-4 text-slate-400 font-bold">Memuat data...</div>
                                ) : expenses.length > 0 ? (
                                    expenses.map(exp => (
                                        <div key={exp.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                                                    {exp.category === 'fuel' && <Fuel className="h-5 w-5 text-orange-500" />}
                                                    {exp.category === 'toll' && <Zap className="h-5 w-5 text-amber-500" />}
                                                    {exp.category === 'topup' && <CreditCard className="h-5 w-5 text-emerald-500" />}
                                                    {exp.category === 'emoney_balance' && <Wallet className="h-5 w-5 text-blue-500" />}
                                                    {exp.category === 'misc' && <Plus className="h-5 w-5 text-purple-500" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black text-slate-800 truncate">
                                                            {exp.category === 'fuel' ? 'Bensin' :
                                                                exp.category === 'toll' ? 'Tol' :
                                                                    exp.category === 'topup' ? 'Topup' :
                                                                        exp.category === 'emoney_balance' ? 'Saldo E-Money' : 'Lain-lain'}
                                                        </p>
                                                        {exp.receipt_url && (
                                                            <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer"
                                                                className="shrink-0 flex items-center justify-center border border-slate-200 rounded-md p-0.5 hover:border-blue-400 bg-white shadow-sm">
                                                                <img src={exp.receipt_url} className="h-5 w-5 rounded object-cover" alt="Nota" />
                                                            </a>
                                                        )}
                                                        {!exp.has_receipt && !exp.receipt_url && (
                                                            <Badge className="h-3.5 text-[8px] bg-amber-100 text-amber-700 border-none py-0 px-1 opacity-80">NO NOTA</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500 tabular-nums uppercase mt-0.5">
                                                        {isAdmin && (exp as any).driver?.full_name && (
                                                            <span className="text-blue-600 font-black mr-2">{(exp as any).driver?.full_name}</span>
                                                        )}
                                                        {format(new Date(exp.expense_time), 'd MMM, HH:mm')}
                                                        {exp.amount > 0 ? ` • Rp ${exp.amount.toLocaleString()}` : ''}
                                                        {exp.emoney_balance ? ` (Saldo: ${exp.emoney_balance.toLocaleString()})` : ''}
                                                    </p>
                                                    {exp.description && (
                                                        <p className="text-[10px] text-slate-400 mt-1 italic">{exp.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {(!isAdmin || (exp as any).driver_id === user?.id) && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Yakin ingin menghapus catatan ini?')) {
                                                            handleDeleteExpense(exp.id);
                                                        }
                                                    }}
                                                    className="p-2 opacity-50 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-8 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                                        <p className="text-xs font-bold text-slate-400">Belum ada pengeluaran tercatat</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
