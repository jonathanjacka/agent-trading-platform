import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import type { PortfolioValue } from '../types';

interface PortfolioChartProps {
  data: PortfolioValue[];
}

export const PortfolioChart = ({ data }: PortfolioChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className='h-48 flex items-center justify-center text-gray-500'>
        No portfolio history yet
      </div>
    );
  }

  // Sort by timestamp ascending
  const sortedData = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Format data for recharts
  const chartData = sortedData.map((item) => ({
    timestamp: new Date(item.timestamp).getTime(),
    value: item.value,
    pnl: item.pnl || 0,
    displayTime: format(new Date(item.timestamp), 'MMM d, HH:mm'),
  }));

  // Determine if overall trend is positive
  const latestPnl = chartData[chartData.length - 1]?.pnl || 0;
  const lineColor = latestPnl >= 0 ? '#10b981' : '#ef4444'; // green-500 : red-500

  return (
    <ResponsiveContainer width='100%' height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
        <XAxis dataKey='displayTime' tick={{ fontSize: 12 }} stroke='#6b7280' />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke='#6b7280'
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number) => [
            `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'Portfolio Value',
          ]}
          labelStyle={{ color: '#374151' }}
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.375rem',
          }}
        />
        <Line
          type='monotone'
          dataKey='value'
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
