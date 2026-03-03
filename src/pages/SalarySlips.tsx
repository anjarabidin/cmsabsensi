import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    ChevronLeft,
    FileText,
    Download,
    Loader2,
    Wallet,
    Calendar,
    ArrowDownToLine,
    Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type SalarySlip = {
    id: string;
    user_id: string;
    month: number;
    year: number;
    file_path: string;
    file_name: string;
    status: string;
    created_at: string;
};

export default function SalarySlipsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [loading, setLoading] = useState(true);
    const [slips, setSlips] = useState<SalarySlip[]>([]);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>('all');

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    // Generate years from 2024 up to current year
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

    useEffect(() => {
        if (user?.id) fetchSlips();
    }, [user?.id]);

    const fetchSlips = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('salary_slips')
                .select('*')
                .eq('user_id', user?.id)
                .eq('status', 'published')
                .order('year', { ascending: false })
                .order('month', { ascending: false });
            if (error) throw error;
            setSlips(data || []);
        } catch {
            toast({ title: 'Error', description: 'Gagal memuat daftar slip gaji', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (slip: SalarySlip) => {
        try {
            setDownloading(slip.id);
            const { data, error } = await supabase.storage
                .from('salary-slips')
                .createSignedUrl(slip.file_path, 60);
            if (error) throw error;
            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
        } catch {
            toast({ title: 'Gagal mengunduh', description: 'Tautan unduhan tidak dapat dibuat', variant: 'destructive' });
        } finally {
            setDownloading(null);
        }
    };

    const filteredSlips = slips.filter(slip => {
        const matchMonth = selectedMonth === 'all' || slip.month.toString() === selectedMonth;
        const matchYear = selectedYear === 'all' || slip.year.toString() === selectedYear;
        return matchMonth && matchYear;
    });

    // ─── MOBILE VIEW ───────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50 pb-24">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white pb-8 pt-[calc(1rem+env(safe-area-inset-top))] px-4 rounded-b-[32px] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 -ml-2 h-8 w-8 rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-lg font-black">Riwayat Slip Gaji</h1>
                                <p className="text-[11px] text-emerald-100 font-medium">{filteredSlips.length} slip tersedia</p>
                            </div>
                        </div>

                        {/* Mobile Filters */}
                        <div className="flex gap-2">
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="h-9 flex-1 bg-white/10 border-white/20 text-white rounded-xl text-xs font-bold ring-offset-emerald-600 focus:ring-white/30 truncate">
                                    <SelectValue placeholder="Bulan" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    <SelectItem value="all" className="font-bold">Semua Bulan</SelectItem>
                                    {months.map((m, i) => (
                                        <SelectItem key={i + 1} value={(i + 1).toString()} className="font-bold">{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="h-9 w-28 bg-white/10 border-white/20 text-white rounded-xl text-xs font-bold ring-offset-emerald-600 focus:ring-white/30">
                                    <SelectValue placeholder="Tahun" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    <SelectItem value="all" className="font-bold">Semua</SelectItem>
                                    {years.map(y => (
                                        <SelectItem key={y} value={y.toString()} className="font-bold">{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 -mt-3 relative z-10 space-y-3">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl h-20 animate-pulse shadow-sm" />
                            ))
                        ) : slips.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                    <Wallet className="h-8 w-8 text-slate-300" />
                                </div>
                                <h3 className="font-bold text-slate-700">Belum Ada Slip Gaji</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                                    Slip gaji akan diterbitkan oleh HR setiap akhir bulan.
                                </p>
                            </div>
                        ) : filteredSlips.length === 0 ? (
                            <div className="py-12 text-center bg-white rounded-[32px] border border-dashed border-slate-200">
                                <Filter className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-slate-400 font-bold text-sm">Filter tidak menemukan hasil.</p>
                            </div>
                        ) : (
                            filteredSlips.map(slip => (
                                <div key={slip.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm ring-1 ring-slate-100 flex items-center gap-3 active:scale-[0.98] transition-transform">
                                    <div className="h-12 w-12 rounded-xl bg-emerald-50 flex flex-col items-center justify-center shrink-0 border border-emerald-100">
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider leading-none">
                                            {format(new Date(slip.year, slip.month - 1), 'MMM', { locale: id })}
                                        </span>
                                        <span className="text-sm font-black text-emerald-700 leading-tight">{slip.year}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm">
                                            {format(new Date(slip.year, slip.month - 1), 'MMMM yyyy', { locale: id })}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            Diterbitkan {format(new Date(slip.created_at), 'd MMM yyyy', { locale: id })}
                                        </p>
                                    </div>
                                    <Button
                                        size="icon"
                                        className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm"
                                        onClick={() => handleDownload(slip)}
                                        disabled={downloading === slip.id}
                                    >
                                        {downloading === slip.id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Download className="h-4 w-4" />
                                        }
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // ─── DESKTOP VIEW ──────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto p-8 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                            <FileText className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Riwayat Slip Gaji</h1>
                            <p className="text-sm text-slate-500 font-medium">Filter dan unduh arsip gaji Anda</p>
                        </div>
                    </div>

                    {/* Filters Desktop */}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm ring-1 ring-slate-100">
                        <div className="pl-3 py-1 flex items-center gap-2 border-r border-slate-100 pr-3">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <span className="text-xs font-black uppercase text-slate-400 tracking-widest hidden sm:inline">Filter</span>
                        </div>

                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="h-10 w-[140px] border-none bg-slate-50 rounded-xl font-bold text-slate-700 hover:bg-slate-100 focus:ring-slate-200">
                                <SelectValue placeholder="Bulan" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl border border-slate-100">
                                <SelectItem value="all" className="font-bold cursor-pointer">Semua Bulan</SelectItem>
                                {months.map((m, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()} className="font-bold cursor-pointer">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="h-10 w-[120px] border-none bg-slate-50 rounded-xl font-bold text-slate-700 hover:bg-slate-100 focus:ring-slate-200">
                                <SelectValue placeholder="Tahun" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl border border-slate-100">
                                <SelectItem value="all" className="font-bold cursor-pointer">Semua Tahun</SelectItem>
                                {years.map(y => (
                                    <SelectItem key={y} value={y.toString()} className="font-bold cursor-pointer">{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="ml-auto pr-2">
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-3 py-1.5 whitespace-nowrap hidden sm:flex">
                                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                                {filteredSlips.length} Slip Tersedia
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Content Card */}
                <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-[32px] overflow-hidden">
                    {loading ? (
                        <CardContent className="p-0">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-6 px-8 py-5 border-b border-slate-50 last:border-0">
                                    <div className="h-12 w-12 bg-slate-100 rounded-xl animate-pulse" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-100 rounded-lg w-40 animate-pulse" />
                                        <div className="h-3 bg-slate-100 rounded-lg w-24 animate-pulse" />
                                    </div>
                                    <div className="h-9 w-28 bg-slate-100 rounded-xl animate-pulse" />
                                </div>
                            ))}
                        </CardContent>
                    ) : slips.length === 0 ? (
                        <CardContent className="p-16 flex flex-col items-center text-center">
                            <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-5">
                                <Wallet className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Belum Ada Slip Gaji</h3>
                            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                                Slip gaji Anda akan muncul di sini setelah diterbitkan oleh admin HR pada setiap akhir bulan.
                            </p>
                        </CardContent>
                    ) : filteredSlips.length === 0 ? (
                        <CardContent className="p-16 flex flex-col items-center text-center">
                            <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-5 border border-dashed border-slate-200">
                                <Filter className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Pencarian Tidak Ditemukan</h3>
                            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                                Tidak ada riwayat slip gaji yang sesuai dengan kriteria filter bulan atau tahun yang Anda pilih.
                            </p>
                        </CardContent>
                    ) : (
                        <CardContent className="p-0">
                            {/* Table-like list */}
                            <div className="px-8 py-4 border-b border-slate-50 grid grid-cols-[auto_1fr_auto] gap-6 items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 w-14 text-center">Bulan</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Keterangan Riwayat</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Aksi Lanjutan</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {filteredSlips.map((slip, idx) => (
                                    <div key={slip.id} className="px-8 py-5 grid grid-cols-[auto_1fr_auto] gap-6 items-center group hover:bg-slate-50/50 transition-colors">
                                        {/* Month icon */}
                                        <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col items-center justify-center text-center group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all duration-300">
                                            <span className="text-[9px] font-black uppercase tracking-wider leading-none opacity-70">
                                                {format(new Date(slip.year, slip.month - 1), 'MMM', { locale: id })}
                                            </span>
                                            <span className="text-sm font-black leading-tight">
                                                {slip.year}
                                            </span>
                                        </div>
                                        {/* Info */}
                                        <div>
                                            <p className="font-bold text-slate-900">
                                                Slip Gaji {format(new Date(slip.year, slip.month - 1), 'MMMM yyyy', { locale: id })}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[9px] font-bold h-4 px-1.5 border-slate-200 text-slate-400">PDF</Badge>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    diterbitkan {format(new Date(slip.created_at), 'd MMMM yyyy', { locale: id })}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Download */}
                                        <Button
                                            className="h-10 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold gap-2 transition-all px-5"
                                            onClick={() => handleDownload(slip)}
                                            disabled={downloading === slip.id}
                                        >
                                            {downloading === slip.id
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <><ArrowDownToLine className="h-4 w-4" /> Unduh</>
                                            }
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
}
