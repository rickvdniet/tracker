import { useMemo } from 'react';
import { format, getYear, startOfMonth, addMonths } from 'date-fns';
import { Coins, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/calculations';

interface MonthlyDividend {
  month: string;
  amount: number;
  fullDate: Date;
}

export function DividendDashboard() {
  const { transactions, holdings, stats } = usePortfolio();

  const dividendData = useMemo(() => {
    // Get all dividend transactions
    const dividends = transactions.filter((t) => t.type === 'dividend');

    // Group by month
    const monthlyMap = new Map<string, number>();
    dividends.forEach((d) => {
      const key = format(d.date, 'yyyy-MM');
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + d.totalAmount);
    });

    // Create monthly data for chart (last 12 months)
    const monthlyData: MonthlyDividend[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = addMonths(startOfMonth(now), -i);
      const key = format(date, 'yyyy-MM');
      monthlyData.push({
        month: format(date, 'MMM'),
        amount: monthlyMap.get(key) || 0,
        fullDate: date,
      });
    }

    // Calculate yearly totals
    const yearlyTotals = new Map<number, number>();
    dividends.forEach((d) => {
      const year = getYear(d.date);
      yearlyTotals.set(year, (yearlyTotals.get(year) || 0) + d.totalAmount);
    });

    // Get dividends by holding
    const byHolding = new Map<string, { product: string; total: number; count: number }>();
    dividends.forEach((d) => {
      const existing = byHolding.get(d.isin || d.product);
      if (existing) {
        existing.total += d.totalAmount;
        existing.count += 1;
      } else {
        byHolding.set(d.isin || d.product, {
          product: d.product,
          total: d.totalAmount,
          count: 1,
        });
      }
    });

    // Calculate average monthly dividend
    const monthsWithDividends = Array.from(monthlyMap.values()).filter((v) => v > 0).length;
    const avgMonthly = monthsWithDividends > 0 ? stats.totalDividends / monthsWithDividends : 0;

    // Projected annual (based on last 12 months or average)
    const last12MonthsTotal = monthlyData.reduce((sum, m) => sum + m.amount, 0);
    const projectedAnnual = last12MonthsTotal > 0 ? last12MonthsTotal : avgMonthly * 12;

    // Dividend yield on portfolio
    const dividendYield = stats.totalValue > 0 ? (projectedAnnual / stats.totalValue) * 100 : 0;

    // Recent dividends
    const recentDividends = dividends
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);

    return {
      monthlyData,
      yearlyTotals,
      byHolding: Array.from(byHolding.values()).sort((a, b) => b.total - a.total),
      avgMonthly,
      projectedAnnual,
      dividendYield,
      recentDividends,
      totalDividends: stats.totalDividends,
    };
  }, [transactions, holdings, stats]);

  if (dividendData.totalDividends === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <Coins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No dividends yet</h3>
          <p className="text-sm text-slate-500">
            Dividend information will appear here once you receive dividends
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Total Dividends</p>
              <p className="text-2xl font-bold text-amber-400">
                {formatCurrency(dividendData.totalDividends)}
              </p>
            </div>
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Avg. Monthly</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(dividendData.avgMonthly)}
              </p>
            </div>
            <div className="p-2 bg-slate-700/50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Projected Annual</p>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrency(dividendData.projectedAnnual)}
              </p>
            </div>
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Dividend Yield</p>
              <p className="text-2xl font-bold text-purple-400">
                {dividendData.dividendYield.toFixed(2)}%
              </p>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Monthly Dividend Income</h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dividendData.monthlyData}>
              <XAxis
                dataKey="month"
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
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value) => [formatCurrency(value as number), 'Dividends']}
              />
              <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Dividend Payers */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Top Dividend Payers</h3>
          <div className="space-y-3">
            {dividendData.byHolding.slice(0, 5).map((holding, index) => (
              <div key={holding.product} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 w-5">{index + 1}.</span>
                  <div>
                    <p className="text-sm text-white truncate max-w-[200px]">{holding.product}</p>
                    <p className="text-xs text-slate-500">{holding.count} payments</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-amber-400">
                  {formatCurrency(holding.total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Dividends */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Dividends</h3>
          <div className="space-y-3">
            {dividendData.recentDividends.map((dividend) => (
              <div key={dividend.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white truncate max-w-[200px]">{dividend.product}</p>
                  <p className="text-xs text-slate-500">{format(dividend.date, 'dd MMM yyyy')}</p>
                </div>
                <span className="text-sm font-medium text-emerald-400">
                  +{formatCurrency(dividend.totalAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
