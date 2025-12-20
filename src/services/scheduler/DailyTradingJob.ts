/**
 * Daily Trading Job
 *
 * Handles the daily pre-market trading session execution.
 */

import { Logger } from '../../utils/logger.js';
import {
  TradingOrchestratorService,
  SessionResult,
} from '../orchestrator/index.js';
import { JobManager } from './JobManager.js';
import { JOB_NAMES } from './types.js';

export class DailyTradingJob {
  private readonly jobName = JOB_NAMES.DAILY_TRADING;

  constructor(
    private orchestrator: TradingOrchestratorService,
    private jobManager: JobManager
  ) {}

  /**
   * Schedule the daily trading job
   */
  schedule(cronSchedule: string, timezone: string): boolean {
    return this.jobManager.scheduleJob({
      name: this.jobName,
      schedule: cronSchedule,
      timezone,
      executor: () => this.execute(),
    });
  }

  /**
   * Execute the daily trading session
   */
  async execute(): Promise<SessionResult | null> {
    Logger.section('Scheduled Daily Trading Started');
    Logger.info(`Time: ${new Date().toISOString()}`);

    // Check if it's a weekend
    const day = new Date().getDay();
    if (day === 0 || day === 6) {
      Logger.info('Skipping: Weekend');
      return null;
    }

    try {
      const result = await this.orchestrator.runDailySession();

      this.jobManager.updateJobStatus(
        this.jobName,
        result.failedAgents === 0 ? 'success' : 'failure'
      );

      Logger.success('Scheduled daily trading completed');
      return result;
    } catch (error) {
      Logger.error('Scheduled daily trading failed', error);
      this.jobManager.updateJobStatus(this.jobName, 'failure');
      return null;
    }
  }

  /**
   * Manual trigger
   */
  async trigger(): Promise<SessionResult | null> {
    Logger.info('Manual trigger requested');
    return this.execute();
  }
}
