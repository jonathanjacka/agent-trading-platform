/**
 * Agent Memory Manager
 * Handles individual agent memory operations
 */

import type {
  DatabaseService,
  AgentMemory,
  TradeLog,
} from '../database/index.js';
import type {
  MemoryContext,
  MemoryStats,
  GetMemoriesOptions,
} from './types.js';

export class AgentMemoryManager {
  constructor(private db: DatabaseService) {}

  /**
   * Store a new memory for an agent
   */
  store(
    agentName: string,
    memoryType: string,
    content: string,
    context?: MemoryContext,
    confidence: number = 0.5,
    tags: string[] = []
  ): number {
    const memoryId = this.db.createAgentMemory({
      agent_name: agentName,
      memory_type: memoryType,
      content,
      context: context ? JSON.stringify(context) : null,
      confidence,
      last_used_at: null,
      use_count: 0,
      success_count: 0,
      failure_count: 0,
      tags: tags.length > 0 ? JSON.stringify(tags) : null,
    });

    console.log(
      `[MemoryService] Stored memory #${memoryId} for ${agentName}: ${memoryType}`
    );
    return memoryId;
  }

  /**
   * Generate memory from a completed trade
   */
  generateFromTrade(tradeLog: TradeLog): number | null {
    // Only generate memories from actual trades (BUY/SELL), not HOLD or ERROR
    if (tradeLog.action === 'HOLD' || tradeLog.action === 'ERROR') {
      return null;
    }

    const memoryType = tradeLog.success ? 'successful_trade' : 'failed_trade';
    const context: MemoryContext = {
      symbol: tradeLog.symbol || undefined,
      action: tradeLog.action,
      price: tradeLog.price || undefined,
      quantity: tradeLog.quantity || undefined,
      rationale: tradeLog.rationale || undefined,
      outcome: tradeLog.success ? 'success' : 'failure',
      error: tradeLog.error_message || undefined,
      executionTime: tradeLog.execution_time_ms,
    };

    // Generate content based on success/failure
    const content = this.generateTradeContent(tradeLog);

    // Initial confidence based on success and execution time
    const baseConfidence = tradeLog.success ? 0.6 : 0.4;
    const timeBonus = tradeLog.execution_time_ms < 2000 ? 0.1 : 0;
    const confidence = Math.min(baseConfidence + timeBonus, 1.0);

    // Extract tags from context
    const tags = this.extractTradeTags(tradeLog);

    return this.store(
      tradeLog.trader_name,
      memoryType,
      content,
      context,
      confidence,
      tags
    );
  }

  /**
   * Generate content string from a trade log
   */
  private generateTradeContent(tradeLog: TradeLog): string {
    if (tradeLog.success) {
      return `Successfully ${tradeLog.action.toLowerCase()}ed ${tradeLog.quantity} shares of ${tradeLog.symbol} at $${tradeLog.price}. ${tradeLog.rationale || ''}`;
    }
    return `Failed to ${tradeLog.action.toLowerCase()} ${tradeLog.symbol}: ${tradeLog.error_message}. Original rationale: ${tradeLog.rationale || 'None'}`;
  }

  /**
   * Extract relevant tags from a trade log
   */
  private extractTradeTags(tradeLog: TradeLog): string[] {
    const tags: string[] = [tradeLog.action, tradeLog.symbol || 'unknown'];
    tags.push(tradeLog.success ? 'success' : 'failure');
    return tags;
  }

  /**
   * Get agent's memories with optional filters
   */
  getMemories(
    agentName: string,
    options: GetMemoriesOptions = {}
  ): AgentMemory[] {
    const memories = this.db.getAgentMemories(agentName, options);

    // Parse JSON fields
    return memories.map((memory) => ({
      ...memory,
      context: memory.context ? JSON.parse(memory.context) : undefined,
      tags: memory.tags ? JSON.parse(memory.tags) : undefined,
    }));
  }

  /**
   * Update memory confidence based on outcome
   */
  updateConfidence(
    memoryId: number,
    wasSuccessful: boolean,
    adjustmentFactor: number = 0.1
  ): void {
    const memory = this.db.getAgentMemory(memoryId);
    if (!memory) {
      console.error(`[MemoryService] Memory #${memoryId} not found`);
      return;
    }

    // Adjust confidence based on outcome
    const newConfidence = wasSuccessful
      ? Math.min(memory.confidence + adjustmentFactor, 1.0)
      : Math.max(memory.confidence - adjustmentFactor, 0.0);

    // Update memory
    this.db.updateAgentMemory(memoryId, { confidence: newConfidence });

    // Also increment usage stats
    this.db.incrementMemoryUsage(memoryId, wasSuccessful);

    console.log(
      `[MemoryService] Updated memory #${memoryId} confidence: ${memory.confidence.toFixed(2)} → ${newConfidence.toFixed(2)}`
    );
  }

  /**
   * Record memory usage (for tracking)
   */
  recordUsage(memoryId: number, wasSuccessful: boolean): void {
    this.db.incrementMemoryUsage(memoryId, wasSuccessful);
  }

  /**
   * Clean up old, low-confidence memories
   */
  cleanup(minConfidence: number = 0.3, minAge: number = 7): number {
    const deletedCount = this.db.cleanupLowConfidenceMemories(
      minConfidence,
      minAge
    );
    console.log(
      `[MemoryService] Cleaned up ${deletedCount} low-confidence memories`
    );
    return deletedCount;
  }

  /**
   * Get memory statistics for an agent
   */
  getStats(agentName: string): MemoryStats {
    const memories = this.db.getAgentMemories(agentName, { limit: 1000 });

    if (memories.length === 0) {
      return {
        totalMemories: 0,
        avgConfidence: 0,
        totalUsage: 0,
        successRate: 0,
        memoryTypeBreakdown: {},
      };
    }

    const totalUsage = memories.reduce((sum, m) => sum + m.use_count, 0);
    const totalSuccess = memories.reduce((sum, m) => sum + m.success_count, 0);
    const totalFailure = memories.reduce((sum, m) => sum + m.failure_count, 0);
    const avgConfidence =
      memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length;

    const memoryTypeBreakdown: Record<string, number> = {};
    memories.forEach((m) => {
      memoryTypeBreakdown[m.memory_type] =
        (memoryTypeBreakdown[m.memory_type] || 0) + 1;
    });

    return {
      totalMemories: memories.length,
      avgConfidence,
      totalUsage,
      successRate:
        totalUsage > 0 ? totalSuccess / (totalSuccess + totalFailure) : 0,
      memoryTypeBreakdown,
    };
  }
}
