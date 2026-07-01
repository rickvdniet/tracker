import type { Holding } from '../types';

// Hard-Growth Framework configuration
// Each asset has a target allocation range and identifying ISIN(s)
export interface FrameworkAsset {
  key: string;
  name: string;
  ticker: string;
  isins: string[]; // multiple ISINs allowed (e.g. new/old ISIN after split)
  category: 'core' | 'turbo' | 'frontier' | 'proxy' | 'speculative';
  targetMin: number; // percent
  targetMax: number; // percent
  description: string;
}

// The framework — hardcoded per user's strategy
export const FRAMEWORK: FrameworkAsset[] = [
  {
    key: 'vwce',
    name: 'VWCE (Vanguard All-World)',
    ticker: 'VWCE.DE',
    isins: ['IE00BK5BQT80'],
    category: 'core',
    targetMin: 55,
    targetMax: 60,
    description: 'THE CORE: Global equity floor. Protection against regional implosions.',
  },
  {
    key: 'nasdaq',
    name: 'Nasdaq-100 (SXRV / Xtrackers)',
    ticker: 'SXRV.DE',
    isins: ['IE00BMFKG444', 'IE00BMW42181'], // Xtrackers Nasdaq 100 variants
    category: 'turbo',
    targetMin: 20,
    targetMax: 25,
    description: 'THE TURBO: Growth accelerator. Tech outperformance, higher volatility accepted.',
  },
  {
    key: 'smallcap',
    name: 'WSML / STST (Small Cap Block)',
    ticker: 'WSML.L',
    isins: ['IE00BF4RFH31', 'IE00BCBJG560'], // iShares MSCI World Small Cap variants
    category: 'frontier',
    targetMin: 10,
    targetMax: 15,
    description: 'THE FRONTIER: Size premium harvesting. Treat both tickers as one block.',
  },
  {
    key: 'inveb',
    name: 'INVE-B (Investor AB)',
    ticker: 'INVE-B.ST',
    isins: ['SE0015811955', 'SE0015811963'],
    category: 'proxy',
    targetMin: 5,
    targetMax: 7.5,
    description: 'THE PROXY: European industrial + PE exposure with NAV discount.',
  },
];

// Speculative allocation rules (BESI etc.)
export const SPECULATIVE_RULES = {
  maxPerPosition: 5,
  maxTotal: 10,
  // Speculative ISINs (single-stock high-conviction picks like BESI)
  knownIsins: ['NL0012866412'], // BE Semiconductor Industries
};

// Iron Laws thresholds
export const IRON_LAWS = {
  harvestThreshold: 10, // Sell if any single position >10%
  harvestTargetAfter: 5, // Sell down to 5%
  fomoBlockadeMonthlyReturn: 10, // No buy if >10% up in 30 days
  dipPriorityDrop: 5, // Full month buy if >5% drop in core assets
};

export const MONTHLY_BUDGET = 1000; // €1000/month

export interface AllocationStatus {
  asset: FrameworkAsset;
  currentValue: number;       // EUR
  currentPercent: number;
  targetMidpoint: number;
  deviation: number;          // percent points (current - target midpoint)
  status: 'underweight' | 'in-range' | 'overweight';
  holding?: Holding;
}

