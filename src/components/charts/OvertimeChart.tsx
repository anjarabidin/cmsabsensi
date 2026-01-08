import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OvertimeData {
  name: string;
  hours: number;
  pay: number;
}

interface OvertimeChartProps {
  data: OvertimeData[];
  title?: string;
  description?: string;
}

export function OvertimeChart({
  data,
  title = "Lembur Bulanan",
  description = "Jam lembur dan upah per minggu"
}: OvertimeChartProps) {
  return (
    <Card className="card-hover h-full flex flex-col shadow-sm border-slate-200">
      <CardHeader className="pt-4 pb-0 px-4">
        <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-2 pb-2 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
            <XAxis
              dataKey="name"
              className="text-[10px]"
              tick={{ fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              className="text-[10px]"
              tick={{ fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
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
              formatter={(value: any, name: string) => {
                if (name === 'pay' || name === 'Upah Lembur') {
                  return [`Rp ${value.toLocaleString('id-ID')}`, 'Upah Lembur'];
                }
                return [value, 'Jam Lembur'];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Bar
              yAxisId="left"
              dataKey="hours"
              fill="#3b82f6"
              name="Jam Lembur"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              yAxisId="right"
              dataKey="pay"
              fill="#22c55e"
              name="Upah Lembur"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
