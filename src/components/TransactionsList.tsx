import { useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Coins,
  Banknote,
  Receipt,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { Transaction } from '../types';
import { formatCurrency } from '../utils/calculations';

const typeIcons: Record<Transaction['type'], React.ReactNode> = {
  buy: <ArrowDownCircle className="w-4 h-4 text-red-400" />,
  sell: <ArrowUpCircle className="w-4 h-4 text-emerald-400" />,
  dividend: <Coins className="w-4 h-4 text-amber-400" />,
  deposit: <Banknote className="w-4 h-4 text-blue-400" />,
  withdrawal: <Banknote className="w-4 h-4 text-purple-400" />,
  fee: <Receipt className="w-4 h-4 text-slate-400" />,
};

const typeLabels: Record<Transaction['type'], string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  fee: 'Fee',
};

export function TransactionsList() {
  const { transactions, deleteTransaction } = usePortfolio();
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<Transaction['type'] | 'all'>('all');

  const filteredTransactions = transactions
    .filter((t) => filter === 'all' || t.type === filter)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const displayedTransactions = isExpanded
    ? filteredTransactions
    : filteredTransactions.slice(0, 5);

  const handleDelete = (id: string, product: string) => {
    if (window.confirm(`Delete transaction for ${product}?`)) {
      deleteTransaction(id);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="px-5 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Transaction['type'] | 'all')}
            className="bg-slate-700 border border-slate-600 text-sm text-white rounded-lg px-3 py-1.5 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Types</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="dividend">Dividend</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="fee">Fee</option>
          </select>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="p-8 text-center text-slate-500">No transactions found</div>
      ) : (
        <>
          <div className="divide-y divide-slate-700">
            {displayedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="px-5 py-3 flex items-center gap-4 hover:bg-slate-700/30 transition-colors group"
              >
                <div className="p-2 bg-slate-700/50 rounded-lg">
                  {typeIcons[transaction.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {transaction.product}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(transaction.date, 'dd MMM yyyy')} &bull; {typeLabels[transaction.type]}
                    {transaction.quantity !== 0 && ` &bull; ${Math.abs(transaction.quantity)} shares`}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      transaction.type === 'sell' || transaction.type === 'dividend'
                        ? 'text-emerald-400'
                        : transaction.type === 'buy'
                        ? 'text-red-400'
                        : 'text-white'
                    }`}
                  >
                    {transaction.type === 'sell' || transaction.type === 'dividend' ? '+' : '-'}
                    {formatCurrency(transaction.totalAmount, transaction.currency)}
                  </p>
                  {transaction.currency !== 'EUR' && transaction.exchangeRate && (
                    <p className="text-xs text-slate-500">
                      ≈ {formatCurrency(transaction.totalAmount * transaction.exchangeRate)}
                    </p>
                  )}
                  {transaction.fees && (
                    <p className="text-xs text-slate-500">Fee: {formatCurrency(transaction.fees, transaction.currency)}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(transaction.id, transaction.product)}
                  className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete transaction"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {filteredTransactions.length > 5 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-5 py-3 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/30 transition-colors border-t border-slate-700"
            >
              {isExpanded ? (
                <>
                  Show Less <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Show All ({filteredTransactions.length}) <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
