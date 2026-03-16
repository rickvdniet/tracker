import { useState } from 'react';
import { Plus, X, ChevronDown, Loader2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { Transaction } from '../types';
import { fetchExchangeRate } from '../utils/priceApi';

const CURRENCIES = ['EUR', 'SEK', 'USD', 'GBP', 'NOK', 'DKK', 'CHF'];

interface AddTransactionFormProps {
  onClose?: () => void;
}

export function AddTransactionForm({ onClose }: AddTransactionFormProps) {
  const { addTransactions, holdings, exchangeRates, updateExchangeRates } = usePortfolio();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'buy' as Transaction['type'],
    product: '',
    isin: '',
    quantity: '',
    price: '',
    fees: '',
    currency: 'EUR',
    exchangeRate: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [fetchingRate, setFetchingRate] = useState(false);

  const handleCurrencyChange = async (currency: string) => {
    setFormData((prev) => ({ ...prev, currency, exchangeRate: '' }));
    if (currency === 'EUR') return;
    // Pre-fill with known rate if available
    const known = exchangeRates.get(currency);
    if (known) {
      setFormData((prev) => ({ ...prev, currency, exchangeRate: known.toFixed(6) }));
      return;
    }
    setFetchingRate(true);
    const rate = await fetchExchangeRate(currency);
    setFetchingRate(false);
    if (rate) {
      setFormData((prev) => ({ ...prev, exchangeRate: rate.toFixed(6) }));
      const newRates = new Map(exchangeRates);
      newRates.set(currency, rate);
      updateExchangeRates(newRates);
    }
  };

  const handleSelectHolding = (isin: string) => {
    const holding = holdings.find((h) => h.isin === isin);
    if (holding) {
      setFormData((prev) => ({
        ...prev,
        product: holding.product,
        isin: holding.isin,
        currency: holding.currency || 'EUR',
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.product.trim()) {
      setError('Product name is required');
      return;
    }

    const quantity = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.price) || 0;
    const fees = parseFloat(formData.fees) || 0;

    if ((formData.type === 'buy' || formData.type === 'sell') && (quantity <= 0 || price <= 0)) {
      setError('Quantity and price are required for buy/sell transactions');
      return;
    }

    const totalAmount = formData.type === 'buy' || formData.type === 'sell'
      ? quantity * price
      : parseFloat(formData.price) || 0;

    const exchangeRate = formData.currency !== 'EUR' && formData.exchangeRate
      ? parseFloat(formData.exchangeRate)
      : undefined;

    const transaction: Transaction = {
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      date: new Date(formData.date),
      type: formData.type,
      product: formData.product.trim(),
      isin: formData.isin.trim().toUpperCase(),
      quantity: formData.type === 'sell' ? -Math.abs(quantity) : quantity,
      price,
      totalAmount,
      currency: formData.currency,
      exchangeRate: exchangeRate && !isNaN(exchangeRate) ? exchangeRate : undefined,
      fees: fees > 0 ? fees : undefined,
      notes: formData.notes.trim() || undefined,
    };

    addTransactions([transaction]);

    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'buy',
      product: '',
      isin: '',
      quantity: '',
      price: '',
      fees: '',
      currency: 'EUR',
      exchangeRate: '',
      notes: '',
    });

    if (onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };

  if (!isOpen && !onClose) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
      >
        <Plus className="w-5 h-5" />
        Add Transaction
      </button>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Add Transaction</h2>
        <button
          onClick={handleClose}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Existing holding picker */}
        {holdings.length > 0 && (formData.type === 'buy' || formData.type === 'sell' || formData.type === 'dividend') && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Pick from existing holdings <span className="text-slate-500">(optional)</span>
            </label>
            <div className="relative">
              <select
                onChange={(e) => handleSelectHolding(e.target.value)}
                value={formData.isin}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white appearance-none focus:ring-emerald-500 focus:border-emerald-500 pr-8"
              >
                <option value="">— select a stock —</option>
                {holdings.map((h) => (
                  <option key={h.isin} value={h.isin}>
                    {h.product} ({h.isin})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Transaction['type'] })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="dividend">Dividend</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="fee">Fee</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Product Name *</label>
          <input
            type="text"
            value={formData.product}
            onChange={(e) => setFormData({ ...formData, product: e.target.value })}
            placeholder="e.g., Investor AB"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">ISIN</label>
          <input
            type="text"
            value={formData.isin}
            onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
            placeholder="e.g., SE0015811955"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Currency</label>
          <div className="grid grid-cols-4 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleCurrencyChange(c)}
                className={`py-2 text-sm rounded-lg border transition-colors font-medium ${
                  formData.currency === c
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {formData.currency !== 'EUR' && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Exchange Rate (1 {formData.currency} = ? EUR)
              {fetchingRate && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
            </label>
            <input
              type="number"
              value={formData.exchangeRate}
              onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
              placeholder="e.g. 0.088 for SEK"
              step="0.000001"
              min="0"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {formData.exchangeRate && formData.price && (formData.type === 'buy' || formData.type === 'sell') && formData.quantity && (
              <p className="text-xs text-slate-500 mt-1">
                ≈ {(parseFloat(formData.quantity) * parseFloat(formData.price) * parseFloat(formData.exchangeRate)).toFixed(2)} EUR
              </p>
            )}
          </div>
        )}

        {(formData.type === 'buy' || formData.type === 'sell') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="0"
                step="any"
                min="0"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Price ({formData.currency}) *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {(formData.type === 'dividend' || formData.type === 'deposit' || formData.type === 'withdrawal' || formData.type === 'fee') && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Amount ({formData.currency}) *</label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        )}

        {(formData.type === 'buy' || formData.type === 'sell') && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Transaction Fees ({formData.currency})</label>
            <input
              type="number"
              value={formData.fees}
              onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Optional notes..."
            rows={2}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
          >
            Add Transaction
          </button>
        </div>
      </form>
    </div>
  );
}
