import { Router, Request, Response } from 'express';
import { TradeLogService } from '../services/TradeLogService.js';
import { Logger } from '../utils/logger.js';

export function createAnalyticsRoutes(
  tradeLogService: TradeLogService
): Router {
  const router = Router();

  const formatTraderName = (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // Get trade logs for a trader
  router.get('/trade-logs/:traderName', async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const symbol = req.query.symbol as string | undefined;
      const success = req.query.success
        ? req.query.success === 'true'
        : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const formattedName = formatTraderName(traderName);

      const logs = tradeLogService.getTradeLogs(formattedName, {
        limit,
        symbol,
        success,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        trader: formattedName,
        logs,
        count: logs.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Trade logs error', error);
      res.status(500).json({
        error: 'Failed to get trade logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get analytics for a trader
  router.get('/:traderName', async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const formattedName = formatTraderName(traderName);

      const analytics = tradeLogService.getAnalytics(formattedName);

      res.json({
        success: true,
        trader: formattedName,
        analytics: {
          performance: {
            totalTrades: analytics.totalTrades,
            successfulTrades: analytics.successfulTrades,
            failedTrades: analytics.failedTrades,
            winRate: `${(analytics.winRate * 100).toFixed(1)}%`,
            winRateDecimal: analytics.winRate,
          },
          financial: {
            totalProfitLoss: analytics.totalProfitLoss,
            bestTradeGain: analytics.bestTradeGain,
            worstTradeLoss: analytics.worstTradeLoss,
            avgTradeSize: analytics.avgTradeSize,
          },
          behavior: {
            mostTradedSymbol: analytics.mostTradedSymbol,
            tradesPerDay: analytics.tradesPerDay,
            avgExecutionTimeMs: analytics.avgExecutionTimeMs,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Analytics error', error);
      res.status(500).json({
        error: 'Failed to get analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get analytics summary for all traders
  router.get('/', async (req: Request, res: Response) => {
    try {
      const allAnalytics = tradeLogService.getAllAnalytics();

      const summary = allAnalytics.map((analytics) => ({
        trader: analytics.traderName,
        performance: {
          totalTrades: analytics.totalTrades,
          winRate: `${(analytics.winRate * 100).toFixed(1)}%`,
          successfulTrades: analytics.successfulTrades,
          failedTrades: analytics.failedTrades,
        },
        financial: {
          totalProfitLoss: analytics.totalProfitLoss,
          bestTradeGain: analytics.bestTradeGain,
          avgTradeSize: analytics.avgTradeSize,
        },
        behavior: {
          mostTradedSymbol: analytics.mostTradedSymbol,
          tradesPerDay: analytics.tradesPerDay.toFixed(2),
        },
      }));

      res.json({
        success: true,
        traders: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Analytics summary error', error);
      res.status(500).json({
        error: 'Failed to get analytics summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
