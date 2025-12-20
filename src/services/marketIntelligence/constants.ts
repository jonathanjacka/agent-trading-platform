/**
 * Constants for Market Intelligence Service
 * Single source of truth for all configurable values
 */

// ═══════════════════════════════════════════════════════
// CACHE SETTINGS
// ═══════════════════════════════════════════════════════

/** Default cache TTL in milliseconds (5 minutes) */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

// ═══════════════════════════════════════════════════════
// MARKET HOURS (US Eastern Time)
// ═══════════════════════════════════════════════════════

/** Pre-market starts at 4:00 AM ET */
export const PRE_MARKET_START_MINUTES = 4 * 60;

/** Regular market opens at 9:30 AM ET */
export const MARKET_OPEN_MINUTES = 9 * 60 + 30;

/** Regular market closes at 4:00 PM ET */
export const MARKET_CLOSE_MINUTES = 16 * 60;

/** After-hours trading ends at 8:00 PM ET */
export const AFTER_HOURS_END_MINUTES = 20 * 60;

/** Timezone for market hours */
export const MARKET_TIMEZONE = 'America/New_York';

// ═══════════════════════════════════════════════════════
// MARKET STATUS VALUES
// ═══════════════════════════════════════════════════════

export const MARKET_STATUS = {
  PRE_MARKET: 'pre-market',
  OPEN: 'open',
  AFTER_HOURS: 'after-hours',
  CLOSED: 'closed',
} as const;

export type MarketStatusValue =
  (typeof MARKET_STATUS)[keyof typeof MARKET_STATUS];

// ═══════════════════════════════════════════════════════
// SENTIMENT VALUES
// ═══════════════════════════════════════════════════════

export const SENTIMENT = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  NEUTRAL: 'neutral',
} as const;

export type SentimentValue = (typeof SENTIMENT)[keyof typeof SENTIMENT];

// ═══════════════════════════════════════════════════════
// VOLATILITY VALUES
// ═══════════════════════════════════════════════════════

export const VOLATILITY = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
} as const;

export type VolatilityValue = (typeof VOLATILITY)[keyof typeof VOLATILITY];

// ═══════════════════════════════════════════════════════
// DISCOVERY SOURCE VALUES
// ═══════════════════════════════════════════════════════

export const DISCOVERY_SOURCE = {
  NEWS: 'news',
  TRENDING: 'trending',
  THEME: 'theme',
  MOVER: 'mover',
} as const;

export type DiscoverySourceValue =
  (typeof DISCOVERY_SOURCE)[keyof typeof DISCOVERY_SOURCE];

// ═══════════════════════════════════════════════════════
// TICKER EXTRACTION
// ═══════════════════════════════════════════════════════

/** Regex pattern to extract ticker symbols from text */
export const TICKER_PATTERN =
  /\b([A-Z]{1,5})\b|\$([A-Z]{1,5})\b|\(([A-Z]{1,5})\)/g;

/** Pattern to match ticker with percentage: "NVDA +5.2%" */
export const TICKER_WITH_PERCENT_PATTERN =
  /\b([A-Z]{1,5})\b.*?([+-]?\d+\.?\d*)%/g;

/** Common words that look like tickers but aren't */
export const FALSE_POSITIVE_TICKERS = [
  // Common abbreviations
  'CEO',
  'CFO',
  'COO',
  'CTO',
  'IPO',
  'ETF',
  'NYSE',
  'SEC',
  'FDA',
  'GDP',
  'CPI',
  'FED',
  // Countries/regions
  'USA',
  'UK',
  'EU',
  'US',
  'UAE',
  // Common words
  'THE',
  'AND',
  'FOR',
  'ARE',
  'THIS',
  'WITH',
  'FROM',
  'THAT',
  'HAVE',
  'BEEN',
  'WILL',
  'MORE',
  'THAN',
  'YEAR',
  'NEW',
  'ALL',
  'CAN',
  'HAS',
  'ITS',
  'MAY',
  'NOW',
  'OUT',
  'WAY',
  // Tech terms that look like tickers
  'AI',
  'API',
  'CEO',
  'USB',
  'RAM',
  'CPU',
  'GPU',
  'SSD',
  'LED',
  'LCD',
  'IOT',
  'EV',
];

