import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { usePortfolio } from '../context/PortfolioContext';
import { filterSnapshotsByTimeRange, formatCurrency } from '../utils/calculations';
import type { TimeRange } from '../types';
import { TrendingUp } from 'lucide-react';

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { date: string; totalValue: number; totalInvested: number; totalProfitLoss: number } }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-lg">
      <p className="text-sm text-slate-400 mb-2">{format(new Date(label), 'MMM yyyy')}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-sm text-slate-300">Value:</span>
          <span className="text-sm font-medium text-white">{formatCurrency(data.totalValue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-slate-300">Invested:</span>
          <span className="text-sm text-slate-400">{formatCurrency(data.totalInvested)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-slate-300">P/L:</span>
          <span className={`text-sm font-medium ${data.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(data.totalProfitLoss)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PortfolioChart() {
  const { snapshots, selectedTimeRange, setTimeRange } = usePortfolio();

  const filteredSnapshots = filterSnapshotsByTimeRange(snapshots, selectedTimeRange);

  const chartData = filteredSnapshots.map((snapshot) => ({
    date: snapshot.date.toISOString(),
    totalValue: snapshot.totalValue,
    totalInvested: snapshot.totalInvested,
    totalProfitLoss: snapshot.totalProfitLoss,
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No data to display</h3>
          <p className="text-sm text-slate-500">
            Import transactions to see your portfolio growth
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Portfolio Performance</h2>
        <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
          {timeRanges.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedTimeRange === value
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM yy')}
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="totalInvested"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#investedGradient)"
              name="Invested"
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#valueGradient)"
              name="Value"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-400">Portfolio Value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-sm text-slate-400">Amount Invested</span>
        </div>
      </div>
    </div>
  );
}
