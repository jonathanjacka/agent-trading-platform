/**
 * Trading Orchestrator Service
 * Coordinates multi-agent trading sessions with memory and insights
 *
 * This service manages the execution of trading agents in sequence,
 * handles collective insights generation, and persists session results.
 *
 * Usage:
 *   const orchestrator = new TradingOrchestratorService(traders);
 *   const result = await orchestrator.runDailySession({ dryRun: true });
 */

import type { TraderAgent } from '../../agents/TraderAgent.js';
import type { SessionResult, SessionOptions, AgentResult } from './types.js';
import { DAILY_PROMPTS, DEFAULT_DELAY_BETWEEN_AGENTS_MS } from './constants.js';
import { AgentRunner } from './AgentRunner.js';
import { SessionNotifier } from './SessionNotifier.js';
import { generateSessionId, sleep } from './utils.js';
import { MemoryService } from '../memory/index.js';
import { DatabaseService } from '../database/index.js';
import { Logger } from '../../utils/logger.js';

// Re-export types for convenience
export * from './types.js';
export { DAILY_PROMPTS } from './constants.js';

export class TradingOrchestratorService {
  private memoryService: MemoryService;
  private db: DatabaseService;
  private agentRunner: AgentRunner;
  private notifier: SessionNotifier;

  constructor(private traders: Map<string, TraderAgent>) {
    this.memoryService = MemoryService.getInstance();
    this.db = DatabaseService.getInstance();
    this.agentRunner = new AgentRunner();
    this.notifier = new SessionNotifier();
  }

  /**
   * Run a complete trading session for all or selected agents
   */
  async runDailySession(
    options: SessionOptions = {},
    jobName: string = 'manual'
  ): Promise<SessionResult> {
    const {
      agents = Array.from(this.traders.keys()),
      delayBetweenAgentsMs = DEFAULT_DELAY_BETWEEN_AGENTS_MS,
      customPrompts = {},
      skipInsights = false,
      dryRun = false,
    } = options;

    const sessionId = generateSessionId();
    const startTime = new Date();
    const agentResults: AgentResult[] = [];
    const errors: string[] = [];

    // Log session start to database (unless dry run)
    if (!dryRun) {
      this.db.createSchedulerRun(sessionId, jobName);
    }

    Logger.section(`Trading Session ${sessionId}`);
    Logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    Logger.info(`Agents: ${agents.join(', ')}`);
    Logger.info(`Delay between agents: ${delayBetweenAgentsMs / 1000}s`);

    // Run each agent sequentially
    for (let i = 0; i < agents.length; i++) {
      const agentName = agents[i];
      const result = await this.executeAgent(agentName, customPrompts, dryRun);

      if (result) {
        agentResults.push(result);
        if (!result.success) {
          errors.push(`${agentName}: ${result.error}`);
        }
      } else {
        // Agent not found or no prompt
        const error = this.getAgentError(agentName);
        Logger.error(error);
        errors.push(error);
      }

      // Delay before next agent (except after last one)
      if (i < agents.length - 1 && !dryRun) {
        Logger.info(
          `Waiting ${delayBetweenAgentsMs / 1000}s before next agent...`
        );
        await sleep(delayBetweenAgentsMs);
      }
    }

    // Generate collective insights after all trades
    const collectiveInsightsGenerated = await this.generateInsights(
      skipInsights,
      dryRun,
      errors
    );

    const endTime = new Date();
    const sessionResult = this.buildSessionResult(
      sessionId,
      startTime,
      endTime,
      agentResults,
      collectiveInsightsGenerated,
      errors
    );

    // Persist and notify
    await this.finalizeSession(sessionId, sessionResult, dryRun);

    return sessionResult;
  }

  /**
   * Execute a single agent's trading session
   */
  private async executeAgent(
    agentName: string,
    customPrompts: Record<string, string>,
    dryRun: boolean
  ): Promise<AgentResult | null> {
    const trader = this.traders.get(agentName.toLowerCase());
    if (!trader) {
      return null;
    }

    const prompt =
      customPrompts[agentName] || DAILY_PROMPTS[agentName.toLowerCase()];
    if (!prompt) {
      return null;
    }

    return this.agentRunner.runAgent(trader, agentName, prompt, dryRun);
  }

  /**
   * Get appropriate error message for agent issues
   */
  private getAgentError(agentName: string): string {
    const trader = this.traders.get(agentName.toLowerCase());
    if (!trader) {
      return `Agent not found: ${agentName}`;
    }
    return `No prompt available for agent: ${agentName}`;
  }

  /**
   * Generate collective insights from agent memories
   */
  private async generateInsights(
    skipInsights: boolean,
    dryRun: boolean,
    errors: string[]
  ): Promise<number> {
    if (skipInsights || dryRun) {
      return 0;
    }

    Logger.info('Generating collective insights...');
    try {
      const count = await this.memoryService.generateCollectiveInsights();
      Logger.success(`Generated ${count} collective insights`);
      return count;
    } catch (error) {
      const errorMsg = `Failed to generate collective insights: ${error instanceof Error ? error.message : 'Unknown error'}`;
      Logger.error(errorMsg);
      errors.push(errorMsg);
      return 0;
    }
  }

  /**
   * Build the final session result object
   */
  private buildSessionResult(
    sessionId: string,
    startTime: Date,
    endTime: Date,
    agentResults: AgentResult[],
    collectiveInsightsGenerated: number,
    errors: string[]
  ): SessionResult {
    const successfulAgents = agentResults.filter((r) => r.success).length;
    const failedAgents = agentResults.filter((r) => !r.success).length;

    return {
      sessionId,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      agentResults,
      totalAgents: agentResults.length,
      successfulAgents,
      failedAgents,
      collectiveInsightsGenerated,
      errors,
    };
  }

  /**
   * Persist session to database and send notifications
   */
  private async finalizeSession(
    sessionId: string,
    result: SessionResult,
    dryRun: boolean
  ): Promise<void> {
    // Update database
    if (!dryRun) {
      this.db.updateSchedulerRun(sessionId, {
        status: result.failedAgents === 0 ? 'success' : 'failure',
        completedAt: result.endTime.toISOString(),
        totalAgents: result.totalAgents,
        successfulAgents: result.successfulAgents,
        failedAgents: result.failedAgents,
        collectiveInsightsGenerated: result.collectiveInsightsGenerated,
        durationMs: result.durationMs,
        errorMessage:
          result.errors.length > 0 ? result.errors.join('; ') : undefined,
        resultsJson: JSON.stringify(result),
      });
    }

    // Log summary
    Logger.section('Session Complete');
    Logger.info(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    Logger.info(
      `Agents: ${result.successfulAgents}/${result.totalAgents} successful`
    );
    if (result.collectiveInsightsGenerated > 0) {
      Logger.info(`Collective insights: ${result.collectiveInsightsGenerated}`);
    }
    if (result.errors.length > 0) {
      Logger.warn(`Errors: ${result.errors.length}`);
    }

    // Send notification
    await this.notifier.sendSessionNotification(result);
  }

  /**
   * Get list of available agent names
   */
  getAvailableAgents(): string[] {
    return Array.from(this.traders.keys());
  }

  /**
   * Get the default prompt for an agent
   */
  getDefaultPrompt(agentName: string): string | undefined {
    return DAILY_PROMPTS[agentName.toLowerCase()];
  }
}
