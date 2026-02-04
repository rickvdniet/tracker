import { TrendingUp, TrendingDown, Wallet, PiggyBank, Coins } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, formatPercent } from '../utils/calculations';

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
  const { stats } = usePortfolio();

  const profitTrend = stats.totalProfitLoss >= 0 ? 'up' : 'down';
  const ProfitIcon = stats.totalProfitLoss >= 0 ? TrendingUp : TrendingDown;

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
      <StatCard
        title="Dividends Received"
        value={formatCurrency(stats.totalDividends)}
        icon={<Coins className="w-5 h-5 text-amber-400" />}
      />
    </div>
  );
}