// ═══════════════════════════════════════════════════════
// SENTIMENT ANALYSIS
// ═══════════════════════════════════════════════════════

/** Words indicating bullish market sentiment */
export const BULLISH_WORDS = [
  'surge',
  'rally',
  'gain',
  'gains',
  'rise',
  'rises',
  'rising',
  'jump',
  'jumps',
  'soar',
  'soars',
  'record',
  'high',
  'highs',
  'bull',
  'bullish',
  'boom',
  'breakout',
  'momentum',
  'growth',
  'optimism',
  'positive',
  'up',
  'higher',
];

/** Words indicating bearish market sentiment */
export const BEARISH_WORDS = [
  'drop',
  'drops',
  'fall',
  'falls',
  'falling',
  'crash',
  'crashes',
  'plunge',
  'plunges',
  'decline',
  'declines',
  'sell-off',
  'selloff',
  'fear',
  'fears',
  'bear',
  'bearish',
  'low',
  'lows',
  'slump',
  'slide',
  'tumble',
  'down',
  'lower',
  'loss',
  'losses',
  'negative',
  'concern',
  'concerns',
  'recession',
  'correction',
];

/** Words indicating high market volatility */
export const VOLATILITY_WORDS = [
  'volatile',
  'volatility',
  'swing',
  'swings',
  'uncertainty',
  'uncertain',
  'vix',
  'turbulent',
  'turbulence',
  'unpredictable',
  'wild',
  'erratic',
  'choppy',
  'whipsaw',
];

// ═══════════════════════════════════════════════════════
// SEARCH QUERIES
// ═══════════════════════════════════════════════════════

/** Query for fetching general market conditions */
export const MARKET_CONDITIONS_QUERY = 'stock market today S&P 500';

/** Query for breaking market news */
export const BREAKING_NEWS_QUERY = 'stock market breaking news';

/** Query for top gainers */
export const GAINERS_QUERY = 'stocks biggest gainers today';

/** Query for top losers */
export const LOSERS_QUERY = 'stocks biggest losers today';

/** Queries for discovering trending stocks */
export const TRENDING_QUERIES = [
  'trending stocks today',
  'most active stocks',
  'stocks making moves',
];

/** Template for theme-based stock discovery */
export const THEME_SEARCH_TEMPLATE = (theme: string) =>
  `best ${theme} stocks to buy 2025`;

// ═══════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════

/** Default number of results to fetch */
export const DEFAULT_RESULT_LIMIT = 10;

/** Default number of movers to return */
export const DEFAULT_MOVERS_LIMIT = 5;

/** Default number of news articles to fetch */
export const DEFAULT_NEWS_COUNT = 5;

/** Maximum headlines to store per ticker for context */
export const MAX_HEADLINES_PER_TICKER = 2;

// ═══════════════════════════════════════════════════════
// DISPLAY FORMATTING (Agent-optimized, no emojis)
// ═══════════════════════════════════════════════════════

export const DISPLAY = {
  SECTION_DIVIDER: '---',
  HEADER_TEMPLATE: (timestamp: string) =>
    `LIVE MARKET INTELLIGENCE (as of ${timestamp} ET)`,
  LABELS: {
    MARKET_STATUS: 'MARKET STATUS',
    SENTIMENT: 'Sentiment',
    VOLATILITY: 'Volatility',
    TRADING_RECOMMENDED: 'Trading Recommended',
    SUMMARY: 'Summary',
    TOP_GAINERS: 'TOP GAINERS TODAY',
    TOP_LOSERS: 'TOP LOSERS TODAY',
    TRENDING_STOCKS: 'TRENDING STOCKS',
    BREAKING_NEWS: 'BREAKING NEWS',
  },
  TRADING_RECOMMENDED_YES: 'YES',
  TRADING_RECOMMENDED_NO: 'NO - HIGH VOLATILITY',
};

// ═══════════════════════════════════════════════════════
// ERROR MESSAGES
// ═══════════════════════════════════════════════════════

export const ERRORS = {
  MARKET_DATA_UNAVAILABLE: 'Market data temporarily unavailable',
  UNABLE_TO_FETCH_SUMMARY: 'Unable to fetch market summary',
  TRENDING_IN_NEWS: 'Trending in financial news',
  EXTRACTED_FROM_TEXT: 'Extracted from text',
};
