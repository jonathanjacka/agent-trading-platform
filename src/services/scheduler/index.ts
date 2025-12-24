/**
 * Scheduler Service
 *
 * Main orchestrator for automated trading job scheduling.
 * Coordinates daily and intraday trading sessions.
 *
 * Usage:
 * ```typescript
 * const scheduler = new SchedulerService(orchestrator, config, marketData, braveSearch);
 * scheduler.start();
 * ```
 */

import { Logger } from '../../utils/logger.js';
import { TradingOrchestratorService } from '../orchestrator/index.js';
import { MarketIntelligenceService } from '../marketIntelligence/index.js';
import { MarketDataService } from '../marketData/index.js';
import { BraveSearchService } from '../BraveSearchService.js';
import * as cron from 'node-cron';

// Sub-modules
import { JobManager } from './JobManager.js';
import { DailyTradingJob } from './DailyTradingJob.js';
import { IntradayTradingJob } from './IntradayTradingJob.js';
import { StreamingJob } from './StreamingJob.js';

// Re-export types for consumers
export * from './types.js';

import {
  SchedulerConfig,
  RequiredSchedulerConfig,
  MarketStatusResult,
  JobStatus,
  DEFAULT_CONFIG,
} from './types.js';

export class SchedulerService {
  private enabled: boolean;
  private config: RequiredSchedulerConfig;
  private marketIntelligence: MarketIntelligenceService | null = null;

  // Sub-modules
  private jobManager: JobManager;
  private dailyJob: DailyTradingJob;
  private intradayJob: IntradayTradingJob;
  private streamingJob: StreamingJob;

  // Streaming cron tasks
  private streamingStartTask: ReturnType<typeof cron.schedule> | null = null;
  private streamingStopTask: ReturnType<typeof cron.schedule> | null = null;

  constructor(
    orchestrator: TradingOrchestratorService,
    config: SchedulerConfig = {},
    marketData?: MarketDataService,
    braveSearch?: BraveSearchService
  ) {
    // Merge config with defaults
    this.config = {
      enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
      tradingSchedule: config.tradingSchedule ?? DEFAULT_CONFIG.tradingSchedule,
      intradaySchedule:
        config.intradaySchedule ?? DEFAULT_CONFIG.intradaySchedule,
      timezone: config.timezone ?? DEFAULT_CONFIG.timezone,
      enableIntraday: config.enableIntraday ?? DEFAULT_CONFIG.enableIntraday,
      enableStreaming: config.enableStreaming ?? DEFAULT_CONFIG.enableStreaming,
    };
    this.enabled = this.config.enabled;

    // Initialize market intelligence if services provided
    if (marketData && braveSearch) {
      this.marketIntelligence = new MarketIntelligenceService(
        marketData,
        braveSearch
      );
      Logger.info('SchedulerService: Market intelligence enabled');
    }

    // Initialize sub-modules
    this.jobManager = new JobManager();
    this.dailyJob = new DailyTradingJob(orchestrator, this.jobManager);
    this.intradayJob = new IntradayTradingJob(
      orchestrator,
      this.jobManager,
      this.marketIntelligence
    );
    this.streamingJob = new StreamingJob(
      orchestrator,
      this.jobManager,
      process.env.POLY_API_KEY || ''
    );

    Logger.info(`SchedulerService initialized (enabled: ${this.enabled})`);
    Logger.info(
      `Trading schedule: ${this.config.tradingSchedule} (${this.config.timezone})`
    );
    if (this.config.enableIntraday) {
      Logger.info(`Intraday schedule: ${this.config.intradaySchedule}`);
    }
    if (this.config.enableStreaming) {
      Logger.info('Streaming job enabled');
    }
  }

  // ═══════════════════════════════════════════════════════
  // Lifecycle Management
  // ═══════════════════════════════════════════════════════

