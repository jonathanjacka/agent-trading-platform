/**
 * Market Data Service Types
 * Shared type definitions for the market data module
 */

// ============================================================================
// Company Data Types
// ============================================================================

export interface CompanyDetails {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  marketCap: number;
  employees: number;
  homepage: string;
  exchange: string;
  active: boolean;
  listDate: string;
  phone: string;
  address: Record<string, unknown>;
}

export interface NewsArticle {
  title: string;
  description: string;
  author: string;
  publisher: string;
  publisherUrl: string;
  articleUrl: string;
  publishedDate: string;
  tickers: string[];
  imageUrl?: string;
  keywords?: string[];
  insights?: Array<{
    ticker: string;
    sentiment: string;
    sentiment_reasoning: string;
  }>;
}

// ============================================================================
// Price Data Types
// ============================================================================

export interface EstimatedPrice {
  symbol: string;
  estimatedPrice: number;
  marketCap: number;
  sharesOutstanding: number;
  note: string;
}

export interface PriceSnapshot {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  timestamp: string;
  note: string;
}

// ============================================================================
// Technical Indicator Types
// ============================================================================

export type IndicatorType = 'sma' | 'ema' | 'rsi' | 'macd';
export type Timespan = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface IndicatorOptions {
  window?: number;
  timespan?: Timespan;
  limit?: number;
}

export interface IndicatorResult {
  symbol: string;
  indicator: string;
  values: Array<{ timestamp: string; value: number }>;
  window?: number;
}

// ============================================================================
// Dividend Types
// ============================================================================

export interface Dividend {
  exDividendDate: string;
  payDate: string;
  cashAmount: number;
  frequency: string;
}

export interface DividendData {
  symbol: string;
  dividends: Dividend[];
  latestYield?: number;
}

// ============================================================================
// Ticker Search Types
// ============================================================================

export interface TickerSearchResult {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  type: string;
  active: boolean;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
