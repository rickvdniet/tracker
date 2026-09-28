import type { Holding, HoldingMetadata, FrameworkCategory } from '../types';
import { getPriceCurrency } from './priceApi';

// Hard-Growth Framework configuration
// Each framework asset represents one target bucket (Core, Turbo, etc.).
// Holdings are assigned to a bucket either via user metadata (frameworkCategory)
// or by falling back to the default ISIN mapping.
export interface FrameworkAsset {
  key: string;
  name: string;
  ticker: string;
  defaultIsins: string[]; // used as fallback when user hasn't set frameworkCategory
  buyIsin?: string;       // fund new money goes into when the bucket holds several; defaults to the largest holding
  category: FrameworkCategory;
  targetMin: number; // percent
  targetMax: number; // percent
  description: string;
}

export const FRAMEWORK: FrameworkAsset[] = [
  {
    key: 'core',
    name: 'VWCE / VGLA (Global Core)',
    ticker: 'VGLA.DE',
    defaultIsins: ['IE00BK5BQT80', 'IE000VAHT5T0'],
    buyIsin: 'IE000VAHT5T0',
    category: 'core',
    targetMin: 55,
    targetMax: 60,
    description: 'THE CORE: Global equity floor. VWCE is held, new money goes to VGLA (0.07% TER, all-cap). Treated as one block.',
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
  signals: BucketSignals | null;
}

export interface Seasonality {
  month: number;       // 0-11, the month the new money will be exposed to
  avgReturn: number;   // % average return of that month across available years
  hitRate: number;     // share of years that month was positive (0-1)
  samples: number;     // number of years in the sample
  excess: number;      // avgReturn minus the average of all months, in pp
}

export interface BucketSignals {
  isin: string;             // holding used as the representative for this bucket
  lastPrice: number;        // local currency
  currency: string;
  return30d: number | null;
  rsi14w: number | null;    // RSI(14) on weekly closes
  drawdown52w: number | null; // % below the 52-week high (negative or 0)
  trendVs40w: number | null;  // % above/below the 40-week moving average
  seasonality: Seasonality | null;
}

export interface PlanOrder {
  asset: FrameworkAsset;
  amountEur: number;
  shares: number | null;        // whole shares affordable at lastPrice (null if no price)
  limitPrice: number | null;    // local currency
  currency: string;
  estCostEur: number | null;    // shares × limit converted to EUR
  score: number;
  reasons: string[];
}

export interface BucketEvaluation {
  asset: FrameworkAsset;
  eligible: boolean;
  blockedReason: string | null;
  deficitEur: number;
  multiplier: number;
  score: number;
  notes: string[];
}

export interface MonthlyPlan {
  executionDate: Date;
  budget: number;
  mode: 'dip-priority' | 'harvest' | 'scored' | 'blocked';
  headline: string;
  orders: PlanOrder[];
  evaluations: BucketEvaluation[];
  dataWarnings: string[];
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
  plan: MonthlyPlan;
}

type PricePoint = { date: string; price: number };

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: number) => MONTH_NAMES[m];

// Minimum order size — below this, fees and the transaction limit make a second order not worth it
const MIN_ORDER_EUR = 250;
const ROUND_TO_EUR = 50;
const RSI_FOMO_RELEASE = 60;

// Next execution moment per the protocol: the 26th of this month, or next month if already past
export function nextExecutionDate(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), 26, 15, 45);
  if (now > d) d.setMonth(d.getMonth() + 1);
  return d;
}

function sortedSeries(history: PricePoint[] | undefined, lastPrice: number): PricePoint[] {
  const series = (history ?? []).filter((p) => p.price > 0).sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date().toISOString().substring(0, 10);
  if (lastPrice > 0 && (series.length === 0 || series[series.length - 1].date < today)) {
    series.push({ date: today, price: lastPrice });
  }
  return series;
}

