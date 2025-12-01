import cron, { ScheduledTask } from 'node-cron';
import {
  TradingOrchestratorService,
  SessionResult,
} from './TradingOrchestratorService.js';
import { Logger } from '../utils/logger.js';

export interface JobStatus {
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  lastResult?: 'success' | 'failure';
  nextRun?: string;
}

export interface SchedulerConfig {
  enabled?: boolean;
  tradingSchedule?: string;
  timezone?: string;
}

export class SchedulerService {
  private jobs: Map<string, ScheduledTask> = new Map();
  private jobStatuses: Map<string, JobStatus> = new Map();
  private enabled: boolean;
  private config: Required<SchedulerConfig>;

  constructor(
    private orchestrator: TradingOrchestratorService,
    config: SchedulerConfig = {}
  ) {
    this.config = {
      enabled: config.enabled ?? true,
      tradingSchedule: config.tradingSchedule ?? '0 6 * * 1-5', // 6 AM UTC, Mon-Fri
      timezone: config.timezone ?? 'UTC',
    };
    this.enabled = this.config.enabled;

    Logger.info(`SchedulerService initialized (enabled: ${this.enabled})`);
    Logger.info(
      `Trading schedule: ${this.config.tradingSchedule} (${this.config.timezone})`
    );
  }

  start(): void {
    if (!this.enabled) {
      Logger.warn('Scheduler is disabled - not starting jobs');
      return;
    }

    Logger.section('Starting Scheduler');

    this.scheduleDailyTrading();

    Logger.success(`Scheduler started with ${this.jobs.size} job(s)`);
  }

  stop(): void {
    Logger.section('Stopping Scheduler');

    for (const [name, job] of this.jobs) {
      job.stop();
      Logger.info(`Stopped job: ${name}`);
    }

    this.jobs.clear();
    Logger.success('Scheduler stopped');
  }

  private scheduleDailyTrading(): void {
    const jobName = 'daily-trading';
    const schedule = this.config.tradingSchedule!;

    if (!cron.validate(schedule)) {
      Logger.error(`Invalid cron expression: ${schedule}`);
      return;
    }

    const task = cron.schedule(
      schedule,
      async () => {
        await this.executeDailyTrading();
      },
      {
        timezone: this.config.timezone,
      }
    );

    this.jobs.set(jobName, task);
    this.jobStatuses.set(jobName, {
      name: jobName,
      schedule,
      enabled: true,
    });

    Logger.success(`Scheduled job: ${jobName} (${schedule})`);
  }

  private async executeDailyTrading(): Promise<SessionResult | null> {
    const jobName = 'daily-trading';

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

      // Update job status
      const status = this.jobStatuses.get(jobName);
      if (status) {
        status.lastRun = new Date();
        status.lastResult = result.failedAgents === 0 ? 'success' : 'failure';
      }

      Logger.success('Scheduled daily trading completed');
      return result;
    } catch (error) {
      Logger.error('Scheduled daily trading failed', error);

      // Update job status
      const status = this.jobStatuses.get(jobName);
      if (status) {
        status.lastRun = new Date();
        status.lastResult = 'failure';
      }

      return null;
    }
  }

  async triggerNow(): Promise<SessionResult | null> {
    Logger.info('Manual trigger requested');
    return this.executeDailyTrading();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (enabled) {
      Logger.info('Scheduler enabled');
      this.start();
    } else {
      Logger.info('Scheduler disabled');
      this.stop();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatuses.values());
  }

  getJobStatus(jobName: string): JobStatus | undefined {
    return this.jobStatuses.get(jobName);
  }

  getConfig(): SchedulerConfig {
    return { ...this.config };
  }
}
