
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ShieldAlert, FileText, Calendar, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

// Placeholder type until we have a real table
interface AuditLog {
    id: string;
    action: string;
    table_name: string;
    record_id: string;
    old_data: any;
    new_data: any;
    changed_by: string;
    created_at: string;
    profiles?: {
        full_name: string;
        email: string;
    }
}

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Note: asking Supabase for a table that might not exist yet.
            // If it fails, we fall back to empty state.
            const { data, error } = await supabase
                .from('audit_logs' as any)
                .select('*, profiles:changed_by(full_name, email)')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.warn('Audit logs table might not exist or permission denied:', error);
                setLogs([]);
            } else {
                setLogs(data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.table_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Audit Logs</h1>
                        <p className="text-slate-500 font-medium text-sm">Monitor perubahan data dan aktivitas sistem.</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari log..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white"
                            />
                        </div>
                        <Button variant="outline" onClick={fetchLogs}>
                            <Filter className="mr-2 h-4 w-4" /> Filter
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-slate-900 text-white border-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-400">Total Aktivitas (7 Hari)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{logs.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Perubahan Kritis</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">0</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">User Aktif</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">-</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-none shadow-lg">
                        <CardHeader>
                            <CardTitle>Riwayat Aktivitas</CardTitle>
                            <CardDescription>Menampilkan 50 aktivitas terakhir di sistem.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Waktu</TableHead>
                                            <TableHead>Actor</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Target</TableHead>
                                            <TableHead>Detail</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                                        <span className="text-slate-500">Memuat data log...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-32 text-center">
                                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                                        <ShieldAlert className="h-10 w-10 mb-2 opacity-50" />
                                                        <p className="font-medium text-slate-900">Belum ada data audit</p>
                                                        <p className="text-sm">Sistem logging mungkin belum diaktifkan atau belum ada aktivitas tercatat.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredLogs.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell className="whitespace-nowrap font-mono text-xs">
                                                        {format(new Date(log.created_at), 'dd MMM HH:mm:ss')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">{log.profiles?.full_name || 'System'}</span>
                                                            <span className="text-xs text-slate-500">{log.profiles?.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="uppercase text-[10px] bg-slate-50">
                                                            {log.action}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-slate-600">
                                                        {log.table_name}
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate text-xs text-slate-500">
                                                        {JSON.stringify(log.new_data)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
