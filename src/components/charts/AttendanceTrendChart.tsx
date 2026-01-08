import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AttendanceData {
  date: string;
  present: number;
  late: number;
  absent: number;
}

interface AttendanceTrendChartProps {
  data: AttendanceData[];
  title?: string;
  description?: string;
}

export function AttendanceTrendChart({
  data,
  title = "Tren Kehadiran",
  description = "Grafik kehadiran 30 hari terakhir"
}: AttendanceTrendChartProps) {
  return (
    <Card className="card-hover h-full flex flex-col shadow-sm border-slate-200">
      <CardHeader className="pt-4 pb-0 px-4">
        <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-2 pb-2 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
            <XAxis
              dataKey="date"
              className="text-[10px]"
              tick={{ fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              className="text-[10px]"
              tick={{ fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12px',
                padding: '8px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Line
              type="monotone"
              dataKey="present"
              stroke="#22c55e"
              strokeWidth={2}
              name="Hadir"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="late"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Terlambat"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="absent"
              stroke="#ef4444"
              strokeWidth={2}
              name="Absen"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
