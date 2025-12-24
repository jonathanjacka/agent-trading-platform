/**
 * Streaming Job
 *
 * Manages real-time market data streaming during market hours.
 * Coordinates WebSocket connections, signal detection, and agent triggering.
 */

import { Logger } from '../../utils/logger.js';
import { MarketStreamService } from '../streaming/MarketStreamService.js';
import { SignalDetectionService } from '../streaming/SignalDetectionService.js';
import { AgentTriggerService } from '../streaming/AgentTriggerService.js';
import { WatchlistService } from '../watchlist/index.js';
import { DatabaseService } from '../database/index.js';
import { TradingOrchestratorService } from '../orchestrator/index.js';
import { JobManager } from './JobManager.js';
import type { StreamingJobStats, StreamingJobStatus } from '../streaming/types.js';
import type { AgentName } from '../consensus/types.js';

/** Job name constant */
export const STREAMING_JOB_NAME = 'streaming-trading';

export class StreamingJob {
  private readonly jobName = STREAMING_JOB_NAME;
  private readonly apiKey: string;

  // Services
  private streamService: MarketStreamService | null = null;
  private signalService: SignalDetectionService | null = null;
  private triggerService: AgentTriggerService | null = null;
  private watchlistService: WatchlistService;
  private orchestrator: TradingOrchestratorService;
  private jobManager: JobManager;

  // State
  private status: StreamingJobStatus = 'stopped';
  private startedAt: Date | null = null;
  private stats = {
    barsReceived: 0,
    signalsDetected: 0,
    agentsTriggered: 0,
    errors: 0,
  };

  // Watchlist sync interval
  private watchlistSyncInterval: NodeJS.Timeout | null = null;
  private readonly WATCHLIST_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(
    orchestrator: TradingOrchestratorService,
    jobManager: JobManager,
    apiKey: string = process.env.POLY_API_KEY || ''
  ) {
    this.orchestrator = orchestrator;
    this.jobManager = jobManager;
    this.apiKey = apiKey;

    // Initialize watchlist service
    const db = DatabaseService.getInstance();
    this.watchlistService = new WatchlistService(db.getDatabase());

    Logger.info('StreamingJob initialized');
  }

  /**
   * Start streaming during market hours
   */
  start(): void {
    if (this.status === 'running' || this.status === 'starting') {
      Logger.info('StreamingJob already running or starting');
      return;
    }

    if (!this.apiKey) {
      Logger.error('Cannot start StreamingJob: POLY_API_KEY not configured');
      return;
    }

    this.status = 'starting';
    Logger.section('Starting Streaming Job');

    try {
      // Initialize services
      this.streamService = new MarketStreamService(this.apiKey);
      this.signalService = new SignalDetectionService(this.streamService);
      this.triggerService = new AgentTriggerService(this.signalService);

      // Set up event handlers
      this.setupEventHandlers();

      // Set up agent trigger callback
      this.triggerService.setTriggerCallback(
        async (agentName, signal, prompt) => {
          await this.handleAgentTrigger(agentName, signal, prompt);
        }
      );

      // Sync portfolio positions to watchlist
      this.watchlistService.syncPortfolioPositions();

      // Get symbols to watch
      const symbols = this.watchlistService.getActiveSymbols();
      Logger.info(`Watchlist contains ${symbols.length} symbols`);

      // Connect to WebSocket
      this.streamService.connect();

      // Subscribe to watchlist symbols
      if (symbols.length > 0) {
        this.streamService.subscribe(symbols);
      }

      // Start watchlist sync interval
      this.startWatchlistSync();

      // Update state
      this.status = 'running';
      this.startedAt = new Date();
      this.resetStats();

      this.jobManager.updateJobStatus(this.jobName, 'success');
      Logger.success(`StreamingJob started - monitoring ${symbols.length} symbols`);
    } catch (error) {
      this.status = 'stopped';
      this.stats.errors++;
      Logger.error(
        `Failed to start StreamingJob: ${error instanceof Error ? error.message : 'Unknown'}`
      );
      this.jobManager.updateJobStatus(this.jobName, 'failure');
    }
  }

