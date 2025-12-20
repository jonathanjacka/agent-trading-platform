/**
 * Type definitions for Market Intelligence Service
 */

// Re-export constants that are commonly used with types
export {
  FALSE_POSITIVE_TICKERS,
  TICKER_PATTERN,
  MARKET_STATUS,
  SENTIMENT,
  VOLATILITY,
  DISCOVERY_SOURCE,
} from './constants.js';

// Import types from constants
import type {
  MarketStatusValue,
  SentimentValue,
  VolatilityValue,
  DiscoverySourceValue,
} from './constants.js';

export interface MarketConditions {
  timestamp: string;
  marketStatus: MarketStatusValue;
  tradingRecommended: boolean;
  summary: string;
  indices: {
    sp500?: { price: number; changePercent: number };
    nasdaq?: { price: number; changePercent: number };
    dow?: { price: number; changePercent: number };
  };
  sentiment: SentimentValue;
  volatility: VolatilityValue;
}

export interface DiscoveredStock {
  symbol: string;
  name: string;
  reason: string;
  source: DiscoverySourceValue;
  mentionCount?: number;
  priceChange?: number;
}

export interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume?: number;
  reason?: string;
}

export interface TradingContext {
  timestamp: string;
  conditions: MarketConditions;
  movers: {
    gainers: MarketMover[];
    losers: MarketMover[];
  };
  trendingStocks: DiscoveredStock[];
  newsHighlights: string[];
}

/** Re-export type aliases for convenience */
export type MarketStatus = MarketStatusValue;
export type Sentiment = SentimentValue;
export type Volatility = VolatilityValue;
export type DiscoverySource = DiscoverySourceValue;
