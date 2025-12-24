/**
 * Common Zod schemas for agent tools
 * Centralized schema definitions to ensure consistency across agents
 */

import { z } from 'zod';

// ============================================================================
// Basic Field Schemas
// ============================================================================

/** Stock ticker symbol (e.g., AAPL, MSFT) */
export const symbolSchema = z
  .string()
  .describe('Stock ticker symbol (e.g., AAPL, MSFT)');

/** Positive limit for results */
export const limitSchema = z
  .number()
  .positive()
  .optional()
  .describe('Maximum number of results to return');

/** Confidence score between 0 and 1 */
export const confidenceSchema = z
  .number()
  .min(0)
  .max(1)
  .optional()
  .describe('Confidence score (0-1). Higher scores indicate more reliability.');

/** Trading rationale */
export const rationaleSchema = z
  .string()
  .describe('Reason for the action, aligned with trading strategy');

/** Quantity of shares */
export const quantitySchema = z
  .number()
  .positive()
  .describe('Number of shares');

/** Tags array for categorization */
export const tagsSchema = z
  .array(z.string())
  .optional()
  .describe('Optional tags for categorization');

// ============================================================================
// Tool Input Schemas
// ============================================================================

/** Empty input schema for tools with no parameters */
export const emptyInputSchema = z.object({});

/** Search news input schema */
export const searchNewsInputSchema = z.object({
  symbol: symbolSchema,
  limit: z
    .number()
    .optional()
    .default(5)
    .describe('Number of news articles to retrieve (default 5)'),
});

/** Web search input schema */
export const searchWebInputSchema = z.object({
  query: z
    .string()
    .describe(
      'The search query (e.g., "AI chip industry trends", "Federal Reserve interest rate policy")'
    ),
  count: z
    .number()
    .optional()
    .default(5)
    .describe('Number of results to retrieve (default 5)'),
  freshness: z
    .enum(['pd', 'pw', 'pm', 'py'])
    .optional()
    .describe(
      'Time filter: pd=past day, pw=past week, pm=past month, py=past year'
    ),
});

/** Company analysis input schema */
export const analyzeCompanyInputSchema = z.object({
  symbol: symbolSchema,
});

/** Stock discovery input schema */
export const discoverStocksInputSchema = z.object({
  mode: z
    .enum(['theme', 'trending'])
    .describe(
      'Discovery mode: "theme" for sector-based, "trending" for current news'
    ),
  theme: z
    .string()
    .optional()
    .describe(
      'Required if mode is "theme". The investment theme to search (e.g., "AI", "renewable energy", "healthcare")'
    ),
  limit: z
    .number()
    .positive()
    .optional()
    .describe('Maximum number of stocks to return. Defaults to 10.'),
});

/** Market movers input schema */
export const marketMoversInputSchema = z.object({
  type: z
    .enum(['gainers', 'losers', 'both'])
    .optional()
    .describe('Type of movers to retrieve. Defaults to "both".'),
  limit: z
    .number()
    .positive()
    .optional()
    .describe('Maximum number of stocks per category. Defaults to 5.'),
});

/** Buy/Sell stock input schema */
export const tradeInputSchema = z.object({
  symbol: symbolSchema,
  quantity: quantitySchema,
  rationale: rationaleSchema,
});

/** Review memories input schema */
export const reviewMemoriesInputSchema = z.object({
  memoryType: z
    .enum(['successful_trade', 'failed_trade', 'all'])
    .optional()
    .describe('Filter by memory type. Defaults to all if not specified.'),
  minConfidence: confidenceSchema,
  limit: z
    .number()
    .positive()
    .optional()
    .describe('Maximum number of memories to retrieve. Defaults to 10.'),
});

/** Review collective insights input schema */
export const reviewInsightsInputSchema = z.object({
  insightType: z
    .enum(['popular_stock', 'common_error', 'all'])
    .optional()
    .describe('Filter by insight type. Defaults to all.'),
  minConfidence: confidenceSchema,
  limit: z
    .number()
    .positive()
    .optional()
    .describe('Maximum number of insights to retrieve.'),
});

/** Record lesson input schema */
export const recordLessonInputSchema = z.object({
  content: z.string().describe('The insight or lesson you want to remember'),
  tags: tagsSchema.describe(
    'Optional tags to categorize this lesson (e.g., ["AAPL", "earnings"])'
  ),
});

// ============================================================================
// Risk Management Schemas
// ============================================================================

/** Position risk analysis input schema */
export const positionRiskInputSchema = z.object({
  symbol: symbolSchema.describe('Stock symbol to analyze risk for'),
});

