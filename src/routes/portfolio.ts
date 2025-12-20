import { Router, Request, Response } from 'express';
import { AccountService } from '../services/account/index.js';
import { Logger } from '../utils/logger.js';

export function createPortfolioRoutes(accountService: AccountService): Router {
  const router = Router();

  const formatTraderName = (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // Get trader portfolio
  router.get('/:traderName', async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const formattedName = formatTraderName(traderName);

      const portfolio = await accountService.getPortfolio(formattedName);

      res.json({
        success: true,
        trader: formattedName,
        portfolio,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Portfolio error', error);
      res.status(500).json({
        error: 'Failed to get portfolio',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get portfolio value history
  router.get('/:traderName/history', async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const formattedName = formatTraderName(traderName);

      const history = accountService.getPortfolioHistory(formattedName, limit);

      res.json({
        success: true,
        trader: formattedName,
        history,
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Portfolio history error', error);
      res.status(500).json({
        error: 'Failed to get portfolio history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
