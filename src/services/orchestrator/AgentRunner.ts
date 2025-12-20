/**
 * Agent Runner
 * Handles execution of individual trading agents
 */

import type { TraderAgent } from '../../agents/TraderAgent.js';
import type { AgentResult } from './types.js';
import { Logger } from '../../utils/logger.js';

export class AgentRunner {
  /**
   * Execute a single agent's trading session
   */
  async runAgent(
    trader: TraderAgent,
    agentName: string,
    prompt: string,
    dryRun: boolean
  ): Promise<AgentResult> {
    const startTime = new Date();

    Logger.section(`${agentName}'s Trading Session`);

    if (dryRun) {
      Logger.info(
        `[DRY RUN] Would execute with prompt: ${prompt.substring(0, 100)}...`
      );
      const endTime = new Date();
      return {
        agentName,
        success: true,
        response: '[DRY RUN] No trade executed',
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    }

    try {
      const response = await trader.trade(prompt);
      const endTime = new Date();

      Logger.success(`${agentName} completed successfully`);

      return {
        agentName,
        success: true,
        response,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    } catch (error) {
      const endTime = new Date();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      Logger.error(`${agentName} failed: ${errorMessage}`);

      return {
        agentName,
        success: false,
        error: errorMessage,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    }
  }
}
