/**
 * Constants for Performance Analytics Service
 * Single source of truth for analytics configuration
 */

// ═══════════════════════════════════════════════════════
// TIME PERIODS
// ═══════════════════════════════════════════════════════

export const TIME_PERIOD = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  ALL_TIME: 'all_time',
} as const;

export type TimePeriodValue = (typeof TIME_PERIOD)[keyof typeof TIME_PERIOD];

/** Days in each time period */
export const PERIOD_DAYS: Record<TimePeriodValue, number | null> = {
  [TIME_PERIOD.DAY]: 1,
  [TIME_PERIOD.WEEK]: 7,
  [TIME_PERIOD.MONTH]: 30,
  [TIME_PERIOD.QUARTER]: 90,
  [TIME_PERIOD.YEAR]: 365,
  [TIME_PERIOD.ALL_TIME]: null, // No limit
};

// ═══════════════════════════════════════════════════════
// PERFORMANCE THRESHOLDS
// ═══════════════════════════════════════════════════════

/** Win rate thresholds for classification */
export const WIN_RATE_THRESHOLDS = {
  EXCELLENT: 0.7, // 70%+
  GOOD: 0.55, // 55-70%
  AVERAGE: 0.45, // 45-55%
  POOR: 0, // Below 45%
} as const;

/** Drawdown severity thresholds */
export const DRAWDOWN_THRESHOLDS = {
  MINIMAL: 0.05, // < 5%
  MODERATE: 0.1, // 5-10%
  SIGNIFICANT: 0.2, // 10-20%
  SEVERE: 0.3, // > 20%
} as const;

/** Return classification thresholds (annualized) */
export const RETURN_THRESHOLDS = {
  EXCELLENT: 0.2, // 20%+ annual
  GOOD: 0.1, // 10-20%
  AVERAGE: 0.05, // 5-10%
  POOR: 0, // 0-5%
  NEGATIVE: -1, // Negative returns
} as const;

// ═══════════════════════════════════════════════════════
// DEFAULT LIMITS
// ═══════════════════════════════════════════════════════

/** Default number of recent trades to include */
export const DEFAULT_RECENT_TRADES_LIMIT = 10;

/** Default number of top/bottom symbols to show */
export const DEFAULT_SYMBOL_RANK_LIMIT = 5;

/** Minimum trades needed for meaningful statistics */
export const MIN_TRADES_FOR_STATS = 3;

/** Minimum data points for Sharpe ratio calculation */
export const MIN_DATA_POINTS_FOR_SHARPE = 10;

// ═══════════════════════════════════════════════════════
// SHARPE RATIO SETTINGS
// ═══════════════════════════════════════════════════════

/** Risk-free rate assumption (annual, e.g., T-bill rate) */
export const RISK_FREE_RATE = 0.05; // 5%

/** Trading days per year for annualization */
export const TRADING_DAYS_PER_YEAR = 252;
