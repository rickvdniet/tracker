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
