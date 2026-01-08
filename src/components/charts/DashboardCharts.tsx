import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AttendanceTrendChart } from './AttendanceTrendChart';
import { LeaveUsageChart } from './LeaveUsageChart';
import { OvertimeChart } from './OvertimeChart';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export function DashboardCharts() {
  const { user } = useAuth();
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);
  const [leaveUsage, setLeaveUsage] = useState<any[]>([]);
  const [overtimeData, setOvertimeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchChartData();
    }
  }, [user?.id]);

  const fetchChartData = async () => {
    try {
      await Promise.all([
        fetchAttendanceTrend(),
        fetchLeaveUsage(),
        fetchOvertimeData(),
      ]);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceTrend = async () => {
    try {
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return format(date, 'yyyy-MM-dd');
      });

      const { data, error } = await supabase
        .from('attendances')
        .select('date, status')
        .eq('user_id', user?.id)
        .gte('date', last30Days[0])
        .lte('date', last30Days[last30Days.length - 1]);

      if (error) throw error;

      // Group by date and count statuses
      const trendData = last30Days.map(date => {
        const dayData = data?.filter(a => a.date === date) || [];
        return {
          date: format(new Date(date), 'dd/MM'),
          present: dayData.filter(a => a.status === 'present').length,
          late: dayData.filter(a => a.status === 'late').length,
          absent: dayData.filter(a => a.status === 'absent').length,
        };
      });

      setAttendanceTrend(trendData);
    } catch (error) {
      console.error('Error fetching attendance trend:', error);
      // Set sample data for demo
      setAttendanceTrend([
        { date: '01/01', present: 1, late: 0, absent: 0 },
        { date: '02/01', present: 1, late: 0, absent: 0 },
        { date: '03/01', present: 0, late: 1, absent: 0 },
        { date: '04/01', present: 1, late: 0, absent: 0 },
        { date: '05/01', present: 0, late: 0, absent: 1 },
      ]);
    }
  };

  const fetchLeaveUsage = async () => {
    try {
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('leave_requests')
        .select('leave_type')
        .eq('user_id', user?.id)
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate);

      if (error) throw error;

      // Count by leave type
      const annual = data?.filter(l => l.leave_type === 'annual').length || 0;
      const sick = data?.filter(l => l.leave_type === 'sick').length || 0;
      const special = data?.filter(l => l.leave_type === 'special').length || 0;

      const leaveData = [
        { name: 'Cuti Tahunan', value: annual, color: 'hsl(217, 91%, 60%)' },
        { name: 'Cuti Sakit', value: sick, color: 'hsl(0, 84%, 60%)' },
        { name: 'Cuti Khusus', value: special, color: 'hsl(142, 76%, 36%)' },
      ].filter(item => item.value > 0);

      setLeaveUsage(leaveData.length > 0 ? leaveData : [
        { name: 'Belum ada cuti', value: 1, color: 'hsl(var(--muted))' }
      ]);
    } catch (error) {
      console.error('Error fetching leave usage:', error);
      setLeaveUsage([
        { name: 'Cuti Tahunan', value: 3, color: 'hsl(217, 91%, 60%)' },
        { name: 'Cuti Sakit', value: 1, color: 'hsl(0, 84%, 60%)' },
      ]);
    }
  };

  const fetchOvertimeData = async () => {
    try {
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('overtime_requests')
        .select('date, duration_minutes, calculated_overtime_pay')
        .eq('user_id', user?.id)
        .eq('status', 'approved')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // Group by week
      const weeks = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'];
      const overtimeByWeek = weeks.map((week, index) => {
        const weekStart = index * 7 + 1;
        const weekEnd = (index + 1) * 7;

        const weekData = data?.filter(o => {
          const day = new Date(o.date).getDate();
          return day >= weekStart && day <= weekEnd;
        }) || [];

        const totalHours = weekData.reduce((sum, o) => sum + (o.duration_minutes / 60), 0);
        const totalPay = weekData.reduce((sum, o) => sum + (o.calculated_overtime_pay || 0), 0);

        return {
          name: week,
          hours: Math.round(totalHours * 10) / 10,
          pay: totalPay,
        };
      });

      setOvertimeData(overtimeByWeek);
    } catch (error) {
      console.error('Error fetching overtime data:', error);
      setOvertimeData([
        { name: 'Minggu 1', hours: 4, pay: 200000 },
        { name: 'Minggu 2', hours: 3, pay: 150000 },
        { name: 'Minggu 3', hours: 5, pay: 250000 },
        { name: 'Minggu 4', hours: 2, pay: 100000 },
      ]);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
        <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
        <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
      <div className="lg:col-span-2 h-[280px]">
        <AttendanceTrendChart data={attendanceTrend} />
      </div>
      <div className="lg:col-span-1 h-[280px]">
        <LeaveUsageChart data={leaveUsage} />
      </div>
      <div className="lg:col-span-3 h-[250px]">
        <OvertimeChart data={overtimeData} />
      </div>
    </div>
  );
}
