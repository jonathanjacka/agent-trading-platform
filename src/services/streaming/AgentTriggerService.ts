/**
 * Agent Trigger Service
 * Routes trading signals to appropriate agents with cost controls
 */

import { Logger } from '../../utils/logger.js';
import { DatabaseService } from '../database/index.js';
import { SignalDetectionService } from './SignalDetectionService.js';
import { DEFAULT_AGENT_CONFIGS } from './types.js';
import type {
  TradingSignal,
  AgentTriggerConfig,
  AgentTriggerState,
  TriggerDecision,
} from './types.js';
import type { AgentName } from '../consensus/types.js';

/** Callback type for when an agent should be triggered */
export type AgentTriggerCallback = (
  agentName: AgentName,
  signal: TradingSignal,
  prompt: string
) => Promise<void>;

export class AgentTriggerService {
  private configs: Record<AgentName, AgentTriggerConfig>;
  private states: Map<AgentName, AgentTriggerState> = new Map();
  private db: DatabaseService;
  private signalService: SignalDetectionService;
  private triggerCallback: AgentTriggerCallback | null = null;

  // Statistics
  private stats = {
    signalsReceived: 0,
    signalsFiltered: 0,
    agentsTriggered: 0,
    triggersByAgent: {} as Record<AgentName, number>,
  };

  constructor(
    signalService: SignalDetectionService,
    configs: Partial<Record<AgentName, Partial<AgentTriggerConfig>>> = {}
  ) {
    this.signalService = signalService;
    this.db = DatabaseService.getInstance();

    // Merge provided configs with defaults
    this.configs = {
      leonardo: { ...DEFAULT_AGENT_CONFIGS.leonardo, ...configs.leonardo },
      michelangelo: {
        ...DEFAULT_AGENT_CONFIGS.michelangelo,
        ...configs.michelangelo,
      },
      raphael: { ...DEFAULT_AGENT_CONFIGS.raphael, ...configs.raphael },
      donatello: { ...DEFAULT_AGENT_CONFIGS.donatello, ...configs.donatello },
    };

    // Initialize states for all agents
    this.initializeStates();

    // Listen for signals
    this.signalService.on('signal', (signal) => this.handleSignal(signal));

    Logger.info('AgentTriggerService initialized');
  }

  /**
   * Set the callback for when an agent should be triggered
   */
  setTriggerCallback(callback: AgentTriggerCallback): void {
    this.triggerCallback = callback;
  }

  /**
   * Initialize agent states
   */
  private initializeStates(): void {
    const today = this.getDateString();

    for (const agentName of Object.keys(this.configs) as AgentName[]) {
      this.states.set(agentName, {
        agentName,
        lastTrigger: null,
        dailyTriggerCount: 0,
        lastResetDate: today,
      });
      this.stats.triggersByAgent[agentName] = 0;
    }
  }

  /**
   * Handle incoming trading signal
   */
  private async handleSignal(signal: TradingSignal): Promise<void> {
    this.stats.signalsReceived++;

    Logger.info(
      `Processing signal: ${signal.type} for ${signal.symbol} -> targets: ${signal.targetAgents.join(', ')}`
    );

    // Check each target agent
    for (const agentName of signal.targetAgents) {
      const decision = this.canTrigger(agentName, signal);

      // Log to database
      this.logSignalDecision(signal, agentName, decision);

      if (decision.allowed) {
        await this.triggerAgent(agentName, signal);
      } else {
        Logger.info(`Skipping ${agentName}: ${decision.reason}`);
        this.stats.signalsFiltered++;
      }
    }
  }

  /**
   * Check if an agent can be triggered
   */
  canTrigger(agentName: AgentName, signal: TradingSignal): TriggerDecision {
    const config = this.configs[agentName];
    const state = this.states.get(agentName);

    if (!state) {
      return {
        allowed: false,
        reason: 'Agent state not found',
        agentName,
        signal,
      };
    }

    // Reset daily counts if new day
    this.checkDailyReset(state);

    // Check 1: Confidence threshold
    if (signal.confidence < config.minimumConfidence) {
      return {
        allowed: false,
        reason: `Confidence ${signal.confidence.toFixed(2)} < minimum ${config.minimumConfidence}`,
        agentName,
        signal,
      };
    }

    // Check 2: Cooldown period
    if (state.lastTrigger) {
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - state.lastTrigger.getTime();

      if (timeSinceLastTrigger < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastTrigger;
        const remainingMins = Math.ceil(remainingMs / 60000);
        return {
          allowed: false,
          reason: `Cooldown: ${remainingMins} minutes remaining`,
          agentName,
          signal,
        };
      }
    }

    // Check 3: Daily limit
    if (state.dailyTriggerCount >= config.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit reached: ${state.dailyTriggerCount}/${config.dailyLimit}`,
        agentName,
        signal,
      };
    }

    return {
      allowed: true,
      reason: 'All checks passed',
      agentName,
      signal,
    };
  }

  /**
   * Trigger an agent with signal context
   */
  private async triggerAgent(
    agentName: AgentName,
    signal: TradingSignal
  ): Promise<void> {
    const state = this.states.get(agentName);
    if (!state) return;

    // Update state
    state.lastTrigger = new Date();
    state.dailyTriggerCount++;

    // Update stats
    this.stats.agentsTriggered++;
    this.stats.triggersByAgent[agentName]++;

    // Build prompt for agent
    const prompt = this.buildAgentPrompt(agentName, signal);

    Logger.success(
      `Triggering ${agentName} for ${signal.symbol}: ${signal.type}`
    );

    // Call the callback if set
    if (this.triggerCallback) {
      try {
        await this.triggerCallback(agentName, signal, prompt);
      } catch (error) {
        Logger.error(
          `Failed to trigger ${agentName}: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }
  }

