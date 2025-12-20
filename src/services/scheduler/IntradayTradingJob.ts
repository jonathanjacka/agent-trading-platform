/**
 * Intraday Trading Job
 *
 * Handles market-hours trading sessions with real-time market intelligence.
 */

import { Logger } from '../../utils/logger.js';
import {
  TradingOrchestratorService,
  SessionResult,
} from '../orchestrator/index.js';
import { MarketIntelligenceService } from '../marketIntelligence/index.js';
import { JobManager } from './JobManager.js';
import { JOB_NAMES, TIMEZONES } from './types.js';

export class IntradayTradingJob {
  private readonly jobName = JOB_NAMES.INTRADAY_TRADING;

  constructor(
    private orchestrator: TradingOrchestratorService,
    private jobManager: JobManager,
    private marketIntelligence: MarketIntelligenceService | null
  ) {}

  /**
   * Schedule the intraday trading job
   * Always uses Eastern timezone for market hours
   */
  schedule(cronSchedule: string): boolean {
    return this.jobManager.scheduleJob({
      name: this.jobName,
      schedule: cronSchedule,
      timezone: TIMEZONES.EASTERN,
      executor: () => this.execute(),
    });
  }

  /**
   * Execute the intraday trading session
   */
  async execute(): Promise<SessionResult | null> {
    Logger.section('Intraday Trading Session Started');
    Logger.info(`Time: ${new Date().toISOString()}`);

    // Check if market is open
    if (this.marketIntelligence) {
      const isOpen = this.marketIntelligence.isMarketOpen();
      if (!isOpen) {
        Logger.info('Skipping: Market is closed');
        return null;
      }
    }

    try {
      // Build market-aware prompts
      const marketContext = await this.buildMarketContext();
      const customPrompts = this.buildIntradayPrompts(marketContext);

      const result = await this.orchestrator.runDailySession(
        {
          customPrompts,
          delayBetweenAgentsMs: 60_000, // Faster for intraday
        },
        this.jobName
      );

      this.jobManager.updateJobStatus(
        this.jobName,
        result.failedAgents === 0 ? 'success' : 'failure'
      );

      Logger.success('Intraday trading session completed');
      return result;
    } catch (error) {
      Logger.error('Intraday trading session failed', error);
      this.jobManager.updateJobStatus(this.jobName, 'failure');
      return null;
    }
  }

  /**
   * Manual trigger
   */
  async trigger(): Promise<SessionResult | null> {
    Logger.info('Manual intraday trigger requested');
    if (!this.marketIntelligence) {
      Logger.warn('Market intelligence not available for intraday trading');
    }
    return this.execute();
  }

  /**
   * Build market context string for agent prompts
   */
  private async buildMarketContext(): Promise<string> {
    if (!this.marketIntelligence) {
      return 'Market intelligence not available.';
    }

    try {
      const context = await this.marketIntelligence.buildTradingContext();
      return this.marketIntelligence.formatContextForAgent(context);
    } catch (error) {
      Logger.warn(
        `Failed to build market context: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return 'Market intelligence temporarily unavailable.';
    }
  }

  /**
   * Build intraday-specific prompts for all agents
   */
  private buildIntradayPrompts(marketContext: string): Record<string, string> {
    const basePrompt = `INTRADAY TRADING SESSION

${marketContext}

This is an intraday check during market hours. Quick actions:
1. Use getMarketOverview to see current conditions
2. Check getPortfolio for your positions
3. Use discoverStocks if looking for opportunities
4. Make quick, informed decisions based on current market state

Remember: This is intraday - focus on immediate opportunities aligned with your strategy.`;

    // All agents get the same market-aware base prompt
    return {
      leonardo: basePrompt,
      michelangelo: basePrompt,
      raphael: basePrompt,
      donatello: basePrompt,
    };
  }
}