export interface HarvestAlert {
  holding: Holding;
  currentPercent: number;
  amountToSell: number; // EUR to sell back to 5%
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
  speculativeValue: number;
  speculativePercent: number;
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

// Find the holding for a framework asset by matching ISINs
function findHolding(holdings: Holding[], isins: string[]): Holding | undefined {
  return holdings.find((h) => isins.includes(h.isin));
}

// Calculate 30-day return for a holding using historical price data
function getReturn30d(
  isin: string,
  currentPrice: number,
  historicalPrices: Map<string, Array<{ date: string; price: number }>>
): number | null {
  const history = historicalPrices.get(isin);
  if (!history || history.length === 0 || currentPrice === 0) return null;

  // Find price ~30 days ago (weekly data ⇒ 4-5 entries back)
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
  historicalPrices: Map<string, Array<{ date: string; price: number }>>
): AdvisorAnalysis {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  // Build allocation status for each framework asset
  const allocations: AllocationStatus[] = FRAMEWORK.map((asset) => {
    const holding = findHolding(holdings, asset.isins);
    const currentValue = holding?.currentValue ?? 0;
    const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const targetMidpoint = (asset.targetMin + asset.targetMax) / 2;
    const deviation = currentPercent - targetMidpoint;

    let status: AllocationStatus['status'] = 'in-range';
    if (currentPercent < asset.targetMin) status = 'underweight';
    else if (currentPercent > asset.targetMax) status = 'overweight';

    return { asset, currentValue, currentPercent, targetMidpoint, deviation, status, holding };
  });

  // Speculative: any holding not in framework
  const frameworkIsins = new Set(FRAMEWORK.flatMap((a) => a.isins));
  const speculativeHoldings = holdings.filter((h) => !frameworkIsins.has(h.isin));
  const speculativeValue = speculativeHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const speculativePercent = totalValue > 0 ? (speculativeValue / totalValue) * 100 : 0;

  // Harvest alerts: any INDIVIDUAL STOCK >10%.
  // Per framework: applies only to individual stocks (INVE-B, BESI, speculative),
  // NOT to diversified ETFs (VWCE, Nasdaq, Small Cap) which are designed to hold >10%.
  const etfIsins = new Set(
    FRAMEWORK
      .filter((a) => a.category === 'core' || a.category === 'turbo' || a.category === 'frontier')
      .flatMap((a) => a.isins)
  );
  const harvestAlerts: HarvestAlert[] = holdings
    .filter((h) => !etfIsins.has(h.isin)) // exclude diversified ETFs
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

  // FOMO alerts: any holding up >10% in 30 days
  const fomoAlerts: FomoAlert[] = [];
  // Dip alerts: core assets (Nasdaq or Small Cap) down >5% in 30 days
  const dipAlerts: DipAlert[] = [];

  for (const alloc of allocations) {
    if (!alloc.holding) continue;
    const ret30d = getReturn30d(alloc.holding.isin, alloc.holding.currentPrice, historicalPrices);
    if (ret30d === null) continue;

    if (ret30d > IRON_LAWS.fomoBlockadeMonthlyReturn) {
      fomoAlerts.push({
        isin: alloc.holding.isin,
        product: alloc.holding.product,
        return30d: ret30d,
      });
    }

    // Dip only applies to Nasdaq (turbo) and Small Cap (frontier)
    if (
      (alloc.asset.category === 'turbo' || alloc.asset.category === 'frontier') &&
      ret30d < -IRON_LAWS.dipPriorityDrop
    ) {
      dipAlerts.push({ asset: alloc.asset, holding: alloc.holding, drop30d: ret30d });
    }
  }

  // Build recommendation
  const recommendation = buildRecommendation(allocations, harvestAlerts, fomoAlerts, dipAlerts);

  return {
    totalValue,
    allocations,
    speculativeValue,
    speculativePercent,
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
  // 1. Dip Priority takes precedence: full budget to dipped core asset
  if (dipAlerts.length > 0) {
    const deepest = dipAlerts.reduce((a, b) => (a.drop30d < b.drop30d ? a : b));
    return {
      asset: deepest.asset,
      reason: `DIP PRIORITY triggered: ${deepest.asset.name} down ${deepest.drop30d.toFixed(1)}% in 30d. Full monthly budget allocated.`,
      amount: MONTHLY_BUDGET,
      blocked: false,
    };
  }

  // 2. Otherwise, find the most underweight asset
  // Sort by deviation ascending (most negative = most underweight)
  const sorted = [...allocations].sort((a, b) => a.deviation - b.deviation);
  const underweight = sorted.find((a) => a.status === 'underweight');
  const target = underweight ?? sorted[0]; // fallback to most-below-midpoint

  // 3. Check FOMO Blockade on the target asset
  const fomoBlocked = target.holding && fomoAlerts.some((f) => f.isin === target.holding!.isin);

  if (fomoBlocked) {
    // Find next best asset that isn't fomo-blocked
    const nextTarget = sorted.find(
      (a) => a !== target && !(a.holding && fomoAlerts.some((f) => f.isin === a.holding!.isin))
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