  /**
   * Build a prompt for the agent based on the signal
   */
  private buildAgentPrompt(agentName: AgentName, signal: TradingSignal): string {
    const agentDescriptions: Record<AgentName, string> = {
      leonardo: 'value investing - looking for undervalued companies',
      michelangelo: 'growth investing - momentum and high-growth opportunities',
      raphael: 'dividend investing - stable income-generating stocks',
      donatello: 'technical analysis - chart patterns and indicators',
    };

    return `
=== INTRADAY OPPORTUNITY ALERT ===

Signal Type: ${signal.type.replace('_', ' ').toUpperCase()}
Symbol: ${signal.symbol}
Confidence: ${(signal.confidence * 100).toFixed(0)}%

${signal.reason}

Current Price: $${signal.data.price.toFixed(2)}
Price Change: ${signal.data.priceChangePercent >= 0 ? '+' : ''}${signal.data.priceChangePercent.toFixed(2)}%
Volume: ${signal.data.volume.toLocaleString()}${signal.data.volumeRatio ? ` (${signal.data.volumeRatio.toFixed(1)}x average)` : ''}

---

This signal matches your ${agentDescriptions[agentName]} strategy.

Please:
1. Check your current portfolio to see if you already hold ${signal.symbol}
2. Research ${signal.symbol} to validate this opportunity
3. Use your risk tools to evaluate if a trade is appropriate
4. Make a trading decision based on your strategy

Remember: You have full autonomy. Consider consulting your peers or the expert consultant if you're uncertain.
`.trim();
  }

  /**
   * Log signal decision to database
   */
  private logSignalDecision(
    signal: TradingSignal,
    agentName: AgentName,
    decision: TriggerDecision
  ): void {
    try {
      const db = this.db.getDatabase();
      const stmt = db.prepare(`
        INSERT INTO signal_history 
        (symbol, signal_type, confidence, target_agent, triggered, trigger_reason, data_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        signal.symbol,
        signal.type,
        signal.confidence,
        agentName,
        decision.allowed ? 1 : 0,
        decision.reason,
        JSON.stringify(signal.data)
      );
    } catch (error) {
      Logger.error(
        `Failed to log signal: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  /**
   * Check and reset daily counters if new day
   */
  private checkDailyReset(state: AgentTriggerState): void {
    const today = this.getDateString();

    if (state.lastResetDate !== today) {
      state.dailyTriggerCount = 0;
      state.lastResetDate = today;
      Logger.info(`Daily counters reset for ${state.agentName}`);
    }
  }

  /**
   * Get current date string (YYYY-MM-DD)
   */
  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get agent state
   */
  getAgentState(agentName: AgentName): AgentTriggerState | undefined {
    return this.states.get(agentName);
  }

  /**
   * Get all agent states
   */
  getAllAgentStates(): AgentTriggerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Update agent config
   */
  updateConfig(
    agentName: AgentName,
    updates: Partial<AgentTriggerConfig>
  ): void {
    this.configs[agentName] = { ...this.configs[agentName], ...updates };
    Logger.info(`Updated ${agentName} config`);
  }

  /**
   * Get agent config
   */
  getConfig(agentName: AgentName): AgentTriggerConfig {
    return { ...this.configs[agentName] };
  }

  /**
   * Reset all states (for testing)
   */
  resetStates(): void {
    this.initializeStates();
    this.stats = {
      signalsReceived: 0,
      signalsFiltered: 0,
      agentsTriggered: 0,
      triggersByAgent: {
        leonardo: 0,
        michelangelo: 0,
        raphael: 0,
        donatello: 0,
      },
    };
    Logger.info('AgentTriggerService states reset');
  }
}
