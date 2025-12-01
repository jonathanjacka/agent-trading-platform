import { Router, Request, Response } from 'express';
import { TraderAgent } from '../agents/TraderAgent.js';
import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { AccountService } from '../services/AccountService.js';
import { TradeLogService } from '../services/TradeLogService.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { PushoverService } from '../services/PushoverService.js';
import { SchedulerService } from '../services/SchedulerService.js';
import { TradingOrchestratorService } from '../services/TradingOrchestratorService.js';
import { createTraderRoutes } from './traders.js';
import { createPortfolioRoutes } from './portfolio.js';
import { createTransactionRoutes } from './transactions.js';
import { createAnalyticsRoutes } from './analytics.js';
import { createResearchRoutes } from './research.js';
import { createSchedulerRoutes } from './scheduler.js';

export function createRoutes(
  researcherAgent: ResearcherAgent,
  traders: Map<string, TraderAgent>,
  accountService: AccountService,
  scheduler?: SchedulerService,
  orchestrator?: TradingOrchestratorService
): Router {
  const db = DatabaseService.getInstance();
  const tradeLogService = new TradeLogService(db);
  const pushoverService = new PushoverService();
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

  // Test Pushover notification
  router.post('/test-notification', async (req: Request, res: Response) => {
    try {
      const success = await pushoverService.sendTestNotification();
      res.json({
        success,
        message: success
          ? 'Test notification sent successfully!'
          : 'Pushover is disabled or failed to send',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Mount sub-routes
  router.use('/api/research', createResearchRoutes(researcherAgent));
  router.use('/api/traders', createTraderRoutes(traders));
  router.use('/api/portfolio', createPortfolioRoutes(accountService));
  router.use('/api/transactions', createTransactionRoutes(accountService));
  router.use('/api/analytics', createAnalyticsRoutes(tradeLogService));

  // Mount scheduler routes if scheduler is provided
  if (scheduler && orchestrator) {
    router.use(
      '/api/scheduler',
      createSchedulerRoutes(scheduler, orchestrator)
    );
  }

  return router;
}
