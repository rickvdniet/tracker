import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import type { Transaction, Holding, PortfolioSnapshot, PortfolioStats, TimeRange, HoldingMetadata } from '../types';
import {
  calculateHoldings,
  updateHoldingsWithPrices,
  calculatePortfolioStats,
  calculateHistoricalSnapshots,
  type ChartGranularity,
} from '../utils/calculations';
import {
  saveTransactions,
  loadTransactions,
  saveSnapshots,
  savePrices,
  loadPrices,
  saveHoldingMetadata,
  loadHoldingMetadata,
  saveExchangeRates,
  loadExchangeRates,
  saveHistoricalPrices,
  loadHistoricalPrices,
} from '../utils/storage';
import { fetchHistoricalPrices as fetchHistoricalPricesApi, isinToTicker } from '../utils/priceApi';

interface PortfolioState {
  transactions: Transaction[];
  holdings: Holding[];
  snapshots: PortfolioSnapshot[];
  stats: PortfolioStats;
  prices: Map<string, number>;
  exchangeRates: Map<string, number>;
  historicalPrices: Map<string, Array<{ date: string; price: number }>>;
  holdingMetadata: Map<string, HoldingMetadata>;
  isLoading: boolean;
  selectedTimeRange: TimeRange;
  chartGranularity: ChartGranularity;
}

type PortfolioAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'UPDATE_PRICES'; payload: Map<string, number> }
  | { type: 'UPDATE_EXCHANGE_RATES'; payload: Map<string, number> }
  | { type: 'SET_HISTORICAL_PRICES'; payload: Map<string, Array<{ date: string; price: number }>> }
  | { type: 'UPDATE_HOLDING_METADATA'; payload: HoldingMetadata }
  | { type: 'SET_HOLDING_METADATA'; payload: Map<string, HoldingMetadata> }
  | { type: 'SET_TIME_RANGE'; payload: TimeRange }
  | { type: 'SET_CHART_GRANULARITY'; payload: ChartGranularity }
  | { type: 'RECALCULATE' }
  | { type: 'CLEAR_ALL' };

const initialState: PortfolioState = {
  transactions: [],
  holdings: [],
  snapshots: [],
  stats: {
    totalValue: 0,
    totalInvested: 0,
    totalProfitLoss: 0,
    profitLossPercent: 0,
    totalDividends: 0,
    totalFees: 0,
    cashBalance: 0,
    numberOfHoldings: 0,
  },
  prices: new Map(),
  exchangeRates: new Map(),
  historicalPrices: new Map(),
  holdingMetadata: new Map(),
  isLoading: true,
  selectedTimeRange: '3M',
  chartGranularity: 'monthly',
};

function recalculateState(state: PortfolioState): PortfolioState {
  const holdings = calculateHoldings(state.transactions, state.exchangeRates);
  const holdingsWithPrices = state.prices.size > 0
    ? updateHoldingsWithPrices(holdings, state.prices, state.exchangeRates)
    : holdings;
  const stats = calculatePortfolioStats(state.transactions, holdingsWithPrices, state.exchangeRates);
  const snapshots = calculateHistoricalSnapshots(
    state.transactions,
    state.prices,
    state.exchangeRates,
    state.historicalPrices,
    state.chartGranularity
  );

  return {
    ...state,
    holdings: holdingsWithPrices,
    stats,
    snapshots,
  };
}

function portfolioReducer(state: PortfolioState, action: PortfolioAction): PortfolioState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_TRANSACTIONS': {
      const newState = { ...state, transactions: action.payload };
      return recalculateState(newState);
    }

    case 'ADD_TRANSACTIONS': {
      const existingIds = new Set(state.transactions.map((t) => t.id));
      const newTransactions = action.payload.filter((t) => !existingIds.has(t.id));
      const allTransactions = [...state.transactions, ...newTransactions].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
      const newState = { ...state, transactions: allTransactions };
      return recalculateState(newState);
    }

    case 'DELETE_TRANSACTION': {
      const transactions = state.transactions.filter((t) => t.id !== action.payload);
      const newState = { ...state, transactions };
      return recalculateState(newState);
    }

    case 'UPDATE_PRICES': {
      const newState = { ...state, prices: action.payload };
      return recalculateState(newState);
    }

    case 'UPDATE_EXCHANGE_RATES': {
      const newState = { ...state, exchangeRates: action.payload };
      return recalculateState(newState);
    }

    case 'SET_HISTORICAL_PRICES': {
      const newState = { ...state, historicalPrices: action.payload };
      return recalculateState(newState);
    }

    case 'SET_TIME_RANGE':
      return { ...state, selectedTimeRange: action.payload };

    case 'SET_CHART_GRANULARITY': {
      const newState = { ...state, chartGranularity: action.payload };
      return recalculateState(newState);
    }

    case 'UPDATE_HOLDING_METADATA': {
      const newMetadata = new Map(state.holdingMetadata);
      newMetadata.set(action.payload.isin, action.payload);
      return { ...state, holdingMetadata: newMetadata };
    }

    case 'SET_HOLDING_METADATA':
      return { ...state, holdingMetadata: action.payload };

    case 'RECALCULATE':
      return recalculateState(state);

    case 'CLEAR_ALL':
      return {
        ...initialState,
        isLoading: false,
      };

    default:
      return state;
  }
}

