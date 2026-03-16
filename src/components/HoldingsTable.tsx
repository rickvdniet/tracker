import { useState } from 'react';
import { TrendingUp, TrendingDown, Package, Tag, FileText } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, formatPercent, formatNumber } from '../utils/calculations';
import { HoldingDetails } from './HoldingDetails';
import type { Holding, HoldingMetadata } from '../types';

export function HoldingsTable() {
  const { holdings, holdingMetadata, updateHoldingMetadata } = usePortfolio();
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

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

  const handleSaveMetadata = (metadata: HoldingMetadata) => {
    updateHoldingMetadata(metadata);
  };

  return (
    <>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Holdings</h2>
          <p className="text-xs text-slate-500 mt-1">Click a holding to add notes and tags</p>
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
                const metadata = holdingMetadata.get(holding.isin);
                const hasTags = metadata?.tags && metadata.tags.length > 0;
                const hasNotes = metadata?.notes && metadata.notes.length > 0;

                return (
                  <tr
                    key={holding.isin}
                    onClick={() => setSelectedHolding(holding)}
                    className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{holding.product}</p>
                          {hasTags && <Tag className="w-3 h-3 text-emerald-400" />}
                          {hasNotes && <FileText className="w-3 h-3 text-blue-400" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-slate-500">{holding.isin}</p>
                          {metadata?.sector && (
                            <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                              {metadata.sector}
                            </span>
                          )}
                        </div>
                        {hasTags && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {metadata!.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {metadata!.tags.length > 3 && (
                              <span className="text-xs text-slate-500">
                                +{metadata!.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
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

      {selectedHolding && (
        <HoldingDetails
          holding={selectedHolding}
          metadata={holdingMetadata.get(selectedHolding.isin)}
          onClose={() => setSelectedHolding(null)}
          onSave={handleSaveMetadata}
        />
      )}
    </>
  );
}
