/**
 * Collective Insight Manager
 * Handles cross-agent insight generation and retrieval
 */

import type { DatabaseService, CollectiveInsight } from '../database/index.js';
import type {
  InsightEvidence,
  GetInsightsOptions,
  GenerateInsightsOptions,
} from './types.js';

export class CollectiveInsightManager {
  constructor(private db: DatabaseService) {}

  /**
   * Get collective insights with optional filters
   */
  getInsights(options: GetInsightsOptions = {}): CollectiveInsight[] {
    const insights = this.db.getCollectiveInsights(options);

    // Parse JSON fields
    return insights.map((insight) => ({
      ...insight,
      contributing_agents: JSON.parse(insight.contributing_agents),
      tags: insight.tags ? JSON.parse(insight.tags) : undefined,
    }));
  }

  /**
   * Create or update a collective insight
   */
  store(
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
      tags: tags.length > 0 ? JSON.stringify(tags) : null,
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
  async generate(options: GenerateInsightsOptions = {}): Promise<number> {
    const { minAgents = 2, minConfidence = 0.6, lookbackDays = 7 } = options;

    console.log('[MemoryService] Generating collective insights...');

    // Get all recent successful trades from all agents
    const allTradeLogs = this.db.getAllTradeLogs(1000);
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

    let insightsCreated = 0;

    // Pattern 1: Popular stocks (bought by multiple agents)
    insightsCreated += this.generatePopularStockInsights(
      recentTrades,
      minAgents
    );

    // Pattern 2: Common failure patterns
    insightsCreated += this.generateErrorPatternInsights(
      allTradeLogs,
      recentDate,
      minAgents
    );

    console.log(
      `[MemoryService] Generated ${insightsCreated} collective insights`
    );
    return insightsCreated;
  }

  /**
   * Generate insights for stocks traded by multiple agents
   */
  private generatePopularStockInsights(
    recentTrades: Array<{
      symbol: string | null;
      trader_name: string;
    }>,
    minAgents: number
  ): number {
    const symbolCounts = new Map<string, Set<string>>();

    recentTrades.forEach((trade) => {
      if (!trade.symbol) return;
      if (!symbolCounts.has(trade.symbol)) {
        symbolCounts.set(trade.symbol, new Set());
      }
      symbolCounts.get(trade.symbol)!.add(trade.trader_name);
    });

    let insightsCreated = 0;

    symbolCounts.forEach((agents, symbol) => {
      if (agents.size >= minAgents) {
        const content = `Multiple agents (${agents.size}) successfully traded ${symbol} recently, indicating potential opportunity or consensus.`;
        const evidence: InsightEvidence[] = Array.from(agents).map(
          (agentName) => ({
            agentName,
            confidence: 0.7,
          })
        );

        this.store('popular_stock', content, evidence, [symbol, 'consensus']);
        insightsCreated++;
      }
    });

    return insightsCreated;
  }

  /**
   * Generate insights for common error patterns across agents
   */
  private generateErrorPatternInsights(
    allTradeLogs: Array<{
      success: boolean;
      timestamp: string;
      error_message: string | null;
      trader_name: string;
    }>,
    recentDate: Date,
    minAgents: number
  ): number {
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

    let insightsCreated = 0;

    errorPatterns.forEach((agents, errorPattern) => {
      if (agents.size >= minAgents) {
        const content = `Multiple agents (${agents.size}) encountered similar error: "${errorPattern}". Consider investigating common cause.`;
        const evidence: InsightEvidence[] = Array.from(agents).map(
          (agentName) => ({
            agentName,
            confidence: 0.8,
          })
        );

        this.store('common_error', content, evidence, ['error', 'warning']);
        insightsCreated++;
      }
    });

    return insightsCreated;
  }
}
