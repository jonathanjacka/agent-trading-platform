/**
 * Performance Analytics Tools
 * Tools for agents to query their trading performance
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import {
  PerformanceAnalyticsService,
  TIME_PERIOD,
  type TimePeriodValue,
  type SymbolStats,
  type TradeRecord,
} from '../../services/analytics/index.js';
import { emptyInputSchema, performanceSummaryInputSchema } from '../schemas.js';

export interface AnalyticsToolsDeps {
  analyticsService: PerformanceAnalyticsService;
  agentName: string;
}

/**
 * Creates performance analytics tools
 */
export function createAnalyticsTools(deps: AnalyticsToolsDeps) {
  const { analyticsService, agentName } = deps;

  return {
    getPerformanceSummary: tool({
      description:
        'Get your trading performance metrics including total return, win rate, drawdown, and per-symbol statistics. Use this to evaluate how well you are trading and identify areas for improvement.',
      inputSchema: performanceSummaryInputSchema,
      execute: async ({ period, recentTradesLimit }) => {
        Logger.info(`${agentName} retrieving performance summary`);

        // Map period string to constant
        const periodValue: TimePeriodValue = period
          ? (TIME_PERIOD[
              period.toUpperCase() as keyof typeof TIME_PERIOD
            ] as TimePeriodValue)
          : TIME_PERIOD.ALL_TIME;

        const summary = analyticsService.getPerformanceSummary(agentName, {
          period: periodValue,
          recentTradesLimit,
        });

        // Format for agent consumption
        return {
          period: summary.period,
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,

          // Portfolio performance
          portfolio: {
            initialValue: `$${summary.initialValue.toFixed(2)}`,
            currentValue: `$${summary.currentValue.toFixed(2)}`,
            totalReturn: `$${summary.totalReturn.toFixed(2)}`,
            totalReturnPercent: `${summary.totalReturnPercent.toFixed(2)}%`,
          },

          // Trade statistics
          trades: {
            total: summary.totalTrades,
            winning: summary.winningTrades,
            losing: summary.losingTrades,
            winRate: `${(summary.winRate * 100).toFixed(1)}%`,
            avgWin: `$${summary.avgWin.toFixed(2)}`,
            avgLoss: `$${summary.avgLoss.toFixed(2)}`,
            profitFactor:
              summary.profitFactor === Infinity
                ? 'No losses'
                : summary.profitFactor.toFixed(2),
          },

          // Risk metrics
          risk: {
            maxDrawdown: `$${summary.drawdown.maxDrawdown.toFixed(2)}`,
            maxDrawdownPercent: `${summary.drawdown.maxDrawdownPercent.toFixed(2)}%`,
            currentDrawdown: `$${summary.drawdown.currentDrawdown.toFixed(2)}`,
            currentDrawdownPercent: `${summary.drawdown.currentDrawdownPercent.toFixed(2)}%`,
            sharpeRatio:
              summary.sharpeRatio !== null
                ? summary.sharpeRatio.toFixed(2)
                : 'Insufficient data',
          },

          // Top performers
          topWinners: summary.topWinners.map((s: SymbolStats) => ({
            symbol: s.symbol,
            pnl: `$${s.realizedPnL.toFixed(2)}`,
            trades: s.totalTrades,
            winRate: `${(s.winRate * 100).toFixed(0)}%`,
          })),

          topLosers: summary.topLosers.map((s: SymbolStats) => ({
            symbol: s.symbol,
            pnl: `$${s.realizedPnL.toFixed(2)}`,
            trades: s.totalTrades,
            winRate: `${(s.winRate * 100).toFixed(0)}%`,
          })),

          // Recent activity
          recentTrades: summary.recentTrades.map((t: TradeRecord) => ({
            date: new Date(t.timestamp).toLocaleDateString(),
            action: t.action,
            symbol: t.symbol,
            quantity: t.quantity,
            price: `$${t.price.toFixed(2)}`,
            value: `$${t.value.toFixed(2)}`,
            pnl:
              t.realizedPnL !== null
                ? `$${t.realizedPnL.toFixed(2)}`
                : 'Open position',
          })),

          // Summary assessment
          assessment: generateAssessment(summary),
        };
      },
    }),

    getSymbolPerformance: tool({
      description:
        'Get detailed performance breakdown by symbol. Shows which stocks are your winners and losers.',
      inputSchema: emptyInputSchema,
      execute: async () => {
        Logger.info(`${agentName} retrieving symbol performance`);

        const summary = analyticsService.getPerformanceSummary(agentName, {
          period: TIME_PERIOD.ALL_TIME,
        });

        // Sort all symbols by P&L
        const symbolsByPnL = [...summary.symbolStats].sort(
          (a, b) => b.realizedPnL - a.realizedPnL
        );

        return {
          totalSymbolsTraded: summary.symbolStats.length,
          symbols: symbolsByPnL.map((s) => ({
            symbol: s.symbol,
            totalTrades: s.totalTrades,
            buyTrades: s.buyTrades,
            sellTrades: s.sellTrades,
            realizedPnL: `$${s.realizedPnL.toFixed(2)}`,
            winRate: `${(s.winRate * 100).toFixed(0)}%`,
            avgGain: `$${s.avgGain.toFixed(2)}`,
            avgLoss: `$${s.avgLoss.toFixed(2)}`,
            largestGain: `$${s.largestGain.toFixed(2)}`,
            largestLoss: `$${s.largestLoss.toFixed(2)}`,
            totalVolume: `$${s.totalVolume.toFixed(2)}`,
          })),
          summary: {
            profitableSymbols: summary.symbolStats.filter(
              (s: SymbolStats) => s.realizedPnL > 0
            ).length,
            unprofitableSymbols: summary.symbolStats.filter(
              (s: SymbolStats) => s.realizedPnL < 0
            ).length,
            breakEvenSymbols: summary.symbolStats.filter(
              (s: SymbolStats) => s.realizedPnL === 0
            ).length,
          },
        };
      },
    }),
  };
}

