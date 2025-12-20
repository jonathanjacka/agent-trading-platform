/**
 * Memory Service
 * Manages agent memories and collective insights for learning
 *
 * This service provides a unified interface for:
 * - Storing and retrieving individual agent memories
 * - Generating memories from trade outcomes
 * - Creating and querying collective insights across agents
 * - Memory confidence tracking and cleanup
 *
 * Usage:
 *   const memoryService = MemoryService.getInstance();
 *   memoryService.storeMemory('agent', 'lesson', 'content');
 *   const insights = memoryService.getCollectiveInsights({ minConfidence: 0.7 });
 */

import {
  DatabaseService,
  AgentMemory,
  CollectiveInsight,
  TradeLog,
} from '../database/index.js';
import { AgentMemoryManager } from './AgentMemoryManager.js';
import { CollectiveInsightManager } from './CollectiveInsightManager.js';
import type {
  MemoryContext,
  MemoryStats,
  InsightEvidence,
  GetMemoriesOptions,
  GetInsightsOptions,
  GenerateInsightsOptions,
} from './types.js';

// Re-export types for convenience
export * from './types.js';
export type { AgentMemory, CollectiveInsight, TradeLog };

export class MemoryService {
  private static instance: MemoryService;
  private db: DatabaseService;
  private memoryManager: AgentMemoryManager;
  private insightManager: CollectiveInsightManager;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.memoryManager = new AgentMemoryManager(this.db);
    this.insightManager = new CollectiveInsightManager(this.db);
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  // ============================================
  // Agent Memory Operations
  // ============================================

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
    return this.memoryManager.store(
      agentName,
      memoryType,
      content,
      context,
      confidence,
      tags
    );
  }

  /**
   * Generate memory from a completed trade
   */
  public generateMemoryFromTrade(tradeLog: TradeLog): number | null {
    return this.memoryManager.generateFromTrade(tradeLog);
  }

  /**
   * Get agent's memories with optional filters
   */
  public getAgentMemories(
    agentName: string,
    options: GetMemoriesOptions = {}
  ): AgentMemory[] {
    return this.memoryManager.getMemories(agentName, options);
  }

  /**
   * Update memory confidence based on outcome
   */
  public updateMemoryConfidence(
    memoryId: number,
    wasSuccessful: boolean,
    adjustmentFactor: number = 0.1
  ): void {
    this.memoryManager.updateConfidence(
      memoryId,
      wasSuccessful,
      adjustmentFactor
    );
  }

  /**
   * Record memory usage (for tracking)
   */
  public recordMemoryUsage(memoryId: number, wasSuccessful: boolean): void {
    this.memoryManager.recordUsage(memoryId, wasSuccessful);
  }

  /**
   * Clean up old, low-confidence memories
   */
  public cleanupOldMemories(
    minConfidence: number = 0.3,
    minAge: number = 7
  ): number {
    return this.memoryManager.cleanup(minConfidence, minAge);
  }

  /**
   * Get memory statistics for an agent
   */
  public getMemoryStats(agentName: string): MemoryStats {
    return this.memoryManager.getStats(agentName);
  }

  // ============================================
  // Collective Insight Operations
  // ============================================

  /**
   * Get collective insights from other agents
   */
  public getCollectiveInsights(
    options: GetInsightsOptions = {}
  ): CollectiveInsight[] {
    return this.insightManager.getInsights(options);
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
    return this.insightManager.store(insightType, content, evidence, tags);
  }

  /**
   * Generate collective insights from recent agent memories
   * This should be run periodically (e.g., daily) to analyze patterns
   */
  public async generateCollectiveInsights(
    options: GenerateInsightsOptions = {}
  ): Promise<number> {
    return this.insightManager.generate(options);
  }
}
