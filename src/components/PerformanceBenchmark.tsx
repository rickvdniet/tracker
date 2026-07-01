import { useEffect, useMemo, useState } from 'react';
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
import { TrendingUp, TrendingDown, Target, Loader2, RefreshCw } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import {
  calculateBenchmarkComparison,
  calculatePerformanceVsBenchmark,
  fetchBenchmarkPrices,
  type BenchmarkPrices,
} from '../utils/benchmarks';

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
  const [benchmarks, setBenchmarks] = useState<BenchmarkPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBenchmarks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBenchmarkPrices(5);
      if (data.sp500.length === 0 && data.msciWorld.length === 0) {
        setError('Failed to fetch benchmark data. Check your CORS proxy in Settings.');
      } else {
        setBenchmarks(data);
      }
    } catch (e) {
      setError('Failed to fetch benchmark data.');
      console.error(e);
    }
    setLoading(false);
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (!benchmarks && !loading) {
      loadBenchmarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { chartData, performance } = useMemo(() => {
    if (!benchmarks) return { chartData: [], performance: { portfolioReturn: 0, sp500Return: 0, msciWorldReturn: 0, alpha: 0, outperforming: false } };
    const data = calculateBenchmarkComparison(snapshots, benchmarks);
    const perf = calculatePerformanceVsBenchmark(snapshots, benchmarks);
    return { chartData: data, performance: perf };
  }, [snapshots, benchmarks]);

  if (loading && !benchmarks) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 animate-spin" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">Loading benchmarks</h3>
          <p className="text-sm text-slate-500">Fetching S&P 500 and MSCI World historical prices…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">Couldn't load benchmark data</h3>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button
            onClick={loadBenchmarks}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-slate-400 mb-1">S&P 500 (CSPX)</p>
          <p className={`text-2xl font-bold ${performance.sp500Return >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {performance.sp500Return >= 0 ? '+' : ''}{performance.sp500Return.toFixed(2)}%
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">MSCI World (IWDA)</p>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Performance vs Benchmarks</h3>
          <button
            onClick={loadBenchmarks}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? 'Fetching…' : 'Refresh'}
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Normalized to 100 at start date for comparison. Real historical prices from Yahoo Finance.
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
      </div>
    </div>
  );
}
