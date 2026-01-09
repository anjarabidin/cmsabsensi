import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { MonthlyAttendanceSummary } from '@/types';
import { generateMonthlySummary, saveMonthlySummary, exportToPayrollCSV } from '@/lib/payroll';

export default function PayrollReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [summaries, setSummaries] = useState<MonthlyAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    fetchSummaries();
  }, [selectedMonth, selectedYear]);

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('monthly_attendance_summary')
        .select(`
          *,
          profiles:user_id (
            full_name,
            employee_id
          )
        `)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setSummaries((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching summaries:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      setGenerating(true);

      // Get all active users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        toast({
          title: 'Info',
          description: 'Tidak ada karyawan aktif',
        });
        return;
      }

      // Generate summary for each user
      let successCount = 0;
      for (const profile of profiles) {
        try {
          const calculation = await generateMonthlySummary({
            userId: profile.id,
            month: selectedMonth,
            year: selectedYear,
          });

          await saveMonthlySummary(
            { userId: profile.id, month: selectedMonth, year: selectedYear },
            calculation
          );
          successCount++;
        } catch (error) {
          console.error(`Error generating summary for user ${profile.id}:`, error);
        }
      }

      toast({
        title: 'Berhasil',
        description: `Summary berhasil di-generate untuk ${successCount} karyawan`,
      });

      fetchSummaries();
    } catch (error) {
      console.error('Error generating summaries:', error);
      toast({
        title: 'Error',
        description: 'Gagal generate summary',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const csv = exportToPayrollCSV(summaries);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `payroll_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Berhasil',
        description: 'File CSV berhasil didownload',
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: 'Error',
        description: 'Gagal export CSV',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="relative">
        {/* Background Gradient */}
        <div className="absolute -top-6 -left-6 w-[calc(100%+3rem)] h-[100px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        {/* Floating Content */}
        <div className="relative z-10 space-y-6 max-w-[1600px] mx-auto pt-[calc(1rem+env(safe-area-inset-top))] pb-20 px-4 md:px-6">
          {/* Header */}
          <div className="text-white">
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Laporan Payroll</h1>
            <p className="text-xs text-blue-50 font-medium opacity-90">Generate dan export rekap absensi untuk payroll</p>
          </div>

          {/* Filters & Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Filter & Generate</CardTitle>
              <CardDescription>Pilih periode dan generate summary untuk payroll</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleGenerateSummary} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate Summary
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleExportCSV}
                  disabled={summaries.length === 0}
                  variant="outline"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rekap Absensi - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
              <CardDescription>
                {summaries.length > 0 ? `${summaries.length} karyawan` : 'Belum ada data'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : summaries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Belum ada data untuk periode ini</p>
                  <p className="text-sm mt-2">Klik "Generate Summary" untuk membuat rekap</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead className="text-center">Hari Kerja</TableHead>
                        <TableHead className="text-center">Hadir</TableHead>
                        <TableHead className="text-center">Terlambat</TableHead>
                        <TableHead className="text-center">Tidak Hadir</TableHead>
                        <TableHead className="text-center">Cuti</TableHead>
                        <TableHead className="text-center">Jam Lembur</TableHead>
                        <TableHead className="text-right">Upah Lembur</TableHead>
                        <TableHead className="text-right">Potongan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.map((summary: any) => (
                        <TableRow key={summary.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p>{summary.profiles?.full_name || 'N/A'}</p>
                              <p className="text-sm text-muted-foreground">{summary.profiles?.employee_id || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{summary.total_working_days}</TableCell>
                          <TableCell className="text-center">{summary.total_present}</TableCell>
                          <TableCell className="text-center">
                            {summary.total_late > 0 ? (
                              <span className="text-destructive">{summary.total_late}x ({summary.total_late_minutes}m)</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {summary.total_absent > 0 ? (
                              <span className="text-destructive">{summary.total_absent}</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-center">{summary.total_leave_days}</TableCell>
                          <TableCell className="text-center">{summary.total_overtime_hours.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(summary.total_overtime_pay)}</TableCell>
                          <TableCell className="text-right">
                            {summary.deductions > 0 ? (
                              <span className="text-destructive">{formatCurrency(summary.deductions)}</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
