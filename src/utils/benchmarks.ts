import type { PortfolioSnapshot, BenchmarkData } from '../types';
import { format } from 'date-fns';

// Approximate average monthly returns for major indices
const BENCHMARK_MONTHLY_RETURNS = {
  sp500: [
    0.015, -0.02, 0.03, 0.01, -0.015, 0.025, 0.02, -0.01, 0.018, 0.022, -0.008, 0.03,
    0.01, 0.025, -0.03, 0.02, 0.015, -0.01, 0.028, 0.012, 0.008, -0.02, 0.035, 0.018,
  ],
  msciWorld: [
    0.012, -0.018, 0.025, 0.008, -0.012, 0.022, 0.018, -0.008, 0.015, 0.02, -0.005, 0.028,
    0.008, 0.022, -0.025, 0.018, 0.012, -0.008, 0.025, 0.01, 0.006, -0.018, 0.032, 0.015,
  ],
};

export function calculateBenchmarkComparison(snapshots: PortfolioSnapshot[]): BenchmarkData[] {
  if (snapshots.length === 0) return [];

  let sp500Value = 100;
  let msciWorldValue = 100;

  return snapshots.map((snapshot, index) => {
    // Use profitLossPercent so deposits don't look like growth.
    // 0% P/L = 100, +10% P/L = 110, -5% P/L = 95
    const portfolioValue = 100 + snapshot.profitLossPercent;

    if (index > 0) {
      sp500Value *= (1 + BENCHMARK_MONTHLY_RETURNS.sp500[index % BENCHMARK_MONTHLY_RETURNS.sp500.length]);
      msciWorldValue *= (1 + BENCHMARK_MONTHLY_RETURNS.msciWorld[index % BENCHMARK_MONTHLY_RETURNS.msciWorld.length]);
    }

    return {
      date: format(snapshot.date, 'yyyy-MM-dd'),
      portfolioValue,
      sp500: sp500Value,
      msciWorld: msciWorldValue,
    };
  });
}

export function calculatePerformanceVsBenchmark(snapshots: PortfolioSnapshot[]): {
  portfolioReturn: number;
  sp500Return: number;
  msciWorldReturn: number;
  alpha: number;
  outperforming: boolean;
} {
  if (snapshots.length < 2) {
    return { portfolioReturn: 0, sp500Return: 0, msciWorldReturn: 0, alpha: 0, outperforming: false };
  }

  const benchmarkData = calculateBenchmarkComparison(snapshots);
  const last = benchmarkData[benchmarkData.length - 1];

  // Portfolio return is just the final profitLossPercent of the last snapshot
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
