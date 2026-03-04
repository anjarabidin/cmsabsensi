import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Calculator,
  ChevronLeft,
  Search,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  User,
  FileText,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type UserProfile = {
  id: string;
  full_name: string;
  employee_id: string;
  avatar_url?: string;
  department?: { name: string };
};

type SalarySlip = {
  id: string;
  user_id: string;
  month: number;
  year: number;
  file_path: string;
  file_name: string;
  status: string;
};

export default function PayrollPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsersAndSlips();
  }, [selectedMonth, selectedYear]);

  const fetchUsersAndSlips = async () => {
    try {
      setLoading(true);
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`id, full_name, employee_id, avatar_url, department:department_id(name)`)
        .order('full_name');
      if (usersError) throw usersError;
      setUsers(usersData as any);

      const { data: slipsData, error: slipsError } = await supabase
        .from('salary_slips')
        .select('*')
        .eq('month', parseInt(selectedMonth) + 1)
        .eq('year', parseInt(selectedYear));
      if (slipsError) throw slipsError;
      setSlips(slipsData || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Gagal memuat data penggajian', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, targetUserId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Format tidak didukung', description: 'Silakan unggah file PDF', variant: 'destructive' });
      return;
    }
    try {
      setUploading(targetUserId);
      const monthInt = parseInt(selectedMonth) + 1;
      const yearInt = parseInt(selectedYear);
      const filePath = `${targetUserId}/${yearInt}-${monthInt}_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('salary-slips').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('salary_slips').upsert({
        user_id: targetUserId, month: monthInt, year: yearInt,
        file_path: filePath, file_name: file.name,
        created_by: user?.id, status: 'published'
      }, { onConflict: 'user_id,month,year' });
      if (dbError) throw dbError;

      toast({ title: 'Berhasil', description: `Slip gaji berhasil diunggah untuk ${format(new Date(yearInt, parseInt(selectedMonth)), 'MMMM yyyy', { locale: id })}` });
      fetchUsersAndSlips();
    } catch (error: any) {
      console.error('Upload error detail:', error);
      toast({
        title: 'Upload Gagal',
        description: error.message || 'Terjadi kesalahan saat mengunggah. Pastikan koneksi stabil.',
        variant: 'destructive'
      });
    } finally {
      setUploading(null);
    }
  };

  const handleViewSlip = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('salary-slips')
        .createSignedUrl(filePath, 60);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      toast({ title: 'Gagal', description: 'Gagal memuat preview file', variant: 'destructive' });
    }
  };

  const handleDeleteSlip = async (slipId: string, filePath: string) => {
    if (!confirm('Hapus slip gaji ini?')) return;
    try {
      await supabase.storage.from('salary-slips').remove([filePath]);
      const { error } = await supabase.from('salary_slips').delete().eq('id', slipId);
      if (error) throw error;
      toast({ title: 'Berhasil', description: 'Slip gaji telah dihapus' });
      fetchUsersAndSlips();
    } catch {
      toast({ title: 'Hapus Gagal', description: 'Gagal menghapus slip gaji', variant: 'destructive' });
    }
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: format(new Date(2024, i), 'MMMM', { locale: id })
  }));

  const years = [
    (new Date().getFullYear() - 1).toString(),
    new Date().getFullYear().toString(),
    (new Date().getFullYear() + 1).toString()
  ];

  const uploadedCount = slips.length;
  const pendingCount = users.length - uploadedCount;
  const periodLabel = format(new Date(parseInt(selectedYear), parseInt(selectedMonth)), 'MMMM yyyy', { locale: id });

  // ─── MOBILE VIEW ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="relative min-h-screen bg-slate-50/50 pb-28">
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pb-6 pt-[calc(1rem+env(safe-area-inset-top))] px-4 rounded-b-[32px] shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 -ml-2 h-8 w-8 rounded-full">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-black">Manajemen Slip Gaji</h1>
                <p className="text-[11px] text-violet-200 font-medium">Periode: {periodLabel}</p>
              </div>
            </div>
            {/* Period Selector */}
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="flex-1 h-10 bg-white/15 border-white/20 text-white rounded-xl text-sm font-bold focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-2xl">
                  {months.map(m => <SelectItem key={m.value} value={m.value} className="font-medium">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[90px] h-10 bg-white/15 border-white/20 text-white rounded-xl text-sm font-bold focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-2xl">
                  {years.map(y => <SelectItem key={y} value={y} className="font-medium">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Mini Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/15">
                <p className="text-base font-black">{users.length}</p>
                <p className="text-[9px] font-bold opacity-70 uppercase">Total</p>
              </div>
              <div className="bg-emerald-500/30 rounded-xl p-2.5 text-center border border-emerald-400/30">
                <p className="text-base font-black text-emerald-200">{uploadedCount}</p>
                <p className="text-[9px] font-bold text-emerald-200 opacity-80 uppercase">Terbit</p>
              </div>
              <div className="bg-amber-500/25 rounded-xl p-2.5 text-center border border-amber-400/25">
                <p className="text-base font-black text-amber-200">{pendingCount}</p>
                <p className="text-[9px] font-bold text-amber-200 opacity-80 uppercase">Belum</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 mt-4 mb-3">
            <div className="relative bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama atau ID staf..."
                className="pl-10 h-11 border-none rounded-2xl bg-transparent focus-visible:ring-0 font-medium text-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* User Cards */}
          <div className="px-4 space-y-2.5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-20 animate-pulse shadow-sm ring-1 ring-slate-100" />
              ))
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center opacity-40">
                <User className="h-10 w-10 text-slate-400 mb-2" />
                <p className="font-bold text-slate-700 text-sm">Tidak ada staf</p>
              </div>
            ) : (
              filteredUsers.map(u => {
                const slip = slips.find(s => s.user_id === u.id);
                const isUploading = uploading === u.id;
                return (
                  <div key={u.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm ring-1 ring-slate-100 flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback className="bg-violet-100 text-violet-700 font-black text-xs">
                        {u.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{u.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium">{u.employee_id}</span>
                        {slip ? (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase">Terbit</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-300">
                            <AlertCircle className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase">Belum</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {slip && (
                        <>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl"
                            onClick={() => handleViewSlip(slip.file_path)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                            onClick={() => handleDeleteSlip(slip.id, slip.file_path)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <div className="relative">
                        <input
                          type="file" accept=".pdf"
                          className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full"
                          onChange={e => handleFileUpload(e, u.id)}
                          disabled={!!isUploading}
                        />
                        <Button
                          size="sm"
                          disabled={!!isUploading}
                          className={cn(
                            'h-8 px-3 rounded-xl font-bold text-xs gap-1.5 transition-all',
                            slip
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shadow-none'
                              : 'bg-violet-600 text-white hover:bg-violet-700'
                          )}
                        >
                          {isUploading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : slip
                              ? <><RefreshCw className="h-3 w-3" />Update</>
                              : <><Upload className="h-3 w-3" />Unggah</>
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── DESKTOP VIEW ─────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-100">
              <Calculator className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Manajemen Slip Gaji</h1>
              <p className="text-sm text-slate-500 font-medium">Unggah slip PDF per staf untuk periode tertentu</p>
            </div>
          </div>
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px] h-9 border-none bg-slate-50 rounded-xl text-sm font-bold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {months.map(m => <SelectItem key={m.value} value={m.value} className="font-medium">{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-9 border-none bg-slate-50 rounded-xl text-sm font-bold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {years.map(y => <SelectItem key={y} value={y} className="font-medium">{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-white rounded-[24px] ring-1 ring-slate-100">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-slate-400 font-black text-[9px] uppercase tracking-widest mb-1">Total Staf</p>
                <h3 className="text-2xl font-black text-slate-900">{users.length}</h3>
              </div>
              <Users className="h-8 w-8 text-slate-100" />
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-emerald-600 text-white rounded-[24px] overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-emerald-100 font-black text-[9px] uppercase tracking-widest mb-1">Slip Terbit</p>
                <h3 className="text-2xl font-black">{uploadedCount}</h3>
              </div>
              <CheckCircle2 className="h-8 w-8 opacity-30" />
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-amber-500 text-white rounded-[24px] overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-amber-100 font-black text-[9px] uppercase tracking-widest mb-1">Belum Terbit</p>
                <h3 className="text-2xl font-black">{pendingCount}</h3>
              </div>
              <AlertCircle className="h-8 w-8 opacity-30" />
            </CardContent>
          </Card>
        </div>

        {/* Main Table Card */}
        <Card className="border-none shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-100/50">
          {/* Card Header */}
          <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="font-black text-slate-800">Daftar Staf — {periodLabel}</h3>
                <p className="text-xs text-slate-400 font-medium">{filteredUsers.length} staf ditampilkan</p>
              </div>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama atau ID..."
                className="pl-10 h-10 rounded-xl border-slate-200 bg-white focus-visible:ring-blue-100"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Staf</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Departemen</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status Slip</th>
                    <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-slate-100 rounded-xl" />
                            <div className="space-y-1.5">
                              <div className="h-3.5 bg-slate-100 rounded w-32" />
                              <div className="h-2.5 bg-slate-100 rounded w-20" />
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5"><div className="h-6 bg-slate-100 rounded-lg w-20" /></td>
                        <td className="px-8 py-5"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                        <td className="px-8 py-5 text-right"><div className="h-9 bg-slate-100 rounded-xl w-28 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <User className="h-12 w-12 mb-3" />
                          <p className="font-bold text-slate-700">Tidak ada staf ditemukan</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const slip = slips.find(s => s.user_id === u.id);
                      const isUploading = uploading === u.id;
                      return (
                        <tr key={u.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                <AvatarImage src={u.avatar_url} />
                                <AvatarFallback className="bg-violet-100 text-violet-700 font-bold text-xs">
                                  {u.full_name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{u.full_name}</p>
                                <p className="text-[10px] font-bold text-slate-400">{u.employee_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase border-slate-200 text-slate-500 rounded-lg">
                              {u.department?.name || 'Umum'}
                            </Badge>
                          </td>
                          <td className="px-8 py-5">
                            {slip ? (
                              <div className="flex items-center gap-2 text-emerald-600">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <span className="text-xs font-bold">Slip Terbit</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-slate-300">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span className="text-xs font-bold">Belum Terbit</span>
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-end gap-2">
                              {slip && (
                                <>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-9 w-9 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 border border-transparent transition-all"
                                    onClick={() => handleViewSlip(slip.file_path)}
                                    title="Pratinjau PDF"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 border border-transparent transition-all"
                                    onClick={() => handleDeleteSlip(slip.id, slip.file_path)}
                                    title="Hapus Slip"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <div className="relative">
                                <input
                                  type="file" accept=".pdf"
                                  className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full"
                                  onChange={e => handleFileUpload(e, u.id)}
                                  disabled={!!isUploading}
                                />
                                <Button
                                  size="sm"
                                  disabled={!!isUploading}
                                  className={cn(
                                    'h-9 px-4 rounded-xl font-bold gap-2 transition-all active:scale-95',
                                    slip
                                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-none'
                                      : 'bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-100'
                                  )}
                                >
                                  {isUploading
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : slip
                                      ? <><RefreshCw className="h-3.5 w-3.5" /> Update Slip</>
                                      : <><Upload className="h-4 w-4" /> Unggah PDF</>
                                  }
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
