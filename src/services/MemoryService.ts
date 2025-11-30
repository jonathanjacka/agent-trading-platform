import {
  DatabaseService,
  AgentMemory,
  CollectiveInsight,
  TradeLog,
} from './DatabaseService';

interface MemoryContext {
  symbol?: string;
  action?: string;
  price?: number;
  quantity?: number;
  rationale?: string;
  outcome?: 'success' | 'failure';
  error?: string;
  portfolioImpact?: string;
  [key: string]: any;
}

interface InsightEvidence {
  agentName: string;
  memoryId?: number;
  tradeLogId?: number;
  confidence: number;
}

export class MemoryService {
  private static instance: MemoryService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /**
   * Store a new memory for an agent
   */
  public storeMemory(
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
      context: context ? JSON.stringify(context) : undefined,
      confidence,
      last_used_at: undefined,
      use_count: 0,
      success_count: 0,
      failure_count: 0,
      tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
    });

    console.log(
      `[MemoryService] Stored memory #${memoryId} for ${agentName}: ${memoryType}`
    );
    return memoryId;
  }

  /**
   * Generate memory from a completed trade
   */
  public generateMemoryFromTrade(tradeLog: TradeLog): number | null {
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
    let content: string;
    if (tradeLog.success) {
      content = `Successfully ${tradeLog.action.toLowerCase()}ed ${tradeLog.quantity} shares of ${tradeLog.symbol} at $${tradeLog.price}. ${tradeLog.rationale || ''}`;
    } else {
      content = `Failed to ${tradeLog.action.toLowerCase()} ${tradeLog.symbol}: ${tradeLog.error_message}. Original rationale: ${tradeLog.rationale || 'None'}`;
    }

    // Initial confidence based on success and execution time
    const baseConfidence = tradeLog.success ? 0.6 : 0.4;
    const timeBonus = tradeLog.execution_time_ms < 2000 ? 0.1 : 0; // Bonus for fast execution
    const confidence = Math.min(baseConfidence + timeBonus, 1.0);

    // Extract tags from context
    const tags: string[] = [tradeLog.action, tradeLog.symbol || 'unknown'];
    if (tradeLog.success) {
      tags.push('success');
    } else {
      tags.push('failure');
    }

    return this.storeMemory(
      tradeLog.trader_name,
      memoryType,
      content,
      context,
      confidence,
      tags
    );
  }

  /**
   * Get agent's memories with optional filters
   */
  public getAgentMemories(
    agentName: string,
    options: {
      memoryType?: string;
      minConfidence?: number;
      limit?: number;
      tags?: string[];
    } = {}
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
   * Get collective insights from other agents
   */
  public getCollectiveInsights(
    options: {
      insightType?: string;
      minConfidence?: number;
      minEvidenceCount?: number;
      limit?: number;
      tags?: string[];
      excludeAgent?: string;
    } = {}
  ): CollectiveInsight[] {
    const insights = this.db.getCollectiveInsights(options);

    // Parse JSON fields
    return insights.map((insight) => ({
      ...insight,
      contributing_agents: JSON.parse(insight.contributing_agents),
      tags: insight.tags ? JSON.parse(insight.tags) : undefined,
    }));
  }

  /**
   * Update memory confidence based on outcome
   */
  public updateMemoryConfidence(
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
    let newConfidence: number;
    if (wasSuccessful) {
      newConfidence = Math.min(memory.confidence + adjustmentFactor, 1.0);
    } else {
      newConfidence = Math.max(memory.confidence - adjustmentFactor, 0.0);
    }

    // Update memory
    this.db.updateAgentMemory(memoryId, {
      confidence: newConfidence,
    });

    // Also increment usage stats
    this.db.incrementMemoryUsage(memoryId, wasSuccessful);

    console.log(
      `[MemoryService] Updated memory #${memoryId} confidence: ${memory.confidence.toFixed(2)} → ${newConfidence.toFixed(2)}`
    );
  }

  /**
   * Record memory usage (for tracking)
   */
  public recordMemoryUsage(memoryId: number, wasSuccessful: boolean): void {
    this.db.incrementMemoryUsage(memoryId, wasSuccessful);
  }

  /**
   * Create or update a collective insight
   */
  public storeCollectiveInsight(
    insightType: string,
    content: string,
    evidence: InsightEvidence[],
    tags: string[] = []
  ): number {
    // Calculate confidence as weighted average of evidence
    const totalConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0);
    const confidence =
      evidence.length > 0 ? totalConfidence / evidence.length : 0.5;

    // Extract contributing agents
    const contributingAgents = [...new Set(evidence.map((e) => e.agentName))];

    const insightId = this.db.createCollectiveInsight({
      insight_type: insightType,
      content,
      contributing_agents: JSON.stringify(contributingAgents),
      confidence,
      evidence_count: evidence.length,
      tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
    });

    console.log(
      `[MemoryService] Created collective insight #${insightId}: ${insightType} (${evidence.length} evidence, ${contributingAgents.length} agents)`
    );

    return insightId;
  }

  /**
   * Generate collective insights from recent agent memories
   * This should be run periodically (e.g., daily) to analyze patterns
   */
  public async generateCollectiveInsights(
    options: {
      minAgents?: number;
      minConfidence?: number;
      lookbackDays?: number;
    } = {}
  ): Promise<number> {
    const { minAgents = 2, minConfidence = 0.6, lookbackDays = 7 } = options;

    console.log('[MemoryService] Generating collective insights...');

    // Get all recent successful trades from all agents
    const allTradeLogs = this.db.getAllTradeLogs(1000); // Get more for analysis
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - lookbackDays);

    const recentTrades = allTradeLogs.filter(
      (log) =>
        log.success &&
        new Date(log.timestamp) >= recentDate &&
        (log.action === 'BUY' || log.action === 'SELL')
    );

    console.log(
      `[MemoryService] Analyzing ${recentTrades.length} recent successful trades`
    );

    // Pattern 1: Popular stocks (bought by multiple agents)
    const symbolCounts = new Map<string, Set<string>>();
    recentTrades.forEach((trade) => {
      if (!trade.symbol) return;
      if (!symbolCounts.has(trade.symbol)) {
        symbolCounts.set(trade.symbol, new Set());
      }
      symbolCounts.get(trade.symbol)!.add(trade.trader_name);
    });

    let insightsCreated = 0;

    // Create insights for popular stocks
    symbolCounts.forEach((agents, symbol) => {
      if (agents.size >= minAgents) {
        const content = `Multiple agents (${agents.size}) successfully traded ${symbol} recently, indicating potential opportunity or consensus.`;
        const evidence: InsightEvidence[] = Array.from(agents).map(
          (agentName) => ({
            agentName,
            confidence: 0.7,
          })
        );

        this.storeCollectiveInsight('popular_stock', content, evidence, [
          symbol,
          'consensus',
        ]);
        insightsCreated++;
      }
    });

    // Pattern 2: Common failure patterns
    const allFailedTrades = allTradeLogs.filter(
      (log) =>
        !log.success &&
        new Date(log.timestamp) >= recentDate &&
        log.error_message
    );

    const errorPatterns = new Map<string, Set<string>>();
    allFailedTrades.forEach((trade) => {
      if (!trade.error_message) return;
      // Extract error pattern (simplified)
      const errorKey = trade.error_message.split(':')[0] || trade.error_message;
      if (!errorPatterns.has(errorKey)) {
        errorPatterns.set(errorKey, new Set());
      }
      errorPatterns.get(errorKey)!.add(trade.trader_name);
    });

    // Create insights for common errors
    errorPatterns.forEach((agents, errorPattern) => {
      if (agents.size >= minAgents) {
        const content = `Multiple agents (${agents.size}) encountered similar error: "${errorPattern}". Consider investigating common cause.`;
        const evidence: InsightEvidence[] = Array.from(agents).map(
          (agentName) => ({
            agentName,
            confidence: 0.8,
          })
        );

        this.storeCollectiveInsight('common_error', content, evidence, [
          'error',
          'warning',
        ]);
        insightsCreated++;
      }
    });

    console.log(
      `[MemoryService] Generated ${insightsCreated} collective insights`
    );
    return insightsCreated;
  }

  /**
   * Clean up old, low-confidence memories
   */
  public cleanupOldMemories(
    minConfidence: number = 0.3,
    minAge: number = 7
  ): number {
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
  public getMemoryStats(agentName: string): {
    totalMemories: number;
    avgConfidence: number;
    totalUsage: number;
    successRate: number;
    memoryTypeBreakdown: Record<string, number>;
  } {
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
