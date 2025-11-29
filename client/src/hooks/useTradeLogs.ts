import { useState, useEffect } from 'react';
import { tradersApi } from '../services/api';

export interface TradeLog {
  id: number;
  trader_name: string;
  timestamp: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'ERROR';
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  success: boolean;
  error_message: string | null;
  prompt: string;
  rationale: string | null;
  execution_time_ms: number;
  market_data_snapshot: string | null;
  portfolio_before: string | null;
  portfolio_after: string | null;
}

interface UseTradeLogsOptions {
  limit?: number;
  symbol?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useTradeLogs(
  traderName: string,
  options: UseTradeLogsOptions = {}
) {
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    limit = 50,
    symbol,
    success,
    startDate,
    endDate,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const logs = await tradersApi.getTradeLogs(traderName, {
          limit,
          symbol,
          success,
          startDate,
          endDate,
        });

        setLogs(logs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [
    traderName,
    limit,
    symbol,
    success,
    startDate,
    endDate,
    autoRefresh,
    refreshInterval,
  ]);

  return { logs, isLoading, error };
}
