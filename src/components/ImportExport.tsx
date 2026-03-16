import { useRef, useState } from 'react';
import { Upload, Download, Trash2, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { parseDeGiroTransactions, exportTransactionsToCSV } from '../utils/csvParser';
import { exportAllData, importAllData } from '../utils/storage';

export function ImportExport() {
  const { transactions, addTransactions, clearAll } = usePortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const newTransactions = parseDeGiroTransactions(text);

      if (newTransactions.length === 0) {
        setStatus({ type: 'error', message: 'No valid transactions found in the file' });
        return;
      }

      addTransactions(newTransactions);
      setStatus({ type: 'success', message: `Imported ${newTransactions.length} transactions` });
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to parse CSV file' });
      console.error(error);
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
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
