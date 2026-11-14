import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ScoreAttendanceBarChartProps {
  scoreBuckets: {
    '9-10': number;
    '7-8': number;
    '5-6': number;
    'duoi-5': number;
  };
  absenceBuckets: Record<string, number>;
}

export const ScoreAttendanceBarChart: React.FC<ScoreAttendanceBarChartProps> = ({
  scoreBuckets,
  absenceBuckets,
}) => {
  const chartData = [
    { name: '9-10 điểm', count: scoreBuckets['9-10'], fill: '#10b981' },
    { name: '7-8 điểm', count: scoreBuckets['7-8'], fill: '#3b82f6' },
    { name: '5-6 điểm', count: scoreBuckets['5-6'], fill: '#6366f1' },
    { name: 'Dưới 5', count: scoreBuckets['duoi-5'], fill: '#f59e0b' },
    { name: 'Vắng > 2 buổi', count: absenceBuckets['>2'] || 0, fill: '#ef4444' },
  ];

  const total = chartData.reduce((acc, curr) => acc + curr.count, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-xs text-slate-400 font-medium">
        Chưa có dữ liệu phổ điểm & chuyên cần
      </div>
    );
  }

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
