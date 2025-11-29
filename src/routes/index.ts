import { Router, Request, Response } from 'express';
import { TraderAgent } from '../agents/TraderAgent.js';
import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { AccountService } from '../services/AccountService.js';
import { TradeLogService } from '../services/TradeLogService.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { createTraderRoutes } from './traders.js';
import { createPortfolioRoutes } from './portfolio.js';
import { createTransactionRoutes } from './transactions.js';
import { createAnalyticsRoutes } from './analytics.js';
import { createResearchRoutes } from './research.js';

export function createRoutes(
  researcherAgent: ResearcherAgent,
  traders: Map<string, TraderAgent>,
  accountService: AccountService
): Router {
  const db = DatabaseService.getInstance();
  const tradeLogService = new TradeLogService(db);
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

  // Mount sub-routes
  router.use('/api/research', createResearchRoutes(researcherAgent));
  router.use('/api/traders', createTraderRoutes(traders));
  router.use('/api/portfolio', createPortfolioRoutes(accountService));
  router.use('/api/transactions', createTransactionRoutes(accountService));
  router.use('/api/analytics', createAnalyticsRoutes(tradeLogService));

  return router;
}
