export interface Transaction {
  id: string;
  date: Date;
  type: 'buy' | 'sell' | 'dividend' | 'fee' | 'deposit' | 'withdrawal';
  product: string;
  isin: string;
  quantity: number;
  price: number;
  totalAmount: number;
  currency: string;
  exchangeRate?: number;
  fees?: number;
  notes?: string;
}

export interface Holding {
  product: string;
  isin: string;
  quantity: number;
  averageCost: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
  currency: string;
  tags?: string[];
  notes?: string;
  sector?: string;
  dividendYield?: number;
  annualDividend?: number;
}

export interface HoldingMetadata {
  isin: string;
  tags: string[];
  notes: string;
  sector: string;
  dividendYield?: number;
  expectedDividendPerShare?: number;
  dividendFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
}

export interface DividendInfo {
  isin: string;
  product: string;
  date: Date;
  amount: number;
  currency: string;
}

export interface BenchmarkData {
  date: string;
  portfolioValue: number;
  sp500: number;
  msciWorld: number;
}

export interface PortfolioSnapshot {
  date: Date;
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  profitLossPercent: number;
  holdings: Holding[];
}

export interface PortfolioState {
  transactions: Transaction[];
  snapshots: PortfolioSnapshot[];
  currentHoldings: Holding[];
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  profitLossPercent: number;
  cashBalance: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  profitLossPercent: number;
  totalDividends: number;
  totalFees: number;
  cashBalance: number;
  numberOfHoldings: number;
}

export interface ParsedDeGiroRow {
  Datum: string;
  Tijd: string;
  Product: string;
  'ISIN': string;
  Beurs: string;
  'Uitvoeringsplaats': string;
  Aantal: string;
  Koers: string;
  'Lokale waarde': string;
  Waarde: string;
  Wisselkoers: string;
  'Transactiekosten en/of': string;
  Totaal: string;
  'Order ID': string;
}

export type TimeRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
