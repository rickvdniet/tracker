import type { Transaction } from '../types';
import { format, subMonths, startOfYear, isAfter } from 'date-fns';
import { fetchHistoricalPrices } from './priceApi';
import type { TimeRange } from '../types';

// Benchmark tickers - Yahoo Finance symbols
// EUR-denominated UCITS ETFs so comparisons stay in EUR without extra FX conversion
export const BENCHMARK_TICKERS = {
  sp500: 'CSPX.AS',
  msciWorld: 'IWDA.AS',
} as const;

export interface BenchmarkPrices {
  sp500: Array<{ date: string; price: number }>;
  msciWorld: Array<{ date: string; price: number }>;
}

export async function fetchBenchmarkPrices(rangeYears: number = 10): Promise<BenchmarkPrices> {
  const [sp500, msciWorld] = await Promise.all([
    fetchHistoricalPrices(BENCHMARK_TICKERS.sp500, rangeYears),
    fetchHistoricalPrices(BENCHMARK_TICKERS.msciWorld, rangeYears),
  ]);
  return { sp500, msciWorld };
}

// Find the closest benchmark price on or before a given date
function priceOnOrBefore(
  history: Array<{ date: string; price: number }>,
  targetDateISO: string
): number | null {
  const targetKey = targetDateISO.substring(0, 10);
  const eligible = history.filter((p) => p.date <= targetKey && p.price > 0);
  if (eligible.length === 0) return null;
  return eligible[eligible.length - 1].price;
}

// Convert a transaction to EUR using stored rate or the fallback rates map
function toEurAmount(tx: Transaction, exchangeRates: Map<string, number>): number {
  const rate = tx.currency === 'EUR'
    ? 1
    : (tx.exchangeRate ?? exchangeRates.get(tx.currency) ?? 1);
  return (tx.totalAmount + (tx.fees ?? 0)) * rate;
}

/**
 * Simulate a benchmark portfolio using the user's actual cashflows.
 * For each buy transaction, we "buy" fractional shares of the benchmark
 * ETF using its price on that transaction's date. Then value the position
 * at the asOfDate price.
 */
export interface CashflowSimulation {
  totalShares: number;
  totalInvested: number; // EUR — sum of buys up to asOfDate
  currentValue: number;  // EUR — totalShares × price at asOfDate
}

export function simulateBenchmarkAt(
  transactions: Transaction[],
  benchmarkPrices: Array<{ date: string; price: number }>,
  exchangeRates: Map<string, number>,
  asOfDate: Date
): CashflowSimulation {
  const asOfKey = format(asOfDate, 'yyyy-MM-dd');
  let totalShares = 0;
  let totalInvested = 0;

  for (const tx of transactions) {
    if (tx.type !== 'buy') continue;
    if (tx.date > asOfDate) continue;

    const txKey = format(tx.date, 'yyyy-MM-dd');
    const priceAtBuy = priceOnOrBefore(benchmarkPrices, txKey);
    if (!priceAtBuy) continue;

    const eurAmount = toEurAmount(tx, exchangeRates);
    totalShares += eurAmount / priceAtBuy;
    totalInvested += eurAmount;
  }

  const currentPrice = priceOnOrBefore(benchmarkPrices, asOfKey) ?? 0;
  const currentValue = totalShares * currentPrice;

  return { totalShares, totalInvested, currentValue };
}

// Filter transactions/dates to a time range
export function filterDateRangeStart(range: TimeRange): Date | null {
  if (range === 'ALL') return null;
  const now = new Date();
  switch (range) {
    case '1M':  return subMonths(now, 1);
    case '3M':  return subMonths(now, 3);
    case '6M':  return subMonths(now, 6);
    case 'YTD': return startOfYear(now);
    case '1Y':  return subMonths(now, 12);
    default:    return null;
  }
}

export interface BenchmarkChartPoint {
  date: string;
  portfolioValue: number;    // EUR — actual portfolio value from snapshot
  sp500Value: number;        // EUR — same money into S&P 500 instead
  msciWorldValue: number;    // EUR — same money into MSCI World instead
  totalInvested: number;     // EUR — actual cash contributed (from snapshot)
  // Amount of cash that could actually be simulated against the benchmark
  // (may be less than totalInvested if some transactions are outside benchmark date coverage)
  benchmarkInvested: number;
}

