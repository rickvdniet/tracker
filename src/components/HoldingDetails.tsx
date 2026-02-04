import { useState } from 'react';
import { X, Tag, FileText, Save, Plus } from 'lucide-react';
import type { Holding, HoldingMetadata } from '../types';
import { formatCurrency, formatPercent } from '../utils/calculations';

interface HoldingDetailsProps {
  holding: Holding;
  onClose: () => void;
  onSave: (metadata: HoldingMetadata) => void;
  metadata?: HoldingMetadata;
}

const PRESET_TAGS = [
  'Tech',
  'Healthcare',
  'Finance',
  'Energy',
  'Consumer',
  'Industrial',
  'ETF',
  'Dividend',
  'Growth',
  'Value',
  'US',
  'EU',
  'Emerging',
];

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Energy',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Materials',
  'Real Estate',
  'Utilities',
  'Communication Services',
  'ETF/Fund',
];

export function HoldingDetails({ holding, onClose, onSave, metadata }: HoldingDetailsProps) {
  const [tags, setTags] = useState<string[]>(metadata?.tags || []);
  const [notes, setNotes] = useState(metadata?.notes || '');
  const [sector, setSector] = useState(metadata?.sector || '');
  const [dividendYield, setDividendYield] = useState(metadata?.dividendYield?.toString() || '');
  const [newTag, setNewTag] = useState('');

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.trim();
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags([...tags, normalizedTag]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    onSave({
      isin: holding.isin,
      tags,
      notes,
      sector,
      dividendYield: dividendYield ? parseFloat(dividendYield) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{holding.product}</h2>
            <p className="text-sm text-slate-400">{holding.isin}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-700/50 rounded-lg">
            <div>
              <p className="text-xs text-slate-400">Current Value</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(holding.currentValue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">P/L</p>
              <p className={`text-lg font-semibold ${holding.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(holding.profitLoss)} ({formatPercent(holding.profitLossPercent)})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Quantity</p>
              <p className="text-lg font-semibold text-white">{holding.quantity.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Avg. Cost</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(holding.averageCost)}</p>
            </div>
          </div>

          {/* Sector */}
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <Tag className="w-4 h-4" />
              Sector
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select sector...</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Dividend Yield */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Expected Dividend Yield (%)
            </label>
            <input
              type="number"
              value={dividendYield}
              onChange={(e) => setDividendYield(e.target.value)}
              placeholder="e.g., 2.5"
              step="0.1"
              min="0"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>

            {/* Current Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-sm rounded-md"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-emerald-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Custom Tag */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(newTag)}
                placeholder="Add custom tag..."
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                onClick={() => handleAddTag(newTag)}
                disabled={!newTag.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Preset Tags */}
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-md transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <FileText className="w-4 h-4" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this holding..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
