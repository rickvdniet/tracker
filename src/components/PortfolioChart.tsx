import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { filterSnapshotsByTimeRange, formatCurrency, formatPercent, type ChartGranularity } from '../utils/calculations';
import { isinToTicker } from '../utils/priceApi';
import type { TimeRange } from '../types';

const granularityOptions: { value: ChartGranularity; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

interface ChartPoint {
  date: string;
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: string;
}

function CustomTooltip({ active, payload, label, granularity }: CustomTooltipProps & { granularity?: ChartGranularity }) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  const data = payload[0].payload;
  const pct = data.totalInvested > 0 ? (data.totalProfitLoss / data.totalInvested) * 100 : 0;
  const dateFormat = granularity === 'weekly' ? 'd MMM yyyy' : 'MMM yyyy';

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-lg">
      <p className="text-sm text-slate-400 mb-2">{format(new Date(label), dateFormat)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-sm text-slate-300">Value:</span>
          <span className="text-sm font-medium text-white">{formatCurrency(data.totalValue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-slate-300">Invested:</span>
          <span className="text-sm text-slate-400">{formatCurrency(data.totalInvested)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-slate-300">P/L:</span>
          <span className={`text-sm font-medium ${data.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(data.totalProfitLoss)} ({formatPercent(pct)})
          </span>
        </div>
      </div>
    </div>
  );
}

export function PortfolioChart() {
  const {
    snapshots,
    holdings,
    historicalPrices,
    historicalPricesLoading,
    selectedTimeRange,
    setTimeRange,
    chartGranularity,
    setChartGranularity,
    fetchHistoricalData,
  } = usePortfolio();

  const [selectedIsin, setSelectedIsin] = useState<string>('portfolio');

  const filteredSnapshots = filterSnapshotsByTimeRange(snapshots, selectedTimeRange);

  // ISINs that have a ticker mapping (and thus can have historical prices fetched)
  const fetchableIsins = holdings.map((h) => h.isin).filter((isin) => isinToTicker(isin));
  const missingHistorical = fetchableIsins.filter((isin) => !historicalPrices.has(isin));
  const hasHistoricalData = historicalPrices.size > 0;

  // Build chart data depending on selected view
  const chartData: ChartPoint[] = (() => {
    if (selectedIsin === 'portfolio') {
      return filteredSnapshots.map((s) => ({
        date: s.date.toISOString(),
        totalValue: s.totalValue,
        totalInvested: s.totalInvested,
        totalProfitLoss: s.totalProfitLoss,
      }));
    }

    // Individual stock view — extract that holding from each snapshot
    return filteredSnapshots
      .map((s) => {
        const h = s.holdings.find((holding) => holding.isin === selectedIsin);
        if (!h || h.totalCost <= 0) return null;
        return {
          date: s.date.toISOString(),
          totalValue: h.currentValue,
          totalInvested: h.totalCost,
          totalProfitLoss: h.profitLoss,
        };
      })
      .filter((d): d is ChartPoint => d !== null);
  })();

  const selectedHolding = holdings.find((h) => h.isin === selectedIsin);
  const latestProfitLoss = chartData.length > 0 ? chartData[chartData.length - 1].totalProfitLoss : 0;
  const latestInvested = chartData.length > 0 ? chartData[chartData.length - 1].totalInvested : 0;
  const latestPct = latestInvested > 0 ? (latestProfitLoss / latestInvested) * 100 : 0;

  if (chartData.length === 0 && snapshots.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No data to display</h3>
          <p className="text-sm text-slate-500">Import transactions to see your portfolio growth</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white mr-auto">Performance</h2>

        {/* Stock selector */}
        {holdings.length > 0 && (
          <select
            value={selectedIsin}
            onChange={(e) => setSelectedIsin(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-sm text-white rounded-lg px-3 py-1.5 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="portfolio">Entire Portfolio</option>
            {holdings.map((h) => (
              <option key={h.isin} value={h.isin}>
                {h.product}
              </option>
            ))}
          </select>
        )}

        {/* Granularity toggle */}
        <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
          {granularityOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setChartGranularity(value)}
              className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                chartGranularity === value
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time range buttons */}
        <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
          {timeRanges.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedTimeRange === value
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Historical data banner */}
      {!hasHistoricalData && fetchableIsins.length > 0 && (
        <div className="mb-4 flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm text-white font-medium">Load historical prices</p>
            <p className="text-xs text-slate-400">
              Fetches real monthly prices from Yahoo Finance so the chart shows actual past performance.
            </p>
          </div>
          <button
            onClick={() => fetchHistoricalData(fetchableIsins)}
            disabled={historicalPricesLoading}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors shrink-0 ml-4"
          >
            {historicalPricesLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {historicalPricesLoading ? 'Fetching…' : 'Load'}
          </button>
        </div>
      )}

      {/* Subtitle row — current P/L summary + refresh button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {selectedHolding ? (
            <p className="text-sm text-slate-400">
              {selectedHolding.product} &bull;{' '}
              <span className={latestProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {formatCurrency(latestProfitLoss)} ({formatPercent(latestPct)})
              </span>
            </p>
          ) : (
            chartData.length > 0 && (
              <p className="text-sm text-slate-400">
                <span className={latestProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {latestProfitLoss >= 0 ? '+' : ''}{formatCurrency(latestProfitLoss)} ({formatPercent(latestPct)})
                </span>
                {' '}total return
              </p>
            )
          )}
        </div>
        {hasHistoricalData && fetchableIsins.length > 0 && (
          <button
            onClick={() => fetchHistoricalData(missingHistorical.length > 0 ? fetchableIsins : fetchableIsins)}
            disabled={historicalPricesLoading}
            title="Refresh historical prices"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            {historicalPricesLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {historicalPricesLoading ? 'Fetching…' : 'Refresh prices'}
          </button>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
          No data for this holding in the selected time range
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), chartGranularity === 'weekly' ? 'd MMM' : 'MMM yy')}
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip granularity={chartGranularity} />} />
              <Area
                type="monotone"
                dataKey="totalInvested"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#investedGradient)"
                name="Invested"
              />
              <Area
                type="monotone"
                dataKey="totalValue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#valueGradient)"
                name="Value"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-400">
            {selectedIsin === 'portfolio' ? 'Portfolio Value' : 'Current Value'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-sm text-slate-400">Amount Invested</span>
        </div>
      </div>
    </div>
  );
}
