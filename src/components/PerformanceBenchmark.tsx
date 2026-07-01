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
import { formatCurrency, formatPercent } from '../utils/calculations';
import type { TimeRange } from '../types';

interface ChartPoint {
  date: string;
  portfolioValue: number;
  sp500Value: number;
  msciWorldValue: number;
  totalInvested: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint; name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  const data = payload[0].payload;
  const invested = data.totalInvested;

  const rows = [
    { name: 'Your Portfolio', value: data.portfolioValue, color: '#10b981' },
    { name: 'S&P 500',        value: data.sp500Value,     color: '#3b82f6' },
    { name: 'MSCI World',     value: data.msciWorldValue, color: '#a855f7' },
    { name: 'Invested',       value: data.totalInvested,  color: '#94a3b8' },
  ];

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-lg min-w-[220px]">
      <p className="text-sm text-slate-400 mb-2">{format(new Date(label), 'd MMM yyyy')}</p>
      <div className="space-y-1">
        {rows.map((r) => {
          const gain = invested > 0 ? ((r.value - invested) / invested) * 100 : 0;
          const isInvested = r.name === 'Invested';
          return (
            <div key={r.name} className="flex justify-between gap-4 text-xs">
              <span style={{ color: r.color }}>{r.name}:</span>
              <div className="text-right">
                <span className="text-white font-medium">{formatCurrency(r.value)}</span>
                {!isInvested && invested > 0 && (
                  <span className={`ml-2 ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {gain >= 0 ? '+' : ''}{gain.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

export function PerformanceBenchmark() {
  const { transactions, snapshots, exchangeRates } = usePortfolio();
  const [benchmarks, setBenchmarks] = useState<BenchmarkPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');

  const loadBenchmarks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBenchmarkPrices(10);
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

  useEffect(() => {
    if (!benchmarks && !loading) {
      loadBenchmarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { chartData, performance } = useMemo(() => {
    if (!benchmarks) {
      return {
        chartData: [] as ChartPoint[],
        performance: {
          portfolioValue: 0, portfolioReturn: 0,
          sp500Value: 0, sp500Return: 0,
          msciWorldValue: 0, msciWorldReturn: 0,
          totalInvested: 0, alpha: 0, outperforming: false,
        },
      };
    }
    const data = calculateBenchmarkComparison(transactions, snapshots, benchmarks, exchangeRates, timeRange);
    const perf = calculatePerformanceVsBenchmark(data);
    return { chartData: data, performance: perf };
  }, [transactions, snapshots, benchmarks, exchangeRates, timeRange]);

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
          <h3 className="text-lg font-medium text-slate-300 mb-1">Not enough data for {timeRange}</h3>
          <p className="text-sm text-slate-500 mb-4">
            Try a longer time range or add more transactions.
          </p>
          <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1 inline-flex">
            {timeRanges.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === value ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const TrendIcon = performance.outperforming ? TrendingUp : TrendingDown;
  const alphaColor = performance.alpha >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* Header with time range */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h3 className="text-sm text-slate-400">
            Compared over: <span className="text-white font-medium">{timeRange === 'ALL' ? 'entire history' : timeRange}</span>
            {' · '}
            {formatCurrency(performance.totalInvested)} invested
          </h3>
        </div>
        <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
          {timeRanges.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timeRange === value ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Your Portfolio</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(performance.portfolioValue)}</p>
          <p className={`text-sm font-medium ${performance.portfolioReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPercent(performance.portfolioReturn)}
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">If in S&P 500</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(performance.sp500Value)}</p>
          <p className={`text-sm font-medium ${performance.sp500Return >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {formatPercent(performance.sp500Return)}
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">If in MSCI World</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(performance.msciWorldValue)}</p>
          <p className={`text-sm font-medium ${performance.msciWorldReturn >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
            {formatPercent(performance.msciWorldReturn)}
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Alpha vs S&P 500</p>
              <p className={`text-2xl font-bold ${alphaColor}`}>
                {performance.alpha >= 0 ? '+' : ''}{performance.alpha.toFixed(2)}pp
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {performance.outperforming ? 'Outperforming' : 'Underperforming'}
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Cashflow-matched comparison</h3>
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
          Simulates buying CSPX (S&P 500) or IWDA (MSCI World) at the exact same times you made your actual purchases, using the same EUR amounts. Chart shows portfolio value in EUR.
        </p>

        <div className="h-[320px]">
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
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
              />
              <Line
                type="monotone"
                dataKey="totalInvested"
                name="Invested"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="portfolioValue"
                name="Your Portfolio"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sp500Value"
                name="S&P 500"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="msciWorldValue"
                name="MSCI World"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Note: Cashflows are matched at transaction dates. FX conversion uses each transaction's stored rate.
          {' '}
          Since the benchmark ETFs (CSPX / IWDA) are EUR-denominated UCITS listings, no additional currency conversion is needed.
        </p>
      </div>
    </div>
  );
}
