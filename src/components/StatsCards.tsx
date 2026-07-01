import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Target, Loader2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { calculateBenchmarkComparison, calculatePerformanceVsBenchmark } from '../utils/benchmarks';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${trend ? trendColors[trend] : 'text-white'}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-sm mt-1 ${trend ? trendColors[trend] : 'text-slate-400'}`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="p-2 bg-slate-700/50 rounded-lg">{icon}</div>
      </div>
    </div>
  );
}

export function StatsCards() {
  const {
    stats,
    transactions,
    snapshots,
    exchangeRates,
    benchmarkPrices,
    benchmarkPricesLoading,
  } = usePortfolio();

  const alphaPerf = useMemo(() => {
    if (!benchmarkPrices) return null;
    const data = calculateBenchmarkComparison(transactions, snapshots, benchmarkPrices, exchangeRates, 'ALL');
    return calculatePerformanceVsBenchmark(data);
  }, [transactions, snapshots, benchmarkPrices, exchangeRates]);

  const profitTrend = stats.totalProfitLoss >= 0 ? 'up' : 'down';
  const ProfitIcon = stats.totalProfitLoss >= 0 ? TrendingUp : TrendingDown;

  // Alpha card values
  const alphaLoading = !alphaPerf && benchmarkPricesLoading;
  const alpha = alphaPerf?.alpha ?? 0;
  const alphaTrend = alpha >= 0 ? 'up' : 'down';
  const AlphaIcon = alpha >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Portfolio Value"
        value={formatCurrency(stats.totalValue)}
        icon={<Wallet className="w-5 h-5 text-blue-400" />}
      />
      <StatCard
        title="Total Invested"
        value={formatCurrency(stats.totalInvested)}
        icon={<PiggyBank className="w-5 h-5 text-purple-400" />}
      />
      <StatCard
        title="Profit / Loss"
        value={formatCurrency(stats.totalProfitLoss)}
        subtitle={formatPercent(stats.profitLossPercent)}
        icon={<ProfitIcon className={`w-5 h-5 ${profitTrend === 'up' ? 'text-emerald-400' : 'text-red-400'}`} />}
        trend={profitTrend}
      />
      {alphaLoading ? (
        <StatCard
          title="Alpha vs S&P 500"
          value="…"
          subtitle="Fetching benchmark"
          icon={<Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
        />
      ) : alphaPerf && alphaPerf.benchmarkInvested > 0 ? (
        <StatCard
          title="Alpha vs S&P 500"
          value={`${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}pp`}
          subtitle={`You ${formatPercent(alphaPerf.portfolioReturn)} · S&P ${formatPercent(alphaPerf.sp500Return)}`}
          icon={<AlphaIcon className={`w-5 h-5 ${alphaTrend === 'up' ? 'text-emerald-400' : 'text-red-400'}`} />}
          trend={alphaTrend}
        />
      ) : (
        <StatCard
          title="Alpha vs S&P 500"
          value="—"
          subtitle="Benchmark unavailable"
          icon={<Target className="w-5 h-5 text-slate-400" />}
        />
      )}
    </div>
  );
}