  /**
   * Stop streaming
   */
  stop(): void {
    if (this.status === 'stopped' || this.status === 'stopping') {
      Logger.info('StreamingJob already stopped or stopping');
      return;
    }

    this.status = 'stopping';
    Logger.section('Stopping Streaming Job');

    try {
      // Stop watchlist sync
      this.stopWatchlistSync();

      // Disconnect WebSocket
      if (this.streamService) {
        this.streamService.disconnect();
      }

      // Clear signal detection data
      if (this.signalService) {
        this.signalService.clear();
      }

      // Reset trigger states for next session
      if (this.triggerService) {
        this.triggerService.resetStates();
      }

      // Log final stats
      this.logStats();

      // Clean up
      this.streamService = null;
      this.signalService = null;
      this.triggerService = null;

      this.status = 'stopped';
      Logger.success('StreamingJob stopped');
    } catch (error) {
      this.status = 'stopped';
      this.stats.errors++;
      Logger.error(
        `Error stopping StreamingJob: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  /**
   * Set up event handlers for streaming services
   */
  private setupEventHandlers(): void {
    if (!this.streamService || !this.signalService) return;

    // Stream events
    this.streamService.on('bar', () => {
      this.stats.barsReceived++;
    });

    this.streamService.on('connected', () => {
      Logger.success('WebSocket connected');
    });

    this.streamService.on('disconnected', () => {
      Logger.warn('WebSocket disconnected');
    });

    this.streamService.on('error', (error) => {
      this.stats.errors++;
      Logger.error(`WebSocket error: ${error.message}`);
    });

    // Signal events
    this.signalService.on('signal', () => {
      this.stats.signalsDetected++;
    });
  }

  /**
   * Handle agent trigger callback
   */
  private async handleAgentTrigger(
    agentName: AgentName,
    _signal: unknown,
    prompt: string
  ): Promise<void> {
    this.stats.agentsTriggered++;

    Logger.info(`Triggering ${agentName} agent for intraday opportunity`);

    try {
      // Use orchestrator to run a single agent session
      await this.orchestrator.runSingleAgent(agentName, prompt);
    } catch (error) {
      this.stats.errors++;
      Logger.error(
        `Failed to trigger ${agentName}: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  /**
   * Start watchlist synchronization interval
   */
  private startWatchlistSync(): void {
    this.watchlistSyncInterval = setInterval(() => {
      this.syncWatchlist();
    }, this.WATCHLIST_SYNC_INTERVAL);
  }

  /**
   * Stop watchlist synchronization interval
   */
  private stopWatchlistSync(): void {
    if (this.watchlistSyncInterval) {
      clearInterval(this.watchlistSyncInterval);
      this.watchlistSyncInterval = null;
    }
  }

  /**
   * Sync watchlist with current subscriptions
   */
  private syncWatchlist(): void {
    if (!this.streamService) return;

    // Clean up expired entries
    this.watchlistService.cleanupExpired();

    // Get current active symbols
    const activeSymbols = new Set(this.watchlistService.getActiveSymbols());
    const currentSubscriptions = new Set(this.streamService.getSubscriptions());

    // Find new symbols to subscribe
    const toSubscribe = [...activeSymbols].filter(
      (s) => !currentSubscriptions.has(s)
    );

    // Find symbols to unsubscribe
    const toUnsubscribe = [...currentSubscriptions].filter(
      (s) => !activeSymbols.has(s)
    );

    if (toSubscribe.length > 0) {
      Logger.info(`Subscribing to ${toSubscribe.length} new symbols`);
      this.streamService.subscribe(toSubscribe);
    }

    if (toUnsubscribe.length > 0) {
      Logger.info(`Unsubscribing from ${toUnsubscribe.length} symbols`);
      this.streamService.unsubscribe(toUnsubscribe);
    }
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      barsReceived: 0,
      signalsDetected: 0,
      agentsTriggered: 0,
      errors: 0,
    };
  }

  /**
   * Log final statistics
   */
  private logStats(): void {
    const duration = this.startedAt
      ? Math.round((Date.now() - this.startedAt.getTime()) / 1000 / 60)
      : 0;

    Logger.info('=== Streaming Session Summary ===');
    Logger.info(`Duration: ${duration} minutes`);
    Logger.info(`Bars received: ${this.stats.barsReceived}`);
    Logger.info(`Signals detected: ${this.stats.signalsDetected}`);
    Logger.info(`Agents triggered: ${this.stats.agentsTriggered}`);
    Logger.info(`Errors: ${this.stats.errors}`);
  }

  // ═══════════════════════════════════════════════════════
  // Status & Information
  // ═══════════════════════════════════════════════════════

  /**
   * Get current status
   */
  getStatus(): StreamingJobStatus {
    return this.status;
  }

  /**
   * Get detailed statistics
   */
  getStats(): StreamingJobStats {
    return {
      status: this.status,
      startedAt: this.startedAt,
      symbolsMonitored: this.streamService?.getSubscriptions().length ?? 0,
      ...this.stats,
    };
  }

  /**
   * Check if job is running
   */
  isRunning(): boolean {
    return this.status === 'running';
  }

  /**
   * Get watchlist summary
   */
  getWatchlistSummary(): {
    totalSymbols: number;
    bySource: Record<string, number>;
  } {
    const stats = this.watchlistService.getStats();
    return {
      totalSymbols: stats.totalActive,
      bySource: stats.bySource,
    };
  }

  /**
   * Manually add symbol to watchlist
   */
  addToWatchlist(
    symbol: string,
    reason: string,
    durationDays: number = 7
  ): void {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    this.watchlistService.add({
      symbol,
      addedBy: 'manual',
      reason,
      expiresAt,
    });

    // Subscribe immediately if streaming
    if (this.streamService && this.status === 'running') {
      this.streamService.subscribe([symbol]);
    }
  }

  /**
   * Manually remove symbol from watchlist
   */
  removeFromWatchlist(symbol: string): void {
    this.watchlistService.remove(symbol, 'manual');

    // Unsubscribe if no other sources are watching
    const allSources = this.watchlistService
      .getAll()
      .filter((e) => e.symbol.toUpperCase() === symbol.toUpperCase());

    if (allSources.length === 0 && this.streamService) {
      this.streamService.unsubscribe([symbol]);
    }
  }
}
