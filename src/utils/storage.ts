import type { Transaction, PortfolioSnapshot, HoldingMetadata } from '../types';
import { getPriceCurrency } from './priceApi';
import { recoverCorruptedDate } from './csvParser';

const STORAGE_KEYS = {
  TRANSACTIONS: 'degiro_transactions',
  SNAPSHOTS: 'degiro_snapshots',
  PRICES: 'degiro_prices',
  SETTINGS: 'degiro_settings',
  HOLDING_METADATA: 'degiro_holding_metadata',
  EXCHANGE_RATES: 'degiro_exchange_rates',
  HISTORICAL_PRICES: 'degiro_historical_prices',
  BENCHMARK_PRICES: 'degiro_benchmark_prices',
} as const;

// Benchmark prices are cached for 6 hours to avoid excessive Yahoo Finance calls
export const BENCHMARK_CACHE_MS = 6 * 60 * 60 * 1000;

export interface CachedBenchmarks {
  sp500: Array<{ date: string; price: number }>;
  msciWorld: Array<{ date: string; price: number }>;
  fetchedAt: number; // Date.now() at time of fetch
}

export function saveBenchmarkPrices(cached: CachedBenchmarks): void {
  localStorage.setItem(STORAGE_KEYS.BENCHMARK_PRICES, JSON.stringify(cached));
}

export function loadBenchmarkPrices(): CachedBenchmarks | null {
  const data = localStorage.getItem(STORAGE_KEYS.BENCHMARK_PRICES);
  if (!data) return null;
  return safeJSONParse<CachedBenchmarks | null>(data, null);
}

export function isBenchmarkStale(cached: CachedBenchmarks | null): boolean {
  if (!cached) return true;
  return (Date.now() - cached.fetchedAt) > BENCHMARK_CACHE_MS;
}

function safeJSONParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// Serialize dates for storage
function serializeTransaction(t: Transaction): Transaction & { date: string } {
  return {
    ...t,
    date: t.date instanceof Date ? t.date.toISOString() : t.date,
  } as Transaction & { date: string };
}

// Deserialize dates from storage
function deserializeTransaction(t: Transaction & { date: string }): Transaction {
  return {
    ...t,
    date: new Date(t.date),
  };
}

function serializeSnapshot(s: PortfolioSnapshot): PortfolioSnapshot & { date: string } {
  return {
    ...s,
    date: s.date instanceof Date ? s.date.toISOString() : s.date,
  } as PortfolioSnapshot & { date: string };
}

function deserializeSnapshot(s: PortfolioSnapshot & { date: string }): PortfolioSnapshot {
  return {
    ...s,
    date: new Date(s.date),
  };
}

export function saveTransactions(transactions: Transaction[]): void {
  const serialized = transactions.map(serializeTransaction);
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(serialized));
}

export function loadTransactions(): Transaction[] {
  const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  const parsed = safeJSONParse<(Transaction & { date: string })[]>(data, []);
  return parsed.map(deserializeTransaction);
}

export function saveSnapshots(snapshots: PortfolioSnapshot[]): void {
  const serialized = snapshots.map(serializeSnapshot);
  localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(serialized));
}

export function loadSnapshots(): PortfolioSnapshot[] {
  const data = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
  const parsed = safeJSONParse<(PortfolioSnapshot & { date: string })[]>(data, []);
  return parsed.map(deserializeSnapshot);
}

export function savePrices(prices: Record<string, number>): void {
  localStorage.setItem(STORAGE_KEYS.PRICES, JSON.stringify(prices));
}

export function loadPrices(): Map<string, number> {
  const data = localStorage.getItem(STORAGE_KEYS.PRICES);
  const parsed = safeJSONParse<Record<string, number>>(data, {});
  return new Map(Object.entries(parsed));
}

export function saveSettings(settings: Record<string, unknown>): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadSettings(): Record<string, unknown> {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return safeJSONParse(data, {});
}

export function saveHistoricalPrices(prices: Map<string, Array<{ date: string; price: number }>>): void {
  localStorage.setItem(STORAGE_KEYS.HISTORICAL_PRICES, JSON.stringify(Object.fromEntries(prices)));
}

export function loadHistoricalPrices(): Map<string, Array<{ date: string; price: number }>> {
  const data = localStorage.getItem(STORAGE_KEYS.HISTORICAL_PRICES);
  const parsed = safeJSONParse<Record<string, Array<{ date: string; price: number }>>>(data, {});
  return new Map(Object.entries(parsed));
}

