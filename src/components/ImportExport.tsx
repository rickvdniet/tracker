import { useRef, useState } from 'react';
import { Upload, Download, Trash2, FileText, AlertCircle, CheckCircle, Wrench, Loader2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { parseDeGiroTransactions, exportTransactionsToCSV } from '../utils/csvParser';
import { exportAllData, importAllData, migrateTransactionCurrencies } from '../utils/storage';
import { fetchExchangeRate } from '../utils/priceApi';

export function ImportExport() {
  const { transactions, addTransactions, clearAll, exchangeRates, updateExchangeRates } = usePortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const newTransactions = parseDeGiroTransactions(text);

      if (newTransactions.length === 0) {
        setStatus({ type: 'error', message: 'No valid transactions found in the file' });
        setIsImporting(false);
        return;
      }

      addTransactions(newTransactions);

      // Auto-fetch exchange rates for non-EUR currencies
      const currencies = new Set<string>();
      newTransactions.forEach((t) => {
        if (t.currency && t.currency !== 'EUR') {
          currencies.add(t.currency);
        }
      });

      if (currencies.size > 0) {
        setStatus({ type: 'success', message: `Imported ${newTransactions.length} transactions. Fetching exchange rates...` });
        const newRates = new Map(exchangeRates);
        for (const currency of currencies) {
          const rate = await fetchExchangeRate(currency);
          if (rate) {
            newRates.set(currency, rate);
            console.log(`Fetched ${currency} rate:`, rate);
          }
        }
        updateExchangeRates(newRates);
        setStatus({ type: 'success', message: `Imported ${newTransactions.length} transactions with exchange rates` });
      } else {
        setStatus({ type: 'success', message: `Imported ${newTransactions.length} transactions` });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to parse CSV file' });
      console.error(error);
    } finally {
      setIsImporting(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleJsonImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = importAllData(text);

      if (success) {
        setStatus({ type: 'success', message: 'Data imported successfully. Refresh the page.' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus({ type: 'error', message: 'Failed to import data' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Invalid JSON file' });
    }

    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
    }
  };

  const handleExportCSV = () => {
    const csv = exportTransactionsToCSV(transactions);
    downloadFile(csv, 'degiro-transactions.csv', 'text/csv');
    setStatus({ type: 'success', message: 'Transactions exported' });
  };

  const handleExportJSON = () => {
    const json = exportAllData();
    downloadFile(json, 'degiro-portfolio-backup.json', 'application/json');
    setStatus({ type: 'success', message: 'Backup created' });
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all data? This cannot be undone.')) {
      clearAll();
      setStatus({ type: 'success', message: 'All data cleared' });
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Import / Export</h2>

      {status && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            status.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm">{status.message}</span>
          <button onClick={() => setStatus(null)} className="ml-auto text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-sm text-slate-400 mb-2">Import DeGiro transactions (CSV)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg transition-colors"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={transactions.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            Backup
          </button>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-2">Restore from backup (JSON)</p>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={handleJsonImport}
            className="hidden"
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Restore Backup
          </button>
        </div>

        <hr className="border-slate-700" />

        <div>
          <p className="text-sm text-slate-400 mb-2">Fix currencies using ISIN mapping</p>
          <button
            onClick={() => {
              const corrected = migrateTransactionCurrencies();
              if (corrected > 0) {
                setStatus({ type: 'success', message: `Fixed ${corrected} transaction(s). Refresh the page.` });
                setTimeout(() => window.location.reload(), 1500);
              } else {
                setStatus({ type: 'success', message: 'No currencies needed fixing' });
              }
            }}
            disabled={transactions.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wrench className="w-4 h-4" />
            Fix Currencies
          </button>
        </div>

        <hr className="border-slate-700" />

        <button
          onClick={handleClearAll}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Data
        </button>
      </div>
    </div>
  );
}
