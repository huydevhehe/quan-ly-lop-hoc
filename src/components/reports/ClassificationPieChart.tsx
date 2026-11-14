import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ClassificationPieChartProps {
  data: {
    T: number;
    H: number;
    C: number;
    none: number;
  };
}

const COLORS = {
  T: '#10b981', // Xanh lá
  H: '#3b82f6', // Xanh dương
  C: '#f59e0b', // Cam
  none: '#94a3b8', // Xám
};

export const ClassificationPieChart: React.FC<ClassificationPieChartProps> = ({ data }) => {
  const chartData = [
    { name: 'Hoàn thành tốt (T)', value: data.T, color: COLORS.T },
    { name: 'Hoàn thành (H)', value: data.H, color: COLORS.H },
    { name: 'Chưa hoàn thành (C)', value: data.C, color: COLORS.C },
    { name: 'Chưa có điểm', value: data.none, color: COLORS.none },
  ].filter((item) => item.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-xs text-slate-400 font-medium">
        Chưa có dữ liệu xếp loại
      </div>
    );
  }

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-xs text-slate-600 font-medium">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