/**
 * Generate a human-readable assessment of performance
 */
function generateAssessment(summary: {
  totalReturnPercent: number;
  winRate: number;
  profitFactor: number;
  drawdown: { maxDrawdownPercent: number };
  totalTrades: number;
}): string {
  const assessments: string[] = [];

  // Return assessment
  if (summary.totalReturnPercent > 10) {
    assessments.push('Strong positive returns');
  } else if (summary.totalReturnPercent > 0) {
    assessments.push('Positive returns');
  } else if (summary.totalReturnPercent > -5) {
    assessments.push('Slight negative returns');
  } else {
    assessments.push('Significant losses - review strategy');
  }

  // Win rate assessment
  if (summary.totalTrades >= 5) {
    if (summary.winRate > 0.6) {
      assessments.push('Excellent win rate');
    } else if (summary.winRate > 0.5) {
      assessments.push('Good win rate');
    } else if (summary.winRate > 0.4) {
      assessments.push('Win rate needs improvement');
    } else {
      assessments.push('Low win rate - consider trade selection');
    }
  }

  // Drawdown assessment
  if (summary.drawdown.maxDrawdownPercent > 20) {
    assessments.push('High drawdown risk - consider tighter risk management');
  } else if (summary.drawdown.maxDrawdownPercent > 10) {
    assessments.push('Moderate drawdown');
  }

  // Profit factor
  if (summary.profitFactor > 2) {
    assessments.push('Excellent risk/reward ratio');
  } else if (summary.profitFactor > 1.5) {
    assessments.push('Good risk/reward ratio');
  } else if (summary.profitFactor < 1 && summary.totalTrades >= 5) {
    assessments.push('Risk/reward needs improvement');
  }

  if (summary.totalTrades < 5) {
    assessments.push('Limited trade history - metrics may not be reliable');
  }

  return assessments.join('. ') + '.';
}
