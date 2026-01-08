import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LeaveBalance } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

interface LeaveBalanceCardProps {
  userId: string;
}

export function LeaveBalanceCard({ userId }: LeaveBalanceCardProps) {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, [userId]);

  const fetchBalance = async () => {
    try {
      const currentYear = new Date().getFullYear();
      
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Initialize balance if not exists
        const { data: newBalance, error: insertError } = await supabase
          .from('leave_balances')
          .insert({
            user_id: userId,
            year: currentYear,
            annual_quota: 12,
            annual_used: 0,
            annual_remaining: 12,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setBalance(newBalance as LeaveBalance);
      } else {
        setBalance(data as LeaveBalance);
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!balance) return null;

  const usagePercentage = (balance.annual_used / balance.annual_quota) * 100;
  const isLowBalance = balance.annual_remaining <= 3;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Saldo Cuti</CardTitle>
          </div>
          {isLowBalance && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Sisa Sedikit
            </Badge>
          )}
        </div>
        <CardDescription>Tahun {balance.year}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Annual Leave */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cuti Tahunan</span>
            <span className="font-semibold">
              {balance.annual_remaining} / {balance.annual_quota} hari
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Terpakai: {balance.annual_used} hari</span>
            <span>{Math.round(usagePercentage)}%</span>
          </div>
        </div>

        {/* Sick Leave */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Sakit</p>
              <p className="text-lg font-semibold">{balance.sick_used} hari</p>
            </div>
            <div>
              <p className="text-muted-foreground">Izin Khusus</p>
              <p className="text-lg font-semibold">{balance.special_leave_used} hari</p>
            </div>
          </div>
        </div>

        {isLowBalance && (
          <div className="pt-3 border-t">
            <p className="text-xs text-destructive">
              ⚠️ Saldo cuti tahunan Anda tinggal {balance.annual_remaining} hari
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
