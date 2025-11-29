import { Router, Request, Response } from 'express';
import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { Logger } from '../utils/logger.js';

export function createResearchRoutes(researcherAgent: ResearcherAgent): Router {
  const router = Router();

  // Research endpoint
  router.post('/', async (req: Request, res: Response) => {
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

  return router;
}
