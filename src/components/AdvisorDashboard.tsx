import { useMemo } from 'react';
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Zap,
  Compass,
  HelpCircle,
} from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/calculations';
import {
  analyzePortfolio,
  SPECULATIVE_RULES,
  MONTHLY_BUDGET,
  CATEGORY_LABELS,
  type AllocationStatus,
} from '../utils/advisor';

function AllocationBar({ alloc }: { alloc: AllocationStatus }) {
  const { asset, currentPercent, status } = alloc;
  const maxScale = Math.max(asset.targetMax + 5, currentPercent + 2);

  const currentBarPct = (currentPercent / maxScale) * 100;
  const targetMinPct = (asset.targetMin / maxScale) * 100;
  const targetMaxPct = (asset.targetMax / maxScale) * 100;

  const barColor =
    status === 'in-range' ? 'bg-emerald-500' : status === 'underweight' ? 'bg-amber-500' : 'bg-red-500';
  const cat = CATEGORY_LABELS[asset.category];

  return (
    <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded border text-white font-semibold ${cat.badgeClass}`}>
              {cat.icon} {cat.short}
            </span>
            <span className="text-sm font-medium text-white">{asset.name}</span>
          </div>
          <p className="text-xs text-slate-500">{asset.description}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${
            status === 'in-range' ? 'text-emerald-400' : status === 'underweight' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {currentPercent.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500">
            target {asset.targetMin}-{asset.targetMax}%
          </p>
        </div>
      </div>

      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-slate-600/60"
          style={{ left: `${targetMinPct}%`, width: `${targetMaxPct - targetMinPct}%` }}
        />
        <div className={`absolute h-full ${barColor} rounded-full transition-all`} style={{ width: `${currentBarPct}%` }} />
      </div>

      <div className="flex justify-between items-center mt-2 text-xs">
        <span className="text-slate-500">
          {formatCurrency(alloc.currentValue)}
        </span>
        <span className={
          status === 'in-range' ? 'text-emerald-400' :
          status === 'underweight' ? 'text-amber-400' : 'text-red-400'
        }>
          {alloc.deviation >= 0 ? '+' : ''}{alloc.deviation.toFixed(1)}pp vs midpoint
        </span>
      </div>

      {/* Contributing holdings */}
      {alloc.holdings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700 space-y-1">
          {alloc.holdings.map((h) => (
            <div key={h.isin} className="flex items-center justify-between text-xs">
              <span className="text-slate-400 truncate mr-2">{h.product}</span>
              <span className="text-slate-500 shrink-0">{formatCurrency(h.currentValue)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdvisorDashboard() {
  const { holdings, historicalPrices, holdingMetadata } = usePortfolio();

  const analysis = useMemo(
    () => analyzePortfolio(holdings, historicalPrices, holdingMetadata),
    [holdings, historicalPrices, holdingMetadata]
  );

  if (holdings.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center">
          <Compass className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No holdings yet</h3>
          <p className="text-sm text-slate-500">
            Import your portfolio to get personalized allocation advice
          </p>
        </div>
      </div>
    );
  }

  const speculativeOverLimit = analysis.speculativePercent > SPECULATIVE_RULES.maxTotal;

  return (
    <div className="space-y-6">
      {/* Framework Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/60 rounded-xl border border-slate-700 p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Compass className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Lead Portfolio Architect</h2>
            <p className="text-sm text-slate-400 mt-1">
              Data-driven advice based on the <span className="text-emerald-400 font-medium">Hard-Growth Framework</span>. €{MONTHLY_BUDGET}/month budget · max 2 transactions.
            </p>
          </div>
        </div>
      </div>

      {/* Unassigned holdings warning */}
      {analysis.unassignedHoldings.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-400 mb-1">
                {analysis.unassignedHoldings.length} holding{analysis.unassignedHoldings.length > 1 ? 's' : ''} without a category
              </p>
              <p className="text-xs text-slate-300 mb-2">
                Click a holding in the Portfolio tab and assign it a framework category (Core / Turbo / Frontier / Proxy / Speculative). Unassigned holdings don't count toward any bucket.
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.unassignedHoldings.map((h) => (
                  <span key={h.isin} className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded">
                    {h.product}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Recommendation */}
      <div className={`rounded-xl border p-5 ${
        analysis.recommendation.blocked
          ? 'bg-red-500/10 border-red-500/40'
          : 'bg-emerald-500/10 border-emerald-500/40'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${
            analysis.recommendation.blocked ? 'bg-red-500/20' : 'bg-emerald-500/20'
          }`}>
            {analysis.recommendation.blocked ? (
              <Ban className="w-6 h-6 text-red-400" />
            ) : (
              <Target className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-white">
                {analysis.recommendation.blocked ? 'HOLD — No Deploy' : 'Next Deploy'}
              </h3>
              {analysis.recommendation.asset && !analysis.recommendation.blocked && (
                <span className="text-emerald-400 font-bold">
                  → {analysis.recommendation.asset.ticker}
                </span>
              )}
            </div>
            <p className="text-slate-300 text-sm">{analysis.recommendation.reason}</p>
            {!analysis.recommendation.blocked && analysis.recommendation.amount > 0 && (
              <div className="mt-3 flex items-center gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white font-semibold ml-2">
                    {formatCurrency(analysis.recommendation.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Order type:</span>
                  <span className="text-white font-semibold ml-2">Limit @ Tradegate</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Iron Laws status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-4 ${
          analysis.harvestAlerts.length > 0
            ? 'bg-red-500/10 border-red-500/40'
            : 'bg-slate-800 border-slate-700'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {analysis.harvestAlerts.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
            <h4 className="text-sm font-semibold text-white">Harvest Rule</h4>
          </div>
          {analysis.harvestAlerts.length > 0 ? (
            <div className="space-y-1">
              {analysis.harvestAlerts.map((a) => (
                <p key={a.holding.isin} className="text-xs text-slate-300">
                  <span className="font-semibold">{a.holding.product}</span> at {a.currentPercent.toFixed(1)}% —
                  <span className="text-red-400"> sell {formatCurrency(a.amountToSell)}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">All individual stocks ≤10%. ETFs are exempt.</p>
          )}
        </div>

        <div className={`rounded-xl border p-4 ${
          analysis.fomoAlerts.length > 0
            ? 'bg-amber-500/10 border-amber-500/40'
            : 'bg-slate-800 border-slate-700'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {analysis.fomoAlerts.length > 0 ? (
              <TrendingUp className="w-5 h-5 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
            <h4 className="text-sm font-semibold text-white">FOMO Blockade</h4>
          </div>
          {analysis.fomoAlerts.length > 0 ? (
            <div className="space-y-1">
              {analysis.fomoAlerts.map((a) => (
                <p key={a.isin} className="text-xs text-slate-300">
                  <span className="font-semibold">{a.product}</span>: <span className="text-amber-400">+{a.return30d.toFixed(1)}%</span> in 30d — no-buy
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No assets overheated (30d ≤ 10%).</p>
          )}
        </div>

        <div className={`rounded-xl border p-4 ${
          analysis.dipAlerts.length > 0
            ? 'bg-emerald-500/10 border-emerald-500/40'
            : 'bg-slate-800 border-slate-700'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {analysis.dipAlerts.length > 0 ? (
              <Zap className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-slate-500" />
            )}
            <h4 className="text-sm font-semibold text-white">Dip Priority</h4>
          </div>
          {analysis.dipAlerts.length > 0 ? (
            <div className="space-y-1">
              {analysis.dipAlerts.map((a) => (
                <p key={a.holding.isin} className="text-xs text-slate-300">
                  <span className="font-semibold">{a.asset.name}</span>: <span className="text-emerald-400">{a.drop30d.toFixed(1)}%</span> in 30d — BUY signal
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No core-asset dips triggered (need &gt;5% drop).</p>
          )}
        </div>
      </div>

      {/* Allocation grid */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Current vs Target Allocation</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {analysis.allocations.map((alloc) => (
            <AllocationBar key={alloc.asset.key} alloc={alloc} />
          ))}
        </div>
      </div>

      {/* Speculative bucket */}
      <div className={`rounded-xl border p-5 ${
        speculativeOverLimit ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-800 border-slate-700'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 border border-red-500 text-white font-semibold">
              🎲 SPECULATIVE
            </span>
            <h4 className="text-sm font-semibold text-white">Alpha Bucket</h4>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${speculativeOverLimit ? 'text-red-400' : 'text-white'}`}>
              {analysis.speculativePercent.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">max {SPECULATIVE_RULES.maxTotal}% total · {SPECULATIVE_RULES.maxPerPosition}% per position</p>
          </div>
        </div>
        {analysis.speculativeHoldings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700 space-y-1">
            {analysis.speculativeHoldings.map((h) => {
              const pct = analysis.totalValue > 0 ? (h.currentValue / analysis.totalValue) * 100 : 0;
              const overSingle = pct > SPECULATIVE_RULES.maxPerPosition;
              return (
                <div key={h.isin} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate mr-2">{h.product}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={overSingle ? 'text-red-400' : 'text-slate-500'}>{pct.toFixed(1)}%</span>
                    <span className="text-slate-500">{formatCurrency(h.currentValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {speculativeOverLimit && (
          <p className="text-xs text-red-400 mt-2">
            ⚠️ Speculative allocation over {SPECULATIVE_RULES.maxTotal}% limit — reduce exposure.
          </p>
        )}
      </div>

      {/* Execution protocol */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
        <h4 className="text-sm font-semibold text-white mb-3">Execution Protocol</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-500">Budget</p>
            <p className="text-white font-medium">€{MONTHLY_BUDGET}/month</p>
          </div>
          <div>
            <p className="text-slate-500">Timing</p>
            <p className="text-white font-medium">26th, 15:45 (US open)</p>
          </div>
          <div>
            <p className="text-slate-500">Order</p>
            <p className="text-white font-medium">Limit @ Tradegate</p>
          </div>
          <div>
            <p className="text-slate-500">Max transactions</p>
            <p className="text-white font-medium">2/month</p>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-500 text-center">
        Portfolio total: {formatCurrency(analysis.totalValue)} · Analysis based on {holdings.length} holdings
        {' · '}
        <span className="text-slate-600">Not financial advice — for personal use.</span>
      </div>
    </div>
  );
}
