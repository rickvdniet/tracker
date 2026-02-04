import type { PortfolioSnapshot, BenchmarkData } from '../types';
import { format, differenceInDays } from 'date-fns';

// Historical benchmark returns (approximate monthly returns for simulation)
// In production, you'd fetch these from an API
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

export function calculateBenchmarkComparison(
  snapshots: PortfolioSnapshot[]
): BenchmarkData[] {
  if (snapshots.length === 0) return [];

  const result: BenchmarkData[] = [];
  const firstValue = snapshots[0].totalInvested || 1;

  // Normalize all values to start at 100
  let sp500Value = 100;
  let msciWorldValue = 100;

  snapshots.forEach((snapshot, index) => {
    // Portfolio normalized to 100
    const portfolioNormalized = (snapshot.totalValue / firstValue) * 100;

    // Apply simulated benchmark returns
    if (index > 0) {
      const sp500Return = BENCHMARK_MONTHLY_RETURNS.sp500[index % BENCHMARK_MONTHLY_RETURNS.sp500.length];
      const msciReturn = BENCHMARK_MONTHLY_RETURNS.msciWorld[index % BENCHMARK_MONTHLY_RETURNS.msciWorld.length];
      sp500Value *= (1 + sp500Return);
      msciWorldValue *= (1 + msciReturn);
    }

    result.push({
      date: format(snapshot.date, 'yyyy-MM-dd'),
      portfolioValue: portfolioNormalized,
      sp500: sp500Value,
      msciWorld: msciWorldValue,
    });
  });

  return result;
}

export function calculatePerformanceVsBenchmark(
  snapshots: PortfolioSnapshot[]
): {
  portfolioReturn: number;
  sp500Return: number;
  msciWorldReturn: number;
  alpha: number;
  outperforming: boolean;
} {
  if (snapshots.length < 2) {
    return {
      portfolioReturn: 0,
      sp500Return: 0,
      msciWorldReturn: 0,
      alpha: 0,
      outperforming: false,
    };
  }

  const benchmarkData = calculateBenchmarkComparison(snapshots);
  const first = benchmarkData[0];
  const last = benchmarkData[benchmarkData.length - 1];

  const portfolioReturn = ((last.portfolioValue - first.portfolioValue) / first.portfolioValue) * 100;
  const sp500Return = ((last.sp500 - first.sp500) / first.sp500) * 100;
  const msciWorldReturn = ((last.msciWorld - first.msciWorld) / first.msciWorld) * 100;
  const alpha = portfolioReturn - sp500Return;

  return {
    portfolioReturn,
    sp500Return,
    msciWorldReturn,
    alpha,
    outperforming: portfolioReturn > sp500Return,
  };
}

// Fetch real benchmark data from Yahoo Finance (via CORS proxy for client-side)
export async function fetchBenchmarkPrices(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: string; close: number }[]> {
  // This would normally use a CORS proxy or backend API
  // For now, return simulated data based on the symbol
  const days = differenceInDays(endDate, startDate);
  const data: { date: string; close: number }[] = [];

  let price = symbol === '^GSPC' ? 4500 : 3000; // S&P 500 or MSCI World approximate values
  const volatility = 0.015;

  for (let i = 0; i <= days; i += 30) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Random walk simulation
    const change = (Math.random() - 0.48) * volatility;
    price *= (1 + change);

    data.push({
      date: format(date, 'yyyy-MM-dd'),
      close: price,
    });
  }

  return data;
}
