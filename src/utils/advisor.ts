import type { Holding, HoldingMetadata, FrameworkCategory } from '../types';

// Hard-Growth Framework configuration
// Each framework asset represents one target bucket (Core, Turbo, etc.).
// Holdings are assigned to a bucket either via user metadata (frameworkCategory)
// or by falling back to the default ISIN mapping.
export interface FrameworkAsset {
  key: string;
  name: string;
  ticker: string;
  defaultIsins: string[]; // used as fallback when user hasn't set frameworkCategory
  category: FrameworkCategory;
  targetMin: number; // percent
  targetMax: number; // percent
  description: string;
}

export const FRAMEWORK: FrameworkAsset[] = [
  {
    key: 'core',
    name: 'VWCE (Vanguard All-World)',
    ticker: 'VWCE.DE',
    defaultIsins: ['IE00BK5BQT80'],
    category: 'core',
    targetMin: 55,
    targetMax: 60,
    description: 'THE CORE: Global equity floor. Protection against regional implosions.',
  },
  {
    key: 'turbo',
    name: 'Nasdaq-100 (SXRV / Xtrackers)',
    ticker: 'SXRV.DE',
    defaultIsins: ['IE00BMFKG444', 'IE00BMW42181'],
    category: 'turbo',
    targetMin: 20,
    targetMax: 25,
    description: 'THE TURBO: Growth accelerator. Tech outperformance, higher volatility accepted.',
  },
  {
    key: 'frontier',
    name: 'WSML / STST (Small Cap Block)',
    ticker: 'WSML.L',
    defaultIsins: ['IE00BF4RFH31', 'IE00BCBJG560'],
    category: 'frontier',
    targetMin: 10,
    targetMax: 15,
    description: 'THE FRONTIER: Size premium harvesting. Treat both tickers as one block.',
  },
  {
    key: 'proxy',
    name: 'INVE-B (Investor AB)',
    ticker: 'INVE-B.ST',
    defaultIsins: ['SE0015811955', 'SE0015811963'],
    category: 'proxy',
    targetMin: 5,
    targetMax: 7.5,
    description: 'THE PROXY: European industrial + PE exposure with NAV discount.',
  },
];

export const SPECULATIVE_RULES = {
  maxPerPosition: 5,
  maxTotal: 10,
  knownIsins: ['NL0012866412'], // BESI etc. — defaults into speculative bucket
};

export const IRON_LAWS = {
  harvestThreshold: 10,
  harvestTargetAfter: 5,
  fomoBlockadeMonthlyReturn: 10,
  dipPriorityDrop: 5,
};

export const MONTHLY_BUDGET = 1000;

/**
 * Determine which framework category a holding belongs to.
 * Priority:
 *   1. User assignment via HoldingMetadata.frameworkCategory
 *   2. Framework asset default ISIN match
 *   3. Speculative default ISINs
 *   4. null (unassigned — treated as speculative)
 */
export function getHoldingCategory(
  isin: string,
  metadata: Map<string, HoldingMetadata>
): FrameworkCategory | null {
  const userCategory = metadata.get(isin)?.frameworkCategory;
  if (userCategory) return userCategory;

  for (const asset of FRAMEWORK) {
    if (asset.defaultIsins.includes(isin)) return asset.category;
  }

  if (SPECULATIVE_RULES.knownIsins.includes(isin)) return 'speculative';

  return null;
}

export interface AllocationStatus {
  asset: FrameworkAsset;
  currentValue: number;       // EUR — sum of all holdings in this category
  currentPercent: number;
  targetMidpoint: number;
  deviation: number;
  status: 'underweight' | 'in-range' | 'overweight';
  holdings: Holding[];         // all holdings contributing to this bucket
}

export interface HarvestAlert {
  holding: Holding;
  currentPercent: number;
  amountToSell: number;
}

export interface FomoAlert {
  isin: string;
  product: string;
  return30d: number;
}

export interface DipAlert {
  asset: FrameworkAsset;
  holding: Holding;
  drop30d: number;
}

