import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { Transaction } from '../types';

interface AddTransactionFormProps {
  onClose?: () => void;
}

export function AddTransactionForm({ onClose }: AddTransactionFormProps) {
  const { addTransactions } = usePortfolio();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'buy' as Transaction['type'],
    product: '',
    isin: '',
    quantity: '',
    price: '',
    fees: '',
    notes: '',
  });
  const [error, setError] = useState('');

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

    const transaction: Transaction = {
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      date: new Date(formData.date),
      type: formData.type,
      product: formData.product.trim(),
      isin: formData.isin.trim().toUpperCase(),
      quantity: formData.type === 'sell' ? -Math.abs(quantity) : quantity,
      price,
      totalAmount,
      currency: 'EUR',
      fees: fees > 0 ? fees : undefined,
      notes: formData.notes.trim() || undefined,
    };

    addTransactions([transaction]);

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'buy',
      product: '',
      isin: '',
      quantity: '',
      price: '',
      fees: '',
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
            placeholder="e.g., Apple Inc."
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">ISIN</label>
          <input
            type="text"
            value={formData.isin}
            onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
            placeholder="e.g., US0378331005"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

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
              <label className="block text-sm text-slate-400 mb-1">Price per share *</label>
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
            <label className="block text-sm text-slate-400 mb-1">Amount *</label>
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
            <label className="block text-sm text-slate-400 mb-1">Transaction Fees</label>
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
