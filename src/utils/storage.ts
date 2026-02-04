import type { Transaction, PortfolioSnapshot } from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'degiro_transactions',
  SNAPSHOTS: 'degiro_snapshots',
  PRICES: 'degiro_prices',
  SETTINGS: 'degiro_settings',
} as const;

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
    settings: loadSettings(),
    exportDate: new Date().toISOString(),
  }, null, 2);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);

    if (data.transactions) {
      saveTransactions(data.transactions.map(deserializeTransaction));
    }
    if (data.snapshots) {
      saveSnapshots(data.snapshots.map(deserializeSnapshot));
    }
    if (data.prices) {
      savePrices(data.prices);
    }
    if (data.settings) {
      saveSettings(data.settings);
    }

    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}