export interface AdvisorAnalysis {
  totalValue: number;
  allocations: AllocationStatus[];
  speculativeHoldings: Holding[];
  speculativeValue: number;
  speculativePercent: number;
  unassignedHoldings: Holding[]; // holdings without any category (need attention)
  harvestAlerts: HarvestAlert[];
  fomoAlerts: FomoAlert[];
  dipAlerts: DipAlert[];
  recommendation: {
    asset: FrameworkAsset | null;
    reason: string;
    amount: number;
    blocked: boolean;
  };
}

function getReturn30d(
  isin: string,
  currentPrice: number,
  historicalPrices: Map<string, Array<{ date: string; price: number }>>
): number | null {
  const history = historicalPrices.get(isin);
  if (!history || history.length === 0 || currentPrice === 0) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const targetDateKey = thirtyDaysAgo.toISOString().substring(0, 10);

  const closest = [...history]
    .filter((p) => p.price > 0 && p.date <= targetDateKey)
    .pop();

  if (!closest) return null;
  return ((currentPrice - closest.price) / closest.price) * 100;
}

export function analyzePortfolio(
  holdings: Holding[],
  historicalPrices: Map<string, Array<{ date: string; price: number }>>,
  metadata: Map<string, HoldingMetadata>
): AdvisorAnalysis {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  // Group holdings by category
  const holdingsByCategory = new Map<FrameworkCategory | 'unassigned', Holding[]>();
  for (const holding of holdings) {
    const category = getHoldingCategory(holding.isin, metadata);
    const key = category ?? 'unassigned';
    const existing = holdingsByCategory.get(key) ?? [];
    existing.push(holding);
    holdingsByCategory.set(key, existing);
  }

  // Build allocation status for each framework asset (aggregating all holdings in that category)
  const allocations: AllocationStatus[] = FRAMEWORK.map((asset) => {
    const bucketHoldings = holdingsByCategory.get(asset.category) ?? [];
    const currentValue = bucketHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const targetMidpoint = (asset.targetMin + asset.targetMax) / 2;
    const deviation = currentPercent - targetMidpoint;

    let status: AllocationStatus['status'] = 'in-range';
    if (currentPercent < asset.targetMin) status = 'underweight';
    else if (currentPercent > asset.targetMax) status = 'overweight';

    return { asset, currentValue, currentPercent, targetMidpoint, deviation, status, holdings: bucketHoldings };
  });

  // Speculative bucket
  const speculativeHoldings = holdingsByCategory.get('speculative') ?? [];
  const speculativeValue = speculativeHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const speculativePercent = totalValue > 0 ? (speculativeValue / totalValue) * 100 : 0;

  const unassignedHoldings = holdingsByCategory.get('unassigned') ?? [];

  // Harvest alerts: only apply to non-ETF holdings (individual stocks + speculative)
  const harvestAlerts: HarvestAlert[] = holdings
    .filter((h) => {
      const cat = getHoldingCategory(h.isin, metadata);
      return cat === null || cat === 'proxy' || cat === 'speculative';
    })
    .map((h) => {
      const pct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
      return { holding: h, currentPercent: pct };
    })
    .filter(({ currentPercent }) => currentPercent > IRON_LAWS.harvestThreshold)
    .map(({ holding, currentPercent }) => ({
      holding,
      currentPercent,
      amountToSell: holding.currentValue - (totalValue * IRON_LAWS.harvestTargetAfter / 100),
    }));

  // FOMO and Dip alerts (per bucket, using dominant holding's 30d return)
  const fomoAlerts: FomoAlert[] = [];
  const dipAlerts: DipAlert[] = [];

  for (const alloc of allocations) {
    if (alloc.holdings.length === 0) continue;
    // Use the largest holding in the bucket as the representative for 30d return
    const dominant = [...alloc.holdings].sort((a, b) => b.currentValue - a.currentValue)[0];
    const ret30d = getReturn30d(dominant.isin, dominant.currentPrice, historicalPrices);
    if (ret30d === null) continue;

    if (ret30d > IRON_LAWS.fomoBlockadeMonthlyReturn) {
      fomoAlerts.push({ isin: dominant.isin, product: dominant.product, return30d: ret30d });
    }

    if (
      (alloc.asset.category === 'turbo' || alloc.asset.category === 'frontier') &&
      ret30d < -IRON_LAWS.dipPriorityDrop
    ) {
      dipAlerts.push({ asset: alloc.asset, holding: dominant, drop30d: ret30d });
    }
  }

  const recommendation = buildRecommendation(allocations, harvestAlerts, fomoAlerts, dipAlerts);

  return {
    totalValue,
    allocations,
    speculativeHoldings,
    speculativeValue,
    speculativePercent,
    unassignedHoldings,
    harvestAlerts,
    fomoAlerts,
    dipAlerts,
    recommendation,
  };
}

