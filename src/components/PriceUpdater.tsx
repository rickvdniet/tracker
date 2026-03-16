import { useState } from 'react';
import { RefreshCw, Check, Edit2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/calculations';

export function PriceUpdater() {
  const { holdings, prices, updatePrices } = usePortfolio();
  const [editingIsin, setEditingIsin] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (holdings.length === 0) return null;

  const handleEdit = (isin: string, currentPrice: number) => {
    setEditingIsin(isin);
    setEditValue(currentPrice.toFixed(2));
  };

  const handleSave = (isin: string) => {
    const newPrice = parseFloat(editValue);
    if (!isNaN(newPrice) && newPrice > 0) {
      const newPrices = new Map(prices);
      newPrices.set(isin, newPrice);
      updatePrices(newPrices);
    }
    setEditingIsin(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, isin: string) => {
    if (e.key === 'Enter') {
      handleSave(isin);
    } else if (e.key === 'Escape') {
      setEditingIsin(null);
      setEditValue('');
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Update Prices</h2>
        <RefreshCw className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Click on a price to update it with the current market value.
      </p>
      <div className="space-y-2">
        {holdings.map((holding) => (
          <div
            key={holding.isin}
            className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{holding.product}</p>
              <p className="text-xs text-slate-500">{holding.isin}</p>
            </div>
            <div className="ml-4">
              {editingIsin === holding.isin ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, holding.isin)}
                    className="w-24 px-2 py-1 text-sm text-right bg-slate-700 border border-slate-600 rounded focus:ring-emerald-500 focus:border-emerald-500 text-white"
                    autoFocus
                    step="0.01"
                    min="0"
                  />
                  <button
                    onClick={() => handleSave(holding.isin)}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleEdit(holding.isin, holding.currentPrice)}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white group"
                >
                  <span>{formatCurrency(holding.currentPrice)}</span>
                  <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
