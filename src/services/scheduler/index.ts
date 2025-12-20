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
import { MarketDataService } from '../MarketDataService.js';
import { BraveSearchService } from '../BraveSearchService.js';

// Sub-modules
import { JobManager } from './JobManager.js';
import { DailyTradingJob } from './DailyTradingJob.js';
import { IntradayTradingJob } from './IntradayTradingJob.js';

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

    Logger.info(`SchedulerService initialized (enabled: ${this.enabled})`);
    Logger.info(
      `Trading schedule: ${this.config.tradingSchedule} (${this.config.timezone})`
    );
    if (this.config.enableIntraday) {
      Logger.info(`Intraday schedule: ${this.config.intradaySchedule}`);
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

    Logger.success(
      `Scheduler started with ${this.jobManager.getActiveJobCount()} job(s)`
    );
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    Logger.section('Stopping Scheduler');
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
}