export function saveExchangeRates(rates: Map<string, number>): void {
  localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATES, JSON.stringify(Object.fromEntries(rates)));
}

export function loadExchangeRates(): Map<string, number> {
  const data = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATES);
  const parsed = safeJSONParse<Record<string, number>>(data, {});
  const result = new Map(Object.entries(parsed));
  console.log('[loadExchangeRates] Loaded from storage:', Object.fromEntries(result));
  return result;
}

export function saveHoldingMetadata(metadata: Map<string, HoldingMetadata>): void {
  localStorage.setItem(STORAGE_KEYS.HOLDING_METADATA, JSON.stringify(Object.fromEntries(metadata)));
}

export function loadHoldingMetadata(): Map<string, HoldingMetadata> {
  const data = localStorage.getItem(STORAGE_KEYS.HOLDING_METADATA);
  const parsed = safeJSONParse<Record<string, HoldingMetadata>>(data, {});
  return new Map(Object.entries(parsed));
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function exportAllData(): string {
  return JSON.stringify({
    transactions: loadTransactions().map(serializeTransaction),
    snapshots: loadSnapshots().map(serializeSnapshot),
    prices: Object.fromEntries(loadPrices()),
    exchangeRates: Object.fromEntries(loadExchangeRates()),
    settings: loadSettings(),
    holdingMetadata: Object.fromEntries(loadHoldingMetadata()),
    exportDate: new Date().toISOString(),
  }, null, 2);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    console.log('[importAllData] Parsed backup:', {
      hasTransactions: !!data.transactions,
      transactionCount: data.transactions?.length,
      hasExchangeRates: !!data.exchangeRates,
      exchangeRates: data.exchangeRates,
      hasPrices: !!data.prices,
    });

    if (data.transactions) {
      // Fix currencies during import using ISIN-to-ticker mapping
      const transactions = data.transactions.map(deserializeTransaction).map((t: Transaction) => {
        if (t.isin) {
          const inferredCurrency = getPriceCurrency(t.isin);
          if (inferredCurrency && t.currency === 'EUR' && inferredCurrency !== 'EUR') {
            return { ...t, currency: inferredCurrency };
          }
        }
        return t;
      });
      saveTransactions(transactions);
    }
    // Snapshots are derived data, no need to import (they'll be recalculated)
    if (data.prices) {
      savePrices(data.prices);
    }
    if (data.exchangeRates) {
      saveExchangeRates(new Map(Object.entries(data.exchangeRates)));
    }
    if (data.settings) {
      saveSettings(data.settings);
    }
    if (data.holdingMetadata) {
      saveHoldingMetadata(new Map(Object.entries(data.holdingMetadata)));
    }

    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

// Detect and fix transactions with corrupted dates (result of the old
// parseDate bug that misparsed YYYY-MM-DD as DD-MM-YYYY, producing dates
// in the 1900s). Returns the number of transactions that were fixed.
export function migrateBrokenDates(): { fixed: number; unfixable: number } {
  const transactions = loadTransactions();
  let fixed = 0;
  let unfixable = 0;

  const migrated = transactions.map((t) => {
    const year = t.date.getFullYear();
    // Any date before 2000 or after 2100 is suspect
    if (year >= 2000 && year <= 2100) return t;

    const recovered = recoverCorruptedDate(t.date);
    if (recovered) {
      fixed++;
      return { ...t, date: recovered };
    }
    unfixable++;
    return t;
  });

  if (fixed > 0) {
    saveTransactions(migrated);
  }
  return { fixed, unfixable };
}

// Count transactions with dates outside a reasonable range (2000-2100)
export function countBrokenDates(): number {
  return loadTransactions().filter((t) => {
    const y = t.date.getFullYear();
    return y < 2000 || y > 2100;
  }).length;
}

// Fix currencies in existing transactions using ISIN-to-ticker mapping
// Returns the number of transactions that were corrected
export function migrateTransactionCurrencies(): number {
  const transactions = loadTransactions();
  let corrected = 0;

  const fixed = transactions.map((t) => {
    if (t.isin && t.currency === 'EUR') {
      const inferredCurrency = getPriceCurrency(t.isin);
      if (inferredCurrency && inferredCurrency !== 'EUR') {
        corrected++;
        return { ...t, currency: inferredCurrency };
      }
    }
    return t;
  });

  if (corrected > 0) {
    saveTransactions(fixed);
  }

  return corrected;
}
