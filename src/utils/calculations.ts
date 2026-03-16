import type { Transaction, Holding, PortfolioSnapshot, PortfolioStats, TimeRange } from '../types';
import { subMonths, startOfYear, isAfter, format, eachWeekOfInterval, eachMonthOfInterval, max } from 'date-fns';
import { getPriceCurrency } from './priceApi';

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

    // Debug non-EUR transactions
    if (transaction.currency !== 'EUR') {
      console.log('[calculateHoldings] Non-EUR transaction:', {
        product: transaction.product,
        currency: transaction.currency,
        totalAmount: transaction.totalAmount,
        storedExchangeRate: transaction.exchangeRate,
        mapRate: exchangeRates.get(transaction.currency),
        usedRate: rate,
        costEur,
      });
    }
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

    // Use the ticker-inferred currency when available — CSV imports hardcode
    // holding.currency='EUR' even for SEK/GBP/USD stocks, so we can't trust it.
    const priceCurrency = getPriceCurrency(holding.isin) ?? holding.currency;
    const rate = toEurRate(priceCurrency, exchangeRates);
    const currentValueEur = holding.quantity * priceLocal * rate;

    // Debug SEK stocks
    if (holding.isin && holding.isin.startsWith('SE')) {
      console.log('SEK value calc:', {
        isin: holding.isin,
        holdingCurrency: holding.currency,
        inferredPriceCurrency: getPriceCurrency(holding.isin),
        finalPriceCurrency: priceCurrency,
        rate,
        priceLocal,
        currentValueEur,
      });
    }
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

// Look up the best available price for an ISIN at a given date key.
// Supports both 'yyyy-MM' (monthly) and 'yyyy-MM-dd' (weekly) keys.
function getHistoricalPrice(
  isin: string,
  dateKey: string, // 'yyyy-MM' or 'yyyy-MM-dd'
  historicalPrices: Map<string, Array<{ date: string; price: number }>>,
  currentPrices: Map<string, number>
): number {
  const history = historicalPrices.get(isin);
  if (history && history.length > 0) {
    // For weekly keys (yyyy-MM-dd), compare full date; for monthly, compare prefix
    const keyLen = dateKey.length;
    const upToDate = history.filter((p) => p.price > 0 && p.date.substring(0, keyLen) <= dateKey);
    if (upToDate.length > 0) return upToDate[upToDate.length - 1].price;
  }
  return currentPrices.get(isin) ?? 0;
}

export type ChartGranularity = 'weekly' | 'monthly';

export function calculateHistoricalSnapshots(
  transactions: Transaction[],
  currentPrices: Map<string, number> = new Map(),
  exchangeRates: Map<string, number> = new Map(),
  historicalPrices: Map<string, Array<{ date: string; price: number }>> = new Map(),
  granularity: ChartGranularity = 'monthly'
): PortfolioSnapshot[] {
  if (transactions.length === 0) return [];

  const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sortedTransactions[0].date;
  const lastDate = max([sortedTransactions[sortedTransactions.length - 1].date, new Date()]);

  // Generate time periods based on granularity
  const periods = granularity === 'weekly'
    ? eachWeekOfInterval({ start: firstDate, end: lastDate }, { weekStartsOn: 1 })
    : eachMonthOfInterval({ start: firstDate, end: lastDate });

  const snapshots: PortfolioSnapshot[] = [];

  for (const periodDate of periods) {
    // Get all transactions up to and including this period
    const transactionsUpToPeriod = sortedTransactions.filter((t) => t.date <= periodDate);
    if (transactionsUpToPeriod.length === 0) continue;

    const holdings = calculateHoldings(transactionsUpToPeriod, exchangeRates);

    // Build date key for price lookup
    const dateKey = granularity === 'weekly'
      ? format(periodDate, 'yyyy-MM-dd')
      : format(periodDate, 'yyyy-MM');

    // Build a price map for this period using historical data
    const periodPrices = new Map<string, number>();
    for (const h of holdings) {
      const price = getHistoricalPrice(h.isin, dateKey, historicalPrices, currentPrices);
      if (price > 0) periodPrices.set(h.isin, price);
    }

    const holdingsWithPrices = periodPrices.size > 0
      ? updateHoldingsWithPrices(holdings, periodPrices, exchangeRates)
      : holdings;

    const totalValue = holdingsWithPrices.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvested = holdingsWithPrices.reduce((sum, h) => sum + h.totalCost, 0);
    const totalProfitLoss = totalValue - totalInvested;

    snapshots.push({
      date: periodDate,
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
