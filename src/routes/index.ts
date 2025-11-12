import { Router, Request, Response } from 'express';
import { TraderAgent } from '../agents/TraderAgent.js';
import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { AccountService } from '../services/AccountService.js';
import { Logger } from '../utils/logger.js';

export function createRoutes(
  researcherAgent: ResearcherAgent,
  traders: Map<string, TraderAgent>,
  accountService: AccountService
): Router {
  const router = Router();

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      agents: {
        researcher: 'active',
        traders: Array.from(traders.keys()),
      },
    });
  });

  // Research endpoint
  router.post('/api/research', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      Logger.info(`Received research request: ${query}`);

      const result = await researcherAgent.research(query);

      res.json({
        success: true,
        agent: 'Researcher',
        query,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Research error', error);
      res.status(500).json({
        error: 'Failed to complete research',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Trade endpoint
  router.post('/api/trade/:traderName', async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const trader = traders.get(traderName.toLowerCase());

      if (!trader) {
        return res.status(404).json({
          error: `Trader '${traderName}' not found. Available: ${Array.from(traders.keys()).join(', ')}`,
        });
      }

      Logger.info(`Received trading request for ${traderName}: ${prompt}`);

      const result = await trader.trade(prompt);

      res.json({
        success: true,
        trader: trader.getInfo(),
        prompt,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Trading error', error);
      res.status(500).json({
        error: 'Failed to complete trading operation',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all traders info
  router.get('/api/traders', (req: Request, res: Response) => {
    const traderInfos = Array.from(traders.values()).map((t) => t.getInfo());
    res.json({
      traders: traderInfos,
    });
  });

  // Get trader portfolio
  router.get(
    '/api/portfolio/:traderName',
    async (req: Request, res: Response) => {
      try {
        const { traderName } = req.params;

        // Capitalize first letter to match database
        const formattedName =
          traderName.charAt(0).toUpperCase() +
          traderName.slice(1).toLowerCase();

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
    }
  );

  // Get trader transaction history
  router.get(
    '/api/transactions/:traderName',
    async (req: Request, res: Response) => {
      try {
        const { traderName } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const formattedName =
          traderName.charAt(0).toUpperCase() +
          traderName.slice(1).toLowerCase();

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
    }
  );

  // Get portfolio value history
  router.get(
    '/api/portfolio-history/:traderName',
    async (req: Request, res: Response) => {
      try {
        const { traderName } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;

        const formattedName =
          traderName.charAt(0).toUpperCase() +
          traderName.slice(1).toLowerCase();

        const history = accountService.getPortfolioHistory(
          formattedName,
          limit
        );

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
    }
  );

  return router;
}
