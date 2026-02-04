import { TrendingUp, TrendingDown, Package } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, formatPercent, formatNumber } from '../utils/calculations';

export function HoldingsTable() {
  const { holdings } = usePortfolio();

  if (holdings.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No holdings yet</h3>
          <p className="text-sm text-slate-500">
            Import your DeGiro transactions to see your portfolio
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">Holdings</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Product
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Avg. Cost
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Current Price
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Value
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                P/L
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {holdings.map((holding) => {
              const isProfit = holding.profitLoss >= 0;
              const TrendIcon = isProfit ? TrendingUp : TrendingDown;
              const trendColor = isProfit ? 'text-emerald-400' : 'text-red-400';

              return (
                <tr key={holding.isin} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">{holding.product}</p>
                      <p className="text-xs text-slate-500">{holding.isin}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm text-slate-300">{formatNumber(holding.quantity, 4)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm text-slate-300">{formatCurrency(holding.averageCost)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm text-slate-300">{formatCurrency(holding.currentPrice)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-medium text-white">{formatCurrency(holding.currentValue)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="text-right">
                        <p className={`text-sm font-medium ${trendColor}`}>
                          {formatCurrency(holding.profitLoss)}
                        </p>
                        <p className={`text-xs ${trendColor}`}>
                          {formatPercent(holding.profitLossPercent)}
                        </p>
                      </div>
                      <TrendIcon className={`w-4 h-4 ${trendColor}`} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
