import { Router, Request, Response } from 'express';
import { AccountService } from '../services/account/index.js';
import { Logger } from '../utils/logger.js';

export function createTransactionRoutes(
  accountService: AccountService
): Router {
  const router = Router();

  const formatTraderName = (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // Get trader transaction history
  router.get('/:traderName', async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const formattedName = formatTraderName(traderName);

      const transactions = accountService.getTransactionHistory(
        formattedName,
        limit
      );

      res.json({
        success: true,
        trader: formattedName,
        transactions,
        count: transactions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Transaction history error', error);
      res.status(500).json({
        error: 'Failed to get transaction history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
