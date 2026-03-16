import type { Transaction, Holding, PortfolioSnapshot, PortfolioStats, TimeRange } from '../types';
import { subMonths, startOfYear, isAfter, format } from 'date-fns';

export function calculateHoldings(transactions: Transaction[]): Holding[] {
  const holdingsMap = new Map<string, {
    product: string;
    isin: string;
    totalQuantity: number;
    totalCost: number;
    currency: string;
  }>();

  for (const transaction of transactions) {
    if (transaction.type !== 'buy' && transaction.type !== 'sell') continue;
    if (!transaction.isin) continue;

    const existing = holdingsMap.get(transaction.isin);

    if (existing) {
      if (transaction.type === 'buy') {
        existing.totalQuantity += transaction.quantity;
        existing.totalCost += transaction.totalAmount + (transaction.fees || 0);
      } else {
        // Sell: reduce quantity proportionally
        const costPerShare = existing.totalCost / existing.totalQuantity;
        const quantitySold = Math.abs(transaction.quantity);
        existing.totalQuantity -= quantitySold;
        existing.totalCost -= costPerShare * quantitySold;
      }
    } else if (transaction.type === 'buy') {
      holdingsMap.set(transaction.isin, {
        product: transaction.product,
        isin: transaction.isin,
        totalQuantity: transaction.quantity,
        totalCost: transaction.totalAmount + (transaction.fees || 0),
        currency: transaction.currency,
      });
    }
  }

  // Convert to Holding array, filtering out zero/negative quantities
  const holdings: Holding[] = [];
  for (const [, data] of holdingsMap) {
    if (data.totalQuantity > 0.0001) {
      const averageCost = data.totalCost / data.totalQuantity;
      holdings.push({
        product: data.product,
        isin: data.isin,
        quantity: data.totalQuantity,
        averageCost,
        totalCost: data.totalCost,
        currentPrice: averageCost, // Will be updated when prices are provided
        currentValue: data.totalCost,
        profitLoss: 0,
        profitLossPercent: 0,
        currency: data.currency,
      });
    }
  }

  return holdings.sort((a, b) => b.totalCost - a.totalCost);
}

export function updateHoldingsWithPrices(
  holdings: Holding[],
  prices: Map<string, number>
): Holding[] {
  return holdings.map((holding) => {
    const currentPrice = prices.get(holding.isin) || holding.averageCost;
    const currentValue = holding.quantity * currentPrice;
    const profitLoss = currentValue - holding.totalCost;
    const profitLossPercent = (profitLoss / holding.totalCost) * 100;

    return {
      ...holding,
      currentPrice,
      currentValue,
      profitLoss,
      profitLossPercent,
    };
  });
}

export function calculatePortfolioStats(
  transactions: Transaction[],
  holdings: Holding[]
): PortfolioStats {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalDividends = 0;
  let totalFees = 0;

  for (const t of transactions) {
    switch (t.type) {
      case 'deposit':
        totalDeposits += t.totalAmount;
        break;
      case 'withdrawal':
        totalWithdrawals += t.totalAmount;
        break;
      case 'dividend':
        totalDividends += t.totalAmount;
        break;
      case 'fee':
        totalFees += t.totalAmount;
        break;
    }
    if (t.fees) {
      totalFees += t.fees;
    }
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfitLoss = totalValue - totalInvested;
  const profitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;
  const cashBalance = totalDeposits - totalWithdrawals + totalDividends - totalFees - totalInvested;

  return {
    totalValue,
    totalInvested,
    totalProfitLoss,
    profitLossPercent,
    totalDividends,
    totalFees,
    cashBalance: Math.max(0, cashBalance),
    numberOfHoldings: holdings.length,
  };
}

export function calculateHistoricalSnapshots(
  transactions: Transaction[],
  currentPrices?: Map<string, number>
): PortfolioSnapshot[] {
  if (transactions.length === 0) return [];

  const snapshots: PortfolioSnapshot[] = [];
  const sortedTransactions = [...transactions].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  // Group by month
  const monthlyGroups = new Map<string, Transaction[]>();
  for (const t of sortedTransactions) {
    const monthKey = format(t.date, 'yyyy-MM');
    const existing = monthlyGroups.get(monthKey) || [];
    existing.push(t);
    monthlyGroups.set(monthKey, existing);
  }

  // Calculate cumulative snapshot at end of each month
  let cumulativeTransactions: Transaction[] = [];
  const sortedMonths = Array.from(monthlyGroups.keys()).sort();

  for (const month of sortedMonths) {
    const monthTransactions = monthlyGroups.get(month) || [];
    cumulativeTransactions = [...cumulativeTransactions, ...monthTransactions];

    const holdings = calculateHoldings(cumulativeTransactions);
    const holdingsWithPrices = currentPrices
      ? updateHoldingsWithPrices(holdings, currentPrices)
      : holdings;

    const totalValue = holdingsWithPrices.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvested = holdingsWithPrices.reduce((sum, h) => sum + h.totalCost, 0);
    const totalProfitLoss = totalValue - totalInvested;

    snapshots.push({
      date: new Date(month + '-28'), // End of month approximation
      totalValue,
      totalInvested,
      totalProfitLoss,
      profitLossPercent: totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0,
      holdings: holdingsWithPrices,
    });
  }

  return snapshots;
}

export function filterSnapshotsByTimeRange(
  snapshots: PortfolioSnapshot[],
  timeRange: TimeRange
): PortfolioSnapshot[] {
  if (timeRange === 'ALL' || snapshots.length === 0) return snapshots;

  const now = new Date();
  let startDate: Date;

  switch (timeRange) {
    case '1M':
      startDate = subMonths(now, 1);
      break;
    case '3M':
      startDate = subMonths(now, 3);
      break;
    case '6M':
      startDate = subMonths(now, 6);
      break;
    case 'YTD':
      startDate = startOfYear(now);
      break;
    case '1Y':
      startDate = subMonths(now, 12);
      break;
    default:
      return snapshots;
  }

  return snapshots.filter((s) => isAfter(s.date, startDate) || s.date.getTime() === startDate.getTime());
}

export function calculatePerformanceMetrics(snapshots: PortfolioSnapshot[]): {
  absoluteReturn: number;
  percentReturn: number;
  bestMonth: { date: Date; return: number } | null;
  worstMonth: { date: Date; return: number } | null;
} {
  if (snapshots.length < 2) {
    return {
      absoluteReturn: 0,
      percentReturn: 0,
      bestMonth: null,
      worstMonth: null,
    };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const absoluteReturn = last.totalValue - first.totalValue;
  const percentReturn = first.totalValue > 0
    ? ((last.totalValue - first.totalValue) / first.totalValue) * 100
    : 0;

  // Calculate monthly returns
  let bestMonth: { date: Date; return: number } | null = null;
  let worstMonth: { date: Date; return: number } | null = null;

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const monthReturn = prev.totalValue > 0
      ? ((curr.totalValue - prev.totalValue) / prev.totalValue) * 100
      : 0;

    if (!bestMonth || monthReturn > bestMonth.return) {
      bestMonth = { date: curr.date, return: monthReturn };
    }
    if (!worstMonth || monthReturn < worstMonth.return) {
      worstMonth = { date: curr.date, return: monthReturn };
    }
  }

  return {
    absoluteReturn,
    percentReturn,
    bestMonth,
    worstMonth,
  };
}

export function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
