/**
 * Performance Analytics Service
 *
 * Computes comprehensive trading performance metrics including:
 * - Total return and P&L
 * - Win rate and trade statistics
 * - Maximum drawdown
 * - Per-symbol breakdown
 * - Equity curve (when portfolio snapshots available)
 *
 * This service orchestrates modular calculators for each metric type.
 */

import { Logger } from '../../utils/logger.js';
import type { TradeLogService } from '../TradeLogService.js';
import {
  TIME_PERIOD,
  PERIOD_DAYS,
  DEFAULT_RECENT_TRADES_LIMIT,
  DEFAULT_SYMBOL_RANK_LIMIT,
} from './constants.js';
import type {
  TimePeriodValue,
  PerformanceSummary,
  PerformanceQueryOptions,
} from './types.js';
import {
  TradeStatisticsCalculator,
  DrawdownCalculator,
  EquityCalculator,
  SymbolStatsCalculator,
  RecentTradesFormatter,
} from './calculators/index.js';

export class PerformanceAnalyticsService {
  private tradeStats: TradeStatisticsCalculator;
  private drawdown: DrawdownCalculator;
  private equity: EquityCalculator;
  private symbolStats: SymbolStatsCalculator;
  private recentTrades: RecentTradesFormatter;

  constructor(private tradeLogService: TradeLogService) {
    this.tradeStats = new TradeStatisticsCalculator();
    this.drawdown = new DrawdownCalculator();
    this.equity = new EquityCalculator();
    this.symbolStats = new SymbolStatsCalculator();
    this.recentTrades = new RecentTradesFormatter();

    Logger.info('PerformanceAnalyticsService initialized');
  }

  /**
   * Get comprehensive performance summary for a trader
   */
  getPerformanceSummary(
    traderName: string,
    options: PerformanceQueryOptions = {}
  ): PerformanceSummary {
    const {
      period = TIME_PERIOD.ALL_TIME,
      startDate,
      endDate,
      recentTradesLimit = DEFAULT_RECENT_TRADES_LIMIT,
      symbolRankLimit = DEFAULT_SYMBOL_RANK_LIMIT,
    } = options;

    // Calculate date range
    const { periodStart, periodEnd } = this.calculateDateRange(
      period,
      startDate,
      endDate
    );

    // Fetch trade logs for the period
    const logs = this.tradeLogService.getTradeLogs(traderName, {
      limit: 10000,
      startDate: periodStart ?? undefined,
      endDate: periodEnd,
    });

    // Filter to successful BUY/SELL trades only for metrics
    const trades = logs.filter(
      (l) => l.success && (l.action === 'BUY' || l.action === 'SELL')
    );

    // Calculate portfolio values from snapshots
    const { initialValue, currentValue, equityCurve } =
      this.equity.extractPortfolioValues(logs);

    // Calculate return metrics
    const totalReturn = currentValue - initialValue;
    const totalReturnPercent =
      initialValue > 0 ? (totalReturn / initialValue) * 100 : 0;

    // Calculate trade statistics
    const tradeStatistics = this.tradeStats.calculate(trades);

    // Calculate drawdown
    const drawdownInfo = this.drawdown.calculate(equityCurve, currentValue);

    // Calculate Sharpe ratio
    const sharpeRatio = this.equity.calculateSharpeRatio(equityCurve);

    // Calculate per-symbol statistics
    const symbolStatistics = this.symbolStats.calculate(trades);

    // Sort symbols by P&L
    const sortedByPnL = [...symbolStatistics].sort(
      (a, b) => b.realizedPnL - a.realizedPnL
    );
    const topWinners = sortedByPnL
      .filter((s) => s.realizedPnL > 0)
      .slice(0, symbolRankLimit);
    const topLosers = sortedByPnL
      .filter((s) => s.realizedPnL < 0)
      .slice(-symbolRankLimit)
      .reverse();

    // Get recent trades
    const recentTradesList = this.recentTrades.format(
      trades,
      recentTradesLimit
    );

    return {
      traderName,
      period,
      periodStart,
      periodEnd: periodEnd || new Date().toISOString(),

      initialValue,
      currentValue,
      totalReturn,
      totalReturnPercent,

      totalTrades: trades.length,
      winningTrades: tradeStatistics.winningTrades,
      losingTrades: tradeStatistics.losingTrades,
      winRate: tradeStatistics.winRate,
      avgWin: tradeStatistics.avgWin,
      avgLoss: tradeStatistics.avgLoss,
      profitFactor: tradeStatistics.profitFactor,

      drawdown: drawdownInfo,
      sharpeRatio,

      symbolStats: symbolStatistics,
      topWinners,
      topLosers,

      recentTrades: recentTradesList,

      dataPoints: equityCurve.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate date range based on period
   */
  private calculateDateRange(
    period: TimePeriodValue,
    startDate?: string,
    endDate?: string
  ): { periodStart: string | null; periodEnd: string } {
    const now = new Date();
    const periodEnd = endDate || now.toISOString();

    if (startDate) {
      return { periodStart: startDate, periodEnd };
    }

    const days = PERIOD_DAYS[period];
    if (days === null) {
      return { periodStart: null, periodEnd };
    }

    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return { periodStart: start.toISOString(), periodEnd };
  }
}
