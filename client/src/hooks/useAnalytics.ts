import { useState, useEffect } from 'react';
import { tradersApi } from '../services/api';

export interface TraderAnalytics {
  performance: {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    winRate: string;
    winRateDecimal: number;
  };
  financial: {
    totalProfitLoss: number;
    bestTradeGain: number;
    worstTradeLoss: number;
    avgTradeSize: number;
  };
  behavior: {
    mostTradedSymbol: string;
    tradesPerDay: number;
    avgExecutionTimeMs: number;
  };
}

interface UseAnalyticsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useAnalytics(
  traderName: string,
  options: UseAnalyticsOptions = {}
) {
  const [analytics, setAnalytics] = useState<TraderAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { autoRefresh = false, refreshInterval = 60000 } = options;

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const analytics = await tradersApi.getAnalytics(traderName);
        setAnalytics(analytics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();

    if (autoRefresh) {
      const interval = setInterval(fetchAnalytics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [traderName, autoRefresh, refreshInterval]);

  return { analytics, isLoading, error };
}
