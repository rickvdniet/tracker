import type { PortfolioSnapshot, BenchmarkData } from '../types';
import { format } from 'date-fns';
import { fetchHistoricalPrices } from './priceApi';

// Benchmark tickers - Yahoo Finance symbols
export const BENCHMARK_TICKERS = {
  sp500: 'CSPX.AS',   // iShares Core S&P 500 UCITS (EUR-denominated for consistency)
  msciWorld: 'IWDA.AS', // iShares Core MSCI World UCITS (EUR-denominated)
} as const;

export interface BenchmarkPrices {
  sp500: Array<{ date: string; price: number }>;
  msciWorld: Array<{ date: string; price: number }>;
}

// Fetch historical weekly prices for both benchmarks in parallel
export async function fetchBenchmarkPrices(rangeYears: number = 5): Promise<BenchmarkPrices> {
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

// Build benchmark comparison chart data using real historical prices
export function calculateBenchmarkComparison(
  snapshots: PortfolioSnapshot[],
  benchmarks: BenchmarkPrices
): BenchmarkData[] {
  if (snapshots.length === 0) return [];

  // Find first date where all data is available
  const firstSnapshotDate = format(snapshots[0].date, 'yyyy-MM-dd');
  const sp500Base = priceOnOrBefore(benchmarks.sp500, firstSnapshotDate);
  const msciBase = priceOnOrBefore(benchmarks.msciWorld, firstSnapshotDate);

  return snapshots.map((snapshot) => {
    const dateStr = format(snapshot.date, 'yyyy-MM-dd');

    // Portfolio value: use profitLossPercent so deposits don't look like growth
    const portfolioValue = 100 + snapshot.profitLossPercent;

    // Benchmark values normalized to 100 at first date
    let sp500 = 100;
    let msciWorld = 100;

    if (sp500Base) {
      const price = priceOnOrBefore(benchmarks.sp500, dateStr);
      if (price) sp500 = (price / sp500Base) * 100;
    }

    if (msciBase) {
      const price = priceOnOrBefore(benchmarks.msciWorld, dateStr);
      if (price) msciWorld = (price / msciBase) * 100;
    }

    return { date: dateStr, portfolioValue, sp500, msciWorld };
  });
}

export function calculatePerformanceVsBenchmark(
  snapshots: PortfolioSnapshot[],
  benchmarks: BenchmarkPrices
): {
  portfolioReturn: number;
  sp500Return: number;
  msciWorldReturn: number;
  alpha: number;
  outperforming: boolean;
} {
  if (snapshots.length < 2) {
    return { portfolioReturn: 0, sp500Return: 0, msciWorldReturn: 0, alpha: 0, outperforming: false };
  }

  const benchmarkData = calculateBenchmarkComparison(snapshots, benchmarks);
  const last = benchmarkData[benchmarkData.length - 1];

  const portfolioReturn = snapshots[snapshots.length - 1].profitLossPercent;
  const sp500Return = last.sp500 - 100;
  const msciWorldReturn = last.msciWorld - 100;
  const alpha = portfolioReturn - sp500Return;

  return {
    portfolioReturn,
    sp500Return,
    msciWorldReturn,
    alpha,
    outperforming: portfolioReturn > sp500Return,
  };
}
