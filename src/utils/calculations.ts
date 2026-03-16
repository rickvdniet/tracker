import type { Transaction, Holding, PortfolioSnapshot, PortfolioStats, TimeRange } from '../types';
import { subMonths, startOfYear, isAfter, format } from 'date-fns';

// Returns EUR per 1 unit of the given currency from the exchange rates map
function toEurRate(currency: string, exchangeRates: Map<string, number>): number {
  if (currency === 'EUR') return 1;
  return exchangeRates.get(currency) ?? 1;
}

export function calculateHoldings(
  transactions: Transaction[],
  exchangeRates: Map<string, number> = new Map()
): Holding[] {
  const holdingsMap = new Map<string, {
    product: string;
    isin: string;
    totalQuantity: number;
    totalCostEur: number; // always stored in EUR
    currency: string;
  }>();

  for (const transaction of transactions) {
    if (transaction.type !== 'buy' && transaction.type !== 'sell') continue;
    if (!transaction.isin) continue;

    // Exchange rate: prefer the one stored on the transaction, fall back to current rates map
    const rate = transaction.currency === 'EUR'
      ? 1
      : (transaction.exchangeRate ?? toEurRate(transaction.currency, exchangeRates));

    const costEur = (transaction.totalAmount + (transaction.fees || 0)) * rate;
    const existing = holdingsMap.get(transaction.isin);

    if (existing) {
      if (transaction.type === 'buy') {
        existing.totalQuantity += transaction.quantity;
        existing.totalCostEur += costEur;
      } else {
        const costPerShare = existing.totalCostEur / existing.totalQuantity;
        const quantitySold = Math.abs(transaction.quantity);
        existing.totalQuantity -= quantitySold;
        existing.totalCostEur -= costPerShare * quantitySold;
      }
    } else if (transaction.type === 'buy') {
      holdingsMap.set(transaction.isin, {
        product: transaction.product,
        isin: transaction.isin,
        totalQuantity: transaction.quantity,
        totalCostEur: costEur,
        currency: transaction.currency,
      });
    }
  }

  const holdings: Holding[] = [];
  for (const [, data] of holdingsMap) {
    if (data.totalQuantity > 0.0001) {
      const averageCostEur = data.totalCostEur / data.totalQuantity;
      holdings.push({
        product: data.product,
        isin: data.isin,
        quantity: data.totalQuantity,
        averageCost: averageCostEur,      // EUR per share
        totalCost: data.totalCostEur,     // total EUR invested
        currentPrice: 0,                  // local currency — filled in by updateHoldingsWithPrices
        currentValue: data.totalCostEur,  // EUR — defaults to cost (P/L = 0 until price is set)
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
  prices: Map<string, number>,
  exchangeRates: Map<string, number> = new Map()
): Holding[] {
  return holdings.map((holding) => {
    const priceLocal = prices.get(holding.isin);

    // If no price is set yet, keep P/L at zero
    if (priceLocal === undefined || priceLocal === 0) {
      return { ...holding, currentPrice: 0, currentValue: holding.totalCost, profitLoss: 0, profitLossPercent: 0 };
    }

    const rate = toEurRate(holding.currency, exchangeRates);
    const currentValueEur = holding.quantity * priceLocal * rate;
    const profitLoss = currentValueEur - holding.totalCost;
    const profitLossPercent = holding.totalCost > 0 ? (profitLoss / holding.totalCost) * 100 : 0;

    return {
      ...holding,
      currentPrice: priceLocal,       // local currency (for display in price updater)
      currentValue: currentValueEur,  // EUR
      profitLoss,
      profitLossPercent,
    };
  });
}

export function calculatePortfolioStats(
  transactions: Transaction[],
  holdings: Holding[],
  exchangeRates: Map<string, number> = new Map()
): PortfolioStats {
  let totalDividends = 0;
  let totalFees = 0;
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  for (const t of transactions) {
    const rate = t.currency === 'EUR'
      ? 1
      : (t.exchangeRate ?? toEurRate(t.currency, exchangeRates));

    switch (t.type) {
      case 'deposit':    totalDeposits    += t.totalAmount * rate; break;
      case 'withdrawal': totalWithdrawals += t.totalAmount * rate; break;
      case 'dividend':   totalDividends   += t.totalAmount * rate; break;
      case 'fee':        totalFees        += t.totalAmount * rate; break;
    }
    if (t.fees) totalFees += t.fees * rate;
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfitLoss = totalValue - totalInvested;
  const profitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;
  const cashBalance = Math.max(0, totalDeposits - totalWithdrawals + totalDividends - totalFees - totalInvested);

  return {
    totalValue, totalInvested, totalProfitLoss, profitLossPercent,
    totalDividends, totalFees, cashBalance, numberOfHoldings: holdings.length,
  };
}

export function calculateHistoricalSnapshots(
  transactions: Transaction[],
  currentPrices?: Map<string, number>,
  exchangeRates: Map<string, number> = new Map()
): PortfolioSnapshot[] {
  if (transactions.length === 0) return [];

  const snapshots: PortfolioSnapshot[] = [];
  const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthlyGroups = new Map<string, Transaction[]>();
  for (const t of sortedTransactions) {
    const key = format(t.date, 'yyyy-MM');
    const existing = monthlyGroups.get(key) || [];
    existing.push(t);
    monthlyGroups.set(key, existing);
  }

  let cumulativeTransactions: Transaction[] = [];

  for (const month of Array.from(monthlyGroups.keys()).sort()) {
    cumulativeTransactions = [...cumulativeTransactions, ...(monthlyGroups.get(month) || [])];

    const holdings = calculateHoldings(cumulativeTransactions, exchangeRates);
    const holdingsWithPrices = currentPrices
      ? updateHoldingsWithPrices(holdings, currentPrices, exchangeRates)
      : holdings;

    const totalValue = holdingsWithPrices.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvested = holdingsWithPrices.reduce((sum, h) => sum + h.totalCost, 0);
    const totalProfitLoss = totalValue - totalInvested;

    snapshots.push({
      date: new Date(month + '-28'),
      totalValue,
      totalInvested,
      totalProfitLoss,
      profitLossPercent: totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0,
      holdings: holdingsWithPrices,
    });
  }

  return snapshots;
}

export function filterSnapshotsByTimeRange(snapshots: PortfolioSnapshot[], timeRange: TimeRange): PortfolioSnapshot[] {
  if (timeRange === 'ALL' || snapshots.length === 0) return snapshots;

  const now = new Date();
  let startDate: Date;

  switch (timeRange) {
    case '1M': startDate = subMonths(now, 1); break;
    case '3M': startDate = subMonths(now, 3); break;
    case '6M': startDate = subMonths(now, 6); break;
    case 'YTD': startDate = startOfYear(now); break;
    case '1Y': startDate = subMonths(now, 12); break;
    default: return snapshots;
  }

  return snapshots.filter((s) => isAfter(s.date, startDate) || s.date.getTime() === startDate.getTime());
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