  /**
   * Start the scheduler and all configured jobs
   */
  start(): void {
    if (!this.enabled) {
      Logger.warn('Scheduler is disabled - not starting jobs');
      return;
    }

    Logger.section('Starting Scheduler');

    // Schedule daily trading
    this.dailyJob.schedule(this.config.tradingSchedule, this.config.timezone);

    // Schedule intraday trading if enabled
    if (this.config.enableIntraday) {
      this.intradayJob.schedule(this.config.intradaySchedule);
    }

    // Schedule streaming during market hours if enabled
    if (this.config.enableStreaming) {
      this.scheduleStreaming();
    }

    Logger.success(
      `Scheduler started with ${this.jobManager.getActiveJobCount()} job(s)`
    );
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    Logger.section('Stopping Scheduler');

    // Stop streaming if running
    if (this.streamingJob.isRunning()) {
      this.streamingJob.stop();
    }

    // Stop streaming cron tasks
    if (this.streamingStartTask) {
      this.streamingStartTask.stop();
      this.streamingStartTask = null;
    }
    if (this.streamingStopTask) {
      this.streamingStopTask.stop();
      this.streamingStopTask = null;
    }

    this.jobManager.stopAll();
    Logger.success('Scheduler stopped');
  }

  /**
   * Enable or disable the scheduler
   */
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

  // ═══════════════════════════════════════════════════════
  // Manual Triggers
  // ═══════════════════════════════════════════════════════

  /**
   * Manually trigger daily trading session
   */
  triggerNow() {
    return this.dailyJob.trigger();
  }

  /**
   * Manually trigger intraday trading session
   */
  triggerIntradayNow() {
    return this.intradayJob.trigger();
  }

  /**
   * Manually start streaming
   */
  startStreaming(): void {
    this.streamingJob.start();
  }

  /**
   * Manually stop streaming
   */
  stopStreaming(): void {
    this.streamingJob.stop();
  }

  /**
   * Get streaming job status
   */
  getStreamingStats() {
    return this.streamingJob.getStats();
  }

  // ═══════════════════════════════════════════════════════
  // Status & Information
  // ═══════════════════════════════════════════════════════

  /**
   * Get current market status
   */
  async getMarketStatus(): Promise<MarketStatusResult> {
    if (!this.marketIntelligence) {
      return {
        isOpen: false,
        status: 'unknown',
        tradingRecommended: false,
      };
    }

    const conditions = await this.marketIntelligence.getMarketConditions();
    return {
      isOpen: this.marketIntelligence.isMarketOpen(),
      status: conditions.marketStatus,
      tradingRecommended: conditions.tradingRecommended,
    };
  }

  /**
   * Check if scheduler is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get all job statuses
   */
  getJobStatuses(): JobStatus[] {
    return this.jobManager.getJobStatuses();
  }

  /**
   * Get status for a specific job
   */
  getJobStatus(jobName: string): JobStatus | undefined {
    return this.jobManager.getJobStatus(jobName);
  }

  /**
   * Get scheduler configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  // ═══════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════

  /**
   * Schedule streaming to start/stop with market hours
   * Market hours: 9:30 AM - 4:00 PM ET (Mon-Fri)
   */
  private scheduleStreaming(): void {
    Logger.info('Scheduling streaming for market hours');

    // Schedule start at 9:30 AM ET (14:30 UTC in winter, 13:30 UTC in summer)
    // Using 9:30 AM in America/New_York timezone
    this.streamingStartTask = cron.schedule(
      '30 9 * * 1-5',
      () => {
        Logger.info('Market opening - starting streaming');
        this.streamingJob.start();
      },
      { timezone: 'America/New_York' }
    );

    // Schedule stop at 4:00 PM ET
    this.streamingStopTask = cron.schedule(
      '0 16 * * 1-5',
      () => {
        Logger.info('Market closing - stopping streaming');
        this.streamingJob.stop();
      },
      { timezone: 'America/New_York' }
    );

    // If market is currently open, start streaming immediately
    const now = new Date();
    const nyTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const hour = nyTime.getHours();
    const minute = nyTime.getMinutes();
    const day = nyTime.getDay();

    const isWeekday = day >= 1 && day <= 5;
    const afterOpen = hour > 9 || (hour === 9 && minute >= 30);
    const beforeClose = hour < 16;

    if (isWeekday && afterOpen && beforeClose) {
      Logger.info('Market is currently open - starting streaming now');
      this.streamingJob.start();
    }
  }
}