function buildRecommendation(
  allocations: AllocationStatus[],
  harvestAlerts: HarvestAlert[],
  fomoAlerts: FomoAlert[],
  dipAlerts: DipAlert[]
): AdvisorAnalysis['recommendation'] {
  if (dipAlerts.length > 0) {
    const deepest = dipAlerts.reduce((a, b) => (a.drop30d < b.drop30d ? a : b));
    return {
      asset: deepest.asset,
      reason: `DIP PRIORITY triggered: ${deepest.asset.name} down ${deepest.drop30d.toFixed(1)}% in 30d. Full monthly budget allocated.`,
      amount: MONTHLY_BUDGET,
      blocked: false,
    };
  }

  const sorted = [...allocations].sort((a, b) => a.deviation - b.deviation);
  const underweight = sorted.find((a) => a.status === 'underweight');
  const target = underweight ?? sorted[0];

  const targetHolding = target.holdings[0];
  const fomoBlocked = targetHolding && fomoAlerts.some((f) => f.isin === targetHolding.isin);

  if (fomoBlocked) {
    const nextTarget = sorted.find(
      (a) => a !== target && !(a.holdings[0] && fomoAlerts.some((f) => f.isin === a.holdings[0].isin))
    );
    if (nextTarget) {
      return {
        asset: nextTarget.asset,
        reason: `${target.asset.name} FOMO-BLOCKED (>10% in 30d). Redirected to next underweight: ${nextTarget.asset.name}.`,
        amount: MONTHLY_BUDGET,
        blocked: false,
      };
    }
    return {
      asset: null,
      reason: `All target assets FOMO-BLOCKED. Wait for RSI < 60 consolidation before deploying.`,
      amount: 0,
      blocked: true,
    };
  }

  if (harvestAlerts.length > 0) {
    return {
      asset: target.asset,
      reason: `HARVEST REQUIRED first: ${harvestAlerts[0].holding.product} at ${harvestAlerts[0].currentPercent.toFixed(1)}%. After selling €${harvestAlerts[0].amountToSell.toFixed(0)}, deploy to ${target.asset.name} (${target.currentPercent.toFixed(1)}% vs ${target.asset.targetMin}-${target.asset.targetMax}% target).`,
      amount: MONTHLY_BUDGET,
      blocked: false,
    };
  }

  return {
    asset: target.asset,
    reason: `Most underweight: ${target.asset.name} at ${target.currentPercent.toFixed(1)}% (target ${target.asset.targetMin}-${target.asset.targetMax}%).`,
    amount: MONTHLY_BUDGET,
    blocked: false,
  };
}

// Helper for UI: human-readable category labels with full Tailwind class strings
// (must be literal strings so Tailwind's JIT can detect them)
export const CATEGORY_LABELS: Record<FrameworkCategory, {
  label: string;
  short: string;
  icon: string;
  badgeClass: string;
}> = {
  core:        { label: 'Core (VWCE)',          short: 'CORE',        icon: '🛡️',  badgeClass: 'bg-emerald-500/20 border-emerald-500' },
  turbo:       { label: 'Turbo (Nasdaq)',       short: 'TURBO',       icon: '⚡',   badgeClass: 'bg-orange-500/20 border-orange-500' },
  frontier:    { label: 'Frontier (Small Cap)', short: 'FRONTIER',    icon: '🔭',  badgeClass: 'bg-purple-500/20 border-purple-500' },
  proxy:       { label: 'Proxy (Investor AB)',  short: 'PROXY',       icon: '📊',  badgeClass: 'bg-blue-500/20 border-blue-500' },
  speculative: { label: 'Speculative (Alpha)',  short: 'SPECULATIVE', icon: '🎲',  badgeClass: 'bg-red-500/20 border-red-500' },
};
