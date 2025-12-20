/**
 * Memory Service Types
 * Interfaces for agent memory and collective insights
 */

export interface MemoryContext {
  symbol?: string;
  action?: string;
  price?: number;
  quantity?: number;
  rationale?: string;
  outcome?: 'success' | 'failure';
  error?: string;
  portfolioImpact?: string;
  executionTime?: number;
  [key: string]: unknown;
}

export interface InsightEvidence {
  agentName: string;
  memoryId?: number;
  tradeLogId?: number;
  confidence: number;
}

export interface MemoryStats {
  totalMemories: number;
  avgConfidence: number;
  totalUsage: number;
  successRate: number;
  memoryTypeBreakdown: Record<string, number>;
}

export interface StoreMemoryParams {
  agentName: string;
  memoryType: string;
  content: string;
  context?: MemoryContext;
  confidence?: number;
  tags?: string[];
}

export interface GetMemoriesOptions {
  memoryType?: string;
  minConfidence?: number;
  limit?: number;
  tags?: string[];
}

export interface GetInsightsOptions {
  insightType?: string;
  minConfidence?: number;
  minEvidenceCount?: number;
  limit?: number;
  tags?: string[];
  excludeAgent?: string;
}

export interface GenerateInsightsOptions {
  minAgents?: number;
  minConfidence?: number;
  lookbackDays?: number;
}