/**
 * Build the cashflow-matched comparison chart.
 * For each snapshot's date, computes what the portfolio would be worth if
 * the same cashflows had been directed into the benchmark ETFs instead.
 */
export function calculateBenchmarkComparison(
  transactions: Transaction[],
  snapshots: Array<{ date: Date; totalValue: number; totalInvested: number }>,
  benchmarks: BenchmarkPrices,
  exchangeRates: Map<string, number>,
  timeRange: TimeRange = 'ALL'
): BenchmarkChartPoint[] {
  if (snapshots.length === 0 || benchmarks.sp500.length === 0) return [];

  // Restrict to snapshots with sane dates AND with any transactions (i.e. portfolio existed)
  const validSnapshots = snapshots.filter((s) => {
    const y = s.date.getFullYear();
    return y >= 2000 && y <= 2100 && s.totalInvested > 0;
  });
  if (validSnapshots.length === 0) return [];

  // Apply time range filter
  const rangeStart = filterDateRangeStart(timeRange);
  const filtered = rangeStart
    ? validSnapshots.filter((s) => isAfter(s.date, rangeStart) || s.date.getTime() === rangeStart.getTime())
    : validSnapshots;
  if (filtered.length === 0) return [];

  // Sort transactions by date for the simulation
  const sortedTx = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  return filtered.map((snapshot) => {
    const sp500Sim = simulateBenchmarkAt(sortedTx, benchmarks.sp500, exchangeRates, snapshot.date);
    const msciSim  = simulateBenchmarkAt(sortedTx, benchmarks.msciWorld, exchangeRates, snapshot.date);

    return {
      date: format(snapshot.date, 'yyyy-MM-dd'),
      portfolioValue: snapshot.totalValue,
      sp500Value: sp500Sim.currentValue,
      msciWorldValue: msciSim.currentValue,
      totalInvested: snapshot.totalInvested,
      // Simulation invested amounts should be equal for both benchmarks
      // (both cover recent history) — use S&P's as canonical
      benchmarkInvested: sp500Sim.totalInvested,
    };
  });
}

export interface BenchmarkPerformance {
  portfolioValue: number;
  portfolioReturn: number;      // % return on actual invested
  sp500Value: number;
  sp500Return: number;          // % return on same benchmarkInvested
  msciWorldValue: number;
  msciWorldReturn: number;
  totalInvested: number;        // Actual EUR contributed
  benchmarkInvested: number;    // EUR that could be simulated
  hasCoverageGap: boolean;      // true if some tx are outside benchmark coverage
  alpha: number;                // portfolioReturn - sp500Return, percentage points
  outperforming: boolean;
}

export function calculatePerformanceVsBenchmark(
  chartData: BenchmarkChartPoint[]
): BenchmarkPerformance {
  if (chartData.length === 0) {
    return {
      portfolioValue: 0, portfolioReturn: 0,
      sp500Value: 0, sp500Return: 0,
      msciWorldValue: 0, msciWorldReturn: 0,
      totalInvested: 0, benchmarkInvested: 0,
      hasCoverageGap: false, alpha: 0, outperforming: false,
    };
  }

  const last = chartData[chartData.length - 1];
  const invested = last.totalInvested;
  const bInvested = last.benchmarkInvested;

  // Portfolio return uses actual invested; benchmark returns use their own simulated invested
  // so all three are fair "% return on capital deployed" numbers.
  const portfolioReturn = invested  > 0 ? ((last.portfolioValue - invested)  / invested)  * 100 : 0;
  const sp500Return     = bInvested > 0 ? ((last.sp500Value     - bInvested) / bInvested) * 100 : 0;
  const msciWorldReturn = bInvested > 0 ? ((last.msciWorldValue - bInvested) / bInvested) * 100 : 0;

  // Coverage gap: benchmark simulation missed >1% of the actual invested amount
  const hasCoverageGap = invested > 0 && (invested - bInvested) / invested > 0.01;

  return {
    portfolioValue: last.portfolioValue,
    portfolioReturn,
    sp500Value: last.sp500Value,
    sp500Return,
    msciWorldValue: last.msciWorldValue,
    msciWorldReturn,
    totalInvested: invested,
    benchmarkInvested: bInvested,
    hasCoverageGap,
    alpha: portfolioReturn - sp500Return,
    outperforming: portfolioReturn > sp500Return,
  };
}
