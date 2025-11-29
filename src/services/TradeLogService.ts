import { DatabaseService, TradeLog } from './DatabaseService.js';
import { Logger } from '../utils/logger.js';

export interface TradeLogData {
  traderName: string;
  prompt?: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'ERROR';
  symbol?: string;
  quantity?: number;
  price?: number;
  success: boolean;
  errorMessage?: string;
  executionTimeMs: number;
  rationale?: string;
  marketDataSnapshot?: any;
  portfolioBefore?: any;
  portfolioAfter?: any;
}

export interface TradeAnalytics {
  traderName: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  winRate: number;
  totalProfitLoss: number;
  bestTradeGain: number;
  worstTradeLoss: number;
  avgTradeSize: number;
  avgExecutionTimeMs: number;
  mostTradedSymbol: string | null;
  tradesPerDay: number;
}

export class TradeLogService {
  constructor(private db: DatabaseService) {}

  public logTrade(data: TradeLogData): number {
    try {
      const logId = this.db.createTradeLog({
        trader_name: data.traderName,
        prompt: data.prompt || null,
        action: data.action,
        symbol: data.symbol || null,
        quantity: data.quantity || null,
        price: data.price || null,
        success: data.success,
        error_message: data.errorMessage || null,
        execution_time_ms: data.executionTimeMs,
        rationale: data.rationale || null,
        market_data_snapshot: data.marketDataSnapshot
          ? JSON.stringify(data.marketDataSnapshot)
          : null,
        portfolio_before: data.portfolioBefore
          ? JSON.stringify(data.portfolioBefore)
          : null,
        portfolio_after: data.portfolioAfter
          ? JSON.stringify(data.portfolioAfter)
          : null,
      });

      if (data.success) {
        Logger.success(
          `Trade logged: ${data.traderName} ${data.action} ${data.quantity} ${data.symbol} @ $${data.price?.toFixed(2)}`
        );
      } else {
        Logger.warn(
          `Failed trade logged: ${data.traderName} ${data.action} - ${data.errorMessage}`
        );
      }

      return logId;
    } catch (error) {
      Logger.error('Failed to log trade', error);
      throw error;
    }
  }

  public getTradeLogs(
    traderName: string,
    options?: {
      limit?: number;
      symbol?: string;
      success?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ): TradeLog[] {
    return this.db.getTradeLogs(traderName, options);
  }

  public getAllTradeLogs(limit: number = 100): TradeLog[] {
    return this.db.getAllTradeLogs(limit);
  }

  public getAnalytics(traderName: string): TradeAnalytics {
    const logs = this.db.getTradeLogs(traderName, { limit: 10000 });

    if (logs.length === 0) {
      return {
        traderName,
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        winRate: 0,
        totalProfitLoss: 0,
        bestTradeGain: 0,
        worstTradeLoss: 0,
        avgTradeSize: 0,
        avgExecutionTimeMs: 0,
        mostTradedSymbol: null,
        tradesPerDay: 0,
      };
    }

    const successfulTrades = logs.filter((l) => l.success).length;
    const failedTrades = logs.length - successfulTrades;
    const winRate = successfulTrades / logs.length;

    const executionTimes = logs.map((l) => l.execution_time_ms);
    const avgExecutionTimeMs =
      executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;

    const buyLogs = logs.filter((l) => l.action === 'BUY' && l.success);
    const sellLogs = logs.filter((l) => l.action === 'SELL' && l.success);

    const tradeSizes = [...buyLogs, ...sellLogs]
      .filter((l) => l.quantity && l.price)
      .map((l) => l.quantity! * l.price!);
    const avgTradeSize =
      tradeSizes.length > 0
        ? tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length
        : 0;

    const gains = this.calculateTradeGains(buyLogs, sellLogs);
    const totalProfitLoss = gains.reduce((a, b) => a + b, 0);
    const bestTradeGain = gains.length > 0 ? Math.max(...gains) : 0;
    const worstTradeLoss = gains.length > 0 ? Math.min(...gains) : 0;

    const symbolCounts = new Map<string, number>();
    logs
      .filter((l) => l.symbol && l.success)
      .forEach((l) => {
        const count = symbolCounts.get(l.symbol!) || 0;
        symbolCounts.set(l.symbol!, count + 1);
      });

    let mostTradedSymbol: string | null = null;
    let maxCount = 0;
    symbolCounts.forEach((count, symbol) => {
      if (count > maxCount) {
        maxCount = count;
        mostTradedSymbol = symbol;
      }
    });

    const daySpan = this.calculateDaySpan(logs);
    const tradesPerDay = daySpan > 0 ? logs.length / daySpan : logs.length;

    return {
      traderName,
      totalTrades: logs.length,
      successfulTrades,
      failedTrades,
      winRate,
      totalProfitLoss,
      bestTradeGain,
      worstTradeLoss,
      avgTradeSize,
      avgExecutionTimeMs,
      mostTradedSymbol,
      tradesPerDay,
    };
  }

  public getAllAnalytics(): TradeAnalytics[] {
    const traderNames = ['Leonardo', 'Michelangelo', 'Raphael', 'Donatello'];
    return traderNames.map((name) => this.getAnalytics(name));
  }

  private calculateTradeGains(
    buyLogs: TradeLog[],
    sellLogs: TradeLog[]
  ): number[] {
    const gains: number[] = [];
    const positions = new Map<string, { qty: number; avgPrice: number }>();

    buyLogs.forEach((log) => {
      if (!log.symbol || !log.quantity || !log.price) return;

      const pos = positions.get(log.symbol);
      if (pos) {
        const totalQty = pos.qty + log.quantity;
        const totalCost = pos.qty * pos.avgPrice + log.quantity * log.price;
        positions.set(log.symbol, {
          qty: totalQty,
          avgPrice: totalCost / totalQty,
        });
      } else {
        positions.set(log.symbol, {
          qty: log.quantity,
          avgPrice: log.price,
        });
      }
    });

    sellLogs.forEach((log) => {
      if (!log.symbol || !log.quantity || !log.price) return;

      const pos = positions.get(log.symbol);
      if (pos && pos.qty >= log.quantity) {
        const gain = (log.price - pos.avgPrice) * log.quantity;
        gains.push(gain);

        const remainingQty = pos.qty - log.quantity;
        if (remainingQty > 0) {
          positions.set(log.symbol, { ...pos, qty: remainingQty });
        } else {
          positions.delete(log.symbol);
        }
      }
    });

    return gains;
  }

  private calculateDaySpan(logs: TradeLog[]): number {
    if (logs.length === 0) return 0;

    const timestamps = logs.map((l) => new Date(l.timestamp).getTime());
    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);
    const daysDiff = (latest - earliest) / (1000 * 60 * 60 * 24);

    return Math.max(daysDiff, 1);
  }
}