function returnSince(series: PricePoint[], daysAgo: number): number | null {
  if (series.length < 2) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAgo);
  const key = cutoff.toISOString().substring(0, 10);
  const base = [...series].reverse().find((p) => p.date <= key);
  if (!base) return null;
  const last = series[series.length - 1].price;
  return ((last - base.price) / base.price) * 100;
}

// Wilder's RSI over weekly closes
function rsi(series: PricePoint[], period = 14): number | null {
  if (series.length < period + 1) return null;
  const closes = series.map((p) => p.price);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(diff, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

function drawdownFromHigh(series: PricePoint[], weeks = 52): number | null {
  if (series.length < 4) return null;
  const window = series.slice(-weeks - 1);
  const high = Math.max(...window.map((p) => p.price));
  const last = series[series.length - 1].price;
  return ((last - high) / high) * 100;
}

function trendVsMovingAverage(series: PricePoint[], weeks = 40): number | null {
  if (series.length < weeks) return null;
  const window = series.slice(-weeks);
  const avg = window.reduce((s, p) => s + p.price, 0) / window.length;
  const last = series[series.length - 1].price;
  return ((last - avg) / avg) * 100;
}

// Close-to-close monthly returns, then the stats for one calendar month
function seasonalityFor(series: PricePoint[], month: number): Seasonality | null {
  const lastCloseByMonth = new Map<string, number>();
  for (const p of series) lastCloseByMonth.set(p.date.substring(0, 7), p.price);
  const keys = [...lastCloseByMonth.keys()].sort();
  const currentKey = new Date().toISOString().substring(0, 7);

  const returns: Array<{ month: number; ret: number }> = [];
  for (let i = 1; i < keys.length; i++) {
    if (keys[i] === currentKey) continue; // month not finished yet
    const prev = lastCloseByMonth.get(keys[i - 1])!;
    const cur = lastCloseByMonth.get(keys[i])!;
    returns.push({ month: parseInt(keys[i].substring(5, 7), 10) - 1, ret: (cur / prev - 1) * 100 });
  }
  const sample = returns.filter((r) => r.month === month);
  if (sample.length < 2) return null;
  const avgReturn = sample.reduce((s, r) => s + r.ret, 0) / sample.length;
  const overall = returns.reduce((s, r) => s + r.ret, 0) / returns.length;
  return {
    month,
    avgReturn,
    hitRate: sample.filter((r) => r.ret > 0).length / sample.length,
    samples: sample.length,
    excess: avgReturn - overall,
  };
}

function buildSignals(
  holdings: Holding[],
  historicalPrices: Map<string, PricePoint[]>,
  seasonalMonth: number
): BucketSignals | null {
  if (holdings.length === 0) return null;
  const dominant = [...holdings].sort((a, b) => b.currentValue - a.currentValue)[0];
  const history = historicalPrices.get(dominant.isin);
  const fallbackPrice = history && history.length > 0 ? history[history.length - 1].price : 0;
  const lastPrice = dominant.currentPrice > 0 ? dominant.currentPrice : fallbackPrice;
  const series = sortedSeries(history, lastPrice);

  return {
    isin: dominant.isin,
    lastPrice,
    currency: getPriceCurrency(dominant.isin) ?? dominant.currency,
    return30d: returnSince(series, 30),
    rsi14w: rsi(series),
    drawdown52w: drawdownFromHigh(series),
    trendVs40w: trendVsMovingAverage(series),
    seasonality: seasonalityFor(series, seasonalMonth),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Opportunity multiplier (0.7–1.3): tilts money between eligible buckets. The target gap stays the base.
function opportunity(signals: BucketSignals | null): { multiplier: number; notes: string[] } {
  if (!signals) return { multiplier: 1, notes: ['No price history — scored on allocation gap only'] };
  const notes: string[] = [];
  let tilt = 0;

  if (signals.rsi14w !== null) {
    // RSI 30 → +1, 50 → 0, 70 → -1
    const s = clamp((50 - signals.rsi14w) / 20, -1, 1);
    tilt += 0.12 * s;
    if (signals.rsi14w < 40) notes.push(`RSI ${signals.rsi14w.toFixed(0)} — oversold, favourable entry`);
    else if (signals.rsi14w > 65) notes.push(`RSI ${signals.rsi14w.toFixed(0)} — stretched, less attractive entry`);
    else notes.push(`RSI ${signals.rsi14w.toFixed(0)} — neutral`);
  }

  if (signals.drawdown52w !== null) {
    // 0% below high → 0, 15%+ below high → +1
    const s = clamp(-signals.drawdown52w / 15, 0, 1);
    tilt += 0.1 * s;
    if (signals.drawdown52w < -5) notes.push(`${Math.abs(signals.drawdown52w).toFixed(1)}% below 52-week high — buying at a discount`);
    else notes.push(`Near 52-week high (${signals.drawdown52w.toFixed(1)}%)`);
  }

  if (signals.trendVs40w !== null) {
    // Mild trend confirmation: in an uptrend DCA is safer than catching a collapsing asset
    const s = clamp(signals.trendVs40w / 10, -1, 1);
    tilt += 0.03 * s;
    notes.push(signals.trendVs40w >= 0
      ? `Above 40-week average (+${signals.trendVs40w.toFixed(1)}%) — long-term uptrend intact`
      : `Below 40-week average (${signals.trendVs40w.toFixed(1)}%) — long-term trend weak`);
  }

  if (signals.seasonality) {
    const se = signals.seasonality;
    // Small weight: 5 or fewer samples per month is mostly noise
    const reliability = clamp((se.samples - 1) / 9, 0, 1);
    const s = clamp(se.excess / 3, -1, 1);
    tilt += 0.05 * s * reliability;
    notes.push(`${monthName(se.month)} seasonality: avg ${se.avgReturn >= 0 ? '+' : ''}${se.avgReturn.toFixed(1)}%, up ${Math.round(se.hitRate * se.samples)}/${se.samples} years (weak signal)`);
  }

  return { multiplier: clamp(1 + tilt, 0.7, 1.3), notes };
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

function toOrder(
  alloc: AllocationStatus,
  amountEur: number,
  score: number,
  reasons: string[],
  exchangeRates: Map<string, number>
): PlanOrder {
  // Price the fund that is actually bought. If the bucket names a buy fund that isn't
  // held yet, we have no quote for it, so the share count is left open.
  const buyIsin = alloc.asset.buyIsin;
  const buyHolding = buyIsin ? alloc.holdings.find((h) => h.isin === buyIsin) : undefined;
  let lastPrice = 0;
  let currency = 'EUR';
  if (buyIsin) {
    if (buyHolding && buyHolding.currentPrice > 0) {
      lastPrice = buyHolding.currentPrice;
      currency = getPriceCurrency(buyHolding.isin) ?? buyHolding.currency;
    }
  } else if (alloc.signals) {
    lastPrice = alloc.signals.lastPrice;
    currency = alloc.signals.currency;
  }

  if (lastPrice <= 0) {
    return { asset: alloc.asset, amountEur, shares: null, limitPrice: null, currency, estCostEur: null, score, reasons };
  }
  const rate = currency === 'EUR' ? 1 : (exchangeRates.get(currency) ?? 1);
  const priceEur = lastPrice * rate;
  const shares = Math.floor(amountEur / priceEur);
  return {
    asset: alloc.asset,
    amountEur,
    shares,
    limitPrice: lastPrice,
    currency,
    estCostEur: shares * priceEur,
    score,
    reasons,
  };
}

function buildPlan(
  allocations: AllocationStatus[],
  totalValue: number,
  harvestAlerts: HarvestAlert[],
  exchangeRates: Map<string, number>,
  executionDate: Date
): MonthlyPlan {
  const dataWarnings: string[] = [];
  for (const a of allocations) {
    if (a.holdings.length > 0 && (!a.signals || a.signals.rsi14w === null)) {
      dataWarnings.push(`${a.asset.name}: no price history loaded — signals unavailable`);
    }
  }

  // Harvest: selling counts as one of the two monthly transactions, so only one buy remains
  const harvestProceeds = harvestAlerts.reduce((s, h) => s + Math.max(0, h.amountToSell), 0);
  const budget = MONTHLY_BUDGET + harvestProceeds;
  const maxBuys = harvestAlerts.length > 0 ? 1 : 2;
  const projectedTotal = totalValue + budget;

  const evaluations: BucketEvaluation[] = allocations.map((alloc) => {
    const s = alloc.signals;
    const fomo = s?.return30d != null && s.return30d > IRON_LAWS.fomoBlockadeMonthlyReturn
      && (s.rsi14w === null || s.rsi14w >= RSI_FOMO_RELEASE);
    const overweight = alloc.currentPercent >= alloc.asset.targetMax;

    const toMid = (alloc.targetMidpoint / 100) * projectedTotal - alloc.currentValue;
    const toMax = (alloc.asset.targetMax / 100) * projectedTotal - alloc.currentValue;
    const deficitEur = Math.max(0, toMid);
    const roomEur = Math.max(0, toMax);

    const { multiplier, notes } = opportunity(s);
    let blockedReason: string | null = null;
    if (fomo) blockedReason = `FOMO Blockade: +${s!.return30d!.toFixed(1)}% in 30 days with RSI ${s!.rsi14w?.toFixed(0) ?? '?'} (needs < ${RSI_FOMO_RELEASE})`;
    else if (overweight) blockedReason = `At or above target maximum (${alloc.currentPercent.toFixed(1)}% vs ${alloc.asset.targetMax}%)`;

    const gapNote = deficitEur > 0
      ? `${formatPp(alloc.deviation)} vs midpoint — €${Math.round(deficitEur).toLocaleString('nl-NL')} needed to reach ${alloc.targetMidpoint}%`
      : `At/above midpoint — €${Math.round(roomEur).toLocaleString('nl-NL')} room left to ${alloc.asset.targetMax}% max`;

    return {
      asset: alloc.asset,
      eligible: !blockedReason,
      blockedReason,
      // When every bucket is at/above midpoint, fall back to room below the max
      deficitEur: deficitEur > 0 ? deficitEur : roomEur * 0.25,
      multiplier,
      score: 0,
      notes: [gapNote, ...notes],
    };
  });
  for (const e of evaluations) e.score = e.eligible ? e.deficitEur * e.multiplier : 0;

  // 1. Dip Priority overrides everything: full budget into the deepest dipped core asset
  const dips = allocations
    .filter((a) => (a.asset.category === 'turbo' || a.asset.category === 'frontier')
      && a.signals?.return30d != null && a.signals.return30d < -IRON_LAWS.dipPriorityDrop)
    .sort((a, b) => a.signals!.return30d! - b.signals!.return30d!);
  if (dips.length > 0) {
    const d = dips[0];
    const evaluation = evaluations.find((e) => e.asset === d.asset)!;
    return {
      executionDate, budget, mode: 'dip-priority',
      headline: `Dip Priority: ${d.asset.name} is down ${d.signals!.return30d!.toFixed(1)}% in 30 days. Full budget goes here, as long as the fundamental thesis is intact.`,
      orders: [toOrder(d, budget, evaluation.score, evaluation.notes, exchangeRates)],
      evaluations, dataWarnings,
    };
  }

  const ranked = evaluations.filter((e) => e.eligible && e.score > 0).sort((a, b) => b.score - a.score);
  if (ranked.length === 0) {
    return {
      executionDate, budget, mode: 'blocked',
      headline: 'No eligible bucket this month — every target is either FOMO-blocked or at its maximum. Hold the cash and re-check next month.',
      orders: [], evaluations, dataWarnings,
    };
  }

  // 2. Split across the top buckets proportional to score, respecting the 2-transaction limit
  const picks = ranked.slice(0, maxBuys);
  const scoreSum = picks.reduce((s, e) => s + e.score, 0);
  let amounts = picks.map((e) => roundTo((e.score / scoreSum) * budget, ROUND_TO_EUR));
  if (amounts.length === 2 && amounts[1] < MIN_ORDER_EUR) amounts = [budget];
  else if (amounts.length === 2) amounts[0] = budget - amounts[1]; // absorb rounding

  const orders = picks.slice(0, amounts.length).map((e, i) => {
    const alloc = allocations.find((a) => a.asset === e.asset)!;
    return toOrder(alloc, amounts[i], e.score, e.notes, exchangeRates);
  });

  const mode = harvestAlerts.length > 0 ? 'harvest' : 'scored';
  const headline = mode === 'harvest'
    ? `Harvest first: sell ${harvestAlerts.map((h) => h.holding.product).join(', ')} back to ${IRON_LAWS.harvestTargetAfter}%, then deploy €${Math.round(budget).toLocaleString('nl-NL')} (incl. proceeds) in a single buy.`
    : orders.length === 2
      ? `Split this month's €${budget} over ${orders[0].asset.name} and ${orders[1].asset.name}.`
      : `Deploy the full €${budget} into ${orders[0].asset.name}.`;

  return { executionDate, budget, mode, headline, orders, evaluations, dataWarnings };
}

function formatPp(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}pp`;
}

export function analyzePortfolio(
  holdings: Holding[],
  historicalPrices: Map<string, Array<{ date: string; price: number }>>,
  metadata: Map<string, HoldingMetadata>,
  exchangeRates: Map<string, number> = new Map()
): AdvisorAnalysis {
  const executionDate = nextExecutionDate();
  // New money bought on the 26th is exposed to the following month's returns
  const seasonalMonth = (executionDate.getMonth() + 1) % 12;
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

    const signals = buildSignals(bucketHoldings, historicalPrices, seasonalMonth);
    return { asset, currentValue, currentPercent, targetMidpoint, deviation, status, holdings: bucketHoldings, signals };
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

  // FOMO and Dip alerts (per bucket, using the dominant holding's signals)
  const fomoAlerts: FomoAlert[] = [];
  const dipAlerts: DipAlert[] = [];

  for (const alloc of allocations) {
    const s = alloc.signals;
    if (!s || s.return30d === null) continue;
    const dominant = alloc.holdings.find((h) => h.isin === s.isin)!;

    if (s.return30d > IRON_LAWS.fomoBlockadeMonthlyReturn && (s.rsi14w === null || s.rsi14w >= RSI_FOMO_RELEASE)) {
      fomoAlerts.push({ isin: s.isin, product: dominant.product, return30d: s.return30d });
    }

    if (
      (alloc.asset.category === 'turbo' || alloc.asset.category === 'frontier') &&
      s.return30d < -IRON_LAWS.dipPriorityDrop
    ) {
      dipAlerts.push({ asset: alloc.asset, holding: dominant, drop30d: s.return30d });
    }
  }

  const plan = buildPlan(allocations, totalValue, harvestAlerts, exchangeRates, executionDate);

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
    plan,
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
  core:        { label: 'Core (VWCE / VGLA)',       short: 'CORE',        icon: '🛡️',  badgeClass: 'bg-emerald-500/20 border-emerald-500' },
  turbo:       { label: 'Turbo (Nasdaq)',       short: 'TURBO',       icon: '⚡',   badgeClass: 'bg-orange-500/20 border-orange-500' },
  frontier:    { label: 'Frontier (Small Cap)', short: 'FRONTIER',    icon: '🔭',  badgeClass: 'bg-purple-500/20 border-purple-500' },
  proxy:       { label: 'Proxy (Investor AB)',  short: 'PROXY',       icon: '📊',  badgeClass: 'bg-blue-500/20 border-blue-500' },
  speculative: { label: 'Speculative (Alpha)',  short: 'SPECULATIVE', icon: '🎲',  badgeClass: 'bg-red-500/20 border-red-500' },
};