interface PortfolioContextValue extends PortfolioState {
  addTransactions: (transactions: Transaction[]) => void;
  deleteTransaction: (id: string) => void;
  updatePrices: (prices: Map<string, number>) => void;
  updateExchangeRates: (rates: Map<string, number>) => void;
  updateHoldingMetadata: (metadata: HoldingMetadata) => void;
  setTimeRange: (range: TimeRange) => void;
  setChartGranularity: (granularity: ChartGranularity) => void;
  clearAll: () => void;
  refreshData: () => void;
  fetchHistoricalData: (isins: string[]) => Promise<void>;
  historicalPricesLoading: boolean;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(portfolioReducer, initialState);
  const [historicalPricesLoading, setHistoricalPricesLoading] = useState(false);

  // Load data from storage on mount
  useEffect(() => {
    const transactions = loadTransactions();
    const prices = loadPrices();
    const metadata = loadHoldingMetadata();
    const exchangeRates = loadExchangeRates();
    const historicalPrices = loadHistoricalPrices();

    dispatch({ type: 'UPDATE_EXCHANGE_RATES', payload: exchangeRates });
    dispatch({ type: 'SET_HISTORICAL_PRICES', payload: historicalPrices });
    dispatch({ type: 'UPDATE_PRICES', payload: prices });
    dispatch({ type: 'SET_HOLDING_METADATA', payload: metadata });
    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  // Save data to storage when it changes
  useEffect(() => {
    if (!state.isLoading) {
      saveTransactions(state.transactions);
      saveSnapshots(state.snapshots);
    }
  }, [state.transactions, state.snapshots, state.isLoading]);

  useEffect(() => {
    if (!state.isLoading && state.prices.size > 0) {
      savePrices(Object.fromEntries(state.prices));
    }
  }, [state.prices, state.isLoading]);

  useEffect(() => {
    if (!state.isLoading && state.exchangeRates.size > 0) {
      saveExchangeRates(state.exchangeRates);
    }
  }, [state.exchangeRates, state.isLoading]);

  useEffect(() => {
    if (!state.isLoading && state.holdingMetadata.size > 0) {
      saveHoldingMetadata(state.holdingMetadata);
    }
  }, [state.holdingMetadata, state.isLoading]);

  const addTransactions = useCallback((transactions: Transaction[]) => {
    dispatch({ type: 'ADD_TRANSACTIONS', payload: transactions });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
  }, []);

  const updatePrices = useCallback((prices: Map<string, number>) => {
    dispatch({ type: 'UPDATE_PRICES', payload: prices });
  }, []);

  const updateExchangeRates = useCallback((rates: Map<string, number>) => {
    dispatch({ type: 'UPDATE_EXCHANGE_RATES', payload: rates });
  }, []);

  const updateHoldingMetadata = useCallback((metadata: HoldingMetadata) => {
    dispatch({ type: 'UPDATE_HOLDING_METADATA', payload: metadata });
  }, []);

  const setTimeRange = useCallback((range: TimeRange) => {
    dispatch({ type: 'SET_TIME_RANGE', payload: range });
  }, []);

  const setChartGranularity = useCallback((granularity: ChartGranularity) => {
    dispatch({ type: 'SET_CHART_GRANULARITY', payload: granularity });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    saveTransactions([]);
    saveSnapshots([]);
  }, []);

  const refreshData = useCallback(() => {
    dispatch({ type: 'RECALCULATE' });
  }, []);

  // Fetches monthly historical closing prices for each ISIN (via Yahoo Finance proxy)
  // and caches them in storage. Calling with a subset of ISINs only re-fetches those.
  const fetchHistoricalData = useCallback(async (isins: string[]) => {
    setHistoricalPricesLoading(true);
    const updated = new Map(state.historicalPrices);

    for (const isin of isins) {
      const ticker = isinToTicker(isin);
      if (!ticker) continue;
      const prices = await fetchHistoricalPricesApi(ticker);
      if (prices.length > 0) updated.set(isin, prices);
      // Small delay to avoid rate-limiting
      await new Promise((r) => setTimeout(r, 400));
    }

    dispatch({ type: 'SET_HISTORICAL_PRICES', payload: updated });
    saveHistoricalPrices(updated);
    setHistoricalPricesLoading(false);
  }, [state.historicalPrices]);

  const value: PortfolioContextValue = {
    ...state,
    addTransactions,
    deleteTransaction,
    updatePrices,
    updateExchangeRates,
    updateHoldingMetadata,
    setTimeRange,
    setChartGranularity,
    clearAll,
    refreshData,
    fetchHistoricalData,
    historicalPricesLoading,
  };

  return (
    <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
