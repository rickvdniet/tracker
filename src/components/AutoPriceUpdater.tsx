import { useState } from 'react';
import { RefreshCw, Check, AlertCircle, Edit2, Plus, Loader2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/calculations';
import { fetchPrices, isinToTicker, registerIsinMapping, type PriceResult } from '../utils/priceApi';

export function AutoPriceUpdater() {
  const { holdings, prices, updatePrices } = usePortfolio();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Map<string, PriceResult>>(new Map());
  const [editingIsin, setEditingIsin] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingTicker, setAddingTicker] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  if (holdings.length === 0) return null;

  const handleFetchAllPrices = async () => {
    setIsLoading(true);
    setResults(new Map());

    try {
      const isins = holdings.map((h) => h.isin).filter((isin) => isin);
      const priceResults = await fetchPrices(isins);
      setResults(priceResults);

      // Update prices in context (only for successful fetches)
      const newPrices = new Map(prices);
      priceResults.forEach((result, isin) => {
        if (!result.error && result.price > 0) {
          newPrices.set(isin, result.price);
        }
      });
      updatePrices(newPrices);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualEdit = (isin: string, currentPrice: number) => {
    setEditingIsin(isin);
    setEditValue(currentPrice.toFixed(2));
  };

  const handleSaveManual = (isin: string) => {
    const newPrice = parseFloat(editValue);
    if (!isNaN(newPrice) && newPrice > 0) {
      const newPrices = new Map(prices);
      newPrices.set(isin, newPrice);
      updatePrices(newPrices);
    }
    setEditingIsin(null);
    setEditValue('');
  };

  const handleAddTicker = (isin: string) => {
    if (newTicker.trim()) {
      registerIsinMapping(isin, newTicker.trim().toUpperCase());
      setAddingTicker(null);
      setNewTicker('');
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Price Updates</h2>
          {lastUpdated && (
            <p className="text-xs text-slate-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={handleFetchAllPrices}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {isLoading ? 'Fetching...' : 'Fetch All'}
        </button>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Auto-fetch prices from Yahoo Finance or edit manually.
      </p>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {holdings.map((holding) => {
          const ticker = isinToTicker(holding.isin);
          const result = results.get(holding.isin);
          const hasError = result?.error;
          const needsTicker = !ticker && holding.isin;

          return (
            <div
              key={holding.isin}
              className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{holding.product}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500">{holding.isin}</p>
                  {ticker && (
                    <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                      {ticker}
                    </span>
                  )}
                </div>
              </div>

              <div className="ml-4 flex items-center gap-2">
                {/* Status indicator */}
                {result && !hasError && (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
                {hasError && (
                  <div className="group relative">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-10">
                      <div className="bg-slate-700 text-xs text-slate-300 px-2 py-1 rounded whitespace-nowrap">
                        {result.error}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add ticker button for unknown ISINs */}
                {needsTicker && addingTicker !== holding.isin && (
                  <button
                    onClick={() => setAddingTicker(holding.isin)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}

                {/* Add ticker input */}
                {addingTicker === holding.isin && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value)}
                      placeholder="AAPL"
                      className="w-20 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAddTicker(holding.isin)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Price display/edit */}
                {editingIsin === holding.isin ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveManual(holding.isin);
                        if (e.key === 'Escape') setEditingIsin(null);
                      }}
                      className="w-20 px-2 py-1 text-sm text-right bg-slate-700 border border-slate-600 rounded text-white"
                      autoFocus
                      step="0.01"
                      min="0"
                    />
                    <button
                      onClick={() => handleSaveManual(holding.isin)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleManualEdit(holding.isin, holding.currentPrice)}
                    className="flex items-center gap-1 text-sm text-slate-300 hover:text-white group"
                  >
                    <span>{formatCurrency(holding.currentPrice)}</span>
                    <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}

                {/* Change indicator */}
                {result && !hasError && result.changePercent !== 0 && (
                  <span
                    className={`text-xs ${
                      result.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {result.changePercent >= 0 ? '+' : ''}
                    {result.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Note: Price fetching may be blocked by CORS. Manual editing is always available.
      </p>
    </div>
  );
}
