import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/calculations';
import { PieChart as PieChartIcon } from 'lucide-react';

const COLORS = [
  '#10b981', // emerald
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#ef4444', // red
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; percentage: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-white mb-1">{data.name}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-slate-400">Value:</span>
          <span className="text-xs text-white">{formatCurrency(data.value)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-slate-400">Allocation:</span>
          <span className="text-xs text-white">{data.percentage.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function AllocationChart() {
  const { holdings, stats } = usePortfolio();

  if (holdings.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <PieChartIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No allocation data</h3>
          <p className="text-sm text-slate-500">Import transactions to see allocation</p>
        </div>
      </div>
    );
  }

  const chartData = holdings.map((holding) => ({
    name: holding.product.length > 25 ? holding.product.substring(0, 25) + '...' : holding.product,
    fullName: holding.product,
    value: holding.currentValue,
    percentage: (holding.currentValue / stats.totalValue) * 100,
  }));

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h2>

      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
        {chartData.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-slate-300 truncate">{item.name}</span>
            </div>
            <span className="text-slate-400 ml-2 flex-shrink-0">{item.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
