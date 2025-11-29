import axios from 'axios';
import type {
  Trader,
  Portfolio,
  Transaction,
  PortfolioValue,
  TradeResponse,
} from '../types';
import type { TradeLog } from '../hooks/useTradeLogs';
import type { TraderAnalytics } from '../hooks/useAnalytics';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const tradersApi = {
  // Get all traders
  getAll: async (): Promise<Trader[]> => {
    const { data } = await api.get<{ traders: Trader[] }>('/api/traders');
    return data.traders;
  },

  // Get trader portfolio
  getPortfolio: async (name: string): Promise<Portfolio> => {
    const { data } = await api.get<{ portfolio: Portfolio }>(
      `/api/portfolio/${name}`
    );
    return data.portfolio;
  },

  // Get trader transactions
  getTransactions: async (name: string, limit = 50): Promise<Transaction[]> => {
    const { data } = await api.get<{ transactions: Transaction[] }>(
      `/api/transactions/${name}`,
      { params: { limit } }
    );
    return data.transactions;
  },

  // Get portfolio value history
  getPortfolioHistory: async (
    name: string,
    limit = 100
  ): Promise<PortfolioValue[]> => {
    const { data } = await api.get<{ history: PortfolioValue[] }>(
      `/api/portfolio/${name}/history`,
      { params: { limit } }
    );
    return data.history;
  },

  // Execute a trade
  executeTrade: async (
    name: string,
    prompt: string
  ): Promise<TradeResponse> => {
    const { data } = await api.post<TradeResponse>(
      `/api/traders/${name}/trade`,
      { prompt }
    );
    return data;
  },

  // Get trade logs
  getTradeLogs: async (
    name: string,
    options: {
      limit?: number;
      symbol?: string;
      success?: boolean;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<TradeLog[]> => {
    const { data } = await api.get<{ logs: TradeLog[] }>(
      `/api/analytics/trade-logs/${name}`,
      { params: options }
    );
    return data.logs;
  },

  // Get trader analytics
  getAnalytics: async (name: string): Promise<TraderAnalytics> => {
    const { data } = await api.get<{ analytics: TraderAnalytics }>(
      `/api/analytics/${name}`
    );
    return data.analytics;
  },
};