/** Trade risk evaluation input schema */
export const evaluateTradeRiskInputSchema = z.object({
  tradeType: z.enum(['BUY', 'SELL']).describe('Type of trade to evaluate'),
  symbol: symbolSchema,
  quantity: quantitySchema,
  estimatedPrice: z
    .number()
    .positive()
    .describe('Estimated price per share for the trade'),
});

/** Position sizing recommendation input schema */
export const positionSizingInputSchema = z.object({
  symbol: symbolSchema.describe(
    'Stock symbol to get sizing recommendation for'
  ),
  estimatedPrice: z
    .number()
    .positive()
    .describe('Current or estimated price per share'),
  strategy: z
    .enum(['conservative', 'moderate', 'max_allowed'])
    .optional()
    .describe(
      'Sizing strategy: conservative (50% of capacity), moderate (75%, default), or max_allowed (100%)'
    ),
});

// ============================================================================
// Performance Analytics Schemas
// ============================================================================

/** Performance summary input schema */
export const performanceSummaryInputSchema = z.object({
  period: z
    .enum(['day', 'week', 'month', 'quarter', 'year', 'all_time'])
    .optional()
    .describe(
      'Time period for analysis. Defaults to all_time if not specified.'
    ),
  recentTradesLimit: z
    .number()
    .positive()
    .optional()
    .describe('Number of recent trades to include. Defaults to 10.'),
});

// ============================================================================
// Technical Analysis Schemas
// ============================================================================

/** Technical indicators input schema */
export const technicalIndicatorInputSchema = z.object({
  symbol: symbolSchema,
  indicators: z
    .array(z.enum(['SMA', 'EMA', 'RSI', 'MACD']))
    .describe('Technical indicators to retrieve (e.g., ["RSI", "SMA"])'),
  window: z
    .number()
    .positive()
    .optional()
    .describe('Period window for indicators (default: 14 for RSI, 20 for SMA/EMA)'),
});

/** Quote/snapshot input schema */
export const quoteInputSchema = z.object({
  symbol: symbolSchema.describe('Stock ticker symbol to get current quote for'),
});

/** Dividend history input schema */
export const dividendInputSchema = z.object({
  symbol: symbolSchema.describe('Stock ticker symbol to get dividend history for'),
  limit: z
    .number()
    .positive()
    .optional()
    .describe('Number of dividend records to retrieve (default: 10)'),
});

// ============================================================================
// Consultation Schemas
// ============================================================================

/** Consult expert (Claude) input schema */
export const consultExpertInputSchema = z.object({
  symbol: symbolSchema,
  action: z.enum(['BUY', 'SELL', 'HOLD']).describe('Proposed trading action'),
  quantity: z.number().positive().optional().describe('Number of shares'),
  price: z.number().positive().optional().describe('Estimated price per share'),
  reasoning: z.string().describe('Your reasoning for this trade decision'),
  concerns: z
    .string()
    .optional()
    .describe('Any concerns or uncertainties you have about this trade'),
});

/** Peer consensus input schema */
export const peerConsensusInputSchema = z.object({
  symbol: symbolSchema,
  action: z.enum(['BUY', 'SELL']).describe('Proposed trading action'),
  reasoning: z.string().describe('Brief explanation of why you want peer input'),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type SearchNewsInput = z.infer<typeof searchNewsInputSchema>;
export type SearchWebInput = z.infer<typeof searchWebInputSchema>;
export type AnalyzeCompanyInput = z.infer<typeof analyzeCompanyInputSchema>;
export type DiscoverStocksInput = z.infer<typeof discoverStocksInputSchema>;
export type MarketMoversInput = z.infer<typeof marketMoversInputSchema>;
export type TradeInput = z.infer<typeof tradeInputSchema>;
export type ReviewMemoriesInput = z.infer<typeof reviewMemoriesInputSchema>;
export type ReviewInsightsInput = z.infer<typeof reviewInsightsInputSchema>;
export type RecordLessonInput = z.infer<typeof recordLessonInputSchema>;
export type PositionRiskInput = z.infer<typeof positionRiskInputSchema>;
export type EvaluateTradeRiskInput = z.infer<
  typeof evaluateTradeRiskInputSchema
>;
export type PositionSizingInput = z.infer<typeof positionSizingInputSchema>;
export type PerformanceSummaryInput = z.infer<
  typeof performanceSummaryInputSchema
>;
export type TechnicalIndicatorInput = z.infer<
  typeof technicalIndicatorInputSchema
>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type DividendInput = z.infer<typeof dividendInputSchema>;
export type ConsultExpertInput = z.infer<typeof consultExpertInputSchema>;
export type PeerConsensusInput = z.infer<typeof peerConsensusInputSchema>;
