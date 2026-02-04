import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Transaction, Holding, PortfolioSnapshot, PortfolioStats, TimeRange } from '../types';
import {
  calculateHoldings,
  updateHoldingsWithPrices,
  calculatePortfolioStats,
  calculateHistoricalSnapshots,
} from '../utils/calculations';
import {
  saveTransactions,
  loadTransactions,
  saveSnapshots,
  savePrices,
  loadPrices,
} from '../utils/storage';

interface PortfolioState {
  transactions: Transaction[];
  holdings: Holding[];
  snapshots: PortfolioSnapshot[];
  stats: PortfolioStats;
  prices: Map<string, number>;
  isLoading: boolean;
  selectedTimeRange: TimeRange;
}

type PortfolioAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'UPDATE_PRICES'; payload: Map<string, number> }
  | { type: 'SET_TIME_RANGE'; payload: TimeRange }
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
  isLoading: true,
  selectedTimeRange: 'ALL',
};

function recalculateState(state: PortfolioState): PortfolioState {
  const holdings = calculateHoldings(state.transactions);
  const holdingsWithPrices = state.prices.size > 0
    ? updateHoldingsWithPrices(holdings, state.prices)
    : holdings;
  const stats = calculatePortfolioStats(state.transactions, holdingsWithPrices);
  const snapshots = calculateHistoricalSnapshots(state.transactions, state.prices);

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

    case 'SET_TIME_RANGE':
      return { ...state, selectedTimeRange: action.payload };

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
  setTimeRange: (range: TimeRange) => void;
  clearAll: () => void;
  refreshData: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(portfolioReducer, initialState);

  // Load data from storage on mount
  useEffect(() => {
    const transactions = loadTransactions();
    const prices = loadPrices();

    dispatch({ type: 'UPDATE_PRICES', payload: prices });
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

  const addTransactions = useCallback((transactions: Transaction[]) => {
    dispatch({ type: 'ADD_TRANSACTIONS', payload: transactions });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
  }, []);

  const updatePrices = useCallback((prices: Map<string, number>) => {
    dispatch({ type: 'UPDATE_PRICES', payload: prices });
  }, []);

  const setTimeRange = useCallback((range: TimeRange) => {
    dispatch({ type: 'SET_TIME_RANGE', payload: range });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    saveTransactions([]);
    saveSnapshots([]);
  }, []);

  const refreshData = useCallback(() => {
    dispatch({ type: 'RECALCULATE' });
  }, []);

  const value: PortfolioContextValue = {
    ...state,
    addTransactions,
    deleteTransaction,
    updatePrices,
    setTimeRange,
    clearAll,
    refreshData,
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
