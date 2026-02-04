import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { calculateBenchmarkComparison, calculatePerformanceVsBenchmark } from '../utils/benchmarks';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-lg">
      <p className="text-sm text-slate-400 mb-2">{format(new Date(label), 'MMM yyyy')}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex justify-between gap-4">
            <span className="text-sm" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="text-sm font-medium text-white">
              {entry.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PerformanceBenchmark() {
  const { snapshots } = usePortfolio();

  const { chartData, performance } = useMemo(() => {
    const data = calculateBenchmarkComparison(snapshots);
    const perf = calculatePerformanceVsBenchmark(snapshots);
    return { chartData: data, performance: perf };
  }, [snapshots]);

  if (chartData.length < 2) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">Not enough data</h3>
          <p className="text-sm text-slate-500">
            Add more transactions to see benchmark comparison
          </p>
        </div>
      </div>
    );
  }

  const TrendIcon = performance.outperforming ? TrendingUp : TrendingDown;
  const alphaColor = performance.alpha >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Your Portfolio</p>
          <p className={`text-2xl font-bold ${performance.portfolioReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {performance.portfolioReturn >= 0 ? '+' : ''}{performance.portfolioReturn.toFixed(2)}%
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">S&P 500</p>
          <p className={`text-2xl font-bold ${performance.sp500Return >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {performance.sp500Return >= 0 ? '+' : ''}{performance.sp500Return.toFixed(2)}%
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">MSCI World</p>
          <p className={`text-2xl font-bold ${performance.msciWorldReturn >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
            {performance.msciWorldReturn >= 0 ? '+' : ''}{performance.msciWorldReturn.toFixed(2)}%
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Alpha vs S&P 500</p>
              <p className={`text-2xl font-bold ${alphaColor}`}>
                {performance.alpha >= 0 ? '+' : ''}{performance.alpha.toFixed(2)}%
              </p>
            </div>
            <div className={`p-2 rounded-lg ${performance.outperforming ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              <TrendIcon className={`w-5 h-5 ${alphaColor}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark Chart */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Performance vs Benchmarks</h3>
        <p className="text-sm text-slate-400 mb-4">
          Normalized to 100 at start date for comparison
        </p>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
              />
              <Line
                type="monotone"
                dataKey="portfolioValue"
                name="Your Portfolio"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sp500"
                name="S&P 500"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="msciWorld"
                name="MSCI World"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Note: Benchmark data is simulated for demonstration purposes.
        </p>
      </div>
    </div>
  );
}
