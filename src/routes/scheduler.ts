import { Router, Request, Response } from 'express';
import { SchedulerService } from '../services/SchedulerService.js';
import { TradingOrchestratorService } from '../services/TradingOrchestratorService.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { Logger } from '../utils/logger.js';
import { requireApiKey, strictLimiter } from '../middleware/index.js';

export function createSchedulerRoutes(
  scheduler: SchedulerService,
  orchestrator: TradingOrchestratorService
): Router {
  const router = Router();
  const db = DatabaseService.getInstance();

  /**
   * GET /api/scheduler/status (public - read only)
   * Get scheduler status and job information
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const enabled = scheduler.isEnabled();
      const config = scheduler.getConfig();
      const jobs = scheduler.getJobStatuses();
      const latestRun = db.getLatestSchedulerRun();

      res.json({
        enabled,
        config,
        jobs,
        latestRun: latestRun
          ? {
              sessionId: latestRun.session_id,
              status: latestRun.status,
              startedAt: latestRun.started_at,
              completedAt: latestRun.completed_at,
              successfulAgents: latestRun.successful_agents,
              failedAgents: latestRun.failed_agents,
              durationMs: latestRun.duration_ms,
            }
          : null,
      });
    } catch (error) {
      Logger.error('Failed to get scheduler status', error);
      res.status(500).json({
        error: 'Failed to get scheduler status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/scheduler/toggle (protected)
   * Enable or disable the scheduler
   */
  router.post('/toggle', requireApiKey, (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'enabled must be a boolean',
        });
      }

      scheduler.setEnabled(enabled);

      res.json({
        success: true,
        enabled: scheduler.isEnabled(),
        message: enabled ? 'Scheduler enabled' : 'Scheduler disabled',
      });
    } catch (error) {
      Logger.error('Failed to toggle scheduler', error);
      res.status(500).json({
        error: 'Failed to toggle scheduler',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/scheduler/run-now (protected + strict rate limit)
   * Manually trigger a trading session immediately
   */
  router.post(
    '/run-now',
    requireApiKey,
    strictLimiter,
    async (req: Request, res: Response) => {
      try {
        const { agents, dryRun = false } = req.body;

        Logger.info(
          `Manual trading session requested (dryRun: ${dryRun}, agents: ${agents || 'all'})`
        );

        // Run the session (this may take several minutes)
        const result = await orchestrator.runDailySession(
          {
            agents,
            dryRun,
          },
          'manual-trigger'
        );

        res.json({
          success: true,
          result: {
            sessionId: result.sessionId,
            durationMs: result.durationMs,
            totalAgents: result.totalAgents,
            successfulAgents: result.successfulAgents,
            failedAgents: result.failedAgents,
            collectiveInsightsGenerated: result.collectiveInsightsGenerated,
            errors: result.errors,
          },
        });
      } catch (error) {
        Logger.error('Manual trading session failed', error);
        res.status(500).json({
          error: 'Trading session failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/scheduler/history
   * Get history of scheduler runs
   */
  router.get('/history', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as
        | 'running'
        | 'success'
        | 'failure'
        | undefined;

      const runs = db.getSchedulerRuns({ limit, status });

      res.json({
        runs: runs.map((run) => ({
          sessionId: run.session_id,
          jobName: run.job_name,
          status: run.status,
          startedAt: run.started_at,
          completedAt: run.completed_at,
          totalAgents: run.total_agents,
          successfulAgents: run.successful_agents,
          failedAgents: run.failed_agents,
          collectiveInsightsGenerated: run.collective_insights_generated,
          durationMs: run.duration_ms,
          errorMessage: run.error_message,
        })),
        total: runs.length,
      });
    } catch (error) {
      Logger.error('Failed to get scheduler history', error);
      res.status(500).json({
        error: 'Failed to get scheduler history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/scheduler/run/:sessionId
   * Get details of a specific scheduler run
   */
  router.get('/run/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const run = db.getSchedulerRun(sessionId);

      if (!run) {
        return res.status(404).json({
          error: 'Not found',
          message: `Scheduler run ${sessionId} not found`,
        });
      }

      res.json({
        sessionId: run.session_id,
        jobName: run.job_name,
        status: run.status,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        totalAgents: run.total_agents,
        successfulAgents: run.successful_agents,
        failedAgents: run.failed_agents,
        collectiveInsightsGenerated: run.collective_insights_generated,
        durationMs: run.duration_ms,
        errorMessage: run.error_message,
        results: run.results_json ? JSON.parse(run.results_json) : null,
      });
    } catch (error) {
      Logger.error('Failed to get scheduler run', error);
      res.status(500).json({
        error: 'Failed to get scheduler run',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
