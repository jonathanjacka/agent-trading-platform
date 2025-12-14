import { Router, Request, Response } from 'express';
import { TraderAgent } from '../agents/TraderAgent.js';
import { Logger } from '../utils/logger.js';
import { requireApiKey, strictLimiter } from '../middleware/index.js';

export function createTraderRoutes(traders: Map<string, TraderAgent>): Router {
  const router = Router();

  // Get all traders info (public)
  router.get('/', (req: Request, res: Response) => {
    const traderInfos = Array.from(traders.values()).map((t) => t.getInfo());
    res.json({
      traders: traderInfos,
    });
  });

  // Execute a trade (protected + strict rate limit)
  router.post(
    '/:traderName/trade',
    requireApiKey,
    strictLimiter,
    async (req: Request, res: Response) => {
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
    }
  );

  return router;
}
